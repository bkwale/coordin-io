import { describe, it, expect } from 'vitest'
import { allowedActions, canView, nextStatus, normaliseAssessment, submissionProblems, averageScore, ASSESSMENT_CRITERIA } from '@/lib/staffing/probation-workflow'

const manager = { isHR: false, isLineManager: true, isSubject: false }
const hr = { isHR: true, isLineManager: false, isSubject: false }
const subject = { isHR: false, isLineManager: false, isSubject: true }
const stranger = { isHR: false, isLineManager: false, isSubject: false }
const hrSubject = { isHR: true, isLineManager: false, isSubject: true }

describe('probation workflow — state machine', () => {
  it('manager can save/submit from SCHEDULED, DRAFT and RETURNED; nothing once SUBMITTED or FINALISED', () => {
    for (const s of ['SCHEDULED', 'DRAFT', 'RETURNED']) expect(allowedActions(s, manager)).toEqual(['save', 'submit'])
    expect(allowedActions('SUBMITTED', manager)).toEqual([])
    expect(allowedActions('FINALISED', manager)).toEqual([])
  })
  it('only HR can return or finalise, and only from SUBMITTED', () => {
    expect(allowedActions('SUBMITTED', hr)).toEqual(['return', 'finalise'])
    for (const s of ['SCHEDULED', 'DRAFT', 'RETURNED', 'FINALISED']) expect(allowedActions(s, hr)).not.toContain('finalise')
  })
  it('HR can draft on behalf of a manager', () => {
    expect(allowedActions('SCHEDULED', hr)).toEqual(['save', 'submit'])
  })
  it('nobody acts on their own review — not even HR', () => {
    for (const s of ['SCHEDULED', 'DRAFT', 'SUBMITTED', 'RETURNED']) {
      expect(allowedActions(s, subject)).toEqual([])
      expect(allowedActions(s, hrSubject)).toEqual([])
    }
  })
  it('strangers can do nothing; unknown status treated as SCHEDULED', () => {
    expect(allowedActions('SUBMITTED', stranger)).toEqual([])
    expect(allowedActions('weird', manager)).toEqual(['save', 'submit'])
  })
  it('transitions map to the right next status', () => {
    expect(nextStatus('save')).toBe('DRAFT')
    expect(nextStatus('submit')).toBe('SUBMITTED')
    expect(nextStatus('return')).toBe('RETURNED')
    expect(nextStatus('finalise')).toBe('FINALISED')
  })
})

describe('probation workflow — visibility', () => {
  it('manager and HR always see it; the employee only once finalised; strangers never', () => {
    expect(canView('DRAFT', manager)).toBe(true)
    expect(canView('DRAFT', hr)).toBe(true)
    expect(canView('SUBMITTED', subject)).toBe(false)
    expect(canView('FINALISED', subject)).toBe(true)
    expect(canView('FINALISED', stranger)).toBe(false)
  })
})

describe('probation workflow — assessment', () => {
  it('keeps known criteria only, clamps scores to integers 1–5, trims comments', () => {
    const a = normaliseAssessment({ criteria: [
      { key: 'quality', score: 4, comment: '  good  ' }, { key: 'technical', score: 9 }, { key: 'communication', score: 2.5 }, { key: 'hack', score: 5 },
    ] })
    expect(a.criteria).toHaveLength(ASSESSMENT_CRITERIA.length)
    expect(a.criteria.find((c) => c.key === 'quality')).toMatchObject({ score: 4, comment: 'good' })
    expect(a.criteria.find((c) => c.key === 'technical')!.score).toBeNull()
    expect(a.criteria.find((c) => c.key === 'communication')!.score).toBeNull()
    expect(a.criteria.some((c) => c.key === 'hack')).toBe(false)
  })
  it('garbage input gives a blank assessment', () => {
    expect(normaliseAssessment('nope').criteria.every((c) => c.score === null)).toBe(true)
  })
  it('submission requires every area scored and a recommendation', () => {
    const blank = normaliseAssessment(null)
    expect(submissionProblems({ assessment: blank, managerRecommendation: null })).toHaveLength(2)
    const full = normaliseAssessment({ criteria: ASSESSMENT_CRITERIA.map((c) => ({ key: c.key, score: 3 })) })
    expect(submissionProblems({ assessment: full, managerRecommendation: 'Pass' })).toEqual([])
    expect(averageScore(full)).toBe(3)
  })
})
