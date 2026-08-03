import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody, optionalString } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CHANGES_REQUIRED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUIRED: ['DRAFT', 'SUBMITTED'],
  APPROVED: ['LOCKED', 'REOPENED'],
  REJECTED: ['DRAFT'],
  LOCKED: ['REOPENED'],
  REOPENED: ['DRAFT', 'SUBMITTED'],
}

const MANAGER_STATUSES = ['CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'LOCKED']
const OWNER_STATUSES = ['SUBMITTED', 'DRAFT']

/**
 * GET /api/timesheets/[weekId] — Get a single timesheet week with entries.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const weekId = request.url.match(/\/timesheets\/([^/?]+)/)?.[1]
  if (!weekId) throw new NotFoundError('Timesheet not found')

  const week = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: weekId },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, avatarUrl: true, managerId: true } },
      entries: {
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!week) {
    throw new NotFoundError('Timesheet not found')
  }

  // Access check: owner, manager, or admin
  const isOwner = week.profileId === profile.id
  const isManager = week.profile.managerId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isOwner && !isManager && !isAdmin) {
    throw new PermissionError('You do not have access to this timesheet')
  }

  // Org boundary
  if (week.organisationId !== profile.organisationId) {
    throw new NotFoundError('Timesheet not found')
  }

  return success({ week })
})

/**
 * PATCH /api/timesheets/[weekId] — Update timesheet status.
 *
 * Body: { status: "SUBMITTED" | "APPROVED" | ... , rejectionReason?: string, comments?: string }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const weekId = request.url.match(/\/timesheets\/([^/?]+)/)?.[1]
  if (!weekId) throw new NotFoundError('Timesheet not found')

  const body = await parseBody(request)
  const newStatus = body.status as string
  const rejectionReason = optionalString(body.rejectionReason, 'Rejection reason', 2000)
  const comments = optionalString(body.comments, 'Comments', 2000)

  if (!newStatus) {
    throw new ValidationError('Status is required')
  }

  const week = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: weekId },
    include: {
      profile: { select: { id: true, organisationId: true, managerId: true } },
      entries: { select: { hours: true, isBillable: true } },
    },
  })

  if (!week) {
    throw new NotFoundError('Timesheet not found')
  }

  // Org boundary
  if (week.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Timesheet not found')
  }

  // Validate transition
  const currentStatus = week.status as string
  const allowed = VALID_TRANSITIONS[currentStatus] || []
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
    )
  }

  // Role check
  const isOwner = week.profileId === profile.id
  const isManager = week.profile.managerId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (OWNER_STATUSES.includes(newStatus) && !isOwner) {
    throw new PermissionError('Only the timesheet owner can perform this action')
  }

  if (MANAGER_STATUSES.includes(newStatus) && !isManager && !isAdmin) {
    throw new PermissionError('Only a manager or admin can approve/reject timesheets')
  }

  // Require rejection reason for CHANGES_REQUIRED or REJECTED
  if ((newStatus === 'CHANGES_REQUIRED' || newStatus === 'REJECTED') && !rejectionReason) {
    throw new ValidationError('A reason is required when requesting changes or rejecting')
  }

  // Calculate totals on submit
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'SUBMITTED') {
    const totalHours = week.entries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)
    const billableHours = week.entries
      .filter((e: { isBillable: boolean }) => e.isBillable)
      .reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)
    updateData.totalHours = totalHours
    updateData.billableHours = billableHours
    updateData.submittedAt = new Date()

    if (totalHours === 0) {
      throw new ValidationError('Cannot submit a timesheet with 0 hours')
    }
  }

  if (newStatus === 'APPROVED') {
    updateData.approvedById = profile.id
    updateData.approvedAt = new Date()
  }

  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason
  }

  if (comments) {
    updateData.comments = comments
  }

  // Reset rejection reason when resubmitting
  if (newStatus === 'DRAFT' || newStatus === 'SUBMITTED') {
    updateData.rejectionReason = null
  }

  const updated = await modulesPrisma.timesheetWeek.update({
    where: { id: weekId },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true } },
      entries: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  // ── Notifications ──
  const ownerName = updated.profile?.fullName ?? 'Someone'
  if (newStatus === 'SUBMITTED' && week.profile.managerId) {
    await createNotification({
      profileId: week.profile.managerId,
      type: NOTIFICATION_EVENTS.TIMESHEET_SUBMITTED,
      title: `${ownerName} submitted a timesheet for review`,
      body: `${updated.totalHours ?? 0} hours`,
      linkUrl: `/timesheets`,
    }).catch(() => {})
  }
  if (['APPROVED', 'REJECTED', 'CHANGES_REQUIRED'].includes(newStatus)) {
    await createNotification({
      profileId: week.profileId,
      type: NOTIFICATION_EVENTS.TIMESHEET_DECISION,
      title: `Your timesheet was ${newStatus.toLowerCase().replace(/_/g, ' ')}`,
      body: rejectionReason ?? undefined,
      linkUrl: `/timesheets`,
    }).catch(() => {})
  }

  return success({ week: updated })
})
