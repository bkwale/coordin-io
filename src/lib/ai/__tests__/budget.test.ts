import { describe, it, expect, vi, beforeEach } from 'vitest'

/** AI spend caps — backstop against runaway or abusive AI usage. Counts come from the AIRun table. */
const count = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { aIRun: { count: (...a: unknown[]) => count(...a) } } }))
import { assertAiBudget, aiCaps, startOfUtcDay } from '@/lib/ai/budget'

describe('AI budget', () => {
  beforeEach(() => { count.mockReset(); delete process.env.AI_CAP_ORG_PER_DAY; delete process.env.AI_CAP_GLOBAL_PER_DAY })

  it('defaults: 50 per studio per day, 300 platform-wide', () => {
    expect(aiCaps()).toEqual({ perOrg: 50, global: 300 })
  })
  it('counts from UTC midnight', () => {
    expect(startOfUtcDay(new Date('2026-11-05T23:59:00+02:00')).toISOString()).toBe('2026-11-05T00:00:00.000Z')
  })
  it('allows a run under both caps', async () => {
    count.mockResolvedValueOnce(10).mockResolvedValueOnce(3)
    await expect(assertAiBudget('org_1')).resolves.toBeUndefined()
    expect(count.mock.calls[1][0]).toMatchObject({ where: { organisationId: 'org_1' } })
  })
  it('blocks a studio at its cap with a 429 the architect can act on', async () => {
    count.mockResolvedValueOnce(120).mockResolvedValueOnce(50)
    await expect(assertAiBudget('org_1')).rejects.toMatchObject({ statusCode: 429, message: expect.stringMatching(/used today’s 50 AI runs/) })
  })
  it('blocks everyone when the platform circuit breaker trips, even a studio with zero runs', async () => {
    count.mockResolvedValueOnce(300).mockResolvedValueOnce(0)
    await expect(assertAiBudget('org_2')).rejects.toMatchObject({ statusCode: 429, message: expect.stringMatching(/platform limit/) })
  })
  it('still applies the global cap to platform-admin runs with no organisation', async () => {
    count.mockResolvedValueOnce(300)
    await expect(assertAiBudget(null)).rejects.toMatchObject({ statusCode: 429 })
  })
  it('caps are tunable from the environment; 0 switches AI off', async () => {
    process.env.AI_CAP_ORG_PER_DAY = '0'
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    await expect(assertAiBudget('org_1')).rejects.toMatchObject({ statusCode: 429 })
  })
})
