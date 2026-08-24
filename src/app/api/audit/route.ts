import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { canPerform } from '@/lib/role-permissions'
import { HR_VISIBLE_PREFIXES, AUDIT_ACTION_LABELS, getAuditPrefixesForRole } from '@/lib/audit'
import { PermissionError } from '@/lib/errors'

/**
 * GET /api/audit — Org-scoped audit trail.
 *
 * Access:
 *   OWNER/ADMIN — see all events for the org
 *   HR — see only HR-relevant events
 *   LEGAL — see only legal/planning-relevant events
 *   FINANCE — see only finance-relevant events
 *   COMMERCIAL — see only commercial-relevant events
 *
 * Query params:
 *   action   — filter by action prefix (e.g. "staffing" matches staffing.*)
 *              Special values: "hr" = all HR prefixes
 *   actorId  — filter by actor profile ID
 *   from     — ISO date string, events after this date
 *   to       — ISO date string, events before this date
 *   limit    — max rows (default 50, max 100)
 *   offset   — pagination offset
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  // Check audit access — any lateral role or above can view
  if (!canPerform(profile.orgPermission, 'audit', 'view_audit')) {
    throw new PermissionError('You do not have permission to view the audit trail')
  }

  const url = new URL(request.url)
  const actionFilter = url.searchParams.get('action') || undefined
  const actorId = url.searchParams.get('actorId') || undefined
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  const isFullAccess = hasOrgPermission(profile.orgPermission, 'ADMIN')
  const rolePrefixes = getAuditPrefixesForRole(profile.orgPermission)

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organisationId: profile.organisationId }

  // Date range
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }

  // Actor filter
  if (actorId) {
    where.actorId = actorId
  }

  // Action filter — user-provided prefix, "hr" composite, or role scope restriction
  const isHrComposite = actionFilter === 'hr'

  if (isHrComposite) {
    // Composite: all HR-visible prefixes
    where.OR = HR_VISIBLE_PREFIXES.map(prefix => ({
      action: { startsWith: prefix },
    }))
  } else if (actionFilter) {
    // Single prefix
    where.action = { startsWith: actionFilter }
  }

  // Role scope: restrict to role-visible prefixes only
  if (!isFullAccess && rolePrefixes !== null) {
    if (isHrComposite && profile.orgPermission !== 'HR') {
      // Non-HR role requested HR composite — override to their own prefixes
      where.OR = rolePrefixes.map(prefix => ({
        action: { startsWith: prefix },
      }))
    } else if (isHrComposite) {
      // HR role with HR composite — already filtered correctly
    } else if (actionFilter) {
      // Verify the requested prefix is in the role's visible list
      const isAllowed = rolePrefixes.some(p => actionFilter.startsWith(p) || p.startsWith(actionFilter))
      if (!isAllowed) {
        return success({ events: [], total: 0, labels: AUDIT_ACTION_LABELS })
      }
    } else {
      // No filter specified — restrict to role-visible prefixes
      where.OR = rolePrefixes.map(prefix => ({
        action: { startsWith: prefix },
      }))
    }
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: {
        actor: {
          select: { id: true, fullName: true, email: true, orgPermission: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditEvent.count({ where }),
  ])

  const formatted = events.map(e => ({
    id: e.id,
    action: e.action,
    actionLabel: AUDIT_ACTION_LABELS[e.action] || e.action.replace(/[._]/g, ' '),
    entityType: e.entityType,
    entityId: e.entityId,
    metadata: e.metadata,
    actorId: e.actorId,
    actorName: e.actor?.fullName || null,
    actorEmail: e.actor?.email || null,
    actorRole: e.actor?.orgPermission || null,
    createdAt: e.createdAt.toISOString(),
    ipAddress: e.ipAddress,
  }))

  return success({ events: formatted, total, labels: AUDIT_ACTION_LABELS })
}, { requiredPermission: 'MEMBER' })
