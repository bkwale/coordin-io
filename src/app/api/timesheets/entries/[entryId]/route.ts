import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody, optionalString, optionalId } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { NextResponse } from 'next/server'

const LOCATION_TYPES = ['office', 'site', 'remote', 'travel'] as const

/**
 * PATCH /api/timesheets/entries/[entryId] — Update a single entry.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const entryId = request.url.match(/\/entries\/([^/?]+)/)?.[1]
  if (!entryId) throw new NotFoundError('Entry not found')

  const entry = await modulesPrisma.timesheetEntry.findUnique({
    where: { id: entryId },
    include: {
      week: { select: { id: true, profileId: true, organisationId: true, status: true } },
    },
  })

  if (!entry) {
    throw new NotFoundError('Entry not found')
  }

  if (entry.week.organisationId !== profile.organisationId) {
    throw new NotFoundError('Entry not found')
  }

  if (entry.week.profileId !== profile.id) {
    throw new PermissionError('You can only edit your own timesheet entries')
  }

  const editableStatuses = ['DRAFT', 'CHANGES_REQUIRED', 'REOPENED']
  if (!editableStatuses.includes(entry.week.status)) {
    throw new ValidationError(`Cannot edit entries on a timesheet with status: ${entry.week.status}`)
  }

  const body = await parseBody(request)
  const updateData: Record<string, unknown> = {}

  // Only update fields that are present in the body
  if (body.hours !== undefined) {
    if (typeof body.hours !== 'number' || isNaN(body.hours) || body.hours <= 0 || body.hours > 24) {
      throw new ValidationError('Hours must be a number between 0 and 24')
    }
    updateData.hours = body.hours
  }

  if (body.date !== undefined) {
    const newDate = new Date(String(body.date) + 'T00:00:00.000Z')
    if (isNaN(newDate.getTime())) {
      throw new ValidationError('Date is not valid')
    }
    updateData.date = newDate
  }

  if (body.projectId !== undefined) {
    updateData.projectId = optionalId(body.projectId, 'Project ID')
  }

  if (body.taskId !== undefined) {
    updateData.taskId = optionalId(body.taskId, 'Task ID')
  }

  if (body.workStage !== undefined) {
    updateData.workStage = optionalString(body.workStage, 'Work stage', 100)
  }

  if (body.activity !== undefined) {
    updateData.activity = optionalString(body.activity, 'Activity', 500)
  }

  if (body.description !== undefined) {
    updateData.description = optionalString(body.description, 'Description', 2000)
  }

  if (body.overheadCode !== undefined) {
    updateData.overheadCode = optionalString(body.overheadCode, 'Overhead code', 100)
  }

  if (body.locationType !== undefined) {
    if (body.locationType && !LOCATION_TYPES.includes(body.locationType as typeof LOCATION_TYPES[number])) {
      throw new ValidationError(`Location type must be one of: ${LOCATION_TYPES.join(', ')}`)
    }
    updateData.locationType = body.locationType || null
  }

  if (body.isBillable !== undefined) {
    updateData.isBillable = Boolean(body.isBillable)
  }

  if (body.isOvertime !== undefined) {
    updateData.isOvertime = Boolean(body.isOvertime)
  }

  if (body.isTOIL !== undefined) {
    updateData.isTOIL = Boolean(body.isTOIL)
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No fields to update')
  }

  const updated = await modulesPrisma.timesheetEntry.update({
    where: { id: entryId },
    data: updateData,
  })

  // Recalculate week totals
  const weekId = entry.week.id
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

  return success({ entry: updated })
})

/**
 * DELETE /api/timesheets/entries/[entryId] — Delete a single entry.
 *
 * Only allowed if the week is in DRAFT status.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const entryId = request.url.match(/\/entries\/([^/?]+)/)?.[1]
  if (!entryId) throw new NotFoundError('Entry not found')

  const entry = await modulesPrisma.timesheetEntry.findUnique({
    where: { id: entryId },
    include: {
      week: { select: { id: true, profileId: true, organisationId: true, status: true } },
    },
  })

  if (!entry) {
    throw new NotFoundError('Entry not found')
  }

  if (entry.week.organisationId !== profile.organisationId) {
    throw new NotFoundError('Entry not found')
  }

  if (entry.week.profileId !== profile.id) {
    throw new PermissionError('You can only delete your own timesheet entries')
  }

  // Only allow deletion in editable states
  const editableStatuses = ['DRAFT', 'CHANGES_REQUIRED', 'REOPENED']
  if (!editableStatuses.includes(entry.week.status)) {
    throw new ValidationError(`Cannot delete entries from a timesheet with status: ${entry.week.status}`)
  }

  await modulesPrisma.timesheetEntry.delete({ where: { id: entryId } })

  // Recalculate week totals
  const weekId = entry.week.id
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

  return new NextResponse(null, { status: 204 })
})
