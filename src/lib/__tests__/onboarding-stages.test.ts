import { describe, it, expect } from 'vitest'
import { CORE_STAGES, orderedStages, stageMeta, isValidStage } from '@/lib/onboarding/stages'

describe('onboarding stages (BUG-015)', () => {
  it('always shows the four core stages, even with no data', () => {
    expect(orderedStages([])).toEqual([...CORE_STAGES])
  })

  it('shows legacy stages present in the data, in chronological order', () => {
    expect(orderedStages(['FIRST_MONTH', 'DAY_ONE', 'PRE_START', 'FIRST_WEEK'])).toEqual([
      'PRE_START', 'BEFORE_START', 'DAY_ONE', 'FIRST_WEEK', 'FIRST_MONTH', 'ROLE_SPECIFIC', 'PROBATION',
    ])
  })

  it('never hides an unknown stage; it goes last with a readable label', () => {
    const out = orderedStages(['DAY_ONE', 'EXIT_INTERVIEW'])
    expect(out[out.length - 1]).toBe('EXIT_INTERVIEW')
    expect(stageMeta('EXIT_INTERVIEW').label).toBe('Exit interview')
  })

  it('labels legacy stages properly', () => {
    expect(stageMeta('PRE_START').label).toBe('Pre-start')
    expect(stageMeta('FIRST_WEEK').label).toBe('First Week')
    expect(stageMeta('FIRST_MONTH').label).toBe('First Month')
  })

  it('accepts legacy stages so existing items stay editable; rejects junk', () => {
    expect(isValidStage('FIRST_WEEK')).toBe(true)
    expect(isValidStage('BEFORE_START')).toBe(true)
    expect(isValidStage('NOPE')).toBe(false)
    expect(isValidStage(undefined)).toBe(false)
  })
})
