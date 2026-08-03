import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { requireString, optionalString, optionalEnum, requireDate, parseBody } from '@/lib/validation'

/**
 * GET /api/projects/[id]/milestones — List milestones ordered by dueDate.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId },
    orderBy: { dueDate: 'asc' },
  })

  return success({ milestones })
})

/**
 * POST /api/projects/[id]/milestones — Create a new milestone.
 * Requires PROJECT_LEAD+ role.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = optionalString(body.description, 'Description', 2000)
  const dueDate = requireDate(body.dueDate, 'Due date')
  const category = optionalEnum(body.category, 'Category', [
    'DESIGN_FREEZE', 'PLANNING', 'CONSTRUCTION', 'OPERATOR_REVIEW',
    'STAGE_GATE', 'HANDOVER', 'CUSTOM',
  ] as const)
  const stage = optionalString(body.stage, 'Stage', 100)

  // Determine sort order — place at end
  const lastMilestone = await prisma.projectMilestone.findFirst({
    where: { projectId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId,
      title,
      description,
      dueDate,
      category: category ?? null,
      stage: stage ?? undefined,
      sortOrder: (lastMilestone?.sortOrder ?? 0) + 1,
    },
  })

  return success({ milestone }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
