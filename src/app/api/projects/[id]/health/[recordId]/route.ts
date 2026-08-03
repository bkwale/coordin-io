import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  optionalString, optionalEnum, parseBody,
} from '@/lib/validation'

const HEALTH_STATUSES = ['GREEN', 'AMBER', 'RED', 'GREY'] as const

/**
 * Extract recordId from URL path.
 */
function extractRecordId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const healthIdx = segments.indexOf('health')
  const recordId = healthIdx >= 0 ? segments[healthIdx + 1] : undefined
  if (!recordId) throw new NotFoundError('Health record not found')
  return recordId
}

/**
 * GET /api/projects/[id]/health/[recordId] — Single health record detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const recordId = extractRecordId(request)

  const record = await modulesPrisma.projectHealthRecord.findFirst({
    where: { id: recordId, projectId },
  })

  if (!record) {
    throw new NotFoundError('Health record not found')
  }

  let components: Record<string, string> = {}
  try {
    components = record.sourceRecords ? JSON.parse(record.sourceRecords as string) : {}
  } catch { /* ignore parse errors */ }

  // Get reporter name
  let reportedByName: string | null = null
  const reporterId = (record.overrideById || record.responsibleId) as string | null
  if (reporterId) {
    const reporter = await prisma.profile.findUnique({
      where: { id: reporterId },
      select: { fullName: true },
    })
    reportedByName = reporter?.fullName || null
  }

  return success({
    record: {
      id: record.id,
      projectId: record.projectId,
      overallHealth: record.rating,
      scheduleHealth: components.scheduleHealth || 'GREY',
      budgetHealth: components.budgetHealth || 'GREY',
      qualityHealth: components.qualityHealth || 'GREY',
      safetyHealth: components.safetyHealth || 'GREY',
      riskHealth: components.riskHealth || 'GREY',
      narrative: record.reason || null,
      mitigationPlan: record.recommendedAction || null,
      reportedById: reporterId,
      reportedByName,
      reportDate: record.calculatedAt,
      isOverride: record.isOverride,
    },
  })
})

/**
 * PATCH /api/projects/[id]/health/[recordId] — Update a health record.
 * Only allows same-day edits (no backdating).
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const recordId = extractRecordId(request)

  const current = await modulesPrisma.projectHealthRecord.findFirst({
    where: { id: recordId, projectId },
  })

  if (!current) {
    throw new NotFoundError('Health record not found')
  }

  // Same-day edit check
  const recordDate = new Date(current.calculatedAt as string)
  const today = new Date()
  const isSameDay =
    recordDate.getFullYear() === today.getFullYear() &&
    recordDate.getMonth() === today.getMonth() &&
    recordDate.getDate() === today.getDate()

  if (!isSameDay) {
    throw new ValidationError('Health records can only be edited on the same day they were created')
  }

  const body = await parseBody(request)
  const data: Record<string, unknown> = {}

  const overallHealth = optionalEnum(body.overallHealth, 'Overall health', HEALTH_STATUSES)
  const narrative = optionalString(body.narrative, 'Narrative', 5000)
  const mitigationPlan = optionalString(body.mitigationPlan, 'Mitigation plan', 5000)

  if (overallHealth) data.rating = overallHealth
  if (narrative !== undefined && narrative !== null) data.reason = narrative
  if (body.narrative === '' || body.narrative === null) data.reason = null
  if (mitigationPlan !== undefined && mitigationPlan !== null) data.recommendedAction = mitigationPlan
  if (body.mitigationPlan === '' || body.mitigationPlan === null) data.recommendedAction = null

  // Update component ratings if any changed
  let components: Record<string, string> = {}
  try {
    components = current.sourceRecords ? JSON.parse(current.sourceRecords as string) : {}
  } catch { /* ignore */ }

  const scheduleHealth = optionalEnum(body.scheduleHealth, 'Schedule health', HEALTH_STATUSES)
  const budgetHealth = optionalEnum(body.budgetHealth, 'Budget health', HEALTH_STATUSES)
  const qualityHealth = optionalEnum(body.qualityHealth, 'Quality health', HEALTH_STATUSES)
  const safetyHealth = optionalEnum(body.safetyHealth, 'Safety health', HEALTH_STATUSES)
  const riskHealth = optionalEnum(body.riskHealth, 'Risk health', HEALTH_STATUSES)

  if (scheduleHealth) components.scheduleHealth = scheduleHealth
  if (budgetHealth) components.budgetHealth = budgetHealth
  if (qualityHealth) components.qualityHealth = qualityHealth
  if (safetyHealth) components.safetyHealth = safetyHealth
  if (riskHealth) components.riskHealth = riskHealth

  if (scheduleHealth || budgetHealth || qualityHealth || safetyHealth || riskHealth) {
    data.sourceRecords = JSON.stringify(components)
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields to update')
  }

  const updated = await modulesPrisma.projectHealthRecord.update({
    where: { id: recordId },
    data,
  })

  // If overall health changed, update project-level too
  if (overallHealth) {
    await prisma.project.update({
      where: { id: projectId },
      data: { healthStatus: overallHealth as 'GREEN' | 'AMBER' | 'RED' },
    })
  }

  return success({
    record: {
      id: updated.id,
      projectId: updated.projectId,
      overallHealth: updated.rating,
      scheduleHealth: components.scheduleHealth || 'GREY',
      budgetHealth: components.budgetHealth || 'GREY',
      qualityHealth: components.qualityHealth || 'GREY',
      safetyHealth: components.safetyHealth || 'GREY',
      riskHealth: components.riskHealth || 'GREY',
      narrative: updated.reason || null,
      mitigationPlan: updated.recommendedAction || null,
      reportedById: updated.overrideById || updated.responsibleId || null,
      reportDate: updated.calculatedAt,
    },
  })
}, { minProjectRole: 'PROJECT_LEAD' })
