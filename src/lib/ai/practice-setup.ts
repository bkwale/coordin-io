/**
 * Surface A — Practice Setup. First client of runAI.
 */
import { createRun, runAI } from './pipeline'
import { crawlPractice, normaliseUrl, CrawlError } from './crawl'
import { PRACTICE_SETUP_SYSTEM, PRACTICE_SETUP_PROMPT_VERSION, practiceSetupUser } from './prompts/practice-setup'
import { PracticeProfileSchema, normalisePracticeProfile } from './schemas'
import { mapPracticeProfile, practiceConfidence } from './map-practice'
import { lookupCompany, type RegistryJurisdiction, type CompanyFacts } from '@/lib/registry'
import { overlayRegistryFacts, profileFromRegistry } from './registry-overlay'
import { prisma } from '@/lib/prisma'

export type PracticeSetupInput = { url?: string | null; registryCode?: string | null; jurisdiction?: RegistryJurisdiction | null }

export async function startPracticeSetup(opts: PracticeSetupInput & { createdBy: string; organisationId?: string | null }) {
  const base = opts.url ? normaliseUrl(opts.url).toString() : null
  if (!base && !opts.registryCode) throw new Error('A website or a registry number is required')
  const run = await createRun({
    surface: 'PRACTICE_SETUP',
    organisationId: opts.organisationId ?? null,
    createdBy: opts.createdBy,
    inputSummary: base ?? `${opts.jurisdiction ?? 'EE'}:${opts.registryCode}`,
    promptVersion: PRACTICE_SETUP_PROMPT_VERSION,
  })
  return run
}

/** Registry-only path: no website, no model. Facts in, profile + mapping out, AWAITING_CONFIRMATION. */
export async function executeRegistryOnlySetup(runId: string, jurisdiction: RegistryJurisdiction, registryCode: string) {
  const t0 = Date.now()
  const stages = [{ name: 'registry', status: 'running', at: new Date().toISOString() } as Record<string, unknown>]
  await prisma.aIRun.update({ where: { id: runId }, data: { status: 'RUNNING', stages: stages as any } })
  try {
    const facts = await lookupCompany(jurisdiction, registryCode)
    if (!facts) throw new Error(`No company with registry number ${registryCode} (not_found)`)
    stages[0] = { name: 'registry', status: 'done', ms: Date.now() - t0, detail: `${facts.legalName} · ${facts.statusRaw}`, at: new Date().toISOString() }
    const output = profileFromRegistry(facts)
    const mapping = mapPracticeProfile(output)
    return prisma.aIRun.update({
      where: { id: runId },
      data: { status: 'AWAITING_CONFIRMATION', model: 'none/registry', inputHash: `${jurisdiction}:${registryCode}`, output: output as any, mapping: mapping as any, confidence: practiceConfidence(output), latencyMs: Date.now() - t0, tokensUsed: 0, stages: [...stages, { name: 'map', status: 'done', ms: 0, at: new Date().toISOString() }] as any },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    stages[0] = { ...stages[0], status: 'failed', detail: message.slice(0, 200) }
    await prisma.aIRun.update({ where: { id: runId }, data: { status: 'FAILED', error: message.slice(0, 1000), latencyMs: Date.now() - t0, stages: stages as any } })
    throw err
  }
}

export async function executePracticeSetup(runId: string, url: string, registry?: { jurisdiction: RegistryJurisdiction; registryCode: string } | null) {
  return runAI(runId, {
    surface: 'PRACTICE_SETUP',
    createdBy: '',
    inputSummary: url,
    promptVersion: PRACTICE_SETUP_PROMPT_VERSION,
    ingest: async (push) => {
      let pages
      try {
        pages = await crawlPractice(url, (s) => push({ name: 'fetch', status: 'done', detail: s.detail, ms: s.ms }))
      } catch (e) {
        if (e instanceof CrawlError) throw new Error(`${e.message} (${e.failure})`)
        throw e
      }
      if (!pages.length) throw new Error('The site returned no readable text. We can set up manually. (empty)')
      await push({ name: 'read', status: 'done', detail: `${pages.length} page${pages.length > 1 ? 's' : ''}, ${pages.reduce((a, p) => a + p.text.split(/\s+/).length, 0).toLocaleString()} words` })
      return { system: PRACTICE_SETUP_SYSTEM, user: practiceSetupUser(url, pages), inputForHash: pages.map((p) => p.text).join('\n') }
    },
    schema: PracticeProfileSchema,
    normalise: normalisePracticeProfile,
    enrich: async (profile, push) => {
      if (!registry) return profile
      const t = Date.now()
      let facts: CompanyFacts | null = null
      try { facts = await lookupCompany(registry.jurisdiction, registry.registryCode) } catch (e) {
        await push({ name: 'registry', status: 'failed', ms: Date.now() - t, detail: e instanceof Error ? e.message.slice(0, 120) : 'lookup failed' })
        return profile
      }
      if (!facts) { await push({ name: 'registry', status: 'failed', ms: Date.now() - t, detail: 'No company with that number' }); return profile }
      await push({ name: 'registry', status: 'done', ms: Date.now() - t, detail: `${facts.legalName} · ${facts.registeredAt ? 'since ' + facts.registeredAt.slice(0, 4) : facts.statusRaw}` })
      return overlayRegistryFacts(profile, facts)
    },
    map: mapPracticeProfile,
    confidenceOf: practiceConfidence,
  })
}
