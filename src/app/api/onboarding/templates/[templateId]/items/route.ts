import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, optionalString, optionalNumber, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

const VALID_STAGES = ['BEFORE_START', 'DAY_ONE', 'ROLE_SPECIFIC', 'PROBATION']
const VALID_ROLES = ['HR', 'MANAGER', 'IT', 'EMPLOYEE']

/**
 * Helper to extract templateId from the URL.
 */
function getTemplateId(url: string): string {
  const match = url.match(/\/templates\/([^/]+)\/items/)
  return match?.[1] ?? ''
}

/**
 * POST /api/onboarding/templates/[templateId]/items — Add item to template.
 *
 * Admin/Owner only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can manage template items')
  }

  const templateId = getTemplateId(request.url)

  // Verify template belongs to org
  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId },
  })
  if (!template) {
    throw new NotFoundError('Template not found')
  }

  const body = await parseBody(request)

  const stage = requireString(body.stage, 'stage', 50)
  if (!VALID_STAGES.includes(stage)) {
    throw new ValidationError(`stage must be one of: ${VALID_STAGES.join(', ')}`)
  }

  const title = requireString(body.title, 'title', 500)
  const category = optionalString(body.category, 'category', 200)
  const description = optionalString(body.description, 'description', 2000)
  const responsibleRole = optionalString(body.responsibleRole, 'responsibleRole', 50)

  if (responsibleRole && !VALID_ROLES.includes(responsibleRole)) {
    throw new ValidationError(`responsibleRole must be one of: ${VALID_ROLES.join(', ')}`)
  }

  const daysFromStart = optionalNumber(body.daysFromStart, 'daysFromStart', { min: 0, max: 365 }) ?? 0
  const requiresEvidence = body.requiresEvidence === true
  const requiresApproval = body.requiresApproval === true
  const sortOrder = optionalNumber(body.sortOrder, 'sortOrder', { min: 0, max: 999 }) ?? 0

  const item = await modulesPrisma.onboardingTemplateItem.create({
    data: {
      templateId,
      stage,
      category: category ?? null,
      title,
      description: description ?? null,
      responsibleRole: responsibleRole ?? null,
      daysFromStart,
      requiresEvidence,
      requiresApproval,
      sortOrder,
    },
  })

  return success({ item }, 201)
})

/**
 * PATCH /api/onboarding/templates/[templateId]/items — Update an item.
 *
 * Admin/Owner only. Requires `itemId` in body.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can manage template items')
  }

  const templateId = getTemplateId(request.url)

  // Verify template belongs to org
  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId },
  })
  if (!template) {
    throw new NotFoundError('Template not found')
  }

  const body = await parseBody(request)
  const itemId = requireString(body.itemId, 'itemId')

  // Verify item belongs to this template
  const existing = await modulesPrisma.onboardingTemplateItem.findFirst({
    where: { id: itemId, templateId },
  })
  if (!existing) {
    throw new NotFoundError('Template item not found')
  }

  const updateData: Record<string, unknown> = {}

  if (body.stage !== undefined) {
    const stage = requireString(body.stage, 'stage', 50)
    if (!VALID_STAGES.includes(stage)) {
      throw new ValidationError(`stage must be one of: ${VALID_STAGES.join(', ')}`)
    }
    updateData.stage = stage
  }
  if (body.title !== undefined) {
    updateData.title = requireString(body.title, 'title', 500)
  }
  if (body.category !== undefined) {
    updateData.category = optionalString(body.category, 'category', 200) ?? null
  }
  if (body.description !== undefined) {
    updateData.description = optionalString(body.description, 'description', 2000) ?? null
  }
  if (body.responsibleRole !== undefined) {
    const role = optionalString(body.responsibleRole, 'responsibleRole', 50)
    if (role && !VALID_ROLES.includes(role)) {
      throw new ValidationError(`responsibleRole must be one of: ${VALID_ROLES.join(', ')}`)
    }
    updateData.responsibleRole = role ?? null
  }
  if (body.daysFromStart !== undefined) {
    updateData.daysFromStart = optionalNumber(body.daysFromStart, 'daysFromStart', { min: 0, max: 365 }) ?? 0
  }
  if (typeof body.requiresEvidence === 'boolean') {
    updateData.requiresEvidence = body.requiresEvidence
  }
  if (typeof body.requiresApproval === 'boolean') {
    updateData.requiresApproval = body.requiresApproval
  }
  if (body.sortOrder !== undefined) {
    updateData.sortOrder = optionalNumber(body.sortOrder, 'sortOrder', { min: 0, max: 999 }) ?? 0
  }

  const item = await modulesPrisma.onboardingTemplateItem.update({
    where: { id: itemId },
    data: updateData,
  })

  return success({ item })
})

/**
 * DELETE /api/onboarding/templates/[templateId]/items — Remove an item.
 *
 * Admin/Owner only. Requires `itemId` in body.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can manage template items')
  }

  const templateId = getTemplateId(request.url)

  // Verify template belongs to org
  const template = await modulesPrisma.onboardingTemplate.findFirst({
    where: { id: templateId, organisationId: profile.organisationId },
  })
  if (!template) {
    throw new NotFoundError('Template not found')
  }

  const body = await parseBody(request)
  const itemId = requireString(body.itemId, 'itemId')

  // Verify item belongs to this template
  const existing = await modulesPrisma.onboardingTemplateItem.findFirst({
    where: { id: itemId, templateId },
  })
  if (!existing) {
    throw new NotFoundError('Template item not found')
  }

  await modulesPrisma.onboardingTemplateItem.delete({
    where: { id: itemId },
  })

  return success({ message: 'Item removed' })
})
