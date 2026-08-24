import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { generateCsv, EXPORT_COLUMNS } from '@/lib/export-utils'

const modulesPrisma = prisma as unknown as Record<string, unknown>

/**
 * GET /api/export — Export data as CSV.
 *
 * Query params:
 *   type: "expenses" | "tasks" | "leave" | "assets" | "timesheets"
 *   projectId: optional — scope to a project
 *   status: optional — filter by status
 *   dateFrom / dateTo: optional — date range
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const projectId = url.searchParams.get('projectId')
  const statusFilter = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')

  if (!type || !EXPORT_COLUMNS[type]) {
    throw new ValidationError(`Invalid export type. Valid: ${Object.keys(EXPORT_COLUMNS).join(', ')}`)
  }

  if (dateFrom && isNaN(new Date(dateFrom).getTime())) {
    throw new ValidationError('Invalid dateFrom format')
  }
  if (dateTo && isNaN(new Date(dateTo).getTime())) {
    throw new ValidationError('Invalid dateTo format')
  }

  const columns = EXPORT_COLUMNS[type]
  let rows: Record<string, unknown>[] = []

  switch (type) {
    case 'expenses': {
      const where: Record<string, unknown> = {
        profile: { organisationId: profile.organisationId },
      }
      if (projectId) where.projectId = projectId
      if (statusFilter) where.status = statusFilter
      if (dateFrom) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), gte: new Date(dateFrom) }
      if (dateTo) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), lte: new Date(dateTo) }

      rows = await prisma.expenseClaim.findMany({
        where,
        include: {
          profile: { select: { fullName: true } },
          approver: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }) as unknown as Record<string, unknown>[]
      break
    }

    case 'tasks': {
      const where: Record<string, unknown> = {
        project: { organisationId: profile.organisationId },
      }
      if (projectId) where.projectId = projectId
      if (statusFilter) where.status = statusFilter

      rows = await prisma.task.findMany({
        where,
        include: {
          owner: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }) as unknown as Record<string, unknown>[]
      break
    }

    case 'leave': {
      const where: Record<string, unknown> = {
        profile: { organisationId: profile.organisationId },
      }
      if (statusFilter) where.status = statusFilter
      if (dateFrom) where.startDate = { ...(where.startDate as Record<string, unknown> ?? {}), gte: new Date(dateFrom) }
      if (dateTo) where.endDate = { ...(where.endDate as Record<string, unknown> ?? {}), lte: new Date(dateTo) }

      rows = await prisma.leaveRequest.findMany({
        where,
        include: {
          profile: { select: { fullName: true } },
          approver: { select: { fullName: true } },
        },
        orderBy: { startDate: 'desc' },
      }) as unknown as Record<string, unknown>[]
      break
    }

    case 'assets': {
      const where: Record<string, unknown> = {
        organisationId: profile.organisationId,
      }

      rows = await prisma.asset.findMany({
        where,
        orderBy: { name: 'asc' },
      }) as unknown as Record<string, unknown>[]
      break
    }

    case 'timesheets': {
      if (modulesPrisma.timesheetWeek && typeof (modulesPrisma.timesheetWeek as Record<string, unknown>).findMany === 'function') {
        const where: Record<string, unknown> = {
          profile: { organisationId: profile.organisationId },
        }
        if (statusFilter) where.status = statusFilter

        rows = await (modulesPrisma.timesheetWeek as { findMany: (args: unknown) => Promise<Record<string, unknown>[]> }).findMany({
          where,
          include: {
            profile: { select: { fullName: true } },
          },
          orderBy: { weekStarting: 'desc' },
        })
      }
      break
    }
  }

  // Permission check: non-admin can only export their own data for some types
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isHR = profile.orgPermission === 'HR'
  const isFinance = profile.orgPermission === 'FINANCE'

  if (!isAdmin && !isHR && !isFinance) {
    // Filter to own data for sensitive types
    if (type === 'expenses' || type === 'leave' || type === 'timesheets') {
      rows = rows.filter((r) => {
        const rowProfile = r.profile as { id?: string } | undefined
        const rowProfileId = (r as { profileId?: string }).profileId
        return rowProfileId === profile.id || rowProfile?.id === profile.id
      })
    }
  }

  const csv = generateCsv(columns, rows)
  const filename = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
