import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { ValidationError, PermissionError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { parseBody } from '@/lib/validation'
import { recordAuditEvent } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { STAGE_TEMPLATES } from '@/lib/stage-templates'

const RIBA_LABELS: Record<number, string> = {
  0: 'Stage 0 — Strategic Definition',
  1: 'Stage 1 — Preparation & Briefing',
  2: 'Stage 2 — Concept Design',
  3: 'Stage 3 — Spatial Coordination',
  4: 'Stage 4 — Technical Design',
  5: 'Stage 5 — Manufacturing & Construction',
  6: 'Stage 6 — Handover',
  7: 'Stage 7 — Use',
}

const STAGE_ENUM_MAP: Record<number, string> = {
  0: 'BRIEF',
  1: 'BRIEF',
  2: 'CONCEPT',
  3: 'SPATIAL_COORDINATION',
  4: 'WORKING_DRAWINGS',
  5: 'CONSTRUCTION',
  6: 'HANDOVER',
  7: 'OPERATIONS',
}

function getStagePrerequisites(ribaStage: number) {
  return STAGE_TEMPLATES.filter((t) => t.stage === ribaStage)
}

/**
 * GET /api/projects/[id]/stage-gates — Stage transition history.
 *
 * Returns ordered list of all stage gates for this project,
 * plus the current work stage and prerequisite status.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId, profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'riba_tracking')
  if (!enabled) {
    throw new ValidationError('RIBA Stage Tracking is not enabled for your organisation')
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      stage: true,
      currentWorkStage: true,
      workStageFramework: true,
    },
  })

  // Fetch gate history
  const gates = await prisma.stageGate.findMany({
    where: { projectId },
    include: {
      advancedBy: { select: { id: true, fullName: true, jobTitle: true } },
    },
    orderBy: { advancedAt: 'desc' },
  })

  // Get prerequisite status for current stage
  const prerequisites = getStagePrerequisites(project.currentWorkStage)
  const nextStage = project.currentWorkStage + 1
  const nextPrerequisites = nextStage <= 7 ? getStagePrerequisites(nextStage) : []

  // Check which required prerequisites are met by looking at project tasks
  const projectTasks = await prisma.task.findMany({
    where: { projectId, status: 'COMPLETED' },
    select: { title: true },
  })
  const completedTitles = new Set(projectTasks.map((t: { title: string }) => t.title.toLowerCase()))

  const currentPrerequisiteStatus = prerequisites.map((p) => ({
    title: p.task_title,
    required: p.required_flag,
    completed: completedTitles.has(p.task_title.toLowerCase()),
  }))

  return success({
    project: {
      id: project.id,
      name: project.name,
      stage: project.stage,
      currentWorkStage: project.currentWorkStage,
      workStageFramework: project.workStageFramework,
    },
    gates,
    currentPrerequisiteStatus,
    nextStagePrerequisites: nextPrerequisites.map((p) => ({
      title: p.task_title,
      required: p.required_flag,
    })),
  })
})

/**
 * POST /api/projects/[id]/stage-gates — Advance project to the next stage.
 *
 * Body: { signOffNotes?, skipPrerequisites?: boolean }
 * MANAGER+ only. Validates required prerequisites are met unless skipped.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'riba_tracking')
  if (!enabled) {
    throw new ValidationError('RIBA Stage Tracking is not enabled for your organisation')
  }

  if (profile.orgPermission === 'MEMBER') {
    throw new PermissionError('Only managers and above can advance project stages')
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, currentWorkStage: true, stage: true },
  })

  const body = await parseBody(request)
  const signOffNotes = body.signOffNotes as string | undefined
  const skipPrerequisites = body.skipPrerequisites === true

  const fromStage = project.currentWorkStage
  const toStage = fromStage + 1

  if (toStage > 7) {
    throw new ValidationError('Project is already at the final RIBA stage (Stage 7 — Use)')
  }

  // Check prerequisites unless explicitly skipped by ADMIN/OWNER
  let prerequisitesMet: string[] = []
  if (!skipPrerequisites) {
    const prerequisites = getStagePrerequisites(fromStage)
    const requiredPrereqs = prerequisites.filter((p) => p.required_flag)

    if (requiredPrereqs.length > 0) {
      const projectTasks = await prisma.task.findMany({
        where: { projectId, status: 'COMPLETED' },
        select: { title: true },
      })
      const completedTitles = new Set(projectTasks.map((t: { title: string }) => t.title.toLowerCase()))

      const unmet = requiredPrereqs.filter(
        (p) => !completedTitles.has(p.task_title.toLowerCase()),
      )

      if (unmet.length > 0) {
        throw new ValidationError(
          `Cannot advance: ${unmet.length} required prerequisite(s) not met — ${unmet.map((u) => u.task_title).join(', ')}`,
        )
      }

      prerequisitesMet = requiredPrereqs.map((p) => p.task_title)
    }
  } else if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can skip prerequisites')
  }

  // Create the gate record and update the project in a transaction
  const [gate] = await prisma.$transaction([
    prisma.stageGate.create({
      data: {
        projectId,
        fromStage,
        toStage,
        advancedById: profile.id,
        signOffNotes: signOffNotes || null,
        prerequisitesMet: prerequisitesMet.length > 0 ? prerequisitesMet : undefined,
        isRollback: false,
      },
      include: {
        advancedBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        currentWorkStage: toStage,
        stage: (STAGE_ENUM_MAP[toStage] || 'OPERATIONS') as any,
      },
    }),
  ])

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'project.stage_advanced',
    entityType: 'project',
    entityId: projectId,
    metadata: { fromStage, toStage, signOffNotes, prerequisitesMet, skipped: skipPrerequisites },
  })

  // Notify project members
  const members = await prisma.projectMembership.findMany({
    where: { projectId, profileId: { not: profile.id } },
    select: { profileId: true },
  })

  for (const member of members) {
    await createNotification({
      profileId: member.profileId,
      type: NOTIFICATION_EVENTS.PROJECT_UPDATE,
      title: `${project.name} advanced to ${RIBA_LABELS[toStage] || `Stage ${toStage}`}`,
      linkUrl: `/projects/${projectId}`,
    }).catch(() => {})
  }

  return success({ gate, newStage: toStage })
})

/**
 * DELETE /api/projects/[id]/stage-gates — Roll back to the previous stage.
 *
 * Body: { signOffNotes? }
 * ADMIN/OWNER only.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'riba_tracking')
  if (!enabled) {
    throw new ValidationError('RIBA Stage Tracking is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can roll back project stages')
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, currentWorkStage: true },
  })

  if (project.currentWorkStage <= 0) {
    throw new ValidationError('Project is already at the initial stage — cannot roll back further')
  }

  const body = await parseBody(request)
  const signOffNotes = body.signOffNotes as string | undefined

  const fromStage = project.currentWorkStage
  const toStage = fromStage - 1

  const [gate] = await prisma.$transaction([
    prisma.stageGate.create({
      data: {
        projectId,
        fromStage,
        toStage,
        advancedById: profile.id,
        signOffNotes: signOffNotes || null,
        isRollback: true,
      },
      include: {
        advancedBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        currentWorkStage: toStage,
        stage: (STAGE_ENUM_MAP[toStage] || 'BRIEF') as any,
      },
    }),
  ])

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'project.stage_rolled_back',
    entityType: 'project',
    entityId: projectId,
    metadata: { fromStage, toStage, signOffNotes },
  })

  return success({ gate, newStage: toStage })
})
