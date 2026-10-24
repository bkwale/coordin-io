import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'

function extractId(url: string): string {
  const match = url.match(/\/outbound-invoices\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Invoice not found')
  return match[1]
}

const INCLUDE = {
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: { select: { id: true, fullName: true } },
  project: { select: { id: true, name: true, code: true } },
  supplier: { select: { id: true, name: true } },
  sourceQuote: { select: { id: true, quoteNumber: true, title: true } },
}

/**
 * GET /api/outbound-invoices/[id] — Get a single outbound invoice with line items.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }
  const id = extractId(request.url)

  const invoice = await prisma.outboundInvoice.findUnique({
    where: { id },
    include: INCLUDE,
  })

  if (!invoice || invoice.organisationId !== profile.organisationId) {
    throw new NotFoundError('Invoice not found')
  }

  return success({ invoice })
})

/**
 * PATCH /api/outbound-invoices/[id] — Update an outbound invoice.
 *
 * Status transitions: DRAFT→SENT, SENT→VIEWED/PAID/OVERDUE/VOIDED, OVERDUE→PAID/VOIDED, etc.
 * Full field update only for DRAFT invoices.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const patchEnabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!patchEnabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can update invoices')
  }

  const id = extractId(request.url)
  const body = await parseBody(request)

  const existing = await prisma.outboundInvoice.findUnique({
    where: { id },
    include: { lineItems: true },
  })

  if (!existing || existing.organisationId !== profile.organisationId) {
    throw new NotFoundError('Invoice not found')
  }

  // Status transition
  if (body.status && typeof body.status === 'string') {
    const newStatus = body.status as string
    const allowed: Record<string, string[]> = {
      DRAFT: ['SENT', 'VOIDED'],
      SENT: ['VIEWED', 'PAID', 'OVERDUE', 'VOIDED'],
      VIEWED: ['PAID', 'OVERDUE', 'VOIDED'],
      OVERDUE: ['PAID', 'VOIDED'],
      PAID: ['CREDITED'],
      VOIDED: [],
      CREDITED: [],
    }

    const currentAllowed = allowed[existing.status] || []
    if (!currentAllowed.includes(newStatus)) {
      throw new ValidationError(`Cannot transition from ${existing.status} to ${newStatus}`)
    }

    const statusData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'SENT') statusData.sentAt = new Date()
    if (newStatus === 'VIEWED') statusData.viewedAt = new Date()
    if (newStatus === 'PAID') statusData.paidAt = new Date()

    const updated = await prisma.outboundInvoice.update({
      where: { id },
      data: statusData,
      include: INCLUDE,
    })

    return success({ invoice: updated })
  }

  // Full update — DRAFT only
  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT invoices can be edited')
  }

  const updateData: Record<string, unknown> = {}

  if (body.clientName !== undefined) updateData.clientName = requireString(body.clientName, 'Client name', 200)
  if (body.clientEmail !== undefined) updateData.clientEmail = optionalString(body.clientEmail, 'Client email', 200)
  if (body.clientAddress !== undefined) updateData.clientAddress = optionalString(body.clientAddress, 'Client address', 500)
  if (body.notes !== undefined) updateData.notes = optionalString(body.notes, 'Notes', 2000)
  if (body.termsAndConditions !== undefined) updateData.termsAndConditions = optionalString(body.termsAndConditions, 'Payment terms', 5000)
  if (body.projectId !== undefined) updateData.projectId = optionalId(body.projectId, 'Project ID')
  if (body.supplierId !== undefined) updateData.supplierId = optionalId(body.supplierId, 'Supplier ID')
  if (body.invoiceDate !== undefined) updateData.invoiceDate = new Date(body.invoiceDate as string)
  if (body.dueDate !== undefined) updateData.dueDate = optionalDate(body.dueDate, 'Due date')

  const validCurrencies: string[] = ['NGN', 'GBP', 'USD', 'EUR']
  if (typeof body.currency === 'string' && validCurrencies.includes(body.currency)) {
    updateData.currency = body.currency
  }

  const taxRate = typeof body.taxRate === 'number' && !isNaN(body.taxRate) ? body.taxRate : undefined
  if (taxRate !== undefined) updateData.taxRate = taxRate

  // Replace line items if provided
  if (Array.isArray(body.lineItems) && body.lineItems.length > 0) {
    const effectiveTaxRate = taxRate ?? existing.taxRate

    const lineItems = body.lineItems.map((item: Record<string, unknown>, idx: number) => {
      const desc = requireString(item.description, `Line item ${idx + 1} description`, 500)
      const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0
      if (unitPrice < 0) throw new ValidationError(`Line item ${idx + 1} unit price cannot be negative`)
      const vatRate = typeof item.vatRate === 'number' ? item.vatRate : effectiveTaxRate
      const lineTotal = Math.round(quantity * unitPrice * 100) / 100
      return { description: desc, quantity, unitPrice, vatRate, lineTotal, sortOrder: idx }
    })

    const netAmount = Math.round(lineItems.reduce((sum: number, li: { lineTotal: number }) => sum + li.lineTotal, 0) * 100) / 100
    const vatAmount = Math.round(netAmount * (effectiveTaxRate / 100) * 100) / 100
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100

    updateData.netAmount = netAmount
    updateData.vatAmount = vatAmount
    updateData.grossAmount = grossAmount

    await prisma.outboundInvoiceLine.deleteMany({ where: { invoiceId: id } })
    updateData.lineItems = { create: lineItems }
  } else if (taxRate !== undefined) {
    const netAmount = existing.netAmount
    const vatAmount = Math.round(netAmount * (taxRate / 100) * 100) / 100
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100
    updateData.vatAmount = vatAmount
    updateData.grossAmount = grossAmount
  }

  const updated = await prisma.outboundInvoice.update({
    where: { id },
    data: updateData,
    include: INCLUDE,
  })

  return success({ invoice: updated })
})

/**
 * DELETE /api/outbound-invoices/[id] — Delete an outbound invoice.
 *
 * OWNER only. Only DRAFT invoices can be deleted.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const delEnabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!delEnabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only owners can delete invoices')
  }

  const id = extractId(request.url)

  const existing = await prisma.outboundInvoice.findUnique({ where: { id } })
  if (!existing || existing.organisationId !== profile.organisationId) {
    throw new NotFoundError('Invoice not found')
  }

  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT invoices can be deleted')
  }

  await prisma.outboundInvoice.delete({ where: { id } })

  return success({ deleted: true })
})
