import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum,
  optionalNumber, optionalId,
} from '@/lib/validation'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const VARIATION_REASONS = [
  'DESIGN_CHANGE', 'CLIENT_INSTRUCTION', 'SITE_CONDITION',
  'REGULATORY', 'VALUE_ENGINEERING', 'OMISSION', 'OTHER',
] as const

const VARIATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
  'REJECTED', 'IMPLEMENTED', 'CLOSED',
] as const

/**
 * GET /api/projects/[id]/commercial/variations — List variations for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof VARIATION_STATUSES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && VARIATION_STATUSES.includes(status as typeof VARIATION_STATUSES[number])) {
    where.status = status
  }

  const variations = await prisma.variation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ variations })
})

/**
 * POST /api/projects/[id]/commercial/variations — Create a new variation order.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = requireString(body.description, 'Description', 5000)
  const reason = optionalEnum(body.reason, 'Reason', VARIATION_REASONS) ?? 'DESIGN_CHANGE'
  const initiatedBy = optionalString(body.initiatedBy, 'Initiated by', 200)
  const amount = optionalNumber(body.amount, 'Amount')
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const timeImpactDays = optionalNumber(body.timeImpactDays, 'Time impact (days)', { min: 0 })
  const linkedDocumentId = optionalId(body.linkedDocumentId, 'Linked document ID')
  const linkedTaskId = optionalId(body.linkedTaskId, 'Linked task ID')
  const notes = optionalString(body.notes, 'Notes', 5000)

  // Auto-generate variation number
  const existingCount = await prisma.variation.count({ where: { projectId } })
  const variationNumber = `VO-${String(existingCount + 1).padStart(3, '0')}`

  const variation = await prisma.variation.create({
    data: {
      projectId,
      variationNumber,
      title,
      description,
      reason,
      initiatedBy,
      amount,
      currency,
      timeImpactDays: timeImpactDays ? Math.round(timeImpactDays) : null,
      status: 'DRAFT',
      linkedDocumentId,
      linkedTaskId,
      notes,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.VARIATION_CREATED,
    entityType: 'Variation',
    entityId: variation.id,
    metadata: { variationNumber, title, reason, amount },
  })

  return success({ variation }, 201)
})
