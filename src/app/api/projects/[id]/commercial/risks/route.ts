import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum, optionalNumber,
} from '@/lib/validation'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const RISK_CATEGORIES = [
  'COST', 'PROGRAMME', 'CONTRACT', 'PROCUREMENT',
  'PAYMENT', 'SCOPE', 'REGULATORY',
] as const

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

const RISK_STATUSES = ['OPEN', 'MITIGATED', 'ESCALATED', 'CLOSED'] as const

/**
 * GET /api/projects/[id]/commercial/risks — List commercial risks for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof RISK_STATUSES[number] | null
  const category = url.searchParams.get('category') as typeof RISK_CATEGORIES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && RISK_STATUSES.includes(status as typeof RISK_STATUSES[number])) {
    where.status = status
  }
  if (category && RISK_CATEGORIES.includes(category as typeof RISK_CATEGORIES[number])) {
    where.category = category
  }

  const risks = await prisma.commercialRisk.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ risks })
})

/**
 * POST /api/projects/[id]/commercial/risks — Create a new commercial risk.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = requireString(body.description, 'Description', 5000)
  const category = optionalEnum(body.category, 'Category', RISK_CATEGORIES) ?? 'COST'
  const likelihood = optionalEnum(body.likelihood, 'Likelihood', RISK_LEVELS) ?? 'MEDIUM'
  const impact = optionalEnum(body.impact, 'Impact', RISK_LEVELS) ?? 'MEDIUM'
  const owner = optionalString(body.owner, 'Owner', 200)
  const mitigationPlan = optionalString(body.mitigationPlan, 'Mitigation plan', 5000)
  const amount = optionalNumber(body.amount, 'Amount', { min: 0 })
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'

  const risk = await prisma.commercialRisk.create({
    data: {
      projectId,
      title,
      description,
      category,
      likelihood,
      impact,
      owner,
      mitigationPlan,
      amount,
      currency,
      status: 'OPEN',
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.RISK_CREATED,
    entityType: 'CommercialRisk',
    entityId: risk.id,
    metadata: { title, category, likelihood, impact, amount },
  })

  return success({ risk }, 201)
})
