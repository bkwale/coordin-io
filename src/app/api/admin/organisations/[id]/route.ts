import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/organisations/[id] — Organisation detail with users & projects */
export const GET = withSuperAdmin(async (
  request: NextRequest,
) => {
  const id = request.nextUrl.pathname.split('/').pop()

  if (!id) {
    return NextResponse.json({ error: 'Organisation ID required' }, { status: 400 })
  }

  // Get org
  const orgs = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; slug: string; default_currency: string; created_at: Date }>
  >(`SELECT id, name, slug, default_currency, created_at FROM organisations WHERE id = $1`, id)

  if (orgs.length === 0) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
  }

  // Get users
  const users = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      full_name: string
      email: string
      job_title: string | null
      orgPermission: string
      status: string
      created_at: Date
    }>
  >(
    `SELECT id, full_name, email, job_title, "orgPermission", status, created_at
     FROM profiles WHERE organisation_id = $1 ORDER BY created_at ASC`,
    id,
  )

  // Get projects
  const projects = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      code: string | null
      status: string
      stage: string
      health_status: string
      created_at: Date
    }>
  >(
    `SELECT id, name, code, status, stage, health_status, created_at
     FROM projects WHERE organisation_id = $1 ORDER BY created_at DESC`,
    id,
  )

  return NextResponse.json({
    organisation: orgs[0],
    users,
    projects,
  })
})
