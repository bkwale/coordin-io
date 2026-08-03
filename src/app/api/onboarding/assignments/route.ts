import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, requireDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ConflictError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

/**
 * GET /api/onboarding/assignments — List onboarding assignments.
 *
 * Query params:
 * - profileId: filter by employee
 * - status: filter by ACTIVE/COMPLETED/CANCELLED
 * - mine: 'true' to show only current user's assignments
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const profileIdFilter = url.searchParams.get('profileId')
  const statusFilter = url.searchParams.get('status')
  const mineOnly = url.searchParams.get('mine') === 'true'

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER' || isAdmin

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }

  if (mineOnly || (!isManager && !profileIdFilter)) {
    where.profileId = profile.id
  } else if (profileIdFilter) {
    // Non-managers can only see their own
    if (!isManager && profileIdFilter !== profile.id) {
      throw new PermissionError('You can only view your own onboarding assignments')
    }
    where.profileId = profileIdFilter
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const assignments = await modulesPrisma.onboardingAssignment.findMany({
    where,
    include: {
      template: { select: { id: true, name: true, roleLevel: true } },
      tasks: {
        select: { id: true, status: true, stage: true, dueDate: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // Look up profile names separately
  const profileIds = [...new Set(assignments.map((a: { profileId: string }) => a.profileId))]
  const profiles = profileIds.length > 0
    ? await modulesPrisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, fullName: true, jobTitle: true, email: true, startDate: true, avatarUrl: true },
      })
    : []
  const profileMap = new Map(profiles.map((p: { id: string }) => [p.id, p]))

  const result = assignments.map((a: {
    id: string
    templateId: string
    profileId: string
    startDate: Date
    status: string
    progress: number
    completedAt: Date | null
    createdAt: Date
    template: { id: string; name: string; roleLevel: string | null }
    tasks: { id: string; status: string; stage: string; dueDate: Date | null }[]
  }) => {
    const tasks = a.tasks
    const total = tasks.length
    const completed = tasks.filter((t: { status: string }) => t.status === 'COMPLETED' || t.status === 'WAIVED').length
    const overdue = tasks.filter((t: { status: string; dueDate: Date | null }) =>
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED' && t.status !== 'WAIVED'
    ).length

    // Stage breakdown
    const stageBreakdown: Record<string, { total: number; completed: number }> = {}
    for (const task of tasks) {
      if (!stageBreakdown[task.stage]) {
        stageBreakdown[task.stage] = { total: 0, completed: 0 }
      }
      stageBreakdown[task.stage].total++
      if (task.status === 'COMPLETED' || task.status === 'WAIVED') {
        stageBreakdown[task.stage].completed++
      }
    }

    const emp = profileMap.get(a.profileId)

    return {
      id: a.id,
      templateId: a.templateId,
      profileId: a.profileId,
      employee: emp ?? { id: a.profileId, fullName: 'Unknown', jobTitle: null, email: null, startDate: null, avatarUrl: null },
      template: a.template,
      startDate: a.startDate,
      status: a.status,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
      taskSummary: { total, completed, overdue },
      stageBreakdown,
    }
  })

  return success({ assignments: result })
})

/**
 * POST /api/onboarding/assignments — Assign a template to an employee.
 *
 * Admin/Owner/Manager only. Auto-creates OnboardingTask records from template items.
 * Calculates due dates from employee start date.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isManager = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'MANAGER'
  if (!isManager) {
    throw new PermissionError('Only managers and admins can assign onboarding templates')
  }

  const body = await parseBody(request)

  const templateId = requireString(body.templateId, 'templateId')
  const targetProfileId = requireString(body.profileId, 'profileId')
  const startDate = requireDate(body.startDate, 'startDate')

  // Verify template belongs to org and is active
  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId, isActive: true },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!template) {
    throw new NotFoundError('Template not found or inactive')
  }

  // Verify target profile is in same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { id: true, organisationId: true, fullName: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new PermissionError('Employee not found in your organisation')
  }

  // Check for existing active assignment with same template
  const existingAssignment = await modulesPrisma.onboardingAssignment.findFirst({
    where: {
      templateId,
      profileId: targetProfileId,
      status: 'ACTIVE',
    },
  })
  if (existingAssignment) {
    throw new ConflictError('This employee already has an active assignment for this template')
  }

  // Create assignment and tasks in a transaction
  const assignment = await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
    // Create the assignment
    const newAssignment = await tx.onboardingAssignment.create({
      data: {
        templateId,
        profileId: targetProfileId,
        organisationId: profile.organisationId,
        assignedById: profile.id,
        startDate,
        status: 'ACTIVE',
        progress: 0,
      },
    })

    // Create tasks from template items
    const tasksData = template.items.map((item: {
      id: string
      stage: string
      category: string | null
      title: string
      daysFromStart: number
      responsibleRole: string | null
      sortOrder: number
    }) => {
      // Calculate due date: startDate + daysFromStart
      const dueDate = new Date(startDate)
      dueDate.setDate(dueDate.getDate() + item.daysFromStart)

      // Determine assignee: EMPLOYEE tasks go to the employee, others stay null for manager to assign
      const assigneeId = item.responsibleRole === 'EMPLOYEE' ? targetProfileId : null

      return {
        assignmentId: newAssignment.id,
        templateItemId: item.id,
        assigneeId,
        title: item.title,
        stage: item.stage,
        category: item.category,
        dueDate,
        status: 'PENDING',
        sortOrder: item.sortOrder,
      }
    })

    if (tasksData.length > 0) {
      await tx.onboardingTask.createMany({ data: tasksData })
    }

    return newAssignment
  })

  // Send notification to the employee
  await createNotification({
    profileId: targetProfileId,
    type: NOTIFICATION_EVENTS.ONBOARDING_TASK_ASSIGNED,
    title: 'Onboarding programme assigned',
    body: `You have been assigned the "${template.name}" onboarding programme. Your start date is ${startDate.toLocaleDateString()}.`,
    linkUrl: '/onboarding',
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'onboarding_assignment.created',
    entityType: 'OnboardingAssignment',
    entityId: assignment.id,
    metadata: { templateId, targetProfileId, templateName: template.name },
  })

  // Return full assignment with tasks
  const fullAssignment = await modulesPrisma.onboardingAssignment.findUnique({
    where: { id: assignment.id },
    include: {
      template: { select: { id: true, name: true } },
      tasks: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return success({ assignment: fullAssignment }, 201)
})
