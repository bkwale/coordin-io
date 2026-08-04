import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, requireNumber, requireDate, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

/**
 * GET /api/staffing/allocations — Resource allocations.
 *
 * Query params:
 * - weekStarting: ISO date string (required for weekly view)
 * - profileId: filter by person
 * - projectId: filter by project
 * - weeks: number of weeks to return (default 4)
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const weekParam = url.searchParams.get('weekStarting')
  const profileIdFilter = url.searchParams.get('profileId')
  const projectIdFilter = url.searchParams.get('projectId')
  const weeksCount = parseInt(url.searchParams.get('weeks') ?? '4', 10)

  // Default to current week's Monday
  const now = new Date()
  let weekStart: Date
  if (weekParam) {
    weekStart = new Date(weekParam)
  } else {
    weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  }
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + weeksCount * 7)

  const where: Record<string, unknown> = {
    weekStarting: { gte: weekStart, lt: weekEnd },
    profile: { organisationId: profile.organisationId },
  }
  if (profileIdFilter) where.profileId = profileIdFilter
  if (projectIdFilter) where.projectId = projectIdFilter

  const allocations = await modulesPrisma.resourceAllocation.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      project: { select: { id: true, name: true, code: true, status: true } },
    },
    orderBy: [{ weekStarting: 'asc' }, { profileId: 'asc' }],
  })

  // Also fetch approved leave for the same period to show on the grid
  let approvedLeave: unknown[] = []
  try {
    approvedLeave = await modulesPrisma.leaveRequest.findMany({
      where: {
        profile: { organisationId: profile.organisationId },
        status: 'APPROVED',
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
        ...(profileIdFilter ? { profileId: profileIdFilter } : {}),
      },
      select: {
        id: true,
        profileId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        days: true,
        profile: { select: { fullName: true } },
      },
    })
  } catch {
    // Leave tables may not exist
  }

  // Fetch all active employees for the grid
  const activeEmployees = await modulesPrisma.profile.findMany({
    where: {
      organisationId: profile.organisationId,
      status: 'ACTIVE',
      ...(profileIdFilter ? { id: profileIdFilter } : {}),
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      office: { select: { name: true } },
    },
    orderBy: { fullName: 'asc' },
  })

  // Active projects for the project dropdown
  const activeProjects = await modulesPrisma.project.findMany({
    where: {
      organisationId: profile.organisationId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: 'asc' },
  })

  return success({
    allocations,
    approvedLeave,
    employees: activeEmployees,
    projects: activeProjects,
    weekStarting: weekStart.toISOString(),
    weeksCount,
  })
})

/**
 * POST /api/staffing/allocations — Create or update a resource allocation.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Only admins/owners can manage allocations
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins can manage resource allocations')
  }

  const body = await parseBody(request)

  const targetProfileId = requireString(body.profileId, 'profileId')
  const projectId = requireString(body.projectId, 'projectId')

  const weekStarting = requireDate(body.weekStarting, 'weekStarting')
  weekStarting.setHours(0, 0, 0, 0)

  const hoursAllocated = requireNumber(body.hoursAllocated, 'hoursAllocated', { min: 0, max: 168 })

  // Verify the target profile is in the same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { organisationId: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new ValidationError('Employee not found in your organisation')
  }

  // Verify project is in the same org
  const project = await modulesPrisma.project.findUnique({
    where: { id: projectId },
    select: { organisationId: true },
  })
  if (!project || project.organisationId !== profile.organisationId) {
    throw new ValidationError('Project not found in your organisation')
  }

  // Upsert the allocation
  const allocation = await modulesPrisma.resourceAllocation.upsert({
    where: {
      profileId_projectId_weekStarting: {
        profileId: targetProfileId,
        projectId,
        weekStarting,
      },
    },
    create: {
      profileId: targetProfileId,
      projectId,
      weekStarting,
      hoursAllocated,
      role: body.role ?? null,
      stage: body.stage ?? null,
      isBillable: body.isBillable !== false,
      notes: body.notes ?? null,
    },
    update: {
      hoursAllocated,
      role: body.role ?? undefined,
      stage: body.stage ?? undefined,
      isBillable: body.isBillable !== undefined ? body.isBillable : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.allocation_updated',
    entityType: 'resource_allocation',
    entityId: allocation.id,
    metadata: { targetProfileId, projectId, weekStarting: weekStarting.toISOString(), hoursAllocated },
  })

  return success({ allocation })
}, { requiredPermission: 'ADMIN' })
