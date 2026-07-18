import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/users — List all users across all organisations */
export const GET = withSuperAdmin(async (_request: NextRequest) => {
  const users = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      full_name: string
      email: string
      job_title: string | null
      orgPermission: string
      status: string
      auth_user_id: string | null
      created_at: Date
      org_name: string
      org_slug: string
    }>
  >(`
    SELECT
      p.id, p.full_name, p.email, p.job_title, p."orgPermission",
      p.status, p.auth_user_id, p.created_at,
      o.name as org_name, o.slug as org_slug
    FROM profiles p
    JOIN organisations o ON o.id = p.organisation_id
    ORDER BY p.created_at DESC
  `)

  return NextResponse.json({ users })
})

/** POST /api/admin/users — Create a user profile in a specific org */
export const POST = withSuperAdmin(async (request: NextRequest) => {
  const body = await request.json()
  const { organisationId, fullName, email, jobTitle, orgPermission = 'MEMBER' } = body

  if (!organisationId || !fullName || !email) {
    return NextResponse.json(
      { error: 'organisationId, fullName, and email are required' },
      { status: 400 },
    )
  }

  // Verify org exists
  const orgCheck = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM organisations WHERE id = $1`,
    organisationId,
  )

  if (orgCheck.length === 0) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
  }

  const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO profiles (organisation_id, full_name, email, job_title, "orgPermission", status)
     VALUES ($1, $2, $3, $4, $5::"OrgPermission", 'INVITED'::"ProfileStatus")
     RETURNING id`,
    organisationId,
    fullName,
    email,
    jobTitle || null,
    orgPermission,
  )

  return NextResponse.json({ profile: { id: result[0].id } }, { status: 201 })
})
