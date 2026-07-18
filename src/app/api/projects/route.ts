import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalId, optionalEnum, optionalDate, parseBody } from '@/lib/validation'

/**
 * GET /api/projects — List projects for the current user.
 *
 * Admins / Owners see all org projects.
 * Everyone else sees only projects they are a member of.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const isAdmin = hasOrgPermission(profile.orgPermission, 'ADMIN')

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? { organisationId: orgId }
      : {
          organisationId: orgId,
          memberships: {
            some: {
              profileId: profile.id,
              removedAt: null,
            },
          },
        },
    include: {
      office: { select: { id: true, name: true } },
      _count: {
        select: { tasks: true, memberships: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return success({ projects })
})

/**
 * POST /api/projects — Create a new project. MANAGER+ only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const name = requireString(body.name, 'Project name', 200)
  const code = optionalString(body.code, 'Project code', 50)
  const description = optionalString(body.description, 'Description', 5000)
  const location = optionalString(body.location, 'Location', 500)
  const projectType = optionalEnum(body.projectType, 'Project type', ['HOTEL', 'RESIDENTIAL', 'MIXED_USE', 'RESORT', 'REFURBISHMENT', 'OFFICE_FIT_OUT'] as const)
  const stage = optionalEnum(body.stage, 'Stage', ['BRIEF', 'CONCEPT', 'SPATIAL_COORDINATION', 'WORKING_DRAWINGS', 'CONSTRUCTION', 'HANDOVER', 'OPERATIONS'] as const)
  const currency = optionalEnum(body.currency, 'Currency', ['NGN', 'GBP', 'USD', 'EUR'] as const)
  const clientBrand = optionalString(body.clientBrand, 'Client brand', 200)
  const officeId = optionalId(body.officeId, 'Office ID')
  const startDate = optionalDate(body.startDate, 'Start date')
  const targetCompletion = optionalDate(body.targetCompletion, 'Target completion')

  const project = await prisma.project.create({
    data: {
      organisationId: profile.organisationId,
      name,
      code: code || undefined,
      description: description || undefined,
      location: location || undefined,
      projectType: projectType || undefined,
      stage: stage || undefined,
      currency: currency || undefined,
      clientBrand: clientBrand || undefined,
      officeId: officeId || undefined,
      startDate: startDate || undefined,
      targetCompletion: targetCompletion || undefined,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_CREATED,
    entityType: 'Project',
    entityId: project.id,
    metadata: { projectName: project.name },
  })

  return success({ project }, 201)
}, { requiredPermission: 'MANAGER' })
