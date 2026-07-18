import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'

/** GET /api/settings/team — List team members for current organisation */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const members = await prisma.profile.findMany({
    where: { organisationId: profile.organisationId },
    orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    include: {
      office: { select: { name: true, city: true } },
      corporateRole: { select: { name: true, level: true } },
    },
  })

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      jobTitle: m.jobTitle,
      phone: m.phone,
      avatarUrl: m.avatarUrl,
      orgPermission: m.orgPermission,
      status: m.status,
      startDate: m.startDate,
      deactivatedAt: m.deactivatedAt,
      office: m.office ? { name: m.office.name, city: m.office.city } : null,
      role: m.corporateRole ? { name: m.corporateRole.name, level: m.corporateRole.level } : null,
    })),
    total: members.length,
    active: members.filter((m) => m.status === 'ACTIVE').length,
  })
})
