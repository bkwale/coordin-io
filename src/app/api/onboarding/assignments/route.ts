import { isProbationClosed } from '@/lib/staffing/probation'
class SkipProbation extends Error {}
import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, requireDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ConflictError, ValidationError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { getEffectiveProbationMonths } from '@/lib/org-settings'
import { isEmployeeType, planTasks, normaliseWindowDays, windowFor, windowState, daysRemaining, type EmployeeType } from '@/lib/onboarding/seven-day'

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
  const isHROrAbove = profile.orgPermission === 'HR' || isAdmin
  const isManager = isHROrAbove || profile.orgPermission === 'MANAGER'

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
    employeeType?: string
    addOnTemplateIds?: string[]
    windowDays?: number
    windowStartAt?: Date | null
    windowDueAt?: Date | null
    submittedAt?: Date | null
    verifiedAt?: Date | null
  }) => {
    const tasks = a.tasks
    const total = tasks.length
    const completed = tasks.filter((t: { status: string }) => t.status === 'COMPLETED' || t.status === 'WAIVED').length
    const overdue = tasks.filter((t: { status: string; dueDate: Date | null }) =>
      t.dueDate && (() => {
        const due = new Date(t.dueDate); due.setHours(0,0,0,0);
        const now = new Date(); now.setHours(0,0,0,0);
        return due < now;
      })()
      && t.status !== 'COMPLETED' && t.status !== 'WAIVED'
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
      employeeType: a.employeeType ?? 'NEW',
      addOnTemplateIds: a.addOnTemplateIds ?? [],
      window: {
        days: a.windowDays ?? 7,
        startAt: a.windowStartAt ?? null,
        dueAt: a.windowDueAt ?? null,
        submittedAt: a.submittedAt ?? null,
        verifiedAt: a.verifiedAt ?? null,
        state: windowState({ windowStartAt: a.windowStartAt ?? null, windowDueAt: a.windowDueAt ?? null, submittedAt: a.submittedAt ?? null, verifiedAt: a.verifiedAt ?? null }),
        daysRemaining: daysRemaining({ windowDueAt: a.windowDueAt ?? null }),
      },
    }
  })

  return success({ assignments: result })
})

