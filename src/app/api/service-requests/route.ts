import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { formatAPIError } from '@/lib/errors'
import {
  requireString,
  optionalString,
  requireEnum,
  optionalEnum,
  optionalNumber,
  optionalDate,
  optionalId,
  parseBody,
} from '@/lib/validation'

const SERVICE_REQUEST_TYPES = [
  'IT_SUPPORT', 'EQUIPMENT', 'PPE', 'SOFTWARE_LICENCE', 'TRAINING',
  'BOOKS_STANDARDS', 'TRAVEL', 'FLIGHTS_ACCOMMODATION', 'OFFICE_SUPPLIES',
  'ACCOUNT_PERMISSION', 'PROCUREMENT_PURCHASE', 'OFFICE_FACILITIES',
  'HR_REQUEST', 'PROJECT_INFORMATION', 'VEHICLE_LOGISTICS', 'CUSTOM',
] as const

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

const REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED', 'HR_APPROVED',
  'APPROVED', 'REJECTED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'WITHDRAWN',
] as const

/**
 * Generate the next request number for an organisation.
 * Format: SR-001, SR-002, etc.
 */
async function generateRequestNumber(organisationId: string): Promise<string> {
  const latest = await modulesPrisma.serviceRequest.findFirst({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    select: { requestNumber: true },
  })

  let nextNum = 1
  if (latest?.requestNumber) {
    const match = latest.requestNumber.match(/SR-(\d+)/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }

  return `SR-${String(nextNum).padStart(3, '0')}`
}

/**
 * GET /api/service-requests — List service requests with filters.
 *
 * Query params:
 *   ?tab=my|all|assigned (default: my)
 *   ?type=IT_SUPPORT,EQUIPMENT,...
 *   ?status=DRAFT,SUBMITTED,...
 *   ?priority=LOW,MEDIUM,...
 *   ?assigneeId=<id>
 *   ?projectId=<id>
 *   ?from=<date>&to=<date>
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  try {
    const url = new URL(request.url)
    const tab = url.searchParams.get('tab') || 'my'
    const typeFilter = url.searchParams.get('type')
    const statusFilter = url.searchParams.get('status')
    const priorityFilter = url.searchParams.get('priority')
    const assigneeId = url.searchParams.get('assigneeId')
    const projectId = url.searchParams.get('projectId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // Base where clause scoped to organisation
    const where: Record<string, unknown> = {
      organisationId: profile.organisationId,
    }

    // Tab filter
    if (tab === 'my') {
      where.profileId = profile.id
    } else if (tab === 'assigned') {
      where.OR = [
        { assignedToId: profile.id },
        { approverId: profile.id },
      ]
    }
    // tab === 'all' — admins/managers see all org requests (enforced below)

    if (tab === 'all') {
      const isPrivileged = ['ADMIN', 'OWNER', 'MANAGER'].includes(profile.orgPermission)
      if (!isPrivileged) {
        // Non-privileged users can only see their own
        where.profileId = profile.id
      }
    }

    // Type filter (comma-separated)
    if (typeFilter) {
      const types = typeFilter.split(',').filter(t => SERVICE_REQUEST_TYPES.includes(t as typeof SERVICE_REQUEST_TYPES[number]))
      if (types.length > 0) where.requestType = { in: types }
    }

    // Status filter
    if (statusFilter) {
      const statuses = statusFilter.split(',').filter(s => REQUEST_STATUSES.includes(s as typeof REQUEST_STATUSES[number]))
      if (statuses.length > 0) where.status = { in: statuses }
    }

    // Priority filter
    if (priorityFilter) {
      const priorities = priorityFilter.split(',').filter(p => PRIORITIES.includes(p as typeof PRIORITIES[number]))
      if (priorities.length > 0) where.priority = { in: priorities }
    }

    // Assignee filter
    if (assigneeId) {
      where.assignedToId = assigneeId
    }

    // Project filter
    if (projectId) {
      where.projectId = projectId
    }

    // Date range
    if (from || to) {
      const createdAtFilter: Record<string, Date> = {}
      if (from) createdAtFilter.gte = new Date(from)
      if (to) createdAtFilter.lte = new Date(to)
      where.createdAt = createdAtFilter
    }

    const requests = await modulesPrisma.serviceRequest.findMany({
      where,
      include: {
        profile: { select: { id: true, fullName: true, jobTitle: true } },
        approver: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true, code: true } },
        office: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Summary counts (for the current user's org)
    const allOrgRequests = await modulesPrisma.serviceRequest.groupBy({
      by: ['status'],
      where: { organisationId: profile.organisationId },
      _count: { id: true },
    })

    const counts = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completedThisMonth: 0,
    }

    for (const group of allOrgRequests) {
      counts.total += group._count.id
      if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(group.status)) {
        counts.pending += group._count.id
      }
      if (group.status === 'FULFILMENT_IN_PROGRESS') {
        counts.inProgress += group._count.id
      }
    }

    // Count completed this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const completedThisMonth = await modulesPrisma.serviceRequest.count({
      where: {
        organisationId: profile.organisationId,
        status: 'COMPLETED',
        completedAt: { gte: startOfMonth },
      },
    })
    counts.completedThisMonth = completedThisMonth

    return success({ requests, counts })
  } catch (err) {
    const formatted = formatAPIError(err)
    const { NextResponse } = await import('next/server')
    return NextResponse.json(formatted.body, { status: formatted.statusCode })
  }
})

/**
 * POST /api/service-requests — Create a new service request.
 *
 * Creates in DRAFT status with auto-generated request number.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const requestType = requireEnum(body.requestType, 'Request type', SERVICE_REQUEST_TYPES)
  const title = requireString(body.title, 'Title', 200)
  const description = optionalString(body.description, 'Description', 4000)
  const category = optionalString(body.category, 'Category', 100)
  const priority = optionalEnum(body.priority, 'Priority', PRIORITIES) || 'MEDIUM'
  const location = optionalString(body.location, 'Location', 500)
  const estimatedCost = optionalNumber(body.estimatedCost, 'Estimated cost', { min: 0 })
  const currency = optionalString(body.currency, 'Currency', 10) || 'GBP'
  const budgetCode = optionalString(body.budgetCode, 'Budget code', 50)
  const requiredByDate = optionalDate(body.requiredByDate, 'Required by date')
  const projectId = optionalId(body.projectId, 'Project')
  const officeId = optionalId(body.officeId, 'Office')
  const serviceTarget = optionalNumber(body.serviceTarget, 'Service target', { min: 1, max: 365 })

  const managerId = profile.managerId || null
  const requestNumber = await generateRequestNumber(profile.organisationId)

  const serviceRequest = await modulesPrisma.serviceRequest.create({
    data: {
      requestNumber,
      profileId: profile.id,
      organisationId: profile.organisationId,
      projectId,
      officeId: officeId || profile.officeId || null,
      requestType,
      category,
      title,
      description,
      status: 'DRAFT',
      priority,
      requiredByDate,
      location,
      estimatedCost,
      currency,
      budgetCode,
      approverId: managerId,
      serviceTarget: serviceTarget ? Math.round(serviceTarget) : null,
      attachmentUrls: [],
      dynamicFields: body.dynamicFields || null,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.REQUEST_CREATED,
    entityType: 'service_request',
    entityId: serviceRequest.id,
    metadata: { requestType, title, requestNumber, priority },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ serviceRequest }, 201)
})
