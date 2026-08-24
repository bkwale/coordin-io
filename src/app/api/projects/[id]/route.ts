import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError } from '@/lib/errors'
import { optionalString, optionalId, optionalEnum, optionalDate, optionalNumber, parseBody } from '@/lib/validation'

/**
 * GET /api/projects/[id] — Single project detail with members and task counts.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId, profile }) => {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      office: { select: { id: true, name: true, city: true } },
      memberships: {
        where: { removedAt: null },
        include: {
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              orgPermission: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  })

  // Task counts by status
  const taskCounts = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId },
    _count: { id: true },
  })

  const taskSummary = taskCounts.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.status] = row._count.id
      return acc
    },
    {},
  )

  return success({
    project: {
      ...project,
      taskSummary,
    },
  })
})

/**
 * PATCH /api/projects/[id] — Update project fields.
 * Requires PROJECT_LEAD+ on the project (or MANAGER+ org).
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  // Validate each allowed field individually
  const data: Record<string, unknown> = {}

  if ('name' in body) data.name = optionalString(body.name, 'Project name', 200) ?? undefined
  if ('code' in body) data.code = optionalString(body.code, 'Project code', 50)
  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000)
  if ('location' in body) data.location = optionalString(body.location, 'Location', 500)
  if ('projectType' in body) data.projectType = optionalEnum(body.projectType, 'Project type', ['HOTEL', 'RESIDENTIAL', 'MIXED_USE', 'RESORT', 'REFURBISHMENT', 'OFFICE_FIT_OUT'] as const)
  if ('stage' in body) data.stage = optionalEnum(body.stage, 'Stage', ['BRIEF', 'CONCEPT', 'SPATIAL_COORDINATION', 'WORKING_DRAWINGS', 'CONSTRUCTION', 'HANDOVER', 'OPERATIONS'] as const)
  if ('status' in body) data.status = optionalEnum(body.status, 'Status', ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const)
  if ('healthStatus' in body) data.healthStatus = optionalEnum(body.healthStatus, 'Health status', ['GREEN', 'AMBER', 'RED'] as const)
  if ('currency' in body) data.currency = optionalEnum(body.currency, 'Currency', ['NGN', 'GBP', 'USD', 'EUR'] as const)
  if ('clientBrand' in body) data.clientBrand = optionalString(body.clientBrand, 'Client brand', 200)
  if ('officeId' in body) data.officeId = optionalId(body.officeId, 'Office ID')
  if ('startDate' in body) data.startDate = optionalDate(body.startDate, 'Start date')
  if ('targetCompletion' in body) data.targetCompletion = optionalDate(body.targetCompletion, 'Target completion')
  if ('currentIssueRef' in body) data.currentIssueRef = optionalString(body.currentIssueRef, 'Current issue ref', 100)
  if ('currentIssueDate' in body) data.currentIssueDate = optionalDate(body.currentIssueDate, 'Current issue date')

  // Sprint 2 — additional project fields
  if ('sharepointUrl' in body) {
    const url = optionalString(body.sharepointUrl, 'SharePoint URL', 2000)
    if (url && !/^https?:\/\//i.test(url)) {
      throw new ValidationError('SharePoint URL must start with http:// or https://')
    }
    data.sharepointUrl = url
  }
  if ('siteAddress' in body) data.siteAddress = optionalString(body.siteAddress, 'Site address', 500)
  if ('siteCity' in body) data.siteCity = optionalString(body.siteCity, 'Site city', 200)
  if ('siteCountry' in body) data.siteCountry = optionalString(body.siteCountry, 'Site country', 200)
  if ('buildingType' in body) data.buildingType = optionalString(body.buildingType, 'Building type', 100)
  if ('jurisdiction' in body) data.jurisdiction = optionalString(body.jurisdiction, 'Jurisdiction', 200)
  if ('feeBasis' in body) data.feeBasis = optionalEnum(body.feeBasis, 'Fee basis', ['PERCENTAGE', 'LUMP_SUM', 'TIME_CHARGE'] as const)
  if ('appointmentType' in body) data.appointmentType = optionalEnum(body.appointmentType, 'Appointment type', ['FULL_SERVICE', 'PARTIAL', 'NOVATED'] as const)
  if ('contractValue' in body) data.contractValue = optionalNumber(body.contractValue, 'Contract value', { min: 0 })
  if ('feeValue' in body) data.feeValue = optionalNumber(body.feeValue, 'Fee value', { min: 0 })
  if ('grossFloorArea' in body) data.grossFloorArea = optionalNumber(body.grossFloorArea, 'Gross floor area', { min: 0 })
  if ('numberOfUnits' in body) data.numberOfUnits = optionalNumber(body.numberOfUnits, 'Number of units', { min: 0 })
  if ('developmentType' in body) data.developmentType = optionalEnum(body.developmentType, 'Development type', [
    'NEW_BUILD', 'CONVERSION', 'REFURBISHMENT', 'EXTENSION', 'COMPLETION', 'FIT_OUT', 'MIXED',
  ] as const)
  if ('workStageFramework' in body) data.workStageFramework = optionalEnum(body.workStageFramework, 'Work stage framework', [
    'RIBA', 'NIGERIAN_CWA', 'INTERNATIONAL', 'DESIGN_BUILD', 'CUSTOM',
  ] as const)
  if ('budget' in body) data.budget = optionalNumber(body.budget, 'Budget', { min: 0 })

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'Project',
    entityId: projectId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ project })
}, { minProjectRole: 'PROJECT_LEAD' })
