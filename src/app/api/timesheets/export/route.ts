import { NextRequest, NextResponse } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { generateCsv } from '@/lib/export-utils'
import { generateTimesheetPdf } from '@/lib/timesheet-pdf'
import type { TimesheetPdfWeek, TimesheetPdfEntry } from '@/lib/timesheet-pdf'

/* ── Local types for Prisma result shapes ─────────────── */

interface TimesheetEntryRow {
  id: string
  date: Date
  projectId: string | null
  workStage: string | null
  activity: string | null
  description: string | null
  hours: number
  isBillable: boolean
  isOvertime: boolean
  isTOIL: boolean
  locationType: string | null
}

interface TimesheetWeekRow {
  id: string
  profileId: string
  organisationId: string
  weekStarting: Date
  status: string
  totalHours: number
  billableHours: number
  submittedAt: Date | null
  approvedAt: Date | null
  profile: { id: string; fullName: string; jobTitle: string | null }
  entries: TimesheetEntryRow[]
}

interface ProjectRow {
  id: string
  name: string
  code: string | null
}

/* ── CSV column definitions (entry-level detail) ──────── */

const ENTRY_CSV_COLUMNS = [
  { key: 'employeeName', label: 'Employee' },
  { key: 'weekStarting', label: 'Week Starting' },
  { key: 'status', label: 'Week Status' },
  { key: 'date', label: 'Date', format: (v: unknown) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'projectName', label: 'Project' },
  { key: 'workStage', label: 'Work Stage' },
  { key: 'activity', label: 'Activity' },
  { key: 'description', label: 'Description' },
  { key: 'hours', label: 'Hours', format: (v: unknown) => Number(v).toFixed(1) },
  { key: 'isBillable', label: 'Billable', format: (v: unknown) => v ? 'Yes' : 'No' },
  { key: 'isOvertime', label: 'Overtime', format: (v: unknown) => v ? 'Yes' : 'No' },
  { key: 'locationType', label: 'Location' },
]

