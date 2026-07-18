import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireId, optionalString, parseBody } from '@/lib/validation'
import { ValidationError, PermissionError } from '@/lib/errors'

/**
 * GET /api/supervision — List supervision records.
 *
 * Returns records where user is employee or supervisor.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const records = await prisma.supervisionRecord.findMany({
    where: {
      OR: [
        { employeeId: profile.id },
        { supervisorId: profile.id },
      ],
    },
    include: {
      employee: { select: { id: true, fullName: true, jobTitle: true } },
      supervisor: { select: { id: true, fullName: true } },
    },
    orderBy: { date: 'desc' },
  })

  return success({ records })
})

/**
 * POST /api/supervision — Create a supervision record (supervisor only).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const employeeId = requireId(body.employeeId, 'Employee ID')
  const notes = optionalString(body.notes, 'Notes', 5000)
  const objectives = optionalString(body.objectives, 'Objectives', 5000)
  const feedback = optionalString(body.feedback, 'Feedback', 5000)

  // Parse date
  const dateStr = body.date
  if (!dateStr || typeof dateStr !== 'string') {
    throw new ValidationError('Date is required')
  }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new ValidationError('Date is not a valid date')
  }

  // Verify the employee exists and belongs to the same org
  const employee = await prisma.profile.findUnique({
    where: { id: employeeId },
    select: { id: true, organisationId: true, managerId: true },
  })

  if (!employee || employee.organisationId !== profile.organisationId) {
    throw new ValidationError('Employee not found in your organisation')
  }

  // Only the employee's manager or an admin can create supervision records
  const isManager = employee.managerId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isManager && !isAdmin) {
    throw new PermissionError('Only the employee\'s manager or an admin can create supervision records')
  }

  const record = await prisma.supervisionRecord.create({
    data: {
      employeeId,
      supervisorId: profile.id,
      date,
      notes,
      objectives,
      feedback,
    },
    include: {
      employee: { select: { id: true, fullName: true } },
      supervisor: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.SUPERVISION_RECORDED,
    entityType: 'supervision_record',
    entityId: record.id,
    metadata: { employeeId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ record }, 201)
})
