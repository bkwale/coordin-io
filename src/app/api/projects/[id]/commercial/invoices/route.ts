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

const INVOICE_TYPES = [
  'FEE_INVOICE', 'REIMBURSABLE', 'VARIATION',
  'RETENTION_RELEASE', 'CREDIT_NOTE',
] as const

const INVOICE_STATUSES = [
  'DRAFT', 'ISSUED', 'OVERDUE', 'PARTIALLY_PAID',
  'PAID', 'CANCELLED', 'WRITTEN_OFF',
] as const

/**
 * GET /api/projects/[id]/commercial/invoices — List invoices for the project.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') as typeof INVOICE_STATUSES[number] | null
  const invoiceType = url.searchParams.get('type') as typeof INVOICE_TYPES[number] | null

  const where: Record<string, unknown> = { projectId }
  if (status && INVOICE_STATUSES.includes(status as typeof INVOICE_STATUSES[number])) {
    where.status = status
  }
  if (invoiceType && INVOICE_TYPES.includes(invoiceType as typeof INVOICE_TYPES[number])) {
    where.invoiceType = invoiceType
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ invoices })
})

/**
 * POST /api/projects/[id]/commercial/invoices — Create a new invoice.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const invoiceNumber = requireString(body.invoiceNumber, 'Invoice number', 50)
  const invoiceType = optionalEnum(body.invoiceType, 'Invoice type', INVOICE_TYPES) ?? 'FEE_INVOICE'
  const recipient = requireString(body.recipient, 'Recipient', 200)
  const description = requireString(body.description, 'Description', 2000)
  const currency = optionalEnum(body.currency, 'Currency', CURRENCIES) ?? 'NGN'
  const taxRate = optionalNumber(body.taxRate, 'Tax rate', { min: 0, max: 100 }) ?? 0
  const issueDate = optionalDate(body.issueDate, 'Issue date')
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const notes = optionalString(body.notes, 'Notes', 5000)

  // Validate net amount
  const netAmount = body.netAmount
  if (netAmount === null || netAmount === undefined || typeof netAmount !== 'number' || isNaN(netAmount)) {
    throw new ValidationError('Net amount is required and must be a number')
  }
  if (netAmount <= 0) {
    throw new ValidationError('Net amount must be greater than zero')
  }

  // Calculate tax and gross
  const taxAmount = netAmount * (taxRate / 100)
  const grossAmount = netAmount + taxAmount

  // Validate issue date is present
  if (!issueDate) {
    throw new ValidationError('Issue date is required')
  }

  // Check invoice number is unique within project
  const existingInvoice = await prisma.invoice.findFirst({
    where: { projectId, invoiceNumber },
  })
  if (existingInvoice) {
    throw new ValidationError(`Invoice number "${invoiceNumber}" already exists for this project`)
  }

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      invoiceNumber,
      invoiceType,
      recipient,
      description,
      netAmount,
      taxRate,
      taxAmount,
      grossAmount,
      currency,
      issueDate,
      dueDate,
      status: 'DRAFT',
      notes,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.INVOICE_CREATED,
    entityType: 'Invoice',
    entityId: invoice.id,
    metadata: { invoiceNumber, invoiceType, recipient, netAmount, grossAmount, currency },
  })

  return success({ invoice }, 201)
})
