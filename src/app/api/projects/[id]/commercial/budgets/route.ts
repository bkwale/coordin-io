import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, requireString, optionalString, optionalEnum, optionalNumber } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const
const BUDGET_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED'] as const

/**
 * GET /api/projects/[id]/commercial/budgets — List budgets for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof BUDGET_STATUSES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && BUDGET_STATUSES.includes(status as typeof BUDGET_STATUSES[number])) {
    where.status = status
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      costPlanLines: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ budgets })
})

/**
 * POST /api/projects/[id]/commercial/budgets — Create a new budget with cost plan lines.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const name = requireString(body.name, 'Budget name', 200)
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const notes = optionalString(body.notes, 'Notes', 5000)

  // Validate cost plan lines
  const lines = body.lines
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ValidationError('At least one cost plan line is required')
  }

  let totalAmount = 0
  const validatedLines: Array<{
    elementCode: string
    elementName: string
    quantity: number | null
    unit: string | null
    rate: number | null
    amount: number
    sortOrder: number
    notes: string | null
  }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const elementCode = requireString(line.elementCode, `Line ${i + 1} element code`, 50)
    const elementName = requireString(line.elementName, `Line ${i + 1} element name`, 200)
    const lineAmount = line.amount

    if (lineAmount === null || lineAmount === undefined || typeof lineAmount !== 'number' || isNaN(lineAmount)) {
      throw new ValidationError(`Line ${i + 1} amount is required and must be a number`)
    }

    const quantity = optionalNumber(line.quantity, `Line ${i + 1} quantity`, { min: 0 })
    const rate = optionalNumber(line.rate, `Line ${i + 1} rate`, { min: 0 })
    const unit = optionalString(line.unit, `Line ${i + 1} unit`, 50)
    const lineNotes = optionalString(line.notes, `Line ${i + 1} notes`, 1000)

    totalAmount += lineAmount

    validatedLines.push({
      elementCode,
      elementName,
      quantity,
      unit,
      rate,
      amount: lineAmount,
      sortOrder: i,
      notes: lineNotes,
    })
  }

  // Determine version number
  const existingCount = await prisma.budget.count({ where: { projectId } })

  const budget = await prisma.budget.create({
    data: {
      projectId,
      name,
      totalAmount,
      currency,
      version: existingCount + 1,
      status: 'DRAFT',
      notes,
      costPlanLines: {
        create: validatedLines,
      },
    },
    include: {
      costPlanLines: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.BUDGET_CREATED,
    entityType: 'Budget',
    entityId: budget.id,
    metadata: { name, totalAmount, currency, lineCount: validatedLines.length },
  })

  return success({ budget }, 201)
})
