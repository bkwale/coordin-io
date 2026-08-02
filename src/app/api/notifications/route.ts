import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody } from '@/lib/validation'

/**
 * GET /api/notifications — List notifications for current user.
 * Query params: ?unreadOnly=true&limit=20&offset=0
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  const where: Record<string, unknown> = { profileId: profile.id }
  if (unreadOnly) where.read = false

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { profileId: profile.id, read: false } }),
  ])

  return success({ notifications, total, unreadCount })
})

/**
 * PATCH /api/notifications — Mark notification(s) as read.
 * Body: { ids: string[] } or { markAllRead: true }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  if (body.markAllRead === true) {
    await prisma.notification.updateMany({
      where: { profileId: profile.id, read: false },
      data: { read: true, readAt: new Date() },
    })
    return success({ message: 'All notifications marked as read' })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return success({ message: 'No notification IDs provided' }, 400)
  }

  await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      profileId: profile.id, // Security: only update own notifications
    },
    data: { read: true, readAt: new Date() },
  })

  return success({ message: `${ids.length} notification(s) marked as read` })
})
