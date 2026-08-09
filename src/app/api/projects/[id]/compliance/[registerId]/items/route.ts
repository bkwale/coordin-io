import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, requireString, optionalString, optionalDate, optionalNumber, optionalId } from '@/lib/validation'

import { NotFoundError, ConflictError } from '@/lib/errors'

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
 * GET /api/projects/[id]/compliance/[registerId]/items — List items for a compliance register.
 * Supports query params: status, section
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const section = url.searchParams.get('section')

  // Verify register belongs to the project
  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const where: Record<string, unknown> = { registerId }
  if (status) where.status = status
  if (section) where.section = section

  const items = await (prisma as any).complianceItem.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return success({ items })
})

/**
 * POST /api/projects/[id]/compliance/[registerId]/items — Create a compliance item.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const body = await parseBody(request)

  // Verify register belongs to the project
  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const requirement = requireString(body.requirement, 'Requirement', 5000)

  // Bug #1 fix: prevent duplicate requirements within the same register
  const existing = await (prisma as any).complianceItem.findFirst({
    where: { registerId, requirement },
  })
  if (existing) {
    throw new ConflictError('A compliance item with this requirement already exists in this register')
  }

  const section = optionalString(body.section, 'Section', 200)
  const source = optionalString(body.source, 'Source', 500)
  const version = optionalString(body.version, 'Version', 100)
  const ownerId = optionalId(body.ownerId, 'Owner ID')
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const evidence = optionalString(body.evidence, 'Evidence', 5000)
  const comments = optionalString(body.comments, 'Comments', 5000)
  const sortOrder = optionalNumber(body.sortOrder, 'Sort order') ?? 0

  const item = await (prisma as any).complianceItem.create({
    data: {
      registerId,
      requirement,
      section,
      source,
      version,
      ownerId,
      dueDate,
      evidence,
      comments,
      sortOrder,
    },
  })

  // Recompute parent register's overallStatus from item-level data
  const allItems = await (prisma as any).complianceItem.findMany({
    where: { registerId },
    select: { status: true },
  })

  let newStatus: string = 'NOT_STARTED'
  if (allItems.length > 0) {
    const statuses = allItems.map((i: { status: string }) => i.status)
    const resolvedStatuses = ['COMPLIANT', 'APPROVED_WITH_CONDITION', 'NOT_APPLICABLE', 'CLOSED']
    const allResolved = statuses.every((s: string) => resolvedStatuses.includes(s))
    const hasNonCompliant = statuses.some((s: string) => s === 'NON_COMPLIANT' || s === 'ACTION_REQUIRED')
    const hasInProgress = statuses.some((s: string) => s === 'IN_PROGRESS' || s === 'EVIDENCE_SUBMITTED' || s === 'UNDER_REVIEW')

    if (allResolved) {
      newStatus = 'COMPLIANT'
    } else if (hasNonCompliant) {
      newStatus = 'ACTION_REQUIRED'
    } else if (hasInProgress) {
      newStatus = 'IN_PROGRESS'
    }
    // else: all items NOT_STARTED → register stays NOT_STARTED
  }

  await (prisma as any).complianceRegister.update({
    where: { id: registerId },
    data: { overallStatus: newStatus },
  })

  return success({ item }, 201)
})
