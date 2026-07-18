import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
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
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
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

  return success({ membership }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
