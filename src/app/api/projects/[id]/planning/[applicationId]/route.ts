import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, optionalString, optionalEnum, optionalDate, optionalNumber } from '@/lib/validation'

const VALID_STATUSES = [
  'FEASIBILITY',
  'PRE_APPLICATION',
  'PREPARING',
  'SUBMITTED',
  'INVALID_INFORMATION_REQUIRED',
  'VALIDATED',
  'CONSULTATION',
  'UNDER_ASSESSMENT',
  'COMMITTEE',
  'APPROVED',
  'REFUSED',
  'WITHDRAWN',
  'APPEAL',
  'CONDITIONS_DISCHARGE',
  'CLOSED',
] as const

const VALID_CURRENCIES = ['GBP', 'NGN', 'USD', 'EUR'] as const

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
    include: { conditions: true },
  })

  if (!application) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  return success(application)
})

export const PATCH = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const planningIdx = segments.indexOf('planning')
  const applicationId = planningIdx >= 0 ? segments[planningIdx + 1] : undefined

  if (!applicationId) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const existing = await (prisma as any).planningApplication.findFirst({
    where: { id: applicationId, projectId },
  })

  if (!existing) {
    const { NotFoundError } = await import('@/lib/errors')
    throw new NotFoundError('Planning application not found')
  }

  const body = await parseBody(request)

  const reference = optionalString(body, 'reference')
  const authority = optionalString(body, 'authority')
  const applicationType = optionalString(body, 'applicationType')
  const description = optionalString(body, 'description')
  const status = optionalEnum(body, 'status', VALID_STATUSES as unknown as string[])
  const consultant = optionalString(body, 'consultant')
  const caseOfficer = optionalString(body, 'caseOfficer')
  const portalLink = optionalString(body, 'portalLink')
  const fee = optionalNumber(body, 'fee')
  const currency = optionalEnum(body, 'currency', VALID_CURRENCIES as unknown as string[])
  const submissionDate = optionalDate(body, 'submissionDate')
  const validationDate = optionalDate(body, 'validationDate')
  const targetDecision = optionalDate(body, 'targetDecision')
  const decisionDate = optionalDate(body, 'decisionDate')
  const decision = optionalString(body, 'decision')
  const appealDate = optionalDate(body, 'appealDate')
  const expiryDate = optionalDate(body, 'expiryDate')
  const comments = optionalString(body, 'comments')

  const data: Record<string, unknown> = {}
  if (reference !== undefined) data.reference = reference
  if (authority !== undefined) data.authority = authority
  if (applicationType !== undefined) data.applicationType = applicationType
  if (description !== undefined) data.description = description
  if (status !== undefined) data.status = status
  if (consultant !== undefined) data.consultant = consultant
  if (caseOfficer !== undefined) data.caseOfficer = caseOfficer
  if (portalLink !== undefined) data.portalLink = portalLink
  if (fee !== undefined) data.fee = fee
  if (currency !== undefined) data.currency = currency
  if (submissionDate !== undefined) data.submissionDate = submissionDate
  if (validationDate !== undefined) data.validationDate = validationDate
  if (targetDecision !== undefined) data.targetDecision = targetDecision
  if (decisionDate !== undefined) data.decisionDate = decisionDate
  if (decision !== undefined) data.decision = decision
  if (appealDate !== undefined) data.appealDate = appealDate
  if (expiryDate !== undefined) data.expiryDate = expiryDate
  if (comments !== undefined) data.comments = comments

  const application = await (prisma as any).planningApplication.update({
    where: { id: applicationId },
    data,
  })

  return success(application)
})
