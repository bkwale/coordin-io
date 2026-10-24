import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { optionalString, parseBody } from '@/lib/validation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError, NotFoundError } from '@/lib/errors'

/**
 * GET /api/suppliers/[id] — Get supplier details with recent invoices.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const supplier = await prisma.supplier.findFirst({
    where: { id, organisationId: profile.organisationId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      inboundInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          grossAmount: true,
          currency: true,
          status: true,
        },
      },
      categorisationRules: {
        where: { active: true },
        orderBy: { priority: 'desc' },
      },
      _count: { select: { inboundInvoices: true } },
    },
  })

  if (!supplier) throw new NotFoundError('Supplier')

  return success({ supplier })
}, { requiredPermission: 'MANAGER' })

/**
 * PATCH /api/suppliers/[id] — Update supplier details.
 *
 * ADMIN/OWNER only.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can edit suppliers')
  }

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const existing = await prisma.supplier.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Supplier')

  const body = await parseBody(request)

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = optionalString(body.name, 'Name', 200) ?? existing.name
  if (body.vatNumber !== undefined) updates.vatNumber = optionalString(body.vatNumber, 'VAT number', 50)
  if (body.peppolId !== undefined) updates.peppolId = optionalString(body.peppolId, 'Peppol ID', 100)
  if (body.country !== undefined) updates.country = optionalString(body.country, 'Country', 2)
  if (body.address !== undefined) updates.address = optionalString(body.address, 'Address', 500)
  if (body.defaultAccountCode !== undefined) updates.defaultAccountCode = optionalString(body.defaultAccountCode, 'Default account code', 20)
  if (body.contactEmail !== undefined) updates.contactEmail = optionalString(body.contactEmail, 'Contact email', 200)
  if (body.contactPhone !== undefined) updates.contactPhone = optionalString(body.contactPhone, 'Contact phone', 50)
  if (body.notes !== undefined) updates.notes = optionalString(body.notes, 'Notes', 2000)
  if (typeof body.paymentTermsDays === 'number') updates.paymentTermsDays = Math.round(body.paymentTermsDays)
  if (typeof body.active === 'boolean') updates.active = body.active

  // Duplicate VAT check if changing
  if (updates.vatNumber && updates.vatNumber !== existing.vatNumber) {
    const dup = await prisma.supplier.findFirst({
      where: {
        organisationId: profile.organisationId,
        vatNumber: updates.vatNumber as string,
        id: { not: id },
      },
    })
    if (dup) {
      throw new ValidationError(`VAT number already used by supplier: ${dup.name}`)
    }
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: updates,
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ supplier })
}, { requiredPermission: 'MANAGER' })
