import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, requireString, optionalString, optionalDate } from '@/lib/validation'

const VALID_CONDITION_STATUSES = [
  'OUTSTANDING',
  'SUBMISSION_PREPARED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DISCHARGED',
  'PARTIALLY_DISCHARGED',
  'NOT_DISCHARGED',
  'APPEALED',
] as const

export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const planningIdx = segments.indexOf('planning')
  const applicationId = planningIdx >= 0 ? segments[planningIdx + 1] : undefined

  if (!applicationId) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const application = await (prisma as any).planningApplication.findFirst({
    where: { id: applicationId, projectId },
  })

  if (!application) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const conditionType = searchParams.get('conditionType')

  const where: Record<string, unknown> = { applicationId }
  if (status) where.status = status
  if (conditionType) where.conditionType = conditionType

  const conditions = await (prisma as any).planningCondition.findMany({
    where,
    orderBy: { conditionNumber: 'asc' },
  })

  return success(conditions)
})

export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const planningIdx = segments.indexOf('planning')
  const applicationId = planningIdx >= 0 ? segments[planningIdx + 1] : undefined

  if (!applicationId) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const application = await (prisma as any).planningApplication.findFirst({
    where: { id: applicationId, projectId },
  })

  if (!application) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const body = await parseBody(request)

  const description = requireString(body, 'description')
  const conditionType = optionalString(body, 'conditionType')
  const triggerStage = optionalString(body, 'triggerStage')
  const submissionRequired = optionalString(body, 'submissionRequired')
  const ownerId = optionalString(body, 'ownerId')
  const dueDate = optionalDate(body, 'dueDate')
  const comments = optionalString(body, 'comments')

  const existingCount = await (prisma as any).planningCondition.count({
    where: { applicationId },
  })

  const condition = await (prisma as any).planningCondition.create({
    data: {
      applicationId,
      conditionNumber: existingCount + 1,
      description,
      conditionType,
      triggerStage,
      submissionRequired,
      ownerId,
      dueDate,
      comments,
    },
  })

  return success(condition, 201)
})
