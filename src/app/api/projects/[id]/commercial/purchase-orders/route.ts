import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  parseBody, requireString, optionalString, optionalEnum,
  optionalNumber, optionalDate,
} from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const

const PO_STATUSES = [
  'DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED',
  'DELIVERED', 'CLOSED', 'CANCELLED',
] as const

/**
 * GET /api/projects/[id]/commercial/purchase-orders — List purchase orders for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof PO_STATUSES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && PO_STATUSES.includes(status as typeof PO_STATUSES[number])) {
    where.status = status
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ purchaseOrders })
})

/**
 * POST /api/projects/[id]/commercial/purchase-orders — Create a new purchase order.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const poNumber = requireString(body.poNumber, 'PO number', 50)
  const supplier = requireString(body.supplier, 'Supplier', 200)
  const description = requireString(body.description, 'Description', 2000)
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const taxAmount = optionalNumber(body.taxAmount, 'Tax amount', { min: 0 })
  const issueDate = optionalDate(body.issueDate, 'Issue date')
  const deliveryDate = optionalDate(body.deliveryDate, 'Delivery date')
  const notes = optionalString(body.notes, 'Notes', 5000)

  // Validate amount
  const amount = body.amount
  if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
    throw new ValidationError('Amount is required and must be a number')
  }
  if (amount <= 0) {
    throw new ValidationError('Amount must be greater than zero')
  }

  // Check PO number is unique within project
  const existingPO = await prisma.purchaseOrder.findFirst({
    where: { projectId, poNumber },
  })
  if (existingPO) {
    throw new ValidationError(`PO number "${poNumber}" already exists for this project`)
  }

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      projectId,
      poNumber,
      supplier,
      description,
      amount,
      currency,
      taxAmount,
      status: 'DRAFT',
      issueDate,
      deliveryDate,
      notes,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PO_CREATED,
    entityType: 'PurchaseOrder',
    entityId: purchaseOrder.id,
    metadata: { poNumber, supplier, amount, currency },
  })

  return success({ purchaseOrder }, 201)
})
