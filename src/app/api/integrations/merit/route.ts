import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody, requireString } from '@/lib/validation'
import { PermissionError, ValidationError } from '@/lib/errors'
import { sealSecret } from '@/lib/secret-box'
import { recordAuditEvent } from '@/lib/audit'
import { firmDefaults } from '@/lib/region-server'
import { MeritApiError, getTaxes, pickTax } from '@/lib/integrations/merit/client'

function adminOnly(p: { orgPermission: string }) {
  if (p.orgPermission !== 'ADMIN' && p.orgPermission !== 'OWNER') throw new PermissionError('Only admins and owners can manage integrations')
}

/** GET /api/integrations/merit — connection status. Never returns the API ID or key. */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  adminOnly(profile)
  const connection = await prisma.meritConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
    select: { id: true, defaultTaxName: true, defaultTaxPct: true, sendEInvoice: true, lastCheckedAt: true, lastSyncAt: true, lastSyncError: true, connectedAt: true },
  })
  const waiting = connection
    ? await prisma.outboundInvoice.count({ where: { organisationId: profile.organisationId, externalId: null, status: { notIn: ['DRAFT', 'VOIDED'] }, documentType: 'INVOICE' } })
    : 0
  return success({ connected: !!connection, connection, waiting })
})

/**
 * POST /api/integrations/merit — connect. Body: { apiId, apiKey, sendEInvoice? }.
 * The credentials are checked against Merit before anything is stored, then sealed.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  adminOnly(profile)
  const body = await parseBody(request)
  const apiId = requireString(body.apiId, 'API ID', 100).trim()
  const apiKey = requireString(body.apiKey, 'API key', 200).trim()
  const sendEInvoice = body.sendEInvoice === true

  let taxes
  try {
    taxes = await getTaxes({ apiId, apiKey })
  } catch (e) {
    throw new ValidationError(e instanceof MeritApiError ? e.message : 'Could not reach Merit. Try again in a few minutes.')
  }
  const { vatRate } = await firmDefaults(profile.organisationId)
  const standard = pickTax(taxes, vatRate ?? 24)
  const zero = pickTax(taxes, 0)

  const data = {
    apiId: sealSecret(apiId), apiKey: sealSecret(apiKey), sendEInvoice,
    defaultTaxId: standard?.Id ?? null, defaultTaxName: standard?.Name ?? null, defaultTaxPct: standard ? Number(standard.TaxPct) : null,
    zeroTaxId: zero?.Id ?? null, lastCheckedAt: new Date(), lastSyncError: null,
    active: true, disconnectedAt: null, connectedById: profile.id, connectedAt: new Date(),
  }
  const existing = await prisma.meritConnection.findFirst({ where: { organisationId: profile.organisationId }, orderBy: { connectedAt: 'desc' }, select: { id: true } })
  if (existing) await prisma.meritConnection.update({ where: { id: existing.id }, data })
  else await prisma.meritConnection.create({ data: { ...data, organisationId: profile.organisationId } })

  await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: 'merit.connected', entityType: 'integration', entityId: 'merit', metadata: { sendEInvoice, taxRates: taxes.length } })
  return success({ connected: true, defaultTaxName: standard?.Name ?? null, taxRates: taxes.length })
})

/** DELETE /api/integrations/merit — disconnect and blank the stored credentials. */
export const DELETE = withAuth(async (_request: NextRequest, { profile }) => {
  adminOnly(profile)
  const res = await prisma.meritConnection.updateMany({
    where: { organisationId: profile.organisationId, active: true },
    data: { active: false, disconnectedAt: new Date(), apiId: '', apiKey: '' },
  })
  if (res.count > 0) await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: 'merit.disconnected', entityType: 'integration', entityId: 'merit', metadata: {} })
  return success({ connected: false })
})
