import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody } from '@/lib/validation'
import { PermissionError, ValidationError } from '@/lib/errors'
import { getOrgSettings, updateOrgSettings } from '@/lib/org-settings'

export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const settings = await getOrgSettings(profile.organisationId)
  return success({ settings })
})

export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only Admin, Owner, or HR can update organisation settings')
  }

  const body = await parseBody(request)
  const updates: Record<string, unknown> = {}

  if ('defaultProbationMonths' in body) {
    const months = Number(body.defaultProbationMonths)
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      throw new ValidationError('Probation duration must be between 1 and 12 months')
    }
    updates.defaultProbationMonths = months
  }

  const settings = await updateOrgSettings(profile.organisationId, updates)
  return success({ settings })
})
