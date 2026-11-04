/**
 * Surface A — Practice Setup. First client of runAI.
 */
import { createRun, runAI } from './pipeline'
import { crawlPractice, normaliseUrl, CrawlError } from './crawl'
import { PRACTICE_SETUP_SYSTEM, PRACTICE_SETUP_PROMPT_VERSION, practiceSetupUser } from './prompts/practice-setup'
import { PracticeProfileSchema, normalisePracticeProfile } from './schemas'
import { mapPracticeProfile, practiceConfidence } from './map-practice'

export async function startPracticeSetup(opts: { url: string; createdBy: string; organisationId?: string | null }) {
  const base = normaliseUrl(opts.url)
  const run = await createRun({
    surface: 'PRACTICE_SETUP',
    organisationId: opts.organisationId ?? null,
    createdBy: opts.createdBy,
    inputSummary: base.toString(),
    promptVersion: PRACTICE_SETUP_PROMPT_VERSION,
  })
  return run
}

export async function executePracticeSetup(runId: string, url: string) {
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
    map: mapPracticeProfile,
    confidenceOf: practiceConfidence,
  })
}
