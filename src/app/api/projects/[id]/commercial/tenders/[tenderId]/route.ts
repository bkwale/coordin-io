import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum,
  optionalNumber, optionalDate,
} from '@/lib/validation'
import { NotFoundError, ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const TENDER_STATUSES = [
  'DRAFT', 'ISSUED', 'RETURNS_RECEIVED',
  'UNDER_EVALUATION', 'AWARDED', 'CANCELLED',
] as const

/**
 * Extract tenderId from the URL path.
 */
function extractTenderId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const idx = segments.indexOf('tenders')
  const tenderId = idx >= 0 ? segments[idx + 1] : undefined
  if (!tenderId) throw new NotFoundError('Tender ID is required')
  return tenderId
}

/**
 * GET /api/projects/[id]/commercial/tenders/[tenderId] — Single tender with returns.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const tenderId = extractTenderId(request)

  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, projectId },
    include: {
      returns: {
        orderBy: { amount: 'asc' },
      },
    },
  })

  if (!tender) {
    throw new NotFoundError('Tender not found')
  }

  return success({ tender })
})

/**
 * PATCH /api/projects/[id]/commercial/tenders/[tenderId] — Update tender or add a tender return.
 *
 * To add a tender return, include a `tenderReturn` object in the body.
 * To update the tender itself, include fields directly.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const tenderId = extractTenderId(request)
  const body = await parseBody(request)

  const existing = await prisma.tender.findFirst({
    where: { id: tenderId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Tender not found')
  }

  // Handle adding a tender return
  if (body.tenderReturn && typeof body.tenderReturn === 'object') {
    const tr = body.tenderReturn as Record<string, unknown>

    const contractorName = requireString(tr.contractorName, 'Contractor name', 200)
    const trAmount = tr.amount
    if (trAmount === null || trAmount === undefined || typeof trAmount !== 'number' || isNaN(trAmount)) {
      throw new ValidationError('Tender return amount is required and must be a number')
    }

    const currency = optionalEnum(tr.currency, 'Currency', CURRENCIES) ?? existing.currency
    const returnDate = optionalDate(tr.returnDate, 'Return date')
    const compliant = tr.compliant !== undefined ? Boolean(tr.compliant) : true
    const qualifications = optionalString(tr.qualifications, 'Qualifications', 2000)
    const score = optionalNumber(tr.score, 'Score', { min: 0, max: 100 })
    const recommended = tr.recommended !== undefined ? Boolean(tr.recommended) : false
    const notes = optionalString(tr.notes, 'Notes', 2000)

    const tenderReturn = await prisma.tenderReturn.create({
      data: {
        tenderId,
        contractorName,
        amount: trAmount,
        currency,
        returnDate,
        compliant,
        qualifications,
        score,
        recommended,
        notes,
      },
    })

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: AuditActions.TENDER_RETURN_ADDED,
      entityType: 'TenderReturn',
      entityId: tenderReturn.id,
      metadata: { tenderId, contractorName, amount: trAmount },
    })

    // Fetch updated tender with all returns
    const updatedTender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        returns: {
          orderBy: { amount: 'asc' },
        },
      },
    })

    return success({ tender: updatedTender })
  }

  // Handle updating the tender itself
  const data: Record<string, unknown> = {}

  if ('packageName' in body) data.packageName = optionalString(body.packageName, 'Package name', 200) ?? undefined
  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000)
  if ('estimatedValue' in body) data.estimatedValue = optionalNumber(body.estimatedValue, 'Estimated value', { min: 0 })
  if ('issueDate' in body) data.issueDate = optionalDate(body.issueDate, 'Issue date')
  if ('returnDate' in body) data.returnDate = optionalDate(body.returnDate, 'Return date')
  if ('notes' in body) data.notes = optionalString(body.notes, 'Notes', 5000)
  if ('status' in body) data.status = optionalEnum(body.status, 'Status', TENDER_STATUSES)

  const tender = await prisma.tender.update({
    where: { id: tenderId },
    data,
    include: {
      returns: {
        orderBy: { amount: 'asc' },
      },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TENDER_UPDATED,
    entityType: 'Tender',
    entityId: tenderId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ tender })
})
