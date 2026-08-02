import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, optionalString, optionalEnum } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'

const OVERALL_STATUSES = [
  'NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED',
  'UNDER_REVIEW', 'COMPLIANT', 'NON_COMPLIANT', 'ACTION_REQUIRED',
  'APPROVED_WITH_CONDITION', 'CLOSED',
] as const

/**
 * Extract registerId from the URL path.
 */
function extractRegisterId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const complianceIdx = segments.indexOf('compliance')
  const registerId = complianceIdx >= 0 ? segments[complianceIdx + 1] : undefined
  if (!registerId) {
    throw new NotFoundError('Register ID is required')
  }
  return registerId
}

/**
 * GET /api/projects/[id]/compliance/[registerId] — Get a single compliance register with items.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)

  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
    include: { items: true },
  })

  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  return success({ register })
})

/**
 * PATCH /api/projects/[id]/compliance/[registerId] — Update a compliance register.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const body = await parseBody(request)

  const existing = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Compliance register not found')
  }

  const data: Record<string, unknown> = {}

  if ('name' in body) {
    const name = optionalString(body.name, 'Name', 200)
    if (name !== null) data.name = name
  }
  if ('description' in body) {
    data.description = optionalString(body.description, 'Description', 5000)
  }
  if ('templateVersion' in body) {
    data.templateVersion = optionalString(body.templateVersion, 'Template version', 100)
  }
  if ('overallStatus' in body) {
    const status = optionalEnum(body.overallStatus, 'Overall status', OVERALL_STATUSES)
    if (status) data.overallStatus = status
  }

  if (Object.keys(data).length === 0) {
    return success({ register: existing })
  }

  const register = await (prisma as any).complianceRegister.update({
    where: { id: registerId },
    data,
    include: { items: true },
  })

  return success({ register })
})
