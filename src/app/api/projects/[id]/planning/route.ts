import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, requireString, optionalString, optionalEnum, optionalDate, optionalNumber } from '@/lib/validation'

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
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const applicationType = searchParams.get('applicationType')

  const where: Record<string, unknown> = { projectId }
  if (status) where.status = status
  if (applicationType) where.applicationType = applicationType

  const applications = await (prisma as any).planningApplication.findMany({
    where,
    include: { _count: { select: { conditions: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return success(applications)
})

export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const body = await parseBody(request)

  const authority = requireString(body, 'authority')
  const applicationType = requireString(body, 'applicationType')
  const description = requireString(body, 'description')
  const reference = optionalString(body, 'reference')
  const consultant = optionalString(body, 'consultant')
  const caseOfficer = optionalString(body, 'caseOfficer')
  const portalLink = optionalString(body, 'portalLink')
  const fee = optionalNumber(body, 'fee')
  const currency = optionalEnum(body, 'currency', VALID_CURRENCIES as unknown as string[])
  const submissionDate = optionalDate(body, 'submissionDate')
  const validationDate = optionalDate(body, 'validationDate')
  const targetDecision = optionalDate(body, 'targetDecision')
  const comments = optionalString(body, 'comments')

  const application = await (prisma as any).planningApplication.create({
    data: {
      projectId,
      authority,
      applicationType,
      description,
      reference,
      consultant,
      caseOfficer,
      portalLink,
      fee,
      currency,
      submissionDate,
      validationDate,
      targetDecision,
      comments,
    },
  })

  return success(application, 201)
})
