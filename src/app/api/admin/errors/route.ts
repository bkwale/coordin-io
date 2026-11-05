import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'
import { providerStatus } from '@/lib/ai/providers/health'
import { aiAvailability } from '@/lib/ai/availability'

export const dynamic = 'force-dynamic'

const SOURCES = ['api', 'ai', 'cron', 'client', 'background']

/**
 * GET /api/admin/errors?days=7&source=ai&level=error&ref=ERR-XXXX
 *   ref given → that one occurrence in full (what a user quoted to support)
 *   otherwise → grouped by fingerprint: count, first/last seen, latest example; plus AI provider status
 */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const url = new URL(request.url)
  const ref = url.searchParams.get('ref')?.trim().toUpperCase()
  if (ref) {
    const event = await prisma.errorEvent.findUnique({ where: { ref } })
    if (!event) return NextResponse.json({ error: 'No error with that reference', code: 'NOT_FOUND' }, { status: 404 })
    const org = event.organisationId ? await prisma.organisation.findUnique({ where: { id: event.organisationId }, select: { name: true } }) : null
    const sameKind = await prisma.errorEvent.count({ where: { fingerprint: event.fingerprint } })
    return NextResponse.json({ data: { event: { ...event, organisationName: org?.name ?? null }, sameKind } })
  }

  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7') || 7, 1), 90)
  const source = url.searchParams.get('source')
  const level = url.searchParams.get('level')
  const since = new Date(Date.now() - days * 24 * 60 * 60_000)
  const where = {
    createdAt: { gte: since },
    ...(source && SOURCES.includes(source) ? { source } : {}),
    ...(level === 'error' || level === 'warning' ? { level } : {}),
  }

  const groups = await prisma.errorEvent.groupBy({
    by: ['fingerprint'],
    where,
    _count: { _all: true },
    _max: { createdAt: true },
    _min: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 100,
  })
  const latest = groups.length
    ? await prisma.errorEvent.findMany({
        where: { ...where, fingerprint: { in: groups.map((g) => g.fingerprint) } },
        orderBy: { createdAt: 'desc' },
        distinct: ['fingerprint'],
        select: { fingerprint: true, ref: true, level: true, source: true, route: true, method: true, statusCode: true, code: true, message: true, organisationId: true, release: true },
      })
    : []
  const byFp = new Map(latest.map((e) => [e.fingerprint, e]))
  const orgIds = Array.from(new Set(latest.map((e) => e.organisationId).filter((x): x is string => !!x)))
  const orgs = orgIds.length ? await prisma.organisation.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : []
  const orgName = new Map(orgs.map((o) => [o.id, o.name]))

  const [total, ai, providers] = await Promise.all([prisma.errorEvent.count({ where }), aiAvailability(), providerStatus()])

  return NextResponse.json({
    data: {
      days,
      total,
      ai: { ...ai, providers, configured: { mistral: !!process.env.MISTRAL_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY }, sentry: !!process.env.SENTRY_DSN, alertEmail: !!process.env.ERROR_ALERT_EMAIL },
      groups: groups.map((g) => {
        const e = byFp.get(g.fingerprint)
        return {
          fingerprint: g.fingerprint, count: g._count._all, firstSeen: g._min.createdAt, lastSeen: g._max.createdAt,
          ...(e ? { ...e, organisationName: e.organisationId ? orgName.get(e.organisationId) ?? null : null } : {}),
        }
      }),
    },
  }, { headers: { 'cache-control': 'no-store' } })
})
