import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError } from '@/lib/errors'
import {
  optionalString, optionalEnum, parseBody,
} from '@/lib/validation'

const METRIC_CATEGORIES = [
  'GENERAL', 'HOSPITALITY', 'SUSTAINABILITY', 'CUSTOM',
] as const

const METRIC_STATUSES = [
  'ON_TARGET', 'ABOVE', 'BELOW', 'NOT_SET',
] as const

/**
 * Extract metricId from URL path.
 */
function extractMetricId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const idx = segments.indexOf('metrics')
  const metricId = idx >= 0 ? segments[idx + 1] : undefined
  if (!metricId) throw new NotFoundError('Metric not found')
  return metricId
}

/**
 * GET /api/projects/[id]/metrics/[metricId] — Single metric detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const metricId = extractMetricId(request)

  const metric = await modulesPrisma.keyMetric.findFirst({
    where: { id: metricId, projectId },
  })

  if (!metric) throw new NotFoundError('Metric not found')

  return success({ metric })
})

/**
 * PATCH /api/projects/[id]/metrics/[metricId] — Update a metric.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const metricId = extractMetricId(request)
  const body = await parseBody(request)

  // Verify metric belongs to this project
  const existing = await modulesPrisma.keyMetric.findFirst({
    where: { id: metricId, projectId },
  })
  if (!existing) throw new NotFoundError('Metric not found')

  const data: Record<string, unknown> = { lastUpdatedById: profile.id }

  if ('name' in body) data.name = optionalString(body.name, 'Metric name', 200) ?? existing.name
  if ('category' in body) data.category = optionalEnum(body.category, 'Category', METRIC_CATEGORIES) ?? existing.category
  if ('value' in body) data.value = optionalString(body.value, 'Value', 500)
  if ('unit' in body) data.unit = optionalString(body.unit, 'Unit', 50)
  if ('targetValue' in body) data.targetValue = optionalString(body.targetValue, 'Target value', 500)
  if ('status' in body) data.status = optionalEnum(body.status, 'Status', METRIC_STATUSES)
  if ('notes' in body) data.notes = optionalString(body.notes, 'Notes', 2000)

  const metric = await modulesPrisma.keyMetric.update({
    where: { id: metricId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'KeyMetric',
    entityId: metricId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ metric })
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * DELETE /api/projects/[id]/metrics/[metricId] — Remove a metric.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const metricId = extractMetricId(request)

  const existing = await modulesPrisma.keyMetric.findFirst({
    where: { id: metricId, projectId },
  })
  if (!existing) throw new NotFoundError('Metric not found')

  await modulesPrisma.keyMetric.delete({ where: { id: metricId } })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'KeyMetric',
    entityId: metricId,
    metadata: { deleted: true, name: existing.name },
  })

  return success({ deleted: true })
}, { minProjectRole: 'PROJECT_LEAD' })
