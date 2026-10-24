import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, optionalDate, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'

/**
 * GET /api/outbound-invoices — List outbound invoices for the organisation.
 *
 * MANAGER+ can view. Filterable by status, projectId.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const projectId = url.searchParams.get('projectId')

  const where: Record<string, unknown> = { organisationId: profile.organisationId }
  if (status) where.status = status
  if (projectId) where.projectId = projectId

  const invoices = await prisma.outboundInvoice.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true } },
      sourceQuote: { select: { id: true, quoteNumber: true, title: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ invoices })
})

/**
 * POST /api/outbound-invoices — Create a new outbound invoice with line items.
 *
 * ADMIN/OWNER only. Auto-generates invoiceNumber as INV-{org-initials}-{sequential}.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const invoicingEnabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!invoicingEnabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can create invoices')
  }

  const body = await parseBody(request)

  const clientName = requireString(body.clientName, 'Client name', 200)
  const clientEmail = optionalString(body.clientEmail, 'Client email', 200)
  const clientAddress = optionalString(body.clientAddress, 'Client address', 500)
  const notes = optionalString(body.notes, 'Notes', 2000)
  const termsAndConditions = optionalString(body.termsAndConditions, 'Payment terms', 5000)
  const projectId = optionalId(body.projectId, 'Project ID')
  const supplierId = optionalId(body.supplierId, 'Supplier ID')
  const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate as string) : new Date()
  const dueDate = optionalDate(body.dueDate, 'Due date')

  // Currency validation
  const validCurrencies: string[] = ['NGN', 'GBP', 'USD', 'EUR']
  const currency = (typeof body.currency === 'string' && validCurrencies.includes(body.currency)
    ? body.currency
    : 'GBP') as 'NGN' | 'GBP' | 'USD' | 'EUR'

  // Tax rate (default 20%)
  const taxRate = typeof body.taxRate === 'number' && !isNaN(body.taxRate) ? body.taxRate : 20

  // Validate line items
  const rawLineItems = body.lineItems
  if (!Array.isArray(rawLineItems) || rawLineItems.length === 0) {
    throw new ValidationError('At least one line item is required')
  }

  const lineItems = rawLineItems.map((item: Record<string, unknown>, idx: number) => {
    const desc = requireString(item.description, `Line item ${idx + 1} description`, 500)
    const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
    const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0
    if (unitPrice < 0) throw new ValidationError(`Line item ${idx + 1} unit price cannot be negative`)
    const vatRate = typeof item.vatRate === 'number' ? item.vatRate : taxRate
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100
    return { description: desc, quantity, unitPrice, vatRate, lineTotal, sortOrder: idx }
  })

  // Calculate totals
  const netAmount = Math.round(lineItems.reduce((sum, li) => sum + li.lineTotal, 0) * 100) / 100
  const vatAmount = Math.round(netAmount * (taxRate / 100) * 100) / 100
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100

  // Verify project belongs to org
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) throw new ValidationError('Project not found in this organisation')
  }

  // Verify supplier belongs to org
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organisationId: profile.organisationId },
    })
    if (!supplier) throw new ValidationError('Supplier not found in this organisation')
  }

  // Auto-generate invoice number: INV-{org-initials}-{sequential}
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })
  const initials = (org?.name || 'ORG')
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

  const invoice = await prisma.outboundInvoice.create({
    data: {
      organisationId: profile.organisationId,
      projectId,
      supplierId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      clientName,
      clientEmail,
      clientAddress,
      currency,
      netAmount,
      vatAmount,
      grossAmount,
      taxRate,
      notes,
      termsAndConditions,
      status: 'DRAFT',
      createdById: profile.id,
      lineItems: { create: lineItems },
    },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true } },
    },
  })

  return success({ invoice }, 201)
})
