import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody, optionalString, optionalId, requireNumber } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

const LOCATION_TYPES = ['office', 'site', 'remote', 'travel'] as const

/**
 * GET /api/timesheets/[weekId]/entries — List entries for a week.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const weekId = request.url.match(/\/timesheets\/([^/]+)\/entries/)?.[1]
  if (!weekId) throw new NotFoundError('Timesheet not found')

  const week = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: weekId },
    select: { profileId: true, organisationId: true, profile: { select: { managerId: true } } },
  })

  if (!week || week.organisationId !== profile.organisationId) {
    throw new NotFoundError('Timesheet not found')
  }

  const isOwner = week.profileId === profile.id
  const isManager = week.profile.managerId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isOwner && !isManager && !isAdmin) {
    throw new PermissionError('You do not have access to this timesheet')
  }

  const entries = await modulesPrisma.timesheetEntry.findMany({
    where: { weekId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  return success({ entries })
})

/**
 * POST /api/timesheets/[weekId]/entries — Add an entry.
 *
 * Body: { date, projectId?, workStage?, taskId?, activity?, description?, hours, isBillable?, overheadCode?, locationType?, isOvertime?, isTOIL? }
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const weekId = request.url.match(/\/timesheets\/([^/]+)\/entries/)?.[1]
  if (!weekId) throw new NotFoundError('Timesheet not found')

  const week = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: weekId },
    select: { id: true, profileId: true, organisationId: true, status: true, weekStarting: true },
  })

  if (!week || week.organisationId !== profile.organisationId) {
    throw new NotFoundError('Timesheet not found')
  }

  if (week.profileId !== profile.id) {
    throw new PermissionError('You can only add entries to your own timesheet')
  }

  // Only allow edits in DRAFT, CHANGES_REQUIRED, or REOPENED
  const editableStatuses = ['DRAFT', 'CHANGES_REQUIRED', 'REOPENED']
  if (!editableStatuses.includes(week.status)) {
    throw new ValidationError(`Cannot add entries to a timesheet with status: ${week.status}`)
  }

  const body = await parseBody(request)

  // Validate date — expects YYYY-MM-DD, normalised to midnight UTC
  if (!body.date || typeof body.date !== 'string') {
    throw new ValidationError('Date is required (YYYY-MM-DD)')
  }
  const entryDate = new Date(body.date + 'T00:00:00.000Z')
  if (isNaN(entryDate.getTime())) {
    throw new ValidationError('Date is not valid')
  }

  // Ensure date falls within the week
  const weekStart = new Date(week.weekStarting)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

  if (entryDate < weekStart || entryDate > weekEnd) {
    throw new ValidationError('Entry date must fall within the timesheet week')
  }

  const hours = requireNumber(body.hours, 'hours', { min: 0.01, max: 24 })

  const projectId = optionalId(body.projectId, 'Project ID')
  const taskId = optionalId(body.taskId, 'Task ID')
  const workStage = optionalString(body.workStage, 'Work stage', 100)
  const activity = optionalString(body.activity, 'Activity', 500)
  const description = optionalString(body.description, 'Description', 2000)
  const overheadCode = optionalString(body.overheadCode, 'Overhead code', 100)
  const locationType = body.locationType ? String(body.locationType) : null

  if (locationType && !LOCATION_TYPES.includes(locationType as typeof LOCATION_TYPES[number])) {
    throw new ValidationError(`Location type must be one of: ${LOCATION_TYPES.join(', ')}`)
  }

  const isBillable = body.isBillable !== undefined ? Boolean(body.isBillable) : true
  const isOvertime = Boolean(body.isOvertime)
  const isTOIL = Boolean(body.isTOIL)

  const entry = await modulesPrisma.timesheetEntry.create({
    data: {
      weekId,
      date: entryDate,
      projectId,
      workStage,
      taskId,
      activity,
      description,
      hours,
      isBillable,
      overheadCode,
      locationType,
      isOvertime,
      isTOIL,
    },
  })

  // Recalculate week totals
  const allEntries = await modulesPrisma.timesheetEntry.findMany({
    where: { weekId },
    select: { hours: true, isBillable: true },
  })

  const totalHours = allEntries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)
  const billableHours = allEntries
    .filter((e: { isBillable: boolean }) => e.isBillable)
    .reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)

  await modulesPrisma.timesheetWeek.update({
    where: { id: weekId },
    data: { totalHours, billableHours },
  })

  return success({ entry }, 201)
})

/**
 * PATCH /api/timesheets/[weekId]/entries — Bulk update entries (copy previous week).
 *
 * Body: { copyFromWeekId: string } — copies entries from another week
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const weekId = request.url.match(/\/timesheets\/([^/]+)\/entries/)?.[1]
  if (!weekId) throw new NotFoundError('Timesheet not found')

  const body = await parseBody(request)
  const copyFromWeekId = body.copyFromWeekId as string

  if (!copyFromWeekId) {
    throw new ValidationError('copyFromWeekId is required')
  }

  // Validate target week
  const targetWeek = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: weekId },
    select: { id: true, profileId: true, organisationId: true, status: true, weekStarting: true },
  })

  if (!targetWeek || targetWeek.organisationId !== profile.organisationId) {
    throw new NotFoundError('Target timesheet not found')
  }

  if (targetWeek.profileId !== profile.id) {
    throw new PermissionError('You can only copy entries to your own timesheet')
  }

  const editableStatuses = ['DRAFT', 'CHANGES_REQUIRED', 'REOPENED']
  if (!editableStatuses.includes(targetWeek.status)) {
    throw new ValidationError(`Cannot add entries to a timesheet with status: ${targetWeek.status}`)
  }

  // Get source entries
  const sourceWeek = await modulesPrisma.timesheetWeek.findUnique({
    where: { id: copyFromWeekId },
    select: { profileId: true, weekStarting: true },
  })

  if (!sourceWeek || sourceWeek.profileId !== profile.id) {
    throw new NotFoundError('Source timesheet not found')
  }

  const sourceEntries = await modulesPrisma.timesheetEntry.findMany({
    where: { weekId: copyFromWeekId },
  })

  if (sourceEntries.length === 0) {
    throw new ValidationError('Source week has no entries to copy')
  }

  // Calculate day offset between source and target week
  const sourceStart = new Date(sourceWeek.weekStarting)
  const targetStart = new Date(targetWeek.weekStarting)
  const dayOffset = Math.round((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24))

  // Create new entries with shifted dates
  const newEntries = sourceEntries.map((e: Record<string, unknown>) => {
    const sourceDate = new Date(e.date as string)
    const newDate = new Date(sourceDate)
    newDate.setUTCDate(newDate.getUTCDate() + dayOffset)

    return {
      weekId,
      date: newDate,
      projectId: e.projectId as string | null,
      workStage: e.workStage as string | null,
      taskId: e.taskId as string | null,
      activity: e.activity as string | null,
      description: e.description as string | null,
      hours: e.hours as number,
      isBillable: e.isBillable as boolean,
      overheadCode: e.overheadCode as string | null,
      locationType: e.locationType as string | null,
      isOvertime: e.isOvertime as boolean,
      isTOIL: e.isTOIL as boolean,
    }
  })

  await modulesPrisma.timesheetEntry.createMany({ data: newEntries })

  // Recalculate totals
  const allEntries = await modulesPrisma.timesheetEntry.findMany({
    where: { weekId },
    select: { hours: true, isBillable: true },
  })

  const totalHours = allEntries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)
  const billableHours = allEntries
    .filter((e: { isBillable: boolean }) => e.isBillable)
    .reduce((sum: number, e: { hours: number }) => sum + e.hours, 0)

  await modulesPrisma.timesheetWeek.update({
    where: { id: weekId },
    data: { totalHours, billableHours },
  })

  return success({ copiedCount: newEntries.length })
})
