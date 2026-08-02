import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'

/**
 * GET /api/projects/[id]/info-in/[infoId] — Get a single incoming document.
 *
 * Stub — returns 501 until InfoIn model is added to the schema.
 */
export const GET = withProjectAccess(async (_request: NextRequest) => {
  return success({ message: 'InfoIn model not yet in schema — using client-side state' }, 501)
})

/**
 * PATCH /api/projects/[id]/info-in/[infoId] — Update an incoming document.
 *
 * Stub — returns 501 until InfoIn model is added to the schema.
 */
export const PATCH = withProjectAccess(async (_request: NextRequest) => {
  return success({ message: 'InfoIn model not yet in schema — using client-side state' }, 501)
})
