/**
 * Filter leave requests by status.
 *
 * 'ACTIVE' excludes WITHDRAWN and CANCELLED (default view).
 * 'ALL' returns everything.
 * Any specific status filters to just that status.
 */
export type LeaveFilterStatus =
  | 'ACTIVE' | 'ALL'
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW'
  | 'LINE_MANAGER_APPROVED' | 'HR_APPROVED'
  | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN'

export function filterLeaveRequests<T extends { status: string }>(
  requests: T[],
  filter: string,
): T[] {
  if (filter === 'ALL') return requests
  if (filter === 'ACTIVE') {
    return requests.filter((r) => r.status !== 'WITHDRAWN' && r.status !== 'CANCELLED')
  }
  return requests.filter((r) => r.status === filter)
}
