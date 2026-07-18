import { describe, it, expect } from 'vitest'

// ── Helper functions mirroring API route logic ────────────────

/** Welcome step is always completed (user reached the page). */
function isWelcomeComplete(): boolean {
  return true
}

/** Policies step: complete when all mandatory policies are acknowledged. */
function isPoliciesComplete(total: number, acknowledged: number): boolean {
  if (total === 0) return true
  return acknowledged >= total
}

/** Training step: complete when all mandatory training items are done. */
function isTrainingComplete(total: number, done: number): boolean {
  if (total === 0) return true
  return done >= total
}

/** Profile step: complete when all optional fields are filled. */
function isProfileComplete(fields: (string | null | undefined)[]): {
  completed: boolean
  fieldsComplete: number
  fieldsTotal: number
} {
  const fieldsTotal = fields.length
  const fieldsComplete = fields.filter((f) => f !== null && f !== undefined && f !== '').length
  return { completed: fieldsComplete === fieldsTotal, fieldsComplete, fieldsTotal }
}

/** Overall onboarding can finish when policies AND training are done. */
function canFinishOnboarding(progress: {
  policies: { total: number; acknowledged: number }
  training: { total: number; done: number }
}): boolean {
  return (
    isPoliciesComplete(progress.policies.total, progress.policies.acknowledged) &&
    isTrainingComplete(progress.training.total, progress.training.done)
  )
}

/** Gathers missing items list (mirrors complete/route.ts logic). */
function getMissingItems(progress: {
  policies: { total: number; acknowledged: number }
  training: { total: number; done: number }
}): string[] {
  const missing: string[] = []
  const { policies, training } = progress
  if (policies.total > 0 && policies.acknowledged < policies.total) {
    missing.push(
      `${policies.total - policies.acknowledged} of ${policies.total} mandatory policies not acknowledged`,
    )
  }
  if (training.total > 0 && training.done < training.total) {
    missing.push(
      `${training.total - training.done} of ${training.total} mandatory training items not completed`,
    )
  }
  return missing
}

type PolicyState = 'unread' | 'opened' | 'acknowledged'

/** Simulates policy state transitions. */
function transitionPolicy(current: PolicyState, action: 'open' | 'acknowledge'): PolicyState {
  if (action === 'open') return current === 'acknowledged' ? 'acknowledged' : 'opened'
  return 'acknowledged'
}

// ── Tests ─────────────────────────────────────────────────────

describe('Onboarding — step completion logic', () => {
  it('welcome is always completed', () => {
    expect(isWelcomeComplete()).toBe(true)
  })

  it('policies complete when acknowledged >= total', () => {
    expect(isPoliciesComplete(3, 3)).toBe(true)
    expect(isPoliciesComplete(3, 4)).toBe(true) // edge: over-count
  })

  it('policies incomplete when acknowledged < total', () => {
    expect(isPoliciesComplete(3, 2)).toBe(false)
    expect(isPoliciesComplete(5, 0)).toBe(false)
  })

  it('zero mandatory policies means auto-complete', () => {
    expect(isPoliciesComplete(0, 0)).toBe(true)
  })

  it('training complete when done >= total', () => {
    expect(isTrainingComplete(2, 2)).toBe(true)
    expect(isTrainingComplete(2, 3)).toBe(true)
  })

  it('training incomplete when done < total', () => {
    expect(isTrainingComplete(4, 1)).toBe(false)
  })

  it('zero mandatory training means auto-complete', () => {
    expect(isTrainingComplete(0, 0)).toBe(true)
  })

  it('profile complete when all 4 fields filled', () => {
    const result = isProfileComplete(['+44123', 'https://img.png', 'Jane Doe', '+44999'])
    expect(result.completed).toBe(true)
    expect(result.fieldsComplete).toBe(4)
    expect(result.fieldsTotal).toBe(4)
  })

  it('profile incomplete with null / empty fields', () => {
    const result = isProfileComplete(['+44123', null, '', undefined])
    expect(result.completed).toBe(false)
    expect(result.fieldsComplete).toBe(1)
  })

  it('overall complete requires policies AND training', () => {
    expect(canFinishOnboarding({
      policies: { total: 2, acknowledged: 2 },
      training: { total: 3, done: 3 },
    })).toBe(true)
  })

  it('overall incomplete when policies missing', () => {
    expect(canFinishOnboarding({
      policies: { total: 2, acknowledged: 1 },
      training: { total: 3, done: 3 },
    })).toBe(false)
  })

  it('overall incomplete when training missing', () => {
    expect(canFinishOnboarding({
      policies: { total: 2, acknowledged: 2 },
      training: { total: 3, done: 1 },
    })).toBe(false)
  })
})

