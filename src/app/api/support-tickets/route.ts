import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { hasOrgPermission } from '@/lib/permissions'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/support-tickets — List support tickets.
 *
 * - Regular users see only their own tickets.
 * - ADMIN / OWNER see all tickets in the organisation.
 * - Supports ?status=OPEN,IN_PROGRESS filter.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const isAdmin = hasOrgPermission(
    profile.orgPermission as OrgPermission,
    'ADMIN'
  )

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }

  // Regular users only see their own tickets
  if (!isAdmin) {
    where.submitterId = profile.id
  }

  // Optional status filter
  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(s =>
      ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(s)
    )
    if (statuses.length > 0) {
      where.status = { in: statuses }
    }
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      submitter: { select: { id: true, fullName: true, email: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return success({
    tickets: tickets.map((t: any) => ({
      id: t.id,
      ref: `#${t.id.slice(-6).toUpperCase()}`,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category,
      page: t.page,
      submitter: t.submitter,
      replyCount: t._count.replies,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
    })),
  })
})
