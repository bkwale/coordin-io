import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, parseBody } from '@/lib/validation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError } from '@/lib/errors'

/**
 * GET /api/suppliers — List suppliers for the organisation.
 *
 * MANAGER+ can view. Supports ?active=true/false filter and ?search= text filter.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    return success({ suppliers: [], message: 'Invoicing feature is not enabled' })
  }

  const url = new URL(request.url)
  const activeFilter = url.searchParams.get('active')
  const search = url.searchParams.get('search')?.trim()

  const where: Record<string, unknown> = { organisationId: profile.organisationId }
  if (activeFilter === 'true') where.active = true
  if (activeFilter === 'false') where.active = false
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { vatNumber: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } },
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      _count: { select: { inboundInvoices: true } },
    },
    orderBy: { name: 'asc' },
  })

  return success({ suppliers })
}, { requiredPermission: 'MANAGER' })

/**
 * POST /api/suppliers — Create a new supplier.
 *
 * ADMIN/OWNER only. Auto-detects duplicates by VAT number.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing feature is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can create suppliers')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Supplier name', 200)
  const vatNumber = optionalString(body.vatNumber, 'VAT number', 50)
  const peppolId = optionalString(body.peppolId, 'Peppol ID', 100)
  const country = optionalString(body.country, 'Country', 2)
  const address = optionalString(body.address, 'Address', 500)
  const defaultAccountCode = optionalString(body.defaultAccountCode, 'Default account code', 20)
  const contactEmail = optionalString(body.contactEmail, 'Contact email', 200)
  const contactPhone = optionalString(body.contactPhone, 'Contact phone', 50)
  const notes = optionalString(body.notes, 'Notes', 2000)

  const paymentTermsDays = typeof body.paymentTermsDays === 'number' && body.paymentTermsDays >= 0
    ? Math.round(body.paymentTermsDays)
    : null

  // Check for duplicate VAT number within org
  if (vatNumber) {
    const existing = await prisma.supplier.findFirst({
      where: { organisationId: profile.organisationId, vatNumber },
    })
    if (existing) {
      throw new ValidationError(`A supplier with VAT number ${vatNumber} already exists: ${existing.name}`)
    }
  }

  const supplier = await prisma.supplier.create({
    data: {
      organisationId: profile.organisationId,
      name,
      vatNumber,
      peppolId,
      country,
      address,
      defaultAccountCode,
      paymentTermsDays,
      contactEmail,
      contactPhone,
      notes,
      createdById: profile.id,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ supplier }, 201)
}, { requiredPermission: 'MANAGER' })
