import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/audit — Recent audit events across all organisations */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const events = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      action: string
      entity_type: string
      entity_id: string
      metadata: unknown
      ip_address: string | null
      created_at: Date
      actor_name: string | null
      actor_email: string | null
      org_name: string
    }>
  >(
    `SELECT
      ae.id, ae.action, ae.entity_type, ae.entity_id,
      ae.metadata, ae.ip_address, ae.created_at,
      p.full_name as actor_name, p.email as actor_email,
      o.name as org_name
    FROM audit_events ae
    LEFT JOIN profiles p ON p.id = ae.actor_id
    JOIN organisations o ON o.id = ae.organisation_id
    ORDER BY ae.created_at DESC
    LIMIT $1 OFFSET $2`,
    limit,
    offset,
  )

  const totalResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM audit_events`,
  )

  return NextResponse.json({
    events,
    total: Number(totalResult[0].count),
    limit,
    offset,
  })
})
