import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, optionalDate, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

/**
 * GET /api/fee-quotes — List fee quotes for the organisation.
 *
 * MANAGER+ can view. Returns quotes with line item count and totals.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const quotes = await prisma.feeQuote.findMany({
    where: { organisationId: profile.organisationId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ quotes })
}, { requiredPermission: 'MANAGER' })

/**
 * POST /api/fee-quotes — Create a new fee quote with line items.
 *
 * ADMIN/OWNER only (quotes_invoices:create_edit).
 * Auto-generates quoteNumber as QT-{org-initials}-{sequential}.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Permission: ADMIN or OWNER only
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can create fee quotes')
  }

  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const clientName = requireString(body.clientName, 'Client name', 200)
  const clientEmail = optionalString(body.clientEmail, 'Client email', 200)
  const clientAddress = optionalString(body.clientAddress, 'Client address', 500)
  const description = optionalString(body.description, 'Description', 2000)
  const notes = optionalString(body.notes, 'Notes', 2000)
  const termsAndConditions = optionalString(body.termsAndConditions, 'Terms and conditions', 5000)
  const projectId = optionalId(body.projectId, 'Project ID')
  const validUntil = optionalDate(body.validUntil, 'Valid until')

  // Currency validation
  const validCurrencies: string[] = ['NGN', 'GBP', 'USD', 'EUR']
  const currencyStr = typeof body.currency === 'string' && validCurrencies.includes(body.currency)
    ? body.currency
    : 'GBP'
  const currency = currencyStr as 'NGN' | 'GBP' | 'USD' | 'EUR'

  // Tax rate (default 20%)
  const taxRate = typeof body.taxRate === 'number' && !isNaN(body.taxRate)
    ? body.taxRate
    : 20

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
    const total = Math.round(quantity * unitPrice * 100) / 100
    return { description: desc, quantity, unitPrice, total, sortOrder: idx }
  })

  // Calculate totals
  const netTotal = Math.round(lineItems.reduce((sum, li) => sum + li.total, 0) * 100) / 100
  const taxAmount = Math.round(netTotal * (taxRate / 100) * 100) / 100
  const grossTotal = Math.round((netTotal + taxAmount) * 100) / 100

  // Verify project belongs to org if provided
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) {
      throw new ValidationError('Project not found in this organisation')
    }
  }

  // Auto-generate quote number: QT-{org-initials}-{sequential}
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })
  const initials = (org?.name || 'ORG')
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3)

  const lastQuote = await prisma.feeQuote.findFirst({
    where: { organisationId: profile.organisationId },
    orderBy: { createdAt: 'desc' },
    select: { quoteNumber: true },
  })

  let seq = 1
  if (lastQuote?.quoteNumber) {
    const match = lastQuote.quoteNumber.match(/-(\d+)$/)
    if (match) seq = parseInt(match[1], 10) + 1
  }
  const quoteNumber = `QT-${initials}-${String(seq).padStart(4, '0')}`

  const quote = await prisma.feeQuote.create({
    data: {
      organisationId: profile.organisationId,
      projectId,
      quoteNumber,
      title,
      clientName,
      clientEmail,
      clientAddress,
      description,
      status: 'DRAFT',
      netTotal,
      taxRate,
      taxAmount,
      grossTotal,
      currency,
      validUntil,
      notes,
      termsAndConditions,
      createdById: profile.id,
      lineItems: {
        create: lineItems,
      },
    },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  return success({ quote }, 201)
}, { requiredPermission: 'MANAGER' })
