import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { requireId, requireEnum, parseBody } from '@/lib/validation'
import type { ProjectRole } from '@/generated/prisma/client'

const VALID_PROJECT_ROLES: readonly ProjectRole[] = [
  'TEAM_MEMBER', 'ARCHITECT', 'SENIOR_ARCHITECT', 'DESIGN_LEAD',
  'PROJECT_ARCHITECT', 'PROJECT_LEAD', 'EXTERNAL_CONSULTANT', 'CONTRACTOR',
] as const

/**
 * GET /api/projects/[id]/members — List project members with profile details.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const members = await prisma.projectMembership.findMany({
    where: { projectId, removedAt: null },
    include: {
      profile: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          orgPermission: true,
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  })

  return success({ members })
})

/**
 * POST /api/projects/[id]/members — Add a member to the project.
 * Requires PROJECT_LEAD+ on the project (or MANAGER+ org).
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, project, profile }) => {
  const body = await parseBody(request)
  const profileId = requireId(body.profileId, 'Profile ID')
  const projectRole = requireEnum(body.projectRole, 'Project role', VALID_PROJECT_ROLES)

  // Verify target profile exists in same org
  const targetProfile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      organisationId: profile.organisationId,
    },
    select: { id: true, fullName: true },
  })

  if (!targetProfile) {
    throw new NotFoundError('Profile not found in this organisation')
  }

  // Check for existing active membership
  const existing = await prisma.projectMembership.findUnique({
    where: {
      projectId_profileId: { projectId, profileId },
    },
  })

  if (existing && existing.removedAt === null) {
    throw new ConflictError('This user is already a member of this project')
  }

  const typedRole = projectRole

  let membership

  if (existing && existing.removedAt !== null) {
    // Re-activate previously removed membership
    membership = await prisma.projectMembership.update({
      where: { id: existing.id },
      data: {
        projectRole: typedRole,
        removedAt: null,
        assignedAt: new Date(),
      },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    })
  } else {
    membership = await prisma.projectMembership.create({
      data: {
        projectId,
        profileId,
        projectRole: typedRole,
      },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_MEMBER_ADDED,
    entityType: 'ProjectMembership',
    entityId: membership.id,
    metadata: {
      projectId,
      addedProfileId: profileId,
      projectRole,
    },
  })

  // Notify the added member (skip if they added themselves)
  if (profileId !== profile.id) {
    await createNotification({
      profileId,
      type: NOTIFICATION_EVENTS.PROJECT_MEMBER_ADDED,
      title: `You were added to project: ${project.name}`,
      body: `${profile.fullName} added you as ${projectRole.replace(/_/g, ' ').toLowerCase()}.`,
      linkUrl: `/projects/${projectId}`,
    }).catch(() => {})
  }

  return success({ membership }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * PATCH /api/projects/[id]/members — Update a member's project role.
 * Body: { membershipId, projectRole }
 * Requires PROJECT_LEAD+ on the project.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)
  const membershipId = requireId(body.membershipId, 'Membership ID')
  const projectRole = requireEnum(body.projectRole, 'Project role', VALID_PROJECT_ROLES)

  const membership = await prisma.projectMembership.findFirst({
    where: { id: membershipId, projectId, removedAt: null },
    include: { profile: { select: { id: true, fullName: true } } },
  })

  if (!membership) {
    throw new NotFoundError('Membership not found')
  }

  const updated = await prisma.projectMembership.update({
    where: { id: membershipId },
    data: { projectRole },
    include: {
      profile: { select: { id: true, fullName: true, email: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_MEMBER_UPDATED,
    entityType: 'ProjectMembership',
    entityId: membershipId,
    metadata: {
      projectId,
      targetProfileId: membership.profile.id,
      oldRole: membership.projectRole,
      newRole: projectRole,
    },
  })

  return success({ membership: updated })
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * DELETE /api/projects/[id]/members — Soft-remove a member from the project.
 * Body: { membershipId }
 * Requires PROJECT_LEAD+ on the project.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, project, profile }) => {
  const body = await parseBody(request)
  const membershipId = requireId(body.membershipId, 'Membership ID')

  const membership = await prisma.projectMembership.findFirst({
    where: { id: membershipId, projectId, removedAt: null },
    include: { profile: { select: { id: true, fullName: true } } },
  })

  if (!membership) {
    throw new NotFoundError('Membership not found')
  }

  await prisma.projectMembership.update({
    where: { id: membershipId },
    data: { removedAt: new Date() },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_MEMBER_REMOVED ?? 'project.member.removed',
    entityType: 'ProjectMembership',
    entityId: membershipId,
    metadata: {
      projectId,
      removedProfileId: membership.profile.id,
      removedProfileName: membership.profile.fullName,
    },
  })

  // Notify the removed member (skip if they removed themselves)
  if (membership.profile.id !== profile.id) {
    await createNotification({
      profileId: membership.profile.id,
      type: NOTIFICATION_EVENTS.PROJECT_MEMBER_REMOVED ?? 'project.member.removed',
      title: `You were removed from project: ${project.name}`,
      body: `${profile.fullName} removed you from the project team.`,
      linkUrl: `/projects/${projectId}`,
    }).catch(() => {})
  }

  return success({ removed: true })
}, { minProjectRole: 'PROJECT_LEAD' })
