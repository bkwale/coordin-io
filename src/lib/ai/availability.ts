import { isProviderOpen } from './providers/health'

export interface AIAvailability { available: boolean; reason: 'ok' | 'not_configured' | 'down'; message: string | null }

/** Can a new AI run start right now? Cheap — no call to the provider. */
/** fallbackAllowed: the organisation opted in to the non-EU backup reader. */
export async function aiAvailability(opts: { fallbackAllowed?: boolean } = {}): Promise<AIAvailability> {
  const hasPrimary = !!process.env.MISTRAL_API_KEY
  const hasFallback = !!process.env.ANTHROPIC_API_KEY && opts.fallbackAllowed === true
  if (!hasPrimary && !hasFallback) return { available: false, reason: 'not_configured', message: 'AI reading isn’t available on this workspace right now. You can fill everything in by hand.' }
  const primaryUp = hasPrimary && !(await isProviderOpen('mistral'))
  const fallbackUp = hasFallback && !(await isProviderOpen('claude'))
  if (primaryUp || fallbackUp) return { available: true, reason: 'ok', message: null }
  return { available: false, reason: 'down', message: 'The AI service isn’t responding right now. Try again in a few minutes, or fill the details in by hand.' }
}
