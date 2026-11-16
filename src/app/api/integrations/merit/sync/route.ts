import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { PermissionError, ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { recordAuditEvent } from '@/lib/audit'
import { MeritApiError } from '@/lib/integrations/merit/client'
import { pushInvoicesToMerit } from '@/lib/integrations/merit/push'

export const maxDuration = 60

/** POST /api/integrations/merit/sync — send invoices that are not in Merit yet (up to 25 per run). ADMIN/OWNER. */
export const POST = withAuth(async (_request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') throw new PermissionError('Only admins and owners can send invoices to Merit')
  if (!(await isFeatureEnabled(profile.organisationId, 'invoicing'))) throw new ValidationError('Invoicing is not enabled for your organisation')
  try {
    const result = await pushInvoicesToMerit(profile.organisationId)
    await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: 'merit.sync', entityType: 'integration', entityId: 'merit', metadata: { synced: result.synced, failed: result.failed, eInvoiced: result.eInvoiced } })
    return success(result)
  } catch (e) {
    if (e instanceof MeritApiError) throw new ValidationError(e.message)
    throw e
  }
})
