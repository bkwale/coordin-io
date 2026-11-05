import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, optionalString, requireDate, optionalDate, parseBody } from '@/lib/validation'
import { PermissionError, ConflictError, ValidationError } from '@/lib/errors'
import { notClosedProfileFilter, normaliseOutcome, probationIssues, isInProbation, probationStatusLabel, ISSUE_LABELS } from '@/lib/staffing/probation'
import { canManageHR } from '@/lib/staffing-utils'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing/probation — List probation reviews.
 *
 * Permission: HR+ sees all reviews; others see only their own.
 *
 * Query params:
 * - profileId: filter by employee
 * - pending: 'true' to show only incomplete reviews
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const profileIdFilter = url.searchParams.get('profileId')
  const pendingOnly = url.searchParams.get('pending') === 'true'

  // canManageHR replaces inline isAdmin — gives HR, ADMIN, OWNER access
  const hasHRAccess = canManageHR(profile.orgPermission as OrgPermission)

  const where: Record<string, unknown> = {
    profile: { organisationId: profile.organisationId },
  }

  // Non-HR: own reviews (finalised only — PT 2026-11-05) + reviews of direct reports (line manager)
  let visibleTo: Record<string, unknown> | null = null
  if (!hasHRAccess) {
    const reports = await modulesPrisma.profile.findMany({ where: { managerId: profile.id, organisationId: profile.organisationId }, select: { id: true } })
    const reportIds = reports.map((r: { id: string }) => r.id)
    visibleTo = { OR: [{ profileId: { in: reportIds } }, { profileId: profile.id, workflowStatus: 'FINALISED' }] }
  }
  if (profileIdFilter) where.profileId = profileIdFilter
  if (visibleTo) where.AND = [visibleTo]
  const workflowFilter = url.searchParams.get('workflow')
  if (workflowFilter) where.workflowStatus = { in: workflowFilter.split(',').slice(0, 5) }

  if (pendingOnly) {
    where.completedDate = null
    // BUG-016: reviews for employees whose probation is closed (confirmed, historic, N/A…) are not pending
    where.profile = notClosedProfileFilter(profile.organisationId)
  }

  const reviews = await modulesPrisma.probationReview.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, startDate: true, managerId: true } },
      _count: { select: { goals: true } },
    },
    orderBy: { scheduledDate: 'asc' },
    take: 100,
  })

  // BUG-016: one definition of "in probation" — the employee's probationStatus — plus records HR must correct
  let employees: unknown[] | undefined
  if (hasHRAccess && !profileIdFilter) {
    const eps = await modulesPrisma.employeeProfile.findMany({
      where: { profile: { organisationId: profile.organisationId } },
      select: {
        profileId: true, probationStatus: true, probationStartDate: true, probationEndDate: true, probationLength: true,
        profile: { select: { fullName: true, jobTitle: true, startDate: true } },
      },
    })
    type EpRow = { profileId: string; probationStatus: string | null; probationStartDate: Date | null; probationEndDate: Date | null; probationLength: number | null; profile: { fullName: string; jobTitle: string | null; startDate: Date | null } | null }
    employees = (eps as EpRow[])
      .map((e) => {
        const issues = probationIssues({ ...e, employmentStartDate: e.profile?.startDate ?? null })
        return {
          profileId: e.profileId,
          fullName: e.profile?.fullName ?? 'Unknown',
          jobTitle: e.profile?.jobTitle ?? null,
          status: e.probationStatus,
          statusLabel: probationStatusLabel(e.probationStatus),
          inProbation: isInProbation(e.probationStatus),
          startDate: e.probationStartDate,
          endDate: e.probationEndDate,
          issues: issues.map((code) => ({ code, label: ISSUE_LABELS[code] })),
        }
      })
      .filter((e) => e.inProbation || e.issues.length > 0)
      .sort((a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName))
  }

  return success({ reviews, employees })
})

/**
 * POST /api/staffing/probation — Create a probation review.
 *
 * Permission: HR+ only (HR, ADMIN, OWNER).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can create probation reviews')
  }

  const body = await parseBody(request)

  const targetProfileId = requireString(body.profileId, 'profileId')
  const reviewType = requireString(body.reviewType, 'reviewType', 50)

  const scheduledDate = requireDate(body.scheduledDate, 'scheduledDate')

  const objectives = optionalString(body.objectives, 'objectives', 5000)
  const feedback = optionalString(body.feedback, 'feedback', 5000)
  const rawOutcome = optionalString(body.outcome, 'outcome', 50)
  const outcome = rawOutcome === null ? null : normaliseOutcome(rawOutcome)
  if (rawOutcome !== null && outcome === null) throw new ValidationError('outcome must be Pass, Extend or Fail')

  // Verify profile in same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { organisationId: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new PermissionError('Employee not found in your organisation')
  }

  const completedDate = optionalDate(body.completedDate, 'completedDate')
  const nextReviewDate = optionalDate(body.nextReviewDate, 'nextReviewDate')

  // BUG-016: never two open reviews of the same type for the same person
  const duplicate = await modulesPrisma.probationReview.findFirst({
    where: { profileId: targetProfileId, reviewType: { equals: reviewType, mode: 'insensitive' }, completedDate: null },
    select: { id: true, scheduledDate: true },
  })
  if (duplicate) {
    throw new ConflictError(`An open ${reviewType} review already exists for this employee (scheduled ${duplicate.scheduledDate.toISOString().slice(0, 10)}). Complete or reschedule it instead.`)
  }

  const review = await modulesPrisma.probationReview.create({
    data: {
      profileId: targetProfileId,
      reviewType,
      scheduledDate,
      completedDate,
      reviewerId: body.reviewerId ?? profile.id,
      objectives: objectives ?? null,
      feedback: feedback ?? null,
      outcome: outcome ?? null,
      nextReviewDate,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.probation_review_created',
    entityType: 'probation_review',
    entityId: review.id,
    metadata: { targetProfileId, reviewType, scheduledDate: scheduledDate.toISOString() },
  })

  // Notify the employee about their probation review
  if (targetProfileId !== profile.id) {
    await createNotification({
      profileId: targetProfileId,
      type: NOTIFICATION_EVENTS.PROBATION_REVIEW_SCHEDULED,
      title: `A ${reviewType} probation review has been scheduled for you`,
      linkUrl: `/staffing/employees/${targetProfileId}`,
    }).catch(() => {})
  }

  return success({ review }, 201)
})
