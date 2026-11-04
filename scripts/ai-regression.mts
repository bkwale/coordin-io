#!/usr/bin/env -S npx tsx --tsconfig scripts/tsconfig.scripts.json
/**
 * AI regression runner — runs the PRODUCTION practice-setup pipeline (crawl → Mistral → Zod → mapper)
 * against a list of real practice websites and writes one JSON per site to private/ai-samples/practice/.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ai-regression.mts            # all sites in scripts/regression-sites.txt
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ai-regression.mts salto.ee   # one site
 *   DIFF=1 ...   # compare against the previous snapshot and print field-level changes
 *
 * Needs MISTRAL_API_KEY in env (or .env.sprint0). No DB, no Redis.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// env
if (!process.env.MISTRAL_API_KEY && existsSync('.env.sprint0')) {
  for (const l of readFileSync('.env.sprint0', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] ??= l.slice(i + 1).replace(/^"|"$/g, '') }
}
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN // no cache in regression

const { crawlPractice, CrawlError } = await import('../src/lib/ai/crawl')
const { chat, parseJson } = await import('../src/lib/ai/providers')
const { PRACTICE_SETUP_SYSTEM, PRACTICE_SETUP_PROMPT_VERSION, practiceSetupUser } = await import('../src/lib/ai/prompts/practice-setup')
const { PracticeProfileSchema, normalisePracticeProfile } = await import('../src/lib/ai/schemas')
const { mapPracticeProfile, practiceConfidence } = await import('../src/lib/ai/map-practice')

const OUT = 'private/ai-samples/practice'
mkdirSync(OUT, { recursive: true })
const sites = process.argv.slice(2).length ? process.argv.slice(2) : readFileSync('scripts/regression-sites.txt', 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))

const summary: string[] = []
for (const site of sites) {
  const host = site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  const file = resolve(OUT, `${host}.mistral.json`)
  const t0 = Date.now()
  const stages: string[] = []
  try {
    const pages = await crawlPractice(site, (s) => stages.push(`${s.detail}${s.ms ? ` ${s.ms}ms` : ''}`))
    const words = pages.reduce((a, p) => a + p.text.split(/\s+/).length, 0)
    const res = await chat({ system: PRACTICE_SETUP_SYSTEM, user: practiceSetupUser(site, pages), json: true })
    const parsed = PracticeProfileSchema.safeParse(normalisePracticeProfile(parseJson(res.text)))
    if (!parsed.success) throw new Error('schema: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; '))
    const mapping = mapPracticeProfile(parsed.data)
    const out = {
      _meta: { url: site, pages: pages.map((p) => p.url), rendered: pages.filter((p) => p.rendered).length, words, model: `${res.provider}/${res.model}`, promptVersion: PRACTICE_SETUP_PROMPT_VERSION, runAt: new Date().toISOString(), latencyMs: Date.now() - t0, tokens: res.tokens, confidence: practiceConfidence(parsed.data), stages },
      profile: parsed.data,
      mapping,
    }
    if (process.env.DIFF && existsSync(file)) {
      const prev = JSON.parse(readFileSync(file, 'utf8'))
      const diffs = diffKeys(prev.profile ?? prev, out.profile)
      if (diffs.length) summary.push(`  Δ ${host}: ${diffs.slice(0, 6).join(', ')}${diffs.length > 6 ? ` +${diffs.length - 6}` : ''}`)
    }
    writeFileSync(file, JSON.stringify(out, null, 2))
    const h = mapping.headline
    summary.push(`OK   ${host.padEnd(24)} ${mapping.jurisdiction} ${String(h.teamSize).padStart(2)}p ${String(h.partners.length)}ptn ${String(mapping.municipalityProfiles.length).padStart(2)}auth  ${words}w ${pages.length}pg${out._meta.rendered ? ` ${out._meta.rendered}r` : ''}  conf=${out._meta.confidence}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    const reason = e instanceof CrawlError ? e.failure : 'error'
    summary.push(`FAIL ${host.padEnd(24)} ${reason}: ${(e as Error).message.slice(0, 90)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
  console.log(summary[summary.length - 1])
}
writeFileSync(resolve(OUT, '_regression-summary.txt'), `${new Date().toISOString()} prompt v${PRACTICE_SETUP_PROMPT_VERSION}\n${summary.join('\n')}\n`)
console.log(`\n${summary.filter((s) => s.startsWith('OK')).length}/${sites.length} OK`)

function diffKeys(a: any, b: any, path = ''): string[] {
  const out: string[] = []
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
  for (const k of keys) {
    const p = path ? `${path}.${k}` : k
    const av = a?.[k], bv = b?.[k]
    if (k === 'confidence' || k === 'source') continue
    if (typeof av === 'object' && av && typeof bv === 'object' && bv && !Array.isArray(av)) out.push(...diffKeys(av, bv, p))
    else if (JSON.stringify(av) !== JSON.stringify(bv)) out.push(p)
  }
  return out
}
