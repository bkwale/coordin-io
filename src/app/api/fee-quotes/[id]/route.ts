import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

function extractId(url: string): string {
  const match = url.match(/\/fee-quotes\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Fee quote not found')
  return match[1]
}

/**
 * GET /api/fee-quotes/[id] — Get a single fee quote with line items.
 *
 * MANAGER+ can view.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)

  const quote = await prisma.feeQuote.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  if (!quote) {
    throw new NotFoundError('Fee quote not found')
  }

  // Org boundary
  if (quote.organisationId !== profile.organisationId) {
    throw new NotFoundError('Fee quote not found')
  }

  return success({ quote })
}, { requiredPermission: 'MANAGER' })

/**
 * PATCH /api/fee-quotes/[id] — Update a fee quote.
 *
 * ADMIN/OWNER only. Can update details only if DRAFT.
 * Can also transition status (DRAFT→SENT, SENT→ACCEPTED/REJECTED, etc.).
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can update fee quotes')
  }

  const id = extractId(request.url)
  const body = await parseBody(request)

  const existing = await prisma.feeQuote.findUnique({
    where: { id },
    include: { lineItems: true },
  })

  if (!existing) throw new NotFoundError('Fee quote not found')
  if (existing.organisationId !== profile.organisationId) {
    throw new NotFoundError('Fee quote not found')
  }

  // Status transition handling
  if (body.status && typeof body.status === 'string') {
    const newStatus = body.status as string
    const allowed: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'DRAFT'],
      ACCEPTED: ['SUPERSEDED'],
      REJECTED: ['DRAFT'],
      EXPIRED: ['DRAFT'],
      SUPERSEDED: [],
    }

    const currentAllowed = allowed[existing.status] || []
    if (!currentAllowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${existing.status} to ${newStatus}`,
      )
    }

    const statusData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'SENT') statusData.sentAt = new Date()
    if (newStatus === 'ACCEPTED') statusData.acceptedAt = new Date()
    if (newStatus === 'REJECTED') statusData.rejectedAt = new Date()

    const updated = await prisma.feeQuote.update({
      where: { id },
      data: statusData,
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    })

    return success({ quote: updated })
  }

  // Full update — only allowed for DRAFT quotes
  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT quotes can be edited')
  }

  const title = body.title !== undefined ? requireString(body.title, 'Title', 200) : undefined
  const clientName = body.clientName !== undefined ? requireString(body.clientName, 'Client name', 200) : undefined
  const clientEmail = body.clientEmail !== undefined ? optionalString(body.clientEmail, 'Client email', 200) : undefined
  const clientAddress = body.clientAddress !== undefined ? optionalString(body.clientAddress, 'Client address', 500) : undefined
  const description = body.description !== undefined ? optionalString(body.description, 'Description', 2000) : undefined
  const notes = body.notes !== undefined ? optionalString(body.notes, 'Notes', 2000) : undefined
  const termsAndConditions = body.termsAndConditions !== undefined ? optionalString(body.termsAndConditions, 'Terms and conditions', 5000) : undefined
  const projectId = body.projectId !== undefined ? optionalId(body.projectId, 'Project ID') : undefined
  const validUntil = body.validUntil !== undefined ? optionalDate(body.validUntil, 'Valid until') : undefined

  const validCurrencies: string[] = ['NGN', 'GBP', 'USD', 'EUR']
  const currency = typeof body.currency === 'string' && validCurrencies.includes(body.currency)
    ? (body.currency as 'NGN' | 'GBP' | 'USD' | 'EUR')
    : undefined

  const taxRate = typeof body.taxRate === 'number' && !isNaN(body.taxRate)
    ? body.taxRate
    : undefined

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (clientName !== undefined) updateData.clientName = clientName
  if (clientEmail !== undefined) updateData.clientEmail = clientEmail
  if (clientAddress !== undefined) updateData.clientAddress = clientAddress
  if (description !== undefined) updateData.description = description
  if (notes !== undefined) updateData.notes = notes
  if (termsAndConditions !== undefined) updateData.termsAndConditions = termsAndConditions
  if (projectId !== undefined) updateData.projectId = projectId
  if (validUntil !== undefined) updateData.validUntil = validUntil
  if (currency !== undefined) updateData.currency = currency
  if (taxRate !== undefined) updateData.taxRate = taxRate

  // If line items provided, replace them all
  if (Array.isArray(body.lineItems) && body.lineItems.length > 0) {
    const lineItems = body.lineItems.map((item: Record<string, unknown>, idx: number) => {
      const desc = requireString(item.description, `Line item ${idx + 1} description`, 500)
      const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0
      if (unitPrice < 0) throw new ValidationError(`Line item ${idx + 1} unit price cannot be negative`)
      const total = Math.round(quantity * unitPrice * 100) / 100
      return { description: desc, quantity, unitPrice, total, sortOrder: idx }
    })

    const netTotal = Math.round(lineItems.reduce((sum: number, li: { total: number }) => sum + li.total, 0) * 100) / 100
    const effectiveTaxRate = taxRate ?? existing.taxRate
    const taxAmount = Math.round(netTotal * (effectiveTaxRate / 100) * 100) / 100
    const grossTotal = Math.round((netTotal + taxAmount) * 100) / 100

    updateData.netTotal = netTotal
    updateData.taxAmount = taxAmount
    updateData.grossTotal = grossTotal

    // Delete existing line items and create new ones
    await prisma.feeQuoteLineItem.deleteMany({ where: { quoteId: id } })
    updateData.lineItems = { create: lineItems }
  } else if (taxRate !== undefined) {
    // Recalculate tax with new rate using existing net total
    const netTotal = existing.netTotal
    const taxAmount = Math.round(netTotal * (taxRate / 100) * 100) / 100
    const grossTotal = Math.round((netTotal + taxAmount) * 100) / 100
    updateData.taxAmount = taxAmount
    updateData.grossTotal = grossTotal
  }

  // Verify project belongs to org if changing
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) {
      throw new ValidationError('Project not found in this organisation')
    }
  }

  const updated = await prisma.feeQuote.update({
    where: { id },
    data: updateData,
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  return success({ quote: updated })
}, { requiredPermission: 'MANAGER' })

/**
 * DELETE /api/fee-quotes/[id] — Delete a fee quote.
 *
 * OWNER only. Only DRAFT quotes can be deleted.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only owners can delete fee quotes')
  }

  const id = extractId(request.url)

  const existing = await prisma.feeQuote.findUnique({
    where: { id },
  })

  if (!existing) throw new NotFoundError('Fee quote not found')
  if (existing.organisationId !== profile.organisationId) {
    throw new NotFoundError('Fee quote not found')
  }

  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT quotes can be deleted')
  }

  // Line items cascade-delete via onDelete: Cascade
  await prisma.feeQuote.delete({ where: { id } })

  return success({ deleted: true })
}, { requiredPermission: 'MANAGER' })
