/**
 * AI spend caps — the backstop if every other control fails (rate limits, auth, demo lock-down).
 *
 * Counted from the AIRun table itself (the source of truth for every model call we make), not from
 * a cache: if Redis is down the cap still holds. Checked BEFORE a run is created, at every entry point.
 *   - per organisation: AI_CAP_ORG_PER_DAY   (default 50)
 *   - whole platform:   AI_CAP_GLOBAL_PER_DAY (default 300) — the circuit breaker
 * Day = UTC calendar day. Concurrent requests can overshoot by a handful; the provider-side monthly
 * spend limit (set in the Mistral console) is the final hard stop.
 */
import { prisma } from '@/lib/prisma'
import { RateLimitedError } from '@/lib/errors'

export function aiCaps() {
  const n = (v: string | undefined, d: number) => { const x = parseInt(v ?? '', 10); return Number.isFinite(x) && x >= 0 ? x : d }
  return { perOrg: n(process.env.AI_CAP_ORG_PER_DAY, 50), global: n(process.env.AI_CAP_GLOBAL_PER_DAY, 300) }
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Throws RateLimitedError (429) if this organisation or the platform has used today's AI allowance. */
export async function assertAiBudget(organisationId: string | null, now = new Date()): Promise<void> {
  const caps = aiCaps()
  const since = startOfUtcDay(now)
  const [global, org] = await Promise.all([
    prisma.aIRun.count({ where: { createdAt: { gte: since } } }),
    organisationId ? prisma.aIRun.count({ where: { organisationId, createdAt: { gte: since } } }) : Promise.resolve(0),
  ])
  if (global >= caps.global) {
    console.warn('[AIBudget] global daily cap reached', { global, cap: caps.global })
    throw new RateLimitedError('AI features have reached today’s platform limit. They reset at midnight UTC — fill the questionnaire by hand for now.')
  }
  if (organisationId && org >= caps.perOrg) {
    console.warn('[AIBudget] organisation daily cap reached', { organisationId, org, cap: caps.perOrg })
    throw new RateLimitedError(`Your studio has used today’s ${caps.perOrg} AI runs. They reset at midnight UTC — fill the questionnaire by hand for now.`)
  }
}
