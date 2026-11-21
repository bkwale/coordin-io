import { describe, it, expect } from 'vitest'
import { canDeleteComment } from '../task-comments'

describe('who may delete a task comment', () => {
  const mine = { authorId: 'me' }, theirs = { authorId: 'someone-else' }
  it('anyone may delete their own comment, whatever their role', () => {
    for (const orgPermission of ['MEMBER', 'HR', 'FINANCE', 'MANAGER', 'ADMIN', 'OWNER']) expect(canDeleteComment({ id: 'me', orgPermission }, mine)).toBe(true)
  })
  it('a team member cannot delete someone else\'s comment', () => {
    expect(canDeleteComment({ id: 'me', orgPermission: 'MEMBER' }, theirs)).toBe(false)
  })
  it('managers, administrators and the owner can delete any comment', () => {
    for (const orgPermission of ['MANAGER', 'ADMIN', 'OWNER']) expect(canDeleteComment({ id: 'me', orgPermission }, theirs)).toBe(true)
  })
  it('an unknown role gets no extra rights', () => {
    expect(canDeleteComment({ id: 'me', orgPermission: 'NOT_A_ROLE' }, theirs)).toBe(false)
  })
})