const SUMMARY_CSV_COLUMNS = [
  { key: 'employeeName', label: 'Employee' },
  { key: 'weekStarting', label: 'Week Starting', format: (v: unknown) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'totalHours', label: 'Total Hours', format: (v: unknown) => Number(v).toFixed(1) },
  { key: 'billableHours', label: 'Billable Hours', format: (v: unknown) => Number(v).toFixed(1) },
  { key: 'billablePercent', label: 'Billable %', format: (v: unknown) => `${v}%` },
  { key: 'entryCount', label: 'Entries' },
  { key: 'status', label: 'Status' },
  { key: 'submittedAt', label: 'Submitted', format: (v: unknown) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'approvedAt', label: 'Approved', format: (v: unknown) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
]

const WEEK_LIMIT = 500

/**
 * GET /api/timesheets/export
 *
 * Query params:
 *   format     — "csv" (default) or "pdf"
 *   detail     — "entries" (default, one row per entry) or "summary" (one row per week)
 *   role       — "manager" for team view (MANAGER/ADMIN/OWNER)
 *   profileId  — filter to specific employee (manager view only)
 *   status     — filter by week status
 *   dateFrom   — ISO date, weeks starting on or after
 *   dateTo     — ISO date, weeks starting on or before
 *   projectId  — filter entries by project
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const format = url.searchParams.get('format') || 'csv'
  const detail = url.searchParams.get('detail') || 'entries'
  const role = url.searchParams.get('role')
  const filterProfileId = url.searchParams.get('profileId')
  const filterStatus = url.searchParams.get('status')
  const filterDateFrom = url.searchParams.get('dateFrom')
  const filterDateTo = url.searchParams.get('dateTo')
  const filterProjectId = url.searchParams.get('projectId')

  if (!['csv', 'pdf'].includes(format)) {
    throw new ValidationError('format must be "csv" or "pdf"')
  }
  if (!['entries', 'summary'].includes(detail)) {
    throw new ValidationError('detail must be "entries" or "summary"')
  }

  // Validate date params
  if (filterDateFrom && isNaN(Date.parse(filterDateFrom))) {
    throw new ValidationError('dateFrom must be a valid date (YYYY-MM-DD)')
  }
  if (filterDateTo && isNaN(Date.parse(filterDateTo))) {
    throw new ValidationError('dateTo must be a valid date (YYYY-MM-DD)')
  }

  // Validate status param
  const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'LOCKED', 'REOPENED']
  if (filterStatus && !VALID_STATUSES.includes(filterStatus)) {
    throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`)
  }

  /* ── Build where clause ──────────────────────── */

  const where: Record<string, unknown> = {}

  if (role === 'manager') {
    const isManager =
      profile.orgPermission === 'ADMIN' ||
      profile.orgPermission === 'OWNER' ||
      profile.orgPermission === 'MANAGER'

    if (!isManager) {
      throw new ValidationError('You do not have permission to export team timesheets')
    }

    // Scope to org
    where.organisationId = profile.organisationId

    // Optional: filter to specific person
    if (filterProfileId) {
      where.profileId = filterProfileId
    }
  } else {
    // My timesheets only
    where.profileId = profile.id
  }

  if (filterStatus) {
    where.status = filterStatus
  }

  if (filterDateFrom || filterDateTo) {
    const range: Record<string, Date> = {}
    if (filterDateFrom) range.gte = new Date(filterDateFrom + 'T00:00:00.000Z')
    if (filterDateTo) range.lte = new Date(filterDateTo + 'T23:59:59.999Z')
    where.weekStarting = range
  }

  /* ── Fetch data ──────────────────────────────── */

  const weeks: TimesheetWeekRow[] = await modulesPrisma.timesheetWeek.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      entries: {
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          projectId: true,
          workStage: true,
          activity: true,
          description: true,
          hours: true,
          isBillable: true,
          isOvertime: true,
          isTOIL: true,
          locationType: true,
        },
      },
    },
    orderBy: [{ weekStarting: 'desc' }, { profile: { fullName: 'asc' } }],
    take: WEEK_LIMIT, // Safety cap — prevents unbounded memory on large orgs
  })

  if (weeks.length === 0) {
    throw new ValidationError('No timesheets found matching the selected filters')
  }

  // Warn if limit reached — user should narrow date range
  if (weeks.length === WEEK_LIMIT) {
    // Still export the data, but the CSV/PDF header will note truncation
    console.warn(`Timesheet export hit ${WEEK_LIMIT}-week limit — results may be truncated`)
  }

  /* ── Resolve project names ───────────────────── */

  const projectIds = new Set<string>()
  for (const week of weeks) {
    for (const entry of week.entries) {
      if (entry.projectId) projectIds.add(entry.projectId)
    }
  }

  const projects: ProjectRow[] =
    projectIds.size > 0
      ? await modulesPrisma.project.findMany({
          where: { id: { in: [...projectIds] } },
          select: { id: true, name: true, code: true },
        })
      : []

  const projectMap = new Map(projects.map((p) => [p.id, `${p.code || ''} ${p.name}`.trim()]))

  /* ── Filter entries by project if requested ──── */

  const filteredWeeks: TimesheetWeekRow[] = filterProjectId
    ? weeks
        .map((w) => ({
          ...w,
          entries: w.entries.filter((e) => e.projectId === filterProjectId),
        }))
        .filter((w) => w.entries.length > 0)
    : weeks

  if (filteredWeeks.length === 0) {
    throw new ValidationError('No timesheets found matching the selected project filter')
  }

  /* ── Generate CSV ────────────────────────────── */

  if (format === 'csv') {
    let csvContent: string

    if (detail === 'summary') {
      const rows = filteredWeeks.map((w) => ({
        employeeName: w.profile.fullName,
        weekStarting: w.weekStarting,
        totalHours: w.totalHours,
        billableHours: w.billableHours,
        billablePercent: w.totalHours > 0 ? Math.round((w.billableHours / w.totalHours) * 100) : 0,
        entryCount: w.entries.length,
        status: w.status,
        submittedAt: w.submittedAt,
        approvedAt: w.approvedAt,
      }))
      csvContent = generateCsv(SUMMARY_CSV_COLUMNS, rows)
    } else {
      const rows: Record<string, unknown>[] = []
      for (const w of filteredWeeks) {
        for (const e of w.entries) {
          rows.push({
            employeeName: w.profile.fullName,
            weekStarting: w.weekStarting.toISOString().slice(0, 10),
            status: w.status,
            date: e.date,
            projectName: e.projectId ? (projectMap.get(e.projectId) || 'Unknown') : '',
            workStage: e.workStage || '',
            activity: e.activity || '',
            description: e.description || '',
            hours: e.hours,
            isBillable: e.isBillable,
            isOvertime: e.isOvertime,
            locationType: e.locationType || '',
          })
        }
      }
      csvContent = generateCsv(ENTRY_CSV_COLUMNS, rows)
    }

    const filename = `timesheets-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  /* ── Generate PDF ────────────────────────────── */

  const pdfWeeks: TimesheetPdfWeek[] = filteredWeeks.map((w) => ({
    weekStarting: w.weekStarting.toISOString(),
    status: w.status,
    totalHours: w.totalHours,
    billableHours: w.billableHours,
    employeeName: w.profile.fullName,
    employeeJobTitle: w.profile.jobTitle || null,
    entries: w.entries.map(
      (e): TimesheetPdfEntry => ({
        date: e.date.toISOString(),
        projectName: e.projectId ? (projectMap.get(e.projectId) ?? null) : null,
        workStage: e.workStage,
        activity: e.activity,
        description: e.description,
        hours: e.hours,
        isBillable: e.isBillable,
        isOvertime: e.isOvertime,
        locationType: e.locationType,
      }),
    ),
    submittedAt: w.submittedAt ? w.submittedAt.toISOString() : null,
    approvedAt: w.approvedAt ? w.approvedAt.toISOString() : null,
  }))

  const dateLabel = filterDateFrom || filterDateTo
    ? `${filterDateFrom || 'start'} to ${filterDateTo || 'now'}`
    : 'All weeks'

  // Resolve organisation name for PDF header
  let orgName = 'Timesheet Report'
  try {
    const org = await modulesPrisma.organisation.findUnique({
      where: { id: profile.organisationId },
      select: { name: true },
    })
    if (org?.name) orgName = org.name
  } catch {
    // Fall back to generic title if org query fails
  }

  const pdfBuffer = await generateTimesheetPdf({
    organisationName: orgName,
    reportTitle: role === 'manager' ? `Team Timesheets — ${dateLabel}` : `My Timesheets — ${dateLabel}`,
    weeks: pdfWeeks,
    generatedAt: new Date().toISOString(),
    generatedBy: profile.fullName,
  })

  const filename = `timesheets-${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
    },
  })
})
