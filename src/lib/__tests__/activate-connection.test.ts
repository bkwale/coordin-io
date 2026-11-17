import { describe, it, expect } from 'vitest'
import { planActivation } from '@/lib/integrations/activate-connection'

describe('where a newly authorised connection is stored', () => {
  it('first connection: the pending row becomes the connection', () => {
    expect(planActivation('pending1', null)).toEqual({ reuse: false, targetId: 'pending1', deletePendingId: null })
    expect(planActivation('pending1', undefined)).toEqual({ reuse: false, targetId: 'pending1', deletePendingId: null })
  })
  it('connecting the same account again after a disconnect: the old row is reused and the pending row removed', () => {
    // Regression, 16 Nov 2026: CWA disconnected Xero and could not connect again. The firm's old row still held the
    // Xero organisation id, so writing it onto the pending row broke the one-row-per-account rule.
    expect(planActivation('pending1', 'old-row')).toEqual({ reuse: true, targetId: 'old-row', deletePendingId: 'pending1' })
  })
  it('never deletes the row it is about to write to', () => {
    expect(planActivation('same', 'same')).toEqual({ reuse: false, targetId: 'same', deletePendingId: null })
  })
})
