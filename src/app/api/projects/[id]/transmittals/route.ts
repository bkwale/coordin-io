import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'

/**
 * GET /api/projects/[id]/transmittals — List transmittals (Info Out).
 *
 * Returns empty array until Transmittal model is added to the Prisma schema.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId: _projectId }) => {
  // TODO: Wire to Prisma when Transmittal model is added
  return success({ transmittals: [] })
})

/**
 * POST /api/projects/[id]/transmittals — Create a transmittal.
 *
 * Stub — returns 501 until Transmittal model is added to the schema.
 */
export const POST = withProjectAccess(async (_request: NextRequest) => {
  return success({ message: 'Transmittal model not yet in schema — using client-side state' }, 501)
})
