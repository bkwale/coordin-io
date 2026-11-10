/**
 * GDPR tools for people records (UK GDPR / EU GDPR arts. 15, 17, 20).
 *
 *  exportPersonData  — everything Coordin holds about one person, as JSON (subject access / portability).
 *  anonymiseProfile  — replaces a former employee's personal data with placeholders. Business records they
 *                      touched (projects, tasks, approvals, expense amounts, audit trail) stay, pointing at an
 *                      anonymous name, so the firm's own records still add up. Irreversible.
 *
 * Retention: a deactivated person becomes due for anonymisation after GDPR_RETENTION_DAYS (default 2190 days =
 * 6 years — the UK HMRC/limitation period for payroll and employment records). An erasure request lets the
 * OWNER anonymise earlier.
 */
import { prisma } from './prisma'
import { NotFoundError, PermissionError, ValidationError } from './errors'

export function retentionDays(): number {
  const n = parseInt(process.env.GDPR_RETENTION_DAYS ?? '', 10)
  return Number.isFinite(n) && n >= 30 ? n : 2190
}

export async function exportPersonData(profileId: string, organisationId: string) {
  const person = await prisma.profile.findFirst({
    where: { id: profileId, organisationId },
    select: {
      id: true, fullName: true, email: true, jobTitle: true, phone: true, department: true, startDate: true, status: true,
      deactivatedAt: true, orgPermission: true, createdAt: true, updatedAt: true, notificationPreferences: true,
      office: { select: { name: true } }, manager: { select: { fullName: true } },
      employeeProfile: true, confidentialData: true,
    },
  })
  if (!person) throw new NotFoundError('Person not found')
  const where = { profileId }
  const [leaveRequests, leaveBalances, expenseClaims, timesheetWeeks, trainingCompletions, cpdRecords, hrDocuments, probationReviews, assetAssignments, policyAcknowledgements, projectMemberships, notifications, supportTickets, auditByThem, auditAboutThem] = await Promise.all([
    prisma.leaveRequest.findMany({ where }),
    prisma.leaveBalance.findMany({ where }),
    prisma.expenseClaim.findMany({ where }),
    prisma.timesheetWeek.findMany({ where }),
    prisma.trainingCompletion.findMany({ where }),
    prisma.cPDRecord.findMany({ where }),
    prisma.hRDocument.findMany({ where }),
    prisma.probationReview.findMany({ where }),
    prisma.assetAssignment.findMany({ where }),
    prisma.policyAcknowledgement.findMany({ where }),
    prisma.projectMembership.findMany({ where, include: { project: { select: { name: true } } } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.supportTicket.findMany({ where: { submitterId: profileId } }),
    prisma.auditEvent.findMany({ where: { actorId: profileId, organisationId }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    prisma.auditEvent.findMany({ where: { entityId: profileId, organisationId }, orderBy: { createdAt: 'desc' }, take: 2000 }),
  ])
  return {
    exportedAt: new Date().toISOString(),
    format: 'coordin-person-export/v1',
    note: 'All personal data Coordin holds about this person in this organisation. Files (HR documents, receipts) are listed by link; open each link while signed in to download it.',
    person,
    leaveRequests, leaveBalances, expenseClaims, timesheetWeeks, trainingCompletions, cpdRecords, hrDocuments,
    probationReviews, assetAssignments, policyAcknowledgements, projectMemberships, notifications, supportTickets,
    activity: { actionsByThem: auditByThem, actionsAboutThem: auditAboutThem },
  }
}

export type AnonymiseReason = 'retention' | 'erasure_request'

/** Profiles deactivated longer ago than the retention period and not yet anonymised. */
export async function profilesDueForAnonymisation(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays() * 86_400_000)
  return prisma.profile.findMany({
    where: { status: 'DEACTIVATED', deactivatedAt: { lt: cutoff }, orgPermission: { not: 'OWNER' }, NOT: { email: { endsWith: '@anonymised.invalid' } } },
    select: { id: true, organisationId: true, deactivatedAt: true },
  })
}

export async function anonymiseProfile(input: { profileId: string; organisationId: string; actorId: string | null; reason: AnonymiseReason; now?: Date }) {
  const now = input.now ?? new Date()
  const p = await prisma.profile.findFirst({ where: { id: input.profileId, organisationId: input.organisationId }, select: { id: true, status: true, deactivatedAt: true, email: true, orgPermission: true, authUserId: true } })
  if (!p) throw new NotFoundError('Person not found')
  if (p.email.endsWith('@anonymised.invalid')) throw new ValidationError('This person has already been anonymised')
  if (p.status !== 'DEACTIVATED') throw new ValidationError('Deactivate this person before anonymising their record')
  if (p.orgPermission === 'OWNER') throw new PermissionError('An owner account cannot be anonymised — transfer ownership first')
  if (input.reason === 'retention') {
    const due = p.deactivatedAt && now.getTime() - p.deactivatedAt.getTime() >= retentionDays() * 86_400_000
    if (!due) throw new ValidationError(`The retention period (${retentionDays()} days after deactivation) has not passed. Use an erasure request if the person asked for this.`)
  }
  const tag = p.id.slice(-6)
  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: p.id },
      data: { fullName: `Former employee ${tag}`, email: `removed+${p.id}@anonymised.invalid`, phone: null, avatarUrl: null, authUserId: null, notificationPreferences: {} },
    })
    await tx.employeeProfile.updateMany({
      where: { profileId: p.id },
      data: { emergencyName: null, emergencyPhone: null, emergencyRelation: null, salary: null, salaryFrequency: null, salaryCurrency: null, benefits: null, hmoProvider: null, hmoPlan: null, dependants: null, pensionProvider: null, pensionContribution: null, noticePeriod: null },
    })
    await tx.confidentialEmployeeData.updateMany({
      where: { profileId: p.id },
      data: { salary: null, salaryFrequency: null, salaryCurrency: null, benefits: null, hmoProvider: null, hmoPlan: null, dependants: null, pensionProvider: null, pensionContribution: null, noticePeriod: null, bankAccountName: null, bankAccountNumber: null, bankName: null, bankCode: null, bankSortCode: null, bankVerified: false, bankRejectionReason: null },
    })
    // Free-text that can carry health or personal detail (sick-leave reasons, notification text)
    await tx.leaveRequest.updateMany({ where: { profileId: p.id }, data: { reason: null } })
    await tx.notification.updateMany({ where: { profileId: p.id }, data: { body: null } })
    await tx.auditEvent.create({
      data: { organisationId: input.organisationId, actorId: input.actorId, action: 'gdpr.profile_anonymised', entityType: 'profile', entityId: p.id, metadata: { reason: input.reason, retentionDays: retentionDays() } },
    })
  })
  // The sign-in account holds the email address too: remove it so they can never sign in again
  let loginRemoved = !p.authUserId
  if (p.authUserId && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { error } = await admin.auth.admin.deleteUser(p.authUserId)
      loginRemoved = !error
    } catch { loginRemoved = false }
  }
  // Stored files (HR documents, receipts) are listed in the export and kept for the firm's records;
  // they are removed with the person's record only on a separate, explicit request.
  return { anonymised: true, profileId: p.id, loginRemoved }
}
