import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'

/**
 * GET /api/projects/[id]/info-in — List incoming documents (Info In).
 *
 * Returns empty array until InfoIn model is added to the Prisma schema.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId: _projectId }) => {
  // TODO: Wire to Prisma when InfoIn model is added
  return success({ incomingDocuments: [] })
})

/**
 * POST /api/projects/[id]/info-in — Log an incoming document.
 *
 * Stub — returns 501 until InfoIn model is added to the schema.
 */
export const POST = withProjectAccess(async (_request: NextRequest) => {
  return success({ message: 'InfoIn model not yet in schema — using client-side state' }, 501)
})