/**
 * POST /api/onboarding/assignments — Assign a template to an employee.
 *
 * Admin/Owner/HR/Manager only. Auto-creates OnboardingTask records from template items.
 * Calculates due dates from employee start date.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isManager = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'HR' || profile.orgPermission === 'MANAGER'
  if (!isManager) {
    throw new PermissionError('Only managers, HR, and admins can assign onboarding templates')
  }

  const body = await parseBody(request)

  const templateId = requireString(body.templateId, 'templateId')
  const targetProfileId = requireString(body.profileId, 'profileId')
  const startDate = requireDate(body.startDate, 'startDate')
  // Seven-day framework: NEW starters vs EXISTING staff joining Coordin; role add-ons; window length
  const employeeType: EmployeeType = body.employeeType === undefined ? 'NEW' : isEmployeeType(body.employeeType) ? body.employeeType : (() => { throw new ValidationError('employeeType must be NEW or EXISTING') })()
  const addOnTemplateIds: string[] = Array.isArray(body.addOnTemplateIds)
    ? [...new Set((body.addOnTemplateIds as unknown[]).filter((x): x is string => typeof x === 'string' && x !== templateId))].slice(0, 10)
    : []
  const windowDays = normaliseWindowDays(body.windowDays)
  // HR may start the window on a chosen date; otherwise it starts when the employee activates their invitation
  const windowStart = body.windowStartDate ? requireDate(body.windowStartDate, 'windowStartDate') : null

  // Verify template belongs to org and is active
  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId, isActive: true },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!template) {
    throw new NotFoundError('Template not found or inactive')
  }
  const addOns = addOnTemplateIds.length
    ? await modulesPrisma.onboardingTemplate.findMany({
        where: { id: { in: addOnTemplateIds }, organisationId: profile.organisationId, isActive: true },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
    : []
  if (addOns.length !== addOnTemplateIds.length) throw new NotFoundError('One or more add-on templates were not found or are inactive')

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
        employeeType,
        addOnTemplateIds: addOns.map((t: { id: string }) => t.id),
        windowDays,
        ...(windowStart ? windowFor(windowStart, windowDays) : {}),
      },
    })

    // Core + add-on items → tasks: filtered by employee type, no duplicates, employee tasks due inside the window
    const planned = planTasks({ core: template, addOns, employeeType, employeeId: targetProfileId, startDate, windowDays })
    const tasksData = planned.map((t) => ({ assignmentId: newAssignment.id, status: 'PENDING', ...t }))

    if (tasksData.length > 0) {
      await tx.onboardingTask.createMany({ data: tasksData })
    }

    return newAssignment
  })

  // Auto-generate probation reviews if none exist for this employee
  try {
    // Existing staff keep their service history and settled probation (Ayo 1.2)
    if (employeeType === 'EXISTING') throw new SkipProbation()
    const existingReviews = await modulesPrisma.probationReview.count({
      where: { profileId: targetProfileId },
    })
    if (existingReviews === 0) {
      // Check if employee has probation dates set; if not, default from startDate
      const empProfile = await modulesPrisma.employeeProfile.findUnique({
        where: { profileId: targetProfileId },
        select: { probationStartDate: true, probationLength: true, probationStatus: true },
      })
      // BUG-016: an employee whose probation is already closed (confirmed, historic, N/A) is not put back on probation
      if (isProbationClosed(empProfile?.probationStatus)) throw new SkipProbation()

      // Always use the assignment's startDate for new probation reviews —
      // empProfile.probationStartDate may be stale from prior data
      const probStart = startDate
      const probMonths = await getEffectiveProbationMonths(empProfile?.probationLength, profile.organisationId)

      const milestones: { type: string; daysOffset: number }[] = []
      // Day 7: agree responsibilities, expectations and goals (Ayo §2.3)
      milestones.push({ type: 'Initial objectives', daysOffset: 7 })
      if (probMonths >= 1) milestones.push({ type: '30-day', daysOffset: 30 })
      if (probMonths >= 2) milestones.push({ type: '60-day', daysOffset: 60 })
      if (probMonths >= 3) milestones.push({ type: '90-day', daysOffset: 90 })
      // Add final review — but skip if it would duplicate an existing milestone
      const finalOffset = probMonths * 30
      if (!milestones.some((m) => m.daysOffset === finalOffset)) {
        milestones.push({ type: 'final', daysOffset: finalOffset })
      } else {
        // Replace the duplicate with 'final' (probation completion is more important)
        const idx = milestones.findIndex((m) => m.daysOffset === finalOffset)
        milestones[idx] = { type: 'final', daysOffset: finalOffset }
      }

      for (const milestone of milestones) {
        const scheduledDate = new Date(probStart)
        scheduledDate.setDate(scheduledDate.getDate() + milestone.daysOffset)
        await modulesPrisma.probationReview.create({
          data: {
            profileId: targetProfileId,
            reviewType: milestone.type,
            scheduledDate,
          },
        })
      }

      // Always sync probation dates from the assignment's start date
      {
        const probEnd = new Date(probStart)
        probEnd.setMonth(probEnd.getMonth() + probMonths)
        await modulesPrisma.employeeProfile.upsert({
          where: { profileId: targetProfileId },
          create: {
            profileId: targetProfileId,
            probationStartDate: probStart,
            probationEndDate: probEnd,
            probationLength: probMonths,
            probationStatus: 'PROBATION',
          },
          update: {
            probationStartDate: probStart,
            probationEndDate: probEnd,
            probationLength: probMonths,
            probationStatus: 'PROBATION',
          },
        })
      }
    }
  } catch (e) {
    // Best-effort; SkipProbation is the deliberate early exit for closed probations
    if (!(e instanceof SkipProbation)) console.warn('[onboarding] probation auto-generation failed', e)
  }

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
    metadata: { templateId, targetProfileId, templateName: template.name, employeeType, addOnTemplateIds: addOns.map((t: { id: string }) => t.id), windowDays },
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
