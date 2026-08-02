import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum,
  optionalNumber, optionalDate,
} from '@/lib/validation'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const TENDER_STATUSES = [
  'DRAFT', 'ISSUED', 'RETURNS_RECEIVED',
  'UNDER_EVALUATION', 'AWARDED', 'CANCELLED',
] as const

/**
 * GET /api/projects/[id]/commercial/tenders — List tenders for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof TENDER_STATUSES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && TENDER_STATUSES.includes(status as typeof TENDER_STATUSES[number])) {
    where.status = status
  }

  const tenders = await prisma.tender.findMany({
    where,
    include: {
      returns: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ tenders })
})

/**
 * POST /api/projects/[id]/commercial/tenders — Create a new tender package.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const packageName = requireString(body.packageName, 'Package name', 200)
  const description = optionalString(body.description, 'Description', 5000)
  const estimatedValue = optionalNumber(body.estimatedValue, 'Estimated value', { min: 0 })
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const issueDate = optionalDate(body.issueDate, 'Issue date')
  const returnDate = optionalDate(body.returnDate, 'Return date')
  const notes = optionalString(body.notes, 'Notes', 5000)

  const tender = await prisma.tender.create({
    data: {
      projectId,
      packageName,
      description,
      estimatedValue,
      currency,
      issueDate,
      returnDate,
      status: 'DRAFT',
      notes,
    },
    include: {
      returns: true,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TENDER_CREATED,
    entityType: 'Tender',
    entityId: tender.id,
    metadata: { packageName, estimatedValue, currency },
  })

  return success({ tender }, 201)
})
