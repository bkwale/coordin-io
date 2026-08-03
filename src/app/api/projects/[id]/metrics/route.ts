import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  requireString, optionalString, optionalEnum, parseBody,
} from '@/lib/validation'

const METRIC_CATEGORIES = [
  'GENERAL', 'HOSPITALITY', 'SUSTAINABILITY', 'CUSTOM',
] as const

const METRIC_STATUSES = [
  'ON_TARGET', 'ABOVE', 'BELOW', 'NOT_SET',
] as const

/**
 * GET /api/projects/[id]/metrics — List all key metrics grouped by category.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const metrics = await modulesPrisma.keyMetric.findMany({
    where: { projectId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  // Group by category
  const grouped: Record<string, typeof metrics> = {}
  for (const m of metrics) {
    const cat = m.category || 'GENERAL'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m)
  }

  return success({ metrics, grouped })
})

/**
 * POST /api/projects/[id]/metrics — Create a key metric.
 * Requires PROJECT_LEAD role or above.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const name = requireString(body.name, 'Metric name', 200)
  const category = optionalEnum(body.category, 'Category', METRIC_CATEGORIES) ?? 'GENERAL'
  const value = optionalString(body.value, 'Value', 500)
  const unit = optionalString(body.unit, 'Unit', 50)
  const targetValue = optionalString(body.targetValue, 'Target value', 500)
  const status = optionalEnum(body.status, 'Status', METRIC_STATUSES) ?? 'NOT_SET'
  const notes = optionalString(body.notes, 'Notes', 2000)

  const metric = await modulesPrisma.keyMetric.create({
    data: {
      projectId,
      name,
      category,
      value,
      unit,
      targetValue,
      status,
      lastUpdatedById: profile.id,
      notes,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'KeyMetric',
    entityId: metric.id,
    metadata: { name, category },
  })

  return success({ metric }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
