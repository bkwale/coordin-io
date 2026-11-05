import { cached } from '@/lib/cache'

export interface CrawledPage {
  url: string
  text: string
  ms: number
  rendered?: boolean // true if obtained via headless renderer
}

export type CrawlFailure =
  | 'dns'            // host not found / connection refused
  | 'blocked'        // 403/429/503 after retry — bot protection or WAF
  | 'down'           // 5xx
  | 'redirect_loop'
  | 'js_app'         // HTML present, text absent, renderer unavailable/failed
  | 'not_html'       // PDF / image / app only
  | 'empty'          // nothing readable

export interface CrawlResult {
  pages: CrawledPage[]
  failure?: CrawlFailure
  detail?: string
}

export class CrawlError extends Error {
  constructor(public failure: CrawlFailure, message: string) { super(message); this.name = 'CrawlError' }
}

export const FAILURE_MESSAGE: Record<CrawlFailure, string> = {
  dns: 'We couldn’t reach that address — check the spelling, or the site may be offline.',
  blocked: 'That site blocks automated reading (bot protection). We can set up manually, or try another URL.',
  down: 'The site returned a server error. Try again in a minute, or set up manually.',
  redirect_loop: 'The site keeps redirecting to itself — a configuration issue on their side. Try the www. or non-www version.',
  js_app: 'That site is a JavaScript app and we couldn’t render it. We can set up manually, or try a different page on the site.',
  not_html: 'That address isn’t a web page we can read.',
  empty: 'The site returned no readable text. We can set up manually.',
}

const CANDIDATE_PATHS = [
  // about
  '/about', '/about/', '/about-us', '/studio', '/practice', '/meist', '/büroo', '/buroo', '/o-nas', '/pracownia', '/biuro',
  // people
  '/people', '/team', '/our-team', '/inimesed', '/tiim', '/meeskond', '/zespol', '/zespół', '/ludzie',
  // work
  '/projects', '/work', '/portfolio', '/projektid', '/tood', '/realizacje', '/projekty', '/prace',
  // contact
  '/contact', '/contact-us', '/kontakt',
]
const EXCLUDE_RE = /login|logout|signin|register|cart|checkout|privacy|privaatsus|cookie|küpsis|polityka|regulamin|search|otsing|szukaj|tag\/|category\/|feed|wp-json|\.(pdf|jpg|png|xml)$/i
const KEYWORD_RE = /about|meist|people|team|inimesed|tiim|projekt|project|work|kontakt|contact|studio|büroo|buroo|practice|o-nas|pracownia|biuro|zespol|zesp|ludzie|realizacje|prace|portfolio/i

const CRAWL_TTL = 60 * 60 * 24 // 24h
const MAX_PAGE_CHARS = 14_000
const MAX_PAGES = 6
const THIN_TEXT = 400       // chars — below this a page is "thin"
const THIN_HTML = 3_000     // bytes — above this with thin text = JS app
const MIN_TOTAL_TEXT = 900  // chars across all pages before we try rendering
const BOT_UA = 'CoordinBot/0.1 (+https://www.coordin.io; practice-setup)'
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const RENDER_API = process.env.RENDER_API_URL || 'https://r.jina.ai/'

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

/** Pull og:/meta description out of thin HTML so a JS app still yields something. */
function metaText(html: string): string {
  const out: string[] = []
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:title|og:description|description|og:site_name)["'][^>]+content=["']([^"']+)["']/gi)) out.push(m[2])
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](og:title|og:description|description|og:site_name)["']/gi)) out.push(m[1])
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  if (title) out.unshift(title)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) out.push(m[1].replace(/\s+/g, ' ').slice(0, 2000))
  return out.join('\n').trim()
}

