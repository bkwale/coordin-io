import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum, optionalNumber,
} from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const VALUATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID', 'DISPUTED',
] as const

/**
 * GET /api/projects/[id]/commercial/valuations — List valuations for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof VALUATION_STATUSES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && VALUATION_STATUSES.includes(status as typeof VALUATION_STATUSES[number])) {
    where.status = status
  }

  const valuations = await prisma.valuation.findMany({
    where,
    orderBy: { valuationNumber: 'asc' },
  })

  return success({ valuations })
})

/**
 * POST /api/projects/[id]/commercial/valuations — Create a new valuation.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const period = requireString(body.period, 'Period', 100)
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const retentionPct = optionalNumber(body.retentionPct, 'Retention %', { min: 0, max: 100 }) ?? 5
  const notes = optionalString(body.notes, 'Notes', 5000)

  // Validate gross valuation
  const grossValuation = body.grossValuation
  if (grossValuation === null || grossValuation === undefined || typeof grossValuation !== 'number' || isNaN(grossValuation)) {
    throw new ValidationError('Gross valuation is required and must be a number')
  }
  if (grossValuation < 0) {
    throw new ValidationError('Gross valuation cannot be negative')
  }

  // Calculate previous cumulative from existing valuations
  const previousValuations = await prisma.valuation.findMany({
    where: { projectId },
    orderBy: { valuationNumber: 'desc' },
    take: 1,
  })

  const previousCumulative = previousValuations.length > 0
    ? previousValuations[0].grossValuation
    : 0

  const thisValuation = grossValuation - previousCumulative
  const retentionAmount = grossValuation * (retentionPct / 100)
  const netPayable = thisValuation - retentionAmount

  // Auto-increment valuation number
  const nextNumber = previousValuations.length > 0
    ? previousValuations[0].valuationNumber + 1
    : 1

  const valuation = await prisma.valuation.create({
    data: {
      projectId,
      valuationNumber: nextNumber,
      period,
      grossValuation,
      previousCumulative,
      thisValuation,
      retentionPct,
      retentionAmount,
      netPayable,
      currency,
      status: 'DRAFT',
      notes,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.VALUATION_CREATED,
    entityType: 'Valuation',
    entityId: valuation.id,
    metadata: { valuationNumber: nextNumber, period, grossValuation, netPayable, currency },
  })

  return success({ valuation }, 201)
})
