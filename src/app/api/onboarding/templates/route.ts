import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/onboarding/templates — List onboarding templates for the org.
 *
 * Returns templates with item counts per stage.
 * Query params:
 * - activeOnly: 'true' to filter only active templates (default: true)
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const activeOnly = url.searchParams.get('activeOnly') !== 'false'

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }
  if (activeOnly) {
    where.isActive = true
  }

  const templates = await modulesPrisma.onboardingTemplate.findMany({
    where,
    include: {
      items: {
        select: { id: true, stage: true },
      },
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  // Compute per-stage item counts
  const result = templates.map((t: {
    id: string
    name: string
    roleLevel: string | null
    description: string | null
    isDefault: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    items: { id: string; stage: string }[]
    _count: { assignments: number }
  }) => {
    const stageCounts: Record<string, number> = {}
    for (const item of t.items) {
      stageCounts[item.stage] = (stageCounts[item.stage] ?? 0) + 1
    }
    return {
      id: t.id,
      name: t.name,
      roleLevel: t.roleLevel ?? 'Not provided',
      description: t.description ?? 'Not provided',
      isDefault: t.isDefault,
      isActive: t.isActive,
      totalItems: t.items.length,
      stageCounts,
      assignmentCount: t._count.assignments,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }
  })

  return success({ templates: result })
})

/**
 * POST /api/onboarding/templates — Create a new onboarding template.
 *
 * Admin/Owner only. Accepts items in the request body.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can create onboarding templates')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'name', 200)
  const roleLevel = optionalString(body.roleLevel, 'roleLevel', 100)
  const description = optionalString(body.description, 'description', 2000)
  const isDefault = body.isDefault === true

  // If setting as default, unset any existing default
  if (isDefault) {
    await modulesPrisma.onboardingTemplate.updateMany({
      where: { organisationId: profile.organisationId, isDefault: true },
      data: { isDefault: false },
    })
  }

  // Build items data if provided
  const items = Array.isArray(body.items) ? body.items : []
  const itemsData = items.map((item: Record<string, unknown>, index: number) => ({
    stage: requireString(item.stage, `items[${index}].stage`, 50),
    category: optionalString(item.category, `items[${index}].category`, 200) ?? null,
    title: requireString(item.title, `items[${index}].title`, 500),
    description: optionalString(item.description, `items[${index}].description`, 2000) ?? null,
    responsibleRole: optionalString(item.responsibleRole, `items[${index}].responsibleRole`, 50) ?? null,
    daysFromStart: typeof item.daysFromStart === 'number' ? item.daysFromStart : 0,
    requiresEvidence: item.requiresEvidence === true,
    requiresApproval: item.requiresApproval === true,
    notifyEmployee: item.notifyEmployee === true,
    actionRequired: item.actionRequired === true,
    acknowledgementRequired: item.acknowledgementRequired === true,
    dueDate: item.dueDate ? new Date(item.dueDate as string) : null,
    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
  }))

  const template = await modulesPrisma.onboardingTemplate.create({
    data: {
      organisationId: profile.organisationId,
      name,
      roleLevel: roleLevel ?? null,
      description: description ?? null,
      isDefault,
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
    },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'onboarding_template.created',
    entityType: 'OnboardingTemplate',
    entityId: template.id,
    metadata: { name, itemCount: itemsData.length },
  })

  return success({ template }, 201)
})
