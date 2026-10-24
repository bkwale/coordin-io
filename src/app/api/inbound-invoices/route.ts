import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError } from '@/lib/errors'

/**
 * GET /api/inbound-invoices — List inbound invoices for the organisation.
 *
 * MANAGER+ can view. Supports filters:
 *   ?status=RECEIVED,CATEGORISED  (comma-separated)
 *   ?supplierId=xxx
 *   ?projectId=xxx
 *   ?from=2026-01-01&to=2026-12-31  (invoice date range)
 *   ?page=1&limit=50
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) return success({ invoices: [], total: 0 })

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const supplierId = url.searchParams.get('supplierId')
  const projectId = url.searchParams.get('projectId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))

  const where: Record<string, unknown> = { organisationId: profile.organisationId }

  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s: string) => s.trim())
    where.status = { in: statuses }
  }
  if (supplierId) where.supplierId = supplierId
  if (projectId) where.projectId = projectId
  if (from || to) {
    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)
    where.invoiceDate = dateFilter
  }

  const [invoices, total] = await Promise.all([
    prisma.inboundInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, vatNumber: true } },
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inboundInvoice.count({ where }),
  ])

  return success({ invoices, total, page, limit })
}, { requiredPermission: 'MANAGER' })
