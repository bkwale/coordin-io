#!/usr/bin/env -S npx tsx --tsconfig scripts/tsconfig.scripts.json
/**
 * Sprint 3 day-one pass: run every private planning-conditions PDF (pre-split to page text in
 * private/ai-samples/pt-text/*.json) through the draft PlanningConditionsSchema.
 * Writes per-file JSON + a summary table to private/ai-samples/pt-out/. Nothing here is committed.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

if (!process.env.MISTRAL_API_KEY && existsSync('.env.sprint0')) {
  for (const l of readFileSync('.env.sprint0', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] ??= l.slice(i + 1).replace(/^"|"$/g, '') }
}
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN

const { chat, parseJson } = await import('../src/lib/ai/providers/index.ts')
const { PlanningConditionsSchema, normalisePlanningConditions } = await import('../src/lib/ai/schemas-documents.ts')
const { PLANNING_CONDITIONS_SYSTEM, planningConditionsUser } = await import('../src/lib/ai/prompts/planning-conditions.ts')

const inDir = resolve('private/ai-samples/pt-text')
const outDir = resolve('private/ai-samples/pt-out')
mkdirSync(outDir, { recursive: true })
const only = process.argv[2]
const files = readdirSync(inDir).filter((f) => f.endsWith('.json') && (!only || f.includes(only)))

const rows: string[] = ['| file | ms | tokens | valid | number | issued | basis | ehr | use | height | footprint | storeys | setback | conds | warnings |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
for (const f of files) {
  const { pages } = JSON.parse(readFileSync(resolve(inDir, f), 'utf8')) as { pages: string[] }
  const t0 = Date.now()
  let status = 'ok', parsed: any = null, raw = ''
  try {
    const r = await chat({ system: PLANNING_CONDITIONS_SYSTEM, user: planningConditionsUser(pages), json: true, temperature: 0, maxTokens: 16000 })
    raw = r.text
    const json = parseJson(r.text)
    const v = PlanningConditionsSchema.safeParse(normalisePlanningConditions(json))
    if (!v.success) { status = 'schema:' + v.error.issues.slice(0, 3).map((i) => i.path.join('.') + ' ' + i.message).join('; '); parsed = json }
    else parsed = v.data
    writeFileSync(resolve(outDir, f), JSON.stringify({ status, ms: Date.now() - t0, tokens: r.tokens, model: r.model, data: parsed, raw: v.success ? undefined : raw }, null, 2))
    const g = (p: any) => (p?.value === null || p?.value === undefined ? '—' : typeof p.value === 'object' ? `${p.value.value ?? '—'}${p.value.unit ?? ''}` : String(p.value)) + (p?.confidence !== undefined ? ` (${Math.round(p.confidence * 100)}%${p.page ? ` p${p.page}` : ''})` : '')
    const d = parsed ?? {}
    rows.push(`| ${f.replace('.json', '')} | ${Date.now() - t0} | ${r.tokens} | ${status === 'ok' ? '✓' : '✗ ' + status.slice(0, 60)} | ${g(d.document?.number)} | ${g(d.document?.issuedAt)} | ${g(d.document?.legalBasis)} | ${g(d.site?.ehrCode)} | ${(d.building?.useCodes ?? []).map((u: any) => u.code).join(',') || '—'} | ${g(d.limits?.maxHeight)} | ${g(d.limits?.maxFootprint)} | ${g(d.limits?.maxStoreys)} | ${g(d.limits?.minSetback)} | ${(d.conditions ?? []).length} | ${(d.warnings ?? []).join('; ').slice(0, 80)} |`)
    console.log(`${status === 'ok' ? '✓' : '✗'} ${f} ${Date.now() - t0}ms ${r.tokens}tok ${status !== 'ok' ? status : ''}`)
  } catch (e) {
    status = 'error:' + (e instanceof Error ? e.message : String(e))
    rows.push(`| ${f.replace('.json', '')} | ${Date.now() - t0} | — | ✗ ${status.slice(0, 80)} | | | | | | | | | | | |`)
    console.log(`✗ ${f} ${status}`)
  }
}
const md = `# Planning-conditions extraction — day-one pass (${new Date().toISOString().slice(0, 10)}, prompt pt-0.1)\n\n${rows.join('\n')}\n`
writeFileSync(resolve(outDir, 'summary.md'), md)
console.log('\n' + md)
