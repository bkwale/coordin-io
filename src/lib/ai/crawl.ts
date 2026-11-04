import { cached } from '@/lib/cache'

export interface CrawledPage {
  url: string
  text: string
  ms: number
}

const CANDIDATE_PATHS = [
  '/', '/about', '/about/', '/about-us', '/meist', '/büroo', '/buroo', '/studio',
  '/people', '/team', '/inimesed', '/tiim', '/meeskond',
  '/projects', '/projektid', '/tood', '/work', '/portfolio',
  '/contact', '/kontakt',
]

const CRAWL_TTL = 60 * 60 * 24 // 24h
const MAX_PAGE_CHARS = 14_000
const MAX_PAGES = 6
const UA = 'CoordinBot/0.1 (+https://www.coordin.io; practice-setup)'

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
    const res = await fetch(new URL('/robots.txt', base), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) })
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

async function fetchPage(url: URL): Promise<CrawledPage | null> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return null
    const text = stripHtml(await res.text()).slice(0, MAX_PAGE_CHARS)
    if (text.length < 200) return null
    return { url: url.toString(), text, ms: Date.now() - t0 }
  } catch {
    return null
  }
}

/** Crawl a practice website: home + likely about/people/projects pages. Cached 24h. */
export async function crawlPractice(input: string, onStage?: (s: { name: string; detail?: string; ms?: number }) => void): Promise<CrawledPage[]> {
  const base = normaliseUrl(input)
  const key = `ai:crawl:v1:${base.hostname}`
  return cached<CrawledPage[]>(key, async () => {
    const pages: CrawledPage[] = []
    const seen = new Set<string>()
    // Home first; also learn same-host nav links from it
    const home = await fetchPage(base)
    if (!home) return []
    pages.push(home)
    seen.add(home.text.slice(0, 500))
    onStage?.({ name: 'fetch', detail: base.hostname, ms: home.ms })

    const extra: string[] = []
    try {
      const html = await (await fetch(base, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12_000) })).text()
      for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
        try {
          const u = new URL(m[1], base)
          if (u.hostname === base.hostname && /about|meist|people|team|inimesed|tiim|projekt|project|work|kontakt|contact|studio|büroo|buroo/i.test(u.pathname)) {
            extra.push(u.pathname)
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const candidates = Array.from(new Set([...extra, ...CANDIDATE_PATHS])).filter((p) => p !== '/')
    for (const p of candidates) {
      if (pages.length >= MAX_PAGES) break
      if (!(await robotsAllows(base, p))) continue
      const page = await fetchPage(new URL(p, base))
      if (!page) continue
      const sig = page.text.slice(0, 500)
      if (seen.has(sig)) continue
      seen.add(sig)
      pages.push(page)
      onStage?.({ name: 'fetch', detail: p, ms: page.ms })
    }
    return pages
  }, CRAWL_TTL)
}
