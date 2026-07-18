import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/organisations — List all organisations */
export const GET = withSuperAdmin(async (_request: NextRequest) => {
  const orgs = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      slug: string
      default_currency: string
      created_at: Date
      user_count: bigint
      project_count: bigint
    }>
  >(`
    SELECT
      o.id, o.name, o.slug, o.default_currency, o.created_at,
      (SELECT COUNT(*) FROM profiles p WHERE p.organisation_id = o.id) as user_count,
      (SELECT COUNT(*) FROM projects pr WHERE pr.organisation_id = o.id) as project_count
    FROM organisations o
    ORDER BY o.created_at DESC
  `)

  return NextResponse.json({
    organisations: orgs.map((o) => ({
      ...o,
      user_count: Number(o.user_count),
      project_count: Number(o.project_count),
    })),
  })
})

/** POST /api/admin/organisations — Create a new organisation */
export const POST = withSuperAdmin(async (request: NextRequest) => {
  const body = await request.json()
  const { name, slug, defaultCurrency = 'NGN', adminEmail, adminName } = body

  if (!name || !slug) {
    return NextResponse.json(
      { error: 'name and slug are required' },
      { status: 400 },
    )
  }

  // Check slug uniqueness
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM organisations WHERE slug = $1 LIMIT 1`,
    slug,
  )

  if (existing.length > 0) {
    return NextResponse.json(
      { error: `Organisation with slug "${slug}" already exists` },
      { status: 409 },
    )
  }

  // Create org
  const orgResult = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO organisations (name, slug, default_currency)
     VALUES ($1, $2, $3::\"Currency\")
     RETURNING id`,
    name,
    slug,
    defaultCurrency,
  )

  const orgId = orgResult[0].id

  // If admin details provided, create the admin profile
  let profileId: string | null = null
  if (adminEmail && adminName) {
    const profileResult = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO profiles (organisation_id, full_name, email, \"orgPermission\", status)
       VALUES ($1, $2, $3, 'OWNER'::"OrgPermission", 'INVITED'::"ProfileStatus")
       RETURNING id`,
      orgId,
      adminName,
      adminEmail,
    )
    profileId = profileResult[0].id
  }

  return NextResponse.json(
    {
      organisation: { id: orgId, name, slug, defaultCurrency },
      adminProfile: profileId ? { id: profileId } : null,
    },
    { status: 201 },
  )
})
