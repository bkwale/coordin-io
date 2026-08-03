import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'

const STAGES = ['BEFORE_START', 'DAY_ONE', 'ROLE_SPECIFIC', 'PROBATION'] as const

/**
 * GET /api/onboarding/templates/[templateId] — Return template with items grouped by stage.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const templateId = request.url.split('/templates/')[1]?.split('/')[0]?.split('?')[0]

  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: {
      id: templateId,
      organisationId: profile.organisationId,
    },
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { assignments: true } },
    },
  })

  if (!template) {
    throw new NotFoundError('Template not found')
  }

  // Group items by stage
  const groupedItems: Record<string, unknown[]> = {}
  for (const stage of STAGES) {
    groupedItems[stage] = []
  }
  for (const item of template.items as Array<{ stage: string; [key: string]: unknown }>) {
    if (!groupedItems[item.stage]) {
      groupedItems[item.stage] = []
    }
    groupedItems[item.stage].push(item)
  }

  return success({
    template: {
      id: template.id,
      name: template.name,
      roleLevel: template.roleLevel ?? 'Not provided',
      description: template.description ?? 'Not provided',
      isDefault: template.isDefault,
      isActive: template.isActive,
      totalItems: template.items.length,
      assignmentCount: template._count.assignments,
      groupedItems,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
  })
})

/**
 * PATCH /api/onboarding/templates/[templateId] — Update template metadata.
 *
 * Admin/Owner only. Updates name, description, isDefault, isActive.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can update onboarding templates')
  }

  const templateId = request.url.split('/templates/')[1]?.split('/')[0]?.split('?')[0]

  const existing = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId },
  })
  if (!existing) {
    throw new NotFoundError('Template not found')
  }

  const body = await parseBody(request)

  const name = optionalString(body.name, 'name', 200)
  const description = optionalString(body.description, 'description', 2000)
  const roleLevel = optionalString(body.roleLevel, 'roleLevel', 100)
  const isDefault = typeof body.isDefault === 'boolean' ? body.isDefault : undefined
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined

  // If setting as default, unset any existing default
  if (isDefault === true) {
    await modulesPrisma.onboardingTemplate.updateMany({
      where: {
        organisationId: profile.organisationId,
        isDefault: true,
        id: { not: templateId },
      },
      data: { isDefault: false },
    })
  }

  const updateData: Record<string, unknown> = {}
  if (name !== null) updateData.name = name
  if (description !== null) updateData.description = description
  if (roleLevel !== null) updateData.roleLevel = roleLevel
  if (isDefault !== undefined) updateData.isDefault = isDefault
  if (isActive !== undefined) updateData.isActive = isActive

  const template = await modulesPrisma.onboardingTemplate.update({
    where: { id: templateId },
    data: updateData,
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'onboarding_template.updated',
    entityType: 'OnboardingTemplate',
    entityId: templateId,
    metadata: updateData,
  })

  return success({ template })
})

/**
 * DELETE /api/onboarding/templates/[templateId] — Soft-delete template.
 *
 * Admin/Owner only. Sets isActive=false.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can delete onboarding templates')
  }

  const templateId = request.url.split('/templates/')[1]?.split('/')[0]?.split('?')[0]

  const existing = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId },
  })
  if (!existing) {
    throw new NotFoundError('Template not found')
  }

  await modulesPrisma.onboardingTemplate.update({
    where: { id: templateId },
    data: { isActive: false, isDefault: false },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'onboarding_template.deleted',
    entityType: 'OnboardingTemplate',
    entityId: templateId,
  })

  return success({ message: 'Template deactivated' })
})