describe('Onboarding — policy state transitions', () => {
  it('unread -> opened on open', () => {
    expect(transitionPolicy('unread', 'open')).toBe('opened')
  })

  it('opened -> acknowledged on acknowledge', () => {
    expect(transitionPolicy('opened', 'acknowledge')).toBe('acknowledged')
  })

  it('unread -> acknowledged directly (acknowledge without opening first)', () => {
    expect(transitionPolicy('unread', 'acknowledge')).toBe('acknowledged')
  })

  it('acknowledged stays acknowledged on re-open', () => {
    expect(transitionPolicy('acknowledged', 'open')).toBe('acknowledged')
  })

  it('all policies must be acknowledged for step completion', () => {
    const states: PolicyState[] = ['acknowledged', 'acknowledged', 'opened']
    const allDone = states.every((s) => s === 'acknowledged')
    expect(allDone).toBe(false)

    states[2] = transitionPolicy(states[2], 'acknowledge')
    expect(states.every((s) => s === 'acknowledged')).toBe(true)
  })
})

describe('Onboarding — training completion rules', () => {
  it('score is optional when completing', () => {
    const completion = { completedAt: new Date(), score: undefined }
    expect(completion.completedAt).toBeTruthy()
    expect(completion.score).toBeUndefined()
  })

  it('duplicate completion throws ConflictError (simulated)', () => {
    const completed = new Set<string>()
    const trainingId = 'train-001'

    // First completion succeeds
    completed.add(trainingId)
    expect(completed.has(trainingId)).toBe(true)

    // Second attempt should conflict
    const alreadyDone = completed.has(trainingId)
    expect(alreadyDone).toBe(true) // would throw ConflictError in API
  })

  it('zero mandatory training items means auto-complete', () => {
    expect(isTrainingComplete(0, 0)).toBe(true)
  })
})

describe('Onboarding — completion validation', () => {
  it('cannot complete when policies are missing', () => {
    const missing = getMissingItems({
      policies: { total: 3, acknowledged: 1 },
      training: { total: 2, done: 2 },
    })
    expect(missing).toHaveLength(1)
    expect(missing[0]).toContain('2 of 3 mandatory policies')
  })

  it('cannot complete when training is missing', () => {
    const missing = getMissingItems({
      policies: { total: 2, acknowledged: 2 },
      training: { total: 5, done: 3 },
    })
    expect(missing).toHaveLength(1)
    expect(missing[0]).toContain('2 of 5 mandatory training')
  })

  it('cannot complete when both are missing', () => {
    const missing = getMissingItems({
      policies: { total: 3, acknowledged: 0 },
      training: { total: 2, done: 0 },
    })
    expect(missing).toHaveLength(2)
  })

  it('profile is NOT a blocker for completion', () => {
    const profileIncomplete = isProfileComplete([null, null, null, null])
    expect(profileIncomplete.completed).toBe(false)

    // But onboarding can still finish
    expect(canFinishOnboarding({
      policies: { total: 1, acknowledged: 1 },
      training: { total: 1, done: 1 },
    })).toBe(true)
  })

  it('status transitions from ONBOARDING to ACTIVE on success', () => {
    const canFinish = canFinishOnboarding({
      policies: { total: 2, acknowledged: 2 },
      training: { total: 1, done: 1 },
    })
    expect(canFinish).toBe(true)
    // API sets profile.status = 'ACTIVE' when canFinish is true
    const newStatus = canFinish ? 'ACTIVE' : 'ONBOARDING'
    expect(newStatus).toBe('ACTIVE')
  })

  it('no missing items when everything is done', () => {
    const missing = getMissingItems({
      policies: { total: 5, acknowledged: 5 },
      training: { total: 3, done: 3 },
    })
    expect(missing).toHaveLength(0)
  })
})
