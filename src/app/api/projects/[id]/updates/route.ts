import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { requireString, optionalString, optionalEnum, parseBody } from '@/lib/validation'
import { createNotifications, NOTIFICATION_EVENTS } from '@/lib/notifications'

/**
 * GET /api/projects/[id]/updates — List project updates.
 *
 * Optional query params:
 * - category: filter by healthOverride category (if we treat it as category)
 * - limit: max results (default 20)
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20

  const updates = await prisma.projectUpdate.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return success({ updates })
})

/**
 * POST /api/projects/[id]/updates — Create a project update.
 *
 * Fields match the ProjectUpdate schema: progress, issues, decisions, actions,
 * healthOverride, healthReason, weekEnding.
 *
 * When created, notify all project team members.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const progress = requireString(body.progress, 'Progress', 5000)
  const issues = optionalString(body.issues, 'Issues', 5000)
  const decisions = optionalString(body.decisions, 'Decisions', 5000)
  const actions = optionalString(body.actions, 'Actions', 5000)
  const healthOverride = optionalEnum(body.healthOverride, 'Health override', [
    'GREEN', 'AMBER', 'RED',
  ] as const)
  const healthReason = optionalString(body.healthReason, 'Health reason', 2000)

  // Default weekEnding to current week's Friday
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + (7 - dayOfWeek)
  const friday = new Date(now)
  friday.setDate(now.getDate() + daysUntilFriday)
  friday.setHours(23, 59, 59, 999)

  const weekEnding = body.weekEnding ? new Date(String(body.weekEnding)) : friday

  const update = await prisma.projectUpdate.create({
    data: {
      projectId,
      authorId: profile.id,
      weekEnding,
      progress,
      issues,
      decisions,
      actions,
      healthOverride: healthOverride ?? null,
      healthReason,
    },
  })

  // Notify all project team members
  const members = await prisma.projectMembership.findMany({
    where: {
      projectId,
      removedAt: null,
      profileId: { not: profile.id }, // Don't notify the author
    },
    select: { profileId: true },
  })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  })

  if (members.length > 0) {
    await createNotifications(
      members,
      {
        type: NOTIFICATION_EVENTS.PROJECT_UPDATE,
        title: `Project update: ${project?.name ?? 'Unknown'}`,
        body: progress.substring(0, 200),
        linkUrl: `/projects/${projectId}`,
      },
    )
  }

  return success({ update }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
