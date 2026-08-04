import { describe, it, expect } from 'vitest'
import { validateOnboardingCompletion } from '@/lib/onboarding-utils'

describe('validateOnboardingCompletion', () => {
  it('returns valid when all policies and training are complete', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 3,
      totalTraining: 5,
      completedTraining: 5,
    })
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('returns invalid with specific message when missing 1 of 3 policies', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 2,
      totalTraining: 5,
      completedTraining: 5,
    })
    expect(result.valid).toBe(false)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toBe(
      '1 of 3 mandatory policies not acknowledged',
    )
  })

  it('returns invalid with specific message when missing training', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 3,
      totalTraining: 5,
      completedTraining: 2,
    })
    expect(result.valid).toBe(false)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toBe(
      '3 of 5 mandatory training items not completed',
    )
  })

  it('returns invalid with 2 messages when both are missing', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 1,
      totalTraining: 4,
      completedTraining: 2,
    })
    expect(result.valid).toBe(false)
    expect(result.missing).toHaveLength(2)
    expect(result.missing[0]).toContain('2 of 3 mandatory policies')
    expect(result.missing[1]).toContain('2 of 4 mandatory training')
  })

  it('returns valid when no mandatory policies or training exist (both 0)', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 0,
      acknowledgedPolicies: 0,
      totalTraining: 0,
      completedTraining: 0,
    })
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('returns invalid when 0 policies but some training missing', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 0,
      acknowledgedPolicies: 0,
      totalTraining: 3,
      completedTraining: 1,
    })
    expect(result.valid).toBe(false)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toContain('2 of 3 mandatory training')
  })

  it('returns invalid when some policies missing but 0 training', () => {
    const result = validateOnboardingCompletion({
      totalPolicies: 5,
      acknowledgedPolicies: 3,
      totalTraining: 0,
      completedTraining: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toContain('2 of 5 mandatory policies')
  })
})