/** Markdown from the renderer → plain text. */
function stripMarkdown(md: string): string {
  return md
    .replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:$/m, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`]+/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

export function normaliseUrl(input: string): URL {
  let s = input.trim()
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  const u = new URL(s)
  u.hash = ''
  u.search = ''
  return u
}

async function robotsAllows(base: URL, path: string): Promise<boolean> {
  try {
    const res = await fetch(new URL('/robots.txt', base), { headers: { 'user-agent': BOT_UA }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return true
    const txt = await res.text()
    let applies = false
    const disallowed: string[] = []
    for (const raw of txt.split('\n')) {
      const line = raw.split('#')[0].trim()
      if (/^user-agent:/i.test(line)) applies = /\*|coordin/i.test(line.split(':')[1] ?? '')
      else if (applies && /^disallow:/i.test(line)) disallowed.push((line.split(':')[1] ?? '').trim())
    }
    return !disallowed.some((d) => d && path.startsWith(d))
  } catch {
    return true
  }
}

interface FetchOutcome { page?: CrawledPage; html?: string; status?: number; failure?: CrawlFailure }

/** Follow redirects manually (max 6) so loops are detected and reported. */
async function fetchHtml(url: URL, ua: string): Promise<{ res?: Response; failure?: CrawlFailure; finalUrl: URL }> {
  let current = url
  const seen = new Set<string>()
  for (let hop = 0; hop < 6; hop++) {
    if (seen.has(current.toString())) return { failure: 'redirect_loop', finalUrl: current }
    seen.add(current.toString())
    let res: Response
    try {
      res = await fetch(current, { headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml' }, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
    } catch {
      return { failure: 'dns', finalUrl: current }
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { failure: 'redirect_loop', finalUrl: current }
      current = new URL(loc, current)
      continue
    }
    return { res, finalUrl: current }
  }
  return { failure: 'redirect_loop', finalUrl: current }
}

async function fetchPage(url: URL): Promise<FetchOutcome> {
  const t0 = Date.now()
  let { res, failure, finalUrl } = await fetchHtml(url, BOT_UA)
  if (failure) return { failure }
  if (res && (res.status === 403 || res.status === 429 || res.status === 503)) {
    // retry once as a browser — many WAFs only block unknown UAs
    ;({ res, failure, finalUrl } = await fetchHtml(url, BROWSER_UA))
    if (failure) return { failure }
    if (res && (res.status === 403 || res.status === 429)) return { status: res.status, failure: 'blocked' }
    if (res && res.status === 503) return { status: 503, failure: 'down' }
  }
  if (!res) return { failure: 'dns' }
  if (res.status >= 500) return { status: res.status, failure: 'down' }
  if (!res.ok) return { status: res.status }
  const ct = res.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml/.test(ct)) return { status: res.status, failure: 'not_html' }
  const html = await res.text()
  let text = stripHtml(html)
  if (text.length < THIN_TEXT) {
    const meta = metaText(html)
    if (meta) text = (text + '\n' + meta).trim()
  }
  text = text.slice(0, MAX_PAGE_CHARS)
  return { html, status: res.status, page: text.length >= 120 ? { url: finalUrl.toString(), text, ms: Date.now() - t0 } : undefined }
}

async function sitemapUrls(base: URL): Promise<string[]> {
  const out: string[] = []
  const seen = new Set<string>()
  async function read(u: URL, depth: number) {
    if (depth > 1) return
    try {
      const res = await fetch(u, { headers: { 'user-agent': BOT_UA }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) return
      const xml = await res.text()
      const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1])
      const isIndex = /<sitemapindex/i.test(xml)
      for (const l of locs) {
        if (isIndex) await read(new URL(l), depth + 1)
        else if (!seen.has(l)) { seen.add(l); out.push(l) }
      }
    } catch { /* ignore */ }
  }
  await read(new URL('/sitemap.xml', base), 0)
  if (!out.length) await read(new URL('/sitemap_index.xml', base), 0)
  return out
}

async function renderPage(url: string): Promise<CrawledPage | null> {
  const t0 = Date.now()
  try {
    const res = await fetch(RENDER_API + url, { headers: { 'user-agent': BOT_UA, accept: 'text/plain' }, signal: AbortSignal.timeout(40_000) })
    if (!res.ok) return null
    const text = stripMarkdown(await res.text()).slice(0, MAX_PAGE_CHARS)
    if (text.length < 200) return null
    return { url, text, ms: Date.now() - t0, rendered: true }
  } catch {
    return null
  }
}

type StageFn = (s: { name: string; detail?: string; ms?: number }) => void

/**
 * Crawl a practice website. Order: home → nav links + sitemap + known paths → (if thin) headless render.
 * Throws CrawlError with a specific failure class so the UI can say why.
 * Cached 24h per host.
 */
export async function crawlPractice(input: string, onStage?: StageFn): Promise<CrawledPage[]> {
  const base = normaliseUrl(input)
  const key = `ai:crawl:v2:${base.hostname}`
  const result = await cached<CrawlResult>(key, () => doCrawl(base, onStage), CRAWL_TTL)
  if (!result.pages.length) throw new CrawlError(result.failure ?? 'empty', FAILURE_MESSAGE[result.failure ?? 'empty'])
  if (!onStage) return result.pages
  // replay stages from cache so the UI still shows what happened
  return result.pages
}

async function doCrawl(base: URL, onStage?: StageFn): Promise<CrawlResult> {
  const pages: CrawledPage[] = []
  const seenSig = new Set<string>()
  const seenUrl = new Set<string>()
  const add = (p: CrawledPage) => {
    const sig = p.text.slice(0, 500)
    if (seenSig.has(sig) || seenUrl.has(p.url)) return false
    seenSig.add(sig); seenUrl.add(p.url); pages.push(p)
    onStage?.({ name: 'fetch', detail: p.rendered ? `${new URL(p.url).pathname} (rendered)` : new URL(p.url).pathname === '/' ? base.hostname : new URL(p.url).pathname, ms: p.ms })
    return true
  }

  // 1. Home — try https, then http, then toggle www
  const variants = [base, new URL(base.toString().replace(/^https:/, 'http:'))]
  const alt = new URL(base.toString()); alt.hostname = alt.hostname.startsWith('www.') ? alt.hostname.slice(4) : 'www.' + alt.hostname
  variants.push(alt)
  let home: FetchOutcome | null = null
  let lastFailure: CrawlFailure | undefined
  for (const v of variants) {
    const o = await fetchPage(v)
    if (o.page || o.html) { home = o; break }
    lastFailure = o.failure ?? lastFailure
  }
  if (!home) return { pages: [], failure: lastFailure ?? 'dns' }
  if (home.page) add(home.page)
  const homeHtml = home.html ?? ''
  const homeIsThin = (home.page?.text.length ?? 0) < THIN_TEXT && homeHtml.length > THIN_HTML

  // 2. Candidate subpages: nav links from home + sitemap + known paths
  const extra: string[] = []
  for (const m of homeHtml.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    try { const u = new URL(m[1], base); if (u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && KEYWORD_RE.test(u.pathname)) extra.push(u.pathname) } catch { /* ignore */ }
  }
  const fromSitemap = (await sitemapUrls(base)).filter((l) => KEYWORD_RE.test(l)).map((l) => { try { return new URL(l).pathname } catch { return '' } }).filter(Boolean)
  if (fromSitemap.length) onStage?.({ name: 'fetch', detail: `sitemap (${fromSitemap.length} relevant pages)` })
  const rank = (path: string) => /people|team|inimesed|tiim|meeskond|zespol|zesp|ludzie|our-team/i.test(path) ? 0
    : /about|meist|studio|practice|büroo|buroo|o-nas|pracownia|biuro/i.test(path) ? 1
    : /contact|kontakt/i.test(path) ? 2
    : /projects?$|projektid$|realizacje$|work$|portfolio$|all$/i.test(path) ? 3   // index pages before individual projects
    : 4
  const candidates = Array.from(new Set([...extra, ...fromSitemap, ...CANDIDATE_PATHS]))
    .filter((p) => p && p !== '/' && !EXCLUDE_RE.test(p))
    .sort((a, b) => rank(a) - rank(b) || a.length - b.length)

  let blockedCount = 0
  for (const p of candidates) {
    if (pages.length >= MAX_PAGES) break
    if (!(await robotsAllows(base, p))) continue
    const o = await fetchPage(new URL(p, base))
    if (o.failure === 'blocked') blockedCount++
    if (o.page) add(o.page)
  }

  // 3. Thin? Render.
  const totalText = pages.reduce((a, p) => a + p.text.length, 0)
  if (totalText < MIN_TOTAL_TEXT || homeIsThin) {
    onStage?.({ name: 'fetch', detail: 'JavaScript site — rendering in a browser' })
    const toRender = [base.toString(), ...candidates.slice(0, 3).map((p) => new URL(p, base).toString())]
    for (const u of toRender) {
      if (pages.filter((p) => p.rendered).length >= 3) break
      const r = await renderPage(u)
      if (r) add(r)
    }
  }

  if (!pages.length) {
    if (blockedCount > 0) return { pages, failure: 'blocked' }
    if (homeIsThin) return { pages, failure: 'js_app' }
    return { pages, failure: 'empty' }
  }
  return { pages }
}
