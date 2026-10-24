import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, parseBody } from '@/lib/validation'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { recordAuditEvent } from '@/lib/audit'

/**
 * POST /api/outbound-invoices/convert-from-quote — Convert an ACCEPTED fee quote
 * into a DRAFT outbound invoice.
 *
 * Copies all fields and line items. Transitions the quote to INVOICED status.
 * ADMIN/OWNER only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can convert quotes to invoices')
  }

  const body = await parseBody(request)
  const quoteId = requireString(body.quoteId, 'Quote ID', 100)

  // Fetch the quote with line items
  const quote = await prisma.feeQuote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      organisation: { select: { name: true } },
      outboundInvoice: { select: { id: true, invoiceNumber: true } },
    },
  })

  if (!quote || quote.organisationId !== profile.organisationId) {
    throw new NotFoundError('Fee quote not found')
  }

  // Must be ACCEPTED
  if (quote.status !== 'ACCEPTED') {
    throw new ValidationError(
      quote.status === 'INVOICED'
        ? 'This quote has already been converted to an invoice'
        : `Cannot convert a quote with status ${quote.status} — only ACCEPTED quotes can be invoiced`,
    )
  }

  // Check not already converted
  if (quote.outboundInvoice) {
    throw new ValidationError(
      `This quote already has invoice ${quote.outboundInvoice.invoiceNumber}`,
    )
  }

  // Auto-generate invoice number
  const initials = (quote.organisation.name || 'ORG')
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3)

  const lastInvoice = await prisma.outboundInvoice.findFirst({
    where: { organisationId: profile.organisationId },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  })

  let seq = 1
  if (lastInvoice?.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/-(\d+)$/)
    if (match) seq = parseInt(match[1], 10) + 1
  }
  const invoiceNumber = `INV-${initials}-${String(seq).padStart(4, '0')}`

  // Default due date: 30 days from now
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Convert in a transaction: create invoice + transition quote to INVOICED
  const invoice = await prisma.$transaction(async (tx) => {
    // Create outbound invoice from quote data
    const created = await tx.outboundInvoice.create({
      data: {
        organisationId: profile.organisationId,
        sourceQuoteId: quoteId,
        projectId: quote.projectId,
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientAddress: quote.clientAddress,
        currency: quote.currency,
        netAmount: quote.netTotal,
        vatAmount: quote.taxAmount,
        grossAmount: quote.grossTotal,
        taxRate: quote.taxRate,
        notes: quote.notes,
        termsAndConditions: quote.termsAndConditions,
        status: 'DRAFT',
        createdById: profile.id,
        lineItems: {
          create: quote.lineItems.map((li: Record<string, unknown>, idx: number) => ({
            description: li.description as string,
            quantity: li.quantity as number,
            unitPrice: li.unitPrice as number,
            vatRate: quote.taxRate,
            lineTotal: li.total as number,
            sortOrder: idx,
          })),
        },
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true, code: true } },
        sourceQuote: { select: { id: true, quoteNumber: true, title: true } },
      },
    })

    // Transition quote to INVOICED
    await tx.feeQuote.update({
      where: { id: quoteId },
      data: { status: 'INVOICED' },
    })

    return created
  })

  // Audit (non-fatal)
  try {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'outbound_invoice.created_from_quote',
      entityType: 'outbound_invoice',
      entityId: invoice.id,
      metadata: {
        invoiceNumber,
        sourceQuoteId: quoteId,
        sourceQuoteNumber: quote.quoteNumber,
        grossAmount: quote.grossTotal,
        currency: quote.currency,
      },
    })
  } catch {
    console.error(`[outbound-invoices] Audit event failed for invoice ${invoice.id}`)
  }

  return success({ invoice, convertedFromQuote: quote.quoteNumber }, 201)
})
