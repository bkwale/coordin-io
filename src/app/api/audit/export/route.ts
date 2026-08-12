import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { HR_VISIBLE_PREFIXES, AUDIT_ACTION_LABELS, recordAuditEvent, AuditActions } from '@/lib/audit'
import { RateLimitedError, ValidationError } from '@/lib/errors'

const EXPORT_COOLDOWN_MS = 60_000 // 1 minute
const MAX_DATE_RANGE_DAYS = 90
const exportTimestamps = new Map<string, number>()

/**
 * GET /api/audit/export — Download audit trail as CSV.
 *
 * Same access control as /api/audit:
 *   OWNER/ADMIN see all; HR sees only HR-relevant actions.
 *
 * Query params: action, actorId, from, to (required — max 90 days).
 * Rate limited: 1 export per minute per user.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  // Rate limit per profile
  const lastExport = exportTimestamps.get(profile.id) || 0
  if (Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
    throw new RateLimitedError('Please wait 1 minute between exports')
  }

  const url = new URL(request.url)
  const actionFilter = url.searchParams.get('action') || undefined
  const actorId = url.searchParams.get('actorId') || undefined
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  // Require date range
  if (!from || !to) {
    throw new ValidationError('Both "from" and "to" dates are required for export')
  }

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)

  if (rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days. Use multiple exports for longer periods.`)
  }

  if (rangeDays < 0) {
    throw new ValidationError('"from" date must be before "to" date')
  }

  // Set rate-limit timestamp immediately to prevent concurrent exports
  exportTimestamps.set(profile.id, Date.now())

  const isFullAccess = hasOrgPermission(profile.orgPermission, 'ADMIN')

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    organisationId: profile.organisationId,
    createdAt: { gte: fromDate, lte: toDate },
  }

  if (actorId) where.actorId = actorId

  const isHrComposite = actionFilter === 'hr'

  if (isHrComposite) {
    where.OR = HR_VISIBLE_PREFIXES.map(prefix => ({
      action: { startsWith: prefix },
    }))
  } else if (actionFilter) {
    where.action = { startsWith: actionFilter }
  }

  // HR scope restriction
  if (!isFullAccess) {
    if (isHrComposite) {
      // Already filtered to HR prefixes — allowed
    } else if (actionFilter) {
      const isAllowed = HR_VISIBLE_PREFIXES.some(p => actionFilter.startsWith(p) || p.startsWith(actionFilter))
      if (!isAllowed) {
        return new NextResponse('Date,Action,Actor,Entity,Details\n', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="audit-export-${from}-to-${to}.csv"`,
          },
        })
      }
    } else {
      where.OR = HR_VISIBLE_PREFIXES.map(prefix => ({
        action: { startsWith: prefix },
      }))
    }
  }

  const events = await prisma.auditEvent.findMany({
    where,
    include: {
      actor: { select: { fullName: true, email: true, orgPermission: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000, // Hard cap
  })

  // Record the export as an audit event
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.AUDIT_EXPORTED,
    entityType: 'AuditExport',
    entityId: `export-${Date.now()}`,
    metadata: {
      from,
      to,
      actionFilter: actionFilter || 'all',
      eventCount: events.length,
    },
  }).catch(() => {})

  // Build CSV
  const escCsv = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = [
    'Date,Time,Action,Actor,Actor Role,Entity Type,Entity ID,Details',
  ]

  for (const e of events) {
    const dt = new Date(e.createdAt)
    const date = dt.toISOString().split('T')[0]
    const time = dt.toISOString().split('T')[1].split('.')[0]
    const label = AUDIT_ACTION_LABELS[e.action] || e.action
    const actor = e.actor?.fullName || e.actor?.email || 'System'
    const role = e.actor?.orgPermission || ''
    const meta = e.metadata ? JSON.stringify(e.metadata) : ''

    rows.push([
      date,
      time,
      escCsv(label),
      escCsv(actor),
      role,
      e.entityType,
      e.entityId,
      escCsv(meta),
    ].join(','))
  }

  const csv = rows.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-${from}-to-${to}.csv"`,
    },
  })
}, { requiredPermission: 'HR' })
