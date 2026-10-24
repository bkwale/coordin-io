import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { modulesPrisma } from '@/lib/prisma-modules'
import { prisma } from '@/lib/prisma'
import { PermissionError } from '@/lib/errors'
import { parseBody, requireString, requireNumber } from '@/lib/validation'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/projects/[id]/resource-plan — Project resource allocations by week.
 *
 * Returns all resource allocations for this project, with member details,
 * grouped by week. Used by the project Stages page resource planning grid.
 *
 * Query: weeks=6 (default 6)
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  if (profile.orgPermission === 'MEMBER') {
    throw new PermissionError('Only managers and above can view resource plans')
  }

  const url = new URL(request.url)
  const weeksCount = parseInt(url.searchParams.get('weeks') ?? '6', 10)
  const offsetDays = parseInt(url.searchParams.get('offset') ?? '0', 10) * 7

  // Current week's Monday + offset
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1 + offsetDays)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + weeksCount * 7)

  // Fetch allocations for this project
  const allocations = await modulesPrisma.resourceAllocation.findMany({
    where: {
      projectId,
      weekStarting: { gte: weekStart, lt: weekEnd },
    },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
    },
    orderBy: [{ weekStarting: 'asc' }, { profile: { fullName: 'asc' } }],
  })

  // Fetch project members for the allocation dropdown
  const members = await prisma.projectMembership.findMany({
    where: { projectId },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
    },
  })

  // Fetch current work stage
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { currentWorkStage: true },
  })

  // Generate week headers
  const weeks: { start: string; label: string }[] = []
  for (let i = 0; i < weeksCount; i++) {
    const ws = new Date(weekStart)
    ws.setDate(weekStart.getDate() + i * 7)
    weeks.push({
      start: ws.toISOString().split('T')[0],
      label: ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    })
  }

  return success({
    allocations,
    members: members.map((m) => ({
      profileId: m.profile.id,
      fullName: m.profile.fullName,
      jobTitle: m.profile.jobTitle,
      role: m.projectRole,
    })),
    weeks,
    currentWorkStage: project.currentWorkStage,
  })
})

/**
 * POST /api/projects/[id]/resource-plan — Upsert a resource allocation.
 *
 * Body: { profileId, weekStarting, hoursAllocated, role?, stage?, isBillable?, notes? }
 * MANAGER+ only.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  if (profile.orgPermission === 'MEMBER') {
    throw new PermissionError('Only managers and above can manage resource plans')
  }

  const body = await parseBody(request)
  const profileId = requireString(body, 'profileId')
  const weekStarting = new Date(requireString(body, 'weekStarting'))
  const hoursAllocated = requireNumber(body, 'hoursAllocated')
  const role = typeof body.role === 'string' ? body.role : undefined
  const stage = typeof body.stage === 'string' ? body.stage : undefined
  const isBillable = typeof body.isBillable === 'boolean' ? body.isBillable : true
  const notes = typeof body.notes === 'string' ? body.notes : undefined

  // Upsert by profileId + projectId + weekStarting
  const existing = await modulesPrisma.resourceAllocation.findFirst({
    where: { profileId, projectId, weekStarting },
  })

  let allocation
  if (existing) {
    allocation = await modulesPrisma.resourceAllocation.update({
      where: { id: existing.id },
      data: { hoursAllocated, role, stage, isBillable, notes },
      include: { profile: { select: { id: true, fullName: true, jobTitle: true } } },
    })
  } else {
    allocation = await modulesPrisma.resourceAllocation.create({
      data: { profileId, projectId, weekStarting, hoursAllocated, role, stage, isBillable, notes },
      include: { profile: { select: { id: true, fullName: true, jobTitle: true } } },
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'project.resource_allocation_updated',
    entityType: 'project',
    entityId: projectId,
    metadata: { profileId, weekStarting: weekStarting.toISOString(), hoursAllocated },
  })

  return success({ allocation })
})
