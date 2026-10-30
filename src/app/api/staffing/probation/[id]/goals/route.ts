import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody, requireString, optionalString, optionalNumber } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

function extractReviewId(url: string): string {
  const match = url.match(/\/probation\/([^/]+)\/goals/)
  if (!match) throw new NotFoundError('Review ID is required')
  return match[1]
}

/**
 * GET /api/staffing/probation/[id]/goals — List goals for a probation review.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const reviewId = extractReviewId(request.url)

  const review = await modulesPrisma.probationReview.findUnique({
    where: { id: reviewId },
    select: { profileId: true },
  })

  if (!review) throw new NotFoundError('Probation review not found')

  // Owner, their manager, or HR+ can view
  const isOwner = review.profileId === profile.id
  const isHRPlus = ['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)
  if (!isOwner && !isHRPlus) {
    // Check if manager
    const employee = await modulesPrisma.profile.findUnique({
      where: { id: review.profileId },
      select: { managerId: true },
    })
    if (employee?.managerId !== profile.id) {
      throw new PermissionError('You do not have access to this review')
    }
  }

  const goals = await modulesPrisma.probationGoal.findMany({
    where: { reviewId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return success({ goals })
})

/**
 * POST /api/staffing/probation/[id]/goals — Add a goal to a probation review.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const reviewId = extractReviewId(request.url)

  // Only HR+ or manager can add goals
  const isHRPlus = ['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)

  const review = await modulesPrisma.probationReview.findUnique({
    where: { id: reviewId },
    select: { profileId: true },
  })

  if (!review) throw new NotFoundError('Probation review not found')

  if (!isHRPlus) {
    const employee = await modulesPrisma.profile.findUnique({
      where: { id: review.profileId },
      select: { managerId: true },
    })
    if (employee?.managerId !== profile.id) {
      throw new PermissionError('Only HR or the employee\'s manager can add goals')
    }
  }

  const body = await parseBody(request)
  const title = requireString(body.title, 'Title', 500)
  const description = optionalString(body.description, 'Description', 2000)
  const sortOrder = optionalNumber(body.sortOrder, 'Sort order', { min: 0, max: 100 }) ?? 0

  let targetDate: Date | null = null
  if (body.targetDate) {
    targetDate = new Date(body.targetDate as string)
    if (isNaN(targetDate.getTime())) throw new ValidationError('Invalid target date')
  }

  const goal = await modulesPrisma.probationGoal.create({
    data: {
      reviewId,
      title,
      description,
      targetDate,
      sortOrder,
    },
  })

  return success({ goal }, 201)
})

/**
 * PATCH /api/staffing/probation/[id]/goals — Update a goal.
 * Body: { goalId, title?, description?, status?, evidence?, targetDate?, sortOrder? }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const reviewId = extractReviewId(request.url)
  const body = await parseBody(request)

  const goalId = requireString(body.goalId, 'Goal ID')

  const goal = await modulesPrisma.probationGoal.findUnique({
    where: { id: goalId },
    select: { reviewId: true },
  })

  if (!goal || goal.reviewId !== reviewId) {
    throw new NotFoundError('Goal not found')
  }

  // Permission check: HR+, manager, or employee (can update status/evidence)
  const review = await modulesPrisma.probationReview.findUnique({
    where: { id: reviewId },
    select: { profileId: true },
  })
  if (!review) throw new NotFoundError('Review not found')

  const isOwner = review.profileId === profile.id
  const isHRPlus = ['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)
  let isManager = false
  if (!isOwner && !isHRPlus) {
    const employee = await modulesPrisma.profile.findUnique({
      where: { id: review.profileId },
      select: { managerId: true },
    })
    isManager = employee?.managerId === profile.id
    if (!isManager) {
      throw new PermissionError('You do not have access to update this goal')
    }
  }

  const VALID_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_MET']
  const data: Record<string, unknown> = {}

  if ('title' in body && (isHRPlus || isManager)) {
    data.title = requireString(body.title, 'Title', 500)
  }
  if ('description' in body && (isHRPlus || isManager)) {
    data.description = optionalString(body.description, 'Description', 2000)
  }
  if ('status' in body) {
    const status = body.status as string
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    data.status = status
    if (status === 'COMPLETED') {
      data.completedAt = new Date()
    } else {
      data.completedAt = null
    }
  }
  if ('evidence' in body) {
    data.evidence = optionalString(body.evidence, 'Evidence', 5000)
  }
  if ('targetDate' in body && (isHRPlus || isManager)) {
    if (body.targetDate) {
      const td = new Date(body.targetDate as string)
      if (isNaN(td.getTime())) throw new ValidationError('Invalid target date')
      data.targetDate = td
    } else {
      data.targetDate = null
    }
  }
  if ('sortOrder' in body && (isHRPlus || isManager)) {
    data.sortOrder = optionalNumber(body.sortOrder, 'Sort order', { min: 0, max: 100 }) ?? 0
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No valid fields to update')
  }

  const updated = await modulesPrisma.probationGoal.update({
    where: { id: goalId },
    data,
  })

  return success({ goal: updated })
})

/**
 * DELETE /api/staffing/probation/[id]/goals — Delete a goal.
 * Body: { goalId }
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const reviewId = extractReviewId(request.url)
  const body = await parseBody(request)

  const goalId = requireString(body.goalId, 'Goal ID')

  // Only HR+ or manager can delete
  const isHRPlus = ['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)

  const review = await modulesPrisma.probationReview.findUnique({
    where: { id: reviewId },
    select: { profileId: true },
  })
  if (!review) throw new NotFoundError('Review not found')

  if (!isHRPlus) {
    const employee = await modulesPrisma.profile.findUnique({
      where: { id: review.profileId },
      select: { managerId: true },
    })
    if (employee?.managerId !== profile.id) {
      throw new PermissionError('Only HR or the employee\'s manager can delete goals')
    }
  }

  const existing = await modulesPrisma.probationGoal.findUnique({
    where: { id: goalId },
    select: { reviewId: true },
  })

  if (!existing || existing.reviewId !== reviewId) {
    throw new NotFoundError('Goal not found')
  }

  await modulesPrisma.probationGoal.delete({ where: { id: goalId } })

  return success({ deleted: true })
})
