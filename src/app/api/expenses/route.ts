import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalId, requireEnum, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const EXPENSE_CATEGORIES = [
  'TRAVEL', 'ACCOMMODATION', 'MEALS', 'EQUIPMENT', 'SOFTWARE',
  'PRINTING', 'POSTAGE', 'TRAINING', 'PPE', 'SITE_EXPENSES',
  'MATERIALS', 'SUBCONTRACTOR', 'PROFESSIONAL_FEES', 'OTHER',
] as const

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

/**
 * GET /api/expenses — List expense claims.
 *
 * Returns the current user's own expense claims.
 * Managers see claims pending their approval (?role=approver).
 * Admins can see all org claims (?all=true).
 *
 * Filters: projectId, expenseCategory, status, dateFrom, dateTo
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const role = url.searchParams.get('role')
  const showAll = url.searchParams.get('all') === 'true'

  // Filters (BUG-23)
  const projectIdFilter = url.searchParams.get('projectId')
  const categoryFilter = url.searchParams.get('expenseCategory')
  const statusFilter = url.searchParams.get('status')
  const dateFromFilter = url.searchParams.get('dateFrom')
  const dateToFilter = url.searchParams.get('dateTo')

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'FINANCE')) {
    where = {
      profile: { organisationId: profile.organisationId },
    }
  } else if (role === 'approver') {
    where = {
      approverId: profile.id,
      profile: { organisationId: profile.organisationId },
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    }
  } else {
    where = { profileId: profile.id }
  }

  // Apply filters
  if (projectIdFilter) where.projectId = projectIdFilter
  if (categoryFilter) where.expenseCategory = categoryFilter
  if (statusFilter) {
    // Don't let statusFilter override the approver-scoped status constraint
    if (role === 'approver') {
      const allowed = ['SUBMITTED', 'UNDER_REVIEW']
      if (allowed.includes(statusFilter)) where.status = statusFilter
    } else {
      where.status = statusFilter
    }
  }
  if (dateFromFilter) {
    const d = new Date(dateFromFilter)
    if (isNaN(d.getTime())) throw new ValidationError('Invalid dateFrom format')
    where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), gte: d }
  }
  if (dateToFilter) {
    const d = new Date(dateToFilter)
    if (isNaN(d.getTime())) throw new ValidationError('Invalid dateTo format')
    where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), lte: d }
  }

  const claims = await prisma.expenseClaim.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, department: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ claims })
})

/**
 * POST /api/expenses — Create a new expense claim.
 *
 * Creates in DRAFT status. Requester must submit separately via PATCH.
 * BUG-23: Added costCode, supplier, expenseCategory fields.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const expenseCategory = requireEnum(body.expenseCategory ?? body.category, 'Category', EXPENSE_CATEGORIES)
  const description = requireString(body.description, 'Description', 1000)
  const currency = requireEnum(body.currency, 'Currency', CURRENCIES)
  const projectId = optionalId(body.projectId, 'Project ID')
  const receiptUrl = optionalString(body.receiptUrl, 'Receipt URL', 2000)
  const costCode = optionalString(body.costCode, 'Cost code', 50)
  const supplier = optionalString(body.supplier, 'Supplier', 200)

  // Validate amount
  const amount = body.amount
  if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
    throw new ValidationError('Amount is required and must be a number')
  }
  if (amount <= 0) {
    throw new ValidationError('Amount must be greater than zero')
  }
  if (amount > 1_000_000) {
    throw new ValidationError('Amount exceeds maximum allowed (1,000,000)')
  }

  // If projectId provided, verify user is in same org (relaxed from project membership)
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) {
      throw new ValidationError('Project not found in your organisation')
    }
  }

  // Find the user's manager as default approver
  const managerId = profile.managerId || null

  const claim = await prisma.expenseClaim.create({
    data: {
      profileId: profile.id,
      projectId,
      category: expenseCategory, // Keep legacy field in sync
      expenseCategory,
      description,
      amount,
      currency,
      receiptUrl,
      costCode: costCode ?? null,
      supplier: supplier ?? null,
      status: 'DRAFT',
      approverId: managerId,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.EXPENSE_CREATED,
    entityType: 'expense_claim',
    entityId: claim.id,
    metadata: { expenseCategory, amount, currency, projectId, costCode, supplier },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ claim }, 201)
})
