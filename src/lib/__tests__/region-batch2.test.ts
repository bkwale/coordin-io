import { describe, it, expect } from 'vitest'
import { leaveRules, planningProfile, showsHospitality } from '@/lib/region'
import { calculateLeaveDays, validateLeaveRequest } from '@/lib/leave-utils'
import { DEFAULT_TOPICS, topicsForCountry } from '@/lib/knowledge-data'

const d = (s: string) => new Date(s + 'T00:00:00')

describe('leave rules by country', () => {
  it('Estonia: 28 calendar days, public holidays not counted; everyone else unchanged', () => {
    expect(leaveRules('EE')).toMatchObject({ dayBasis: 'calendar', annualDays: 28, skipPublicHolidays: true })
    for (const c of ['GB', 'NG', null] as const) expect(leaveRules(c)).toMatchObject({ dayBasis: 'working', annualDays: 25, skipPublicHolidays: false, maxRequestDays: 25 })
  })
  it('counts a Monday–Sunday week as 5 working or 7 calendar days', () => {
    expect(calculateLeaveDays(d('2026-11-09'), d('2026-11-15'))).toBe(5)
    expect(calculateLeaveDays(d('2026-11-09'), d('2026-11-15'), 'calendar')).toBe(7)
  })
  it('takes public holidays off calendar-day leave (Estonian Independence Day, 24 Feb)', () => {
    expect(calculateLeaveDays(d('2026-02-23'), d('2026-02-27'), 'calendar', [d('2026-02-24')])).toBe(4)
  })
  it('keeps the old defaults and messages when no options are passed (CWA)', () => {
    expect(validateLeaveRequest(d('2026-11-09'), d('2026-11-13')).days).toBe(5)
    expect(() => validateLeaveRequest(d('2026-11-14'), d('2026-11-15'))).toThrow(/working day/)
    expect(() => validateLeaveRequest(d('2026-01-05'), d('2026-03-31'))).toThrow(/25 working days/)
    expect(validateLeaveRequest(d('2026-11-14'), d('2026-11-15'), { basis: 'calendar', maxDays: 35 }).days).toBe(2)
  })
})

describe('project pages by country', () => {
  it('schedule of accommodation: hotels only in Estonia and the UK, always for Nigeria or unknown', () => {
    expect(showsHospitality({ country: 'EE', projectType: 'RESIDENTIAL' })).toBe(false)
    expect(showsHospitality({ country: 'GB', projectType: 'OTHER' })).toBe(false)
    expect(showsHospitality({ country: 'EE', projectType: 'HOTEL' })).toBe(true)
    expect(showsHospitality({ country: 'NG', projectType: 'RESIDENTIAL' })).toBe(true)
    expect(showsHospitality({ country: null, projectType: 'RESIDENTIAL' })).toBe(true)
  })
  it('planning wording: Estonian permit types and statuses; UK wording for the UK and unknown', () => {
    expect(planningProfile('EE').applicationTypes.some((t) => t.startsWith('Ehitusluba'))).toBe(true)
    expect(planningProfile('EE').statusLabels.SUBMITTED).toMatch(/EHR/)
    expect(planningProfile('GB').title).toBe('Planning Applications')
    expect(planningProfile(null)).toBe(planningProfile('GB'))
    expect(planningProfile('NG').sourceDocument).toBeNull()
  })
})

describe('knowledge base', () => {
  it('has Estonian topics and shows a firm its own country first', () => {
    expect(DEFAULT_TOPICS.filter((t) => t.country === 'EE').length).toBe(3)
    expect(topicsForCountry(DEFAULT_TOPICS, 'EE').slice(0, 3).every((t) => t.country === 'EE')).toBe(true)
    expect(topicsForCountry(DEFAULT_TOPICS, 'GB')[0].country).toBe('GB')
    expect(topicsForCountry(DEFAULT_TOPICS, null)).toBe(DEFAULT_TOPICS)
    expect(new Set(DEFAULT_TOPICS.map((t) => t.id)).size).toBe(DEFAULT_TOPICS.length)
  })
})
