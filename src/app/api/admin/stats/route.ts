import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/stats — Platform-wide statistics */
export const GET = withSuperAdmin(async (_request: NextRequest) => {
  const [orgCount, userCount, projectCount, activeUsers] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM organisations`,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM profiles`,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM projects`,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM profiles WHERE status = 'ACTIVE'`,
    ),
  ])

  // Recent audit events (last 7 days)
  const recentEvents = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM audit_events WHERE created_at > NOW() - INTERVAL '7 days'`,
  )

  return NextResponse.json({
    organisations: Number(orgCount[0].count),
    users: Number(userCount[0].count),
    activeUsers: Number(activeUsers[0].count),
    projects: Number(projectCount[0].count),
    recentAuditEvents: Number(recentEvents[0].count),
  })
})
