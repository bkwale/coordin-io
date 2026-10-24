import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { optionalString, parseBody } from '@/lib/validation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError, NotFoundError } from '@/lib/errors'
import { createApprovalInstance } from '@/lib/approval-engine'
import type { InboundInvoiceStatus } from '@/generated/prisma/client'

const VALID_STATUSES: InboundInvoiceStatus[] = [
  'RECEIVED', 'CATEGORISED', 'PENDING_REVIEW', 'APPROVED', 'SYNCED', 'PAID', 'REJECTED', 'VOIDED',
]

/**
 * GET /api/inbound-invoices/[id] — Get invoice detail with line items.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const invoice = await prisma.inboundInvoice.findFirst({
    where: { id, organisationId: profile.organisationId },
    include: {
      supplier: true,
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true } },
      approvalInstance: {
        include: {
          steps: {
            include: { approver: { select: { id: true, fullName: true } } },
            orderBy: { stepOrder: 'asc' },
          },
        },
      },
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!invoice) throw new NotFoundError('Invoice')

  return success({ invoice })
}, { requiredPermission: 'MANAGER' })

/**
 * PATCH /api/inbound-invoices/[id] — Update invoice (status, project, supplier assignment, line items).
 *
 * ADMIN/OWNER can change anything. MANAGER can assign project and update status to PENDING_REVIEW.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const existing = await prisma.inboundInvoice.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Invoice')

  const body = await parseBody(request)
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  const updates: Record<string, unknown> = {}

  // Status transition
  if (body.status) {
    const newStatus = body.status as InboundInvoiceStatus
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new ValidationError(`Invalid status: ${newStatus}`)
    }

    // Managers can only move to PENDING_REVIEW
    if (!isAdmin && newStatus !== 'PENDING_REVIEW') {
      throw new ValidationError('Only admins can change invoice status beyond PENDING_REVIEW')
    }

    // APPROVED sets approvedBy + approvedAt
    if (newStatus === 'APPROVED') {
      updates.approvedById = profile.id
      updates.approvedAt = new Date()
    }

    updates.status = newStatus
  }

  // Assign supplier
  if (body.supplierId !== undefined) {
    if (body.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, organisationId: profile.organisationId },
      })
      if (!supplier) throw new ValidationError('Supplier not found in this organisation')
      updates.supplierId = body.supplierId
    } else {
      updates.supplierId = null
    }
  }

  // Assign project
  if (body.projectId !== undefined) {
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, organisationId: profile.organisationId },
      })
      if (!project) throw new ValidationError('Project not found in this organisation')
      updates.projectId = body.projectId
    } else {
      updates.projectId = null
    }
  }

  if (body.notes !== undefined) updates.notes = optionalString(body.notes, 'Notes', 2000)

  // Wrap line item updates + invoice update in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    // Update line item account codes (bulk)
    if (Array.isArray(body.lineItemUpdates)) {
      for (const lineUpdate of body.lineItemUpdates) {
        if (!lineUpdate.id) continue
        const lineData: Record<string, unknown> = {}
        if (lineUpdate.accountCode !== undefined) lineData.accountCode = lineUpdate.accountCode || null
        if (lineUpdate.costCode !== undefined) lineData.costCode = lineUpdate.costCode || null

        if (Object.keys(lineData).length > 0) {
          await tx.inboundInvoiceLine.updateMany({
            where: { id: lineUpdate.id, invoiceId: id },
            data: lineData,
          })
        }
      }
    }

    return tx.inboundInvoice.update({
      where: { id },
      data: updates,
      include: {
        supplier: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, code: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    })
  })

  // ── Approval Engine: create approval instance on PENDING_REVIEW ──
  if (body.status === 'PENDING_REVIEW') {
    // Cancel any existing approval instance before creating a new one
    if (existing.approvalInstanceId) {
      await prisma.approvalInstance.update({
        where: { id: existing.approvalInstanceId },
        data: { status: 'CANCELLED' },
      }).catch((err: unknown) => console.error(`[invoicing] Failed to cancel old approval ${existing.approvalInstanceId}:`, err))
    }

    const approvalInstanceId = await createApprovalInstance({
      organisationId: profile.organisationId,
      requestType: 'INBOUND_INVOICE',
      entityId: id,
      submitterId: profile.id,
      amount: existing.grossAmount ?? undefined,
      submitterManagerId: profile.managerId,
    }).catch((err: unknown) => {
      console.error(`[invoicing] Failed to create approval instance for invoice ${id}:`, err)
      return null
    })

    // Link approval instance to invoice
    if (approvalInstanceId) {
      await prisma.inboundInvoice.update({
        where: { id },
        data: { approvalInstanceId },
      })
    }
  }

  return success({ invoice })
}, { requiredPermission: 'MANAGER' })
