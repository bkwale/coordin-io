/** Document summaries: the engine (summary-core) run through the audited AI pipeline. */
import { runAI } from './pipeline'
import { DocumentSummarySchema, normaliseSummary } from './schemas-summary'
import { SUMMARY_PROMPT_VERSION, type SummaryLanguage } from './prompts/summary'
import { planSummary, finalPrompt, checkSummary, verifiedShare } from './summary-core'

export * from './summary-core'

export interface ExecuteSummaryOptions { language?: SummaryLanguage; truncated?: boolean; allowFallback?: boolean }

export async function executeSummary(runId: string, rawPages: string[], opts: ExecuteSummaryOptions = {}) {
  const plan = planSummary(rawPages)
  const n = plan.sections.length
  return runAI(runId, {
    surface: 'EXTRACTION', createdBy: '', inputSummary: '', promptVersion: SUMMARY_PROMPT_VERSION,
    maxTokens: 8_000,
    ingest: async (push) => {
      await push({ name: 'read', status: 'done', detail: `${rawPages.length} page${rawPages.length > 1 ? 's' : ''}${n > 1 ? ` · read in ${n} sections` : ''}` })
      if (n > 1) await push({ name: 'sections', status: 'running', detail: `0 of ${n}` })
      const p = await finalPrompt(plan, opts.language ?? 'same', opts.allowFallback === true, (done, total) => push({ name: 'sections', status: 'running', detail: `${done} of ${total}` }))
      if (n > 1) await push({ name: 'sections', status: 'done', detail: `${n} sections` })
      return { system: p.system, user: p.user, inputForHash: rawPages.join('\n'), tokens: p.tokens }
    },
    schema: DocumentSummarySchema,
    normalise: normaliseSummary,
    map: (s) => checkSummary(s, rawPages, { sections: n, truncated: opts.truncated === true, engineWarnings: plan.engineWarnings }),
    confidenceOf: (s) => verifiedShare(s, rawPages),
  })
}
