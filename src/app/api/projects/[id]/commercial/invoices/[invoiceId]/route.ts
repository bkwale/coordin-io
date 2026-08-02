import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, optionalString, optionalEnum, optionalNumber, optionalDate } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'

const INVOICE_STATUSES = [
  'DRAFT', 'ISSUED', 'OVERDUE', 'PARTIALLY_PAID',
  'PAID', 'CANCELLED', 'WRITTEN_OFF',
] as const

/**
 * Extract invoiceId from the URL path.
 */
function extractInvoiceId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const idx = segments.indexOf('invoices')
  const invoiceId = idx >= 0 ? segments[idx + 1] : undefined
  if (!invoiceId) throw new NotFoundError('Invoice ID is required')
  return invoiceId
}

/**
 * GET /api/projects/[id]/commercial/invoices/[invoiceId] — Single invoice detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const invoiceId = extractInvoiceId(request)

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, projectId },
  })

  if (!invoice) {
    throw new NotFoundError('Invoice not found')
  }

  return success({ invoice })
})

/**
 * PATCH /api/projects/[id]/commercial/invoices/[invoiceId] — Update invoice fields or record payment.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const invoiceId = extractInvoiceId(request)
  const body = await parseBody(request)

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Invoice not found')
  }

  const data: Record<string, unknown> = {}

  if ('recipient' in body) data.recipient = optionalString(body.recipient, 'Recipient', 200) ?? undefined
  if ('description' in body) data.description = optionalString(body.description, 'Description', 2000) ?? undefined
  if ('dueDate' in body) data.dueDate = optionalDate(body.dueDate, 'Due date')
  if ('notes' in body) data.notes = optionalString(body.notes, 'Notes', 5000)

  if ('status' in body) {
    const newStatus = optionalEnum(body.status, 'Status', INVOICE_STATUSES)
    if (newStatus) {
      data.status = newStatus
    }
  }

  // Handle payment recording
  if ('paidAmount' in body) {
    const paidAmount = optionalNumber(body.paidAmount, 'Paid amount', { min: 0 })
    if (paidAmount !== null) {
      data.paidAmount = paidAmount
      data.paidDate = optionalDate(body.paidDate, 'Paid date') ?? new Date()

      // Auto-set status based on payment
      if (paidAmount >= existing.grossAmount) {
        data.status = 'PAID'
      } else if (paidAmount > 0) {
        data.status = 'PARTIALLY_PAID'
      }
    }
  }

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.INVOICE_UPDATED,
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ invoice })
})
