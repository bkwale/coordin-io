import { prisma } from '@/lib/prisma'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

/**
 * Parse @mentions from text. Supports @[Full Name](profileId) format.
 * Returns array of profile IDs.
 */
export function parseMentions(text: string): string[] {
  if (!text) return []
  const regex = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[2])
  }
  return [...new Set(ids)] // deduplicate
}

/**
 * Send notifications to all @mentioned users in a comment.
 */
export async function notifyMentions(
  text: string,
  context: {
    organisationId: string
    mentionedById: string
    mentionedByName: string
    entityType: string // 'approval', 'leave', 'expense'
    entityId: string
    linkUrl: string
  },
): Promise<void> {
  const mentionedIds = parseMentions(text)
  if (mentionedIds.length === 0) return

  // Verify mentioned users are in the same org
  const validProfiles = await prisma.profile.findMany({
    where: {
      id: { in: mentionedIds },
      organisationId: context.organisationId,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  const validIds = validProfiles.map((p: { id: string }) => p.id)

  for (const profileId of validIds) {
    if (profileId === context.mentionedById) continue // don't notify self
    await createNotification({
      profileId,
      type: NOTIFICATION_EVENTS.MENTION,
      title: `${context.mentionedByName} mentioned you in a ${context.entityType} comment`,
      body: text.length > 100 ? text.substring(0, 100) + '...' : text,
      linkUrl: context.linkUrl,
    }).catch(() => {})
  }
}

/**
 * Search for mentionable users in an organisation.
 * Used by the frontend mention autocomplete.
 */
export async function searchMentionableUsers(
  organisationId: string,
  query: string,
  limit = 10,
) {
  return prisma.profile.findMany({
    where: {
      organisationId,
      status: 'ACTIVE',
      fullName: { contains: query, mode: 'insensitive' },
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      avatarUrl: true,
    },
    take: limit,
    orderBy: { fullName: 'asc' },
  })
}
