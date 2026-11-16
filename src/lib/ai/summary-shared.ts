/** The parts of the summary engine the service needs, without pulling the model-calling code into every import. */
export { readDocumentPages, type SummaryMapping } from './summary-core'
import { SUMMARY_PROMPT_VERSION } from './prompts/summary'
export const SUMMARY_PROMPT_VERSION_FOR_RUNS = SUMMARY_PROMPT_VERSION
