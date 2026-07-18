import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalId, requireEnum, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const EXPENSE_CATEGORIES = [
  'TRAVEL', 'ACCOMMODATION', 'MEALS', 'EQUIPMENT', 'SOFTWARE',
  'PRINTING', 'POSTAGE', 'TRAINING', 'PPE', 'SITE_EXPENSES', 'OTHER',
] as const

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

/**
 * GET /api/expenses — List expense claims.
 *
 * Returns the current user's own expense claims.
 * Managers see claims pending their approval (?role=approver).
 * Admins can see all org claims (?all=true).
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const role = url.searchParams.get('role')
  const showAll = url.searchParams.get('all') === 'true'

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER')) {
    where = {
      profile: { organisationId: profile.organisationId },
    }
  } else if (role === 'approver') {
    where = {
      approverId: profile.id,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    }
  } else {
    where = { profileId: profile.id }
  }

  const claims = await prisma.expenseClaim.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true } },
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
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const category = requireEnum(body.category, 'Category', EXPENSE_CATEGORIES)
  const description = requireString(body.description, 'Description', 1000)
  const currency = requireEnum(body.currency, 'Currency', CURRENCIES)
  const projectId = optionalId(body.projectId, 'Project ID')
  const receiptUrl = optionalString(body.receiptUrl, 'Receipt URL', 2000)

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

  // If projectId provided, verify membership
  if (projectId) {
    const membership = await prisma.projectMembership.findFirst({
      where: { projectId, profileId: profile.id },
    })
    if (!membership) {
      throw new ValidationError('You are not a member of the specified project')
    }
  }

  // Find the user's manager as default approver
  const managerId = profile.managerId || null

  const claim = await prisma.expenseClaim.create({
    data: {
      profileId: profile.id,
      projectId,
      category,
      description,
      amount,
      currency,
      receiptUrl,
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
    metadata: { category, amount, currency },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ claim }, 201)
})
