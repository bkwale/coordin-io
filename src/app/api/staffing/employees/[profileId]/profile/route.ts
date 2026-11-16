import { isValidProbationStatus, PROBATION_STATUS_OPTIONS } from '@/lib/staffing/probation'
import { retentionDays } from '@/lib/gdpr'
import { bankFormatFor, validateBank, normaliseSortCode } from '@/lib/bank-format'
import { prisma } from '@/lib/prisma'
import { resolveNigerianAccount } from '@/lib/paystack'
import { assertOrgOffice, assertOrgProfile } from '@/lib/tenant'
import { firmDefaults } from '@/lib/region-server'
import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, optionalNumber, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { hasFullStaffingAccess } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'
import { invalidateCache, cacheKey } from '@/lib/cache'

/** The firm's country for bank-format defaults; never fails the request. */
async function firmCountryOf(organisationId: string) {
  try { return (await firmDefaults(organisationId)).country } catch { return null }
}

/**
 * GET /api/staffing/employees/[profileId]/profile
 *
 * Returns the full employee profile including all EmployeeProfile fields
 * plus connected data: leave balances, current project assignments,
 * training completions, asset assignments, HR documents count.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)\/profile/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const employee = await modulesPrisma.profile.findUnique({
    where: { id: profileId },
    include: {
      office: { select: { id: true, name: true, city: true, country: true } },
      corporateRole: { select: { id: true, name: true, level: true } },
      manager: { select: { id: true, fullName: true, jobTitle: true } },
      employeeProfile: true,
      projectMemberships: {
        where: { removedAt: null },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              stage: true,
            },
          },
        },
      },
      leaveBalances: {
        take: 3,
        orderBy: { year: 'desc' as const },
      },
      trainingCompletions: {
        include: {
          training: { select: { id: true, title: true } },
        },
        orderBy: { completedAt: 'desc' as const },
      },
      assetAssignments: {
        where: { returnedAt: null },
        include: {
          asset: { select: { id: true, name: true, assetTag: true, category: true } },
        },
      },
    },
  })

  if (!employee) {
    throw new NotFoundError('Employee not found')
  }

  // Must be in same org
  if (employee.organisationId !== profile.organisationId) {
    throw new PermissionError('You do not have access to this employee')
  }

  // hasFullStaffingAccess replaces inline isAdmin — gives HR, ADMIN, OWNER access
  const hasHRAccess = hasFullStaffingAccess(profile.orgPermission as OrgPermission)
  const isSelf = profileId === profile.id
  const showConfidential = hasHRAccess || isSelf
  const firmCountry = showConfidential ? await firmCountryOf(profile.organisationId) : null

  // Fetch confidential data separately — only when authorized
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let confidential: any = null

  if (showConfidential) {
    try {
      confidential = await modulesPrisma.confidentialEmployeeData.findUnique({
        where: { profileId },
      })
    } catch (err: unknown) {
      // Swallow only "relation does not exist" (table not migrated yet)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('does not exist') && !msg.includes('P2021')) throw err
    }
  }

  // HR documents count by type
  let hrDocumentCounts: Record<string, number> = {}
  try {
    const docs = await modulesPrisma.hRDocument.findMany({
      where: {
        profileId,
        ...(hasHRAccess || isSelf ? {} : { isConfidential: false }),
      },
      select: { documentType: true },
    })
    for (const doc of docs) {
      const dtype = doc.documentType as string
      hrDocumentCounts[dtype] = (hrDocumentCounts[dtype] || 0) + 1
    }
  } catch {
    // Table may not exist yet
  }

  // Resource allocations for current assignments
  let currentAllocations: { projectId: string; hoursAllocated: number; role: string | null }[] = []
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)

    currentAllocations = await modulesPrisma.resourceAllocation.findMany({
      where: {
        profileId,
        weekStarting: { gte: weekStart },
      },
      select: {
        projectId: true,
        hoursAllocated: true,
        role: true,
      },
      take: 20,
    })
  } catch {
    // Table may not exist yet
  }

  // Aggregate allocation hours per project
  const allocationByProject: Record<string, { hours: number; role: string | null }> = {}
  for (const a of currentAllocations) {
    if (!allocationByProject[a.projectId]) {
      allocationByProject[a.projectId] = { hours: 0, role: a.role }
    }
    allocationByProject[a.projectId].hours += a.hoursAllocated
  }

  // Compute total allocated hours this week
  const totalAllocatedHours = currentAllocations.reduce((sum, a) => sum + a.hoursAllocated, 0)
  const standardWeeklyHours = employee.employeeProfile?.workingHours ?? 40
  const availableCapacity = Math.max(0, standardWeeklyHours - totalAllocatedHours)

  // Calculate leave stats from current year balance
  const currentYear = new Date().getFullYear()
  const currentLeave = employee.leaveBalances?.find(
    (lb: { year: number }) => lb.year === currentYear
  )

  // Count sickness records
  let sicknessCount = 0
  try {
    sicknessCount = await modulesPrisma.leaveRequest.count({
      where: {
        profileId,
        leaveType: 'SICK',
        status: { in: ['APPROVED', 'SUBMITTED'] },
      },
    })
  } catch {
    // Table may not exist yet
  }

  // Training stats
  const trainingCompletions = employee.trainingCompletions ?? []
  const mandatoryComplete = trainingCompletions.filter(
    (t: { training: { mandatory?: boolean } }) =>
      t.training?.mandatory === true
  ).length

  // CPD hours total
  let totalCpdHours = 0
  try {
    const cpdRecords = await modulesPrisma.cPDRecord.findMany({
      where: { profileId },
      select: { durationHours: true },
    })
    totalCpdHours = cpdRecords.reduce((sum: number, r: { durationHours: number }) => sum + (r.durationHours ?? 0), 0)
  } catch {
    // Table may not exist yet
  }

  // Build the employee profile fields - only show confidential (salary, etc.) to HR+/self
  const ep = employee.employeeProfile

  // Audit event: log salary data access (PT recommendation)
  if (showConfidential && !isSelf && (confidential?.salary ?? ep?.salary)) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'staffing.salary_data_accessed',
      entityType: 'profile',
      entityId: profileId,
      metadata: { accessedBy: profile.orgPermission },
    })
  }

  return success({
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      avatarUrl: employee.avatarUrl,
      orgPermission: employee.orgPermission,
      status: employee.status,
      startDate: employee.startDate,
      office: employee.office,
      role: employee.corporateRole
        ? {
            id: employee.corporateRole.id,
            title: employee.corporateRole.name,
            department: ep?.department ?? null,
            level: employee.corporateRole.level,
          }
        : null,
      manager: employee.manager,
      department: ep?.department ?? null,
      availabilityStatus: ep?.availabilityStatus ?? null,
      emergencyContact: showConfidential
        ? {
            name: ep?.emergencyName ?? null,
            phone: ep?.emergencyPhone ?? null,
            relation: ep?.emergencyRelation ?? null,
          }
        : null,
    },
    employment: showConfidential
      ? {
          contractType: ep?.contractType ?? null,
          employmentType: ep?.employmentType ?? null,
          probationLength: ep?.probationLength ?? null,
          probationStatus: ep?.probationStatus ?? null,
          probationStartDate: ep?.probationStartDate ?? null,
          probationEndDate: ep?.probationEndDate ?? null,
          // Prefer confidential table, fall back to legacy EmployeeProfile fields
          salary: confidential?.salary ?? ep?.salary ?? null,
          salaryFrequency: confidential?.salaryFrequency ?? ep?.salaryFrequency ?? null,
          salaryCurrency: confidential?.salaryCurrency ?? ep?.salaryCurrency ?? null,
          benefits: confidential?.benefits ?? ep?.benefits ?? null,
          hmoProvider: confidential?.hmoProvider ?? ep?.hmoProvider ?? null,
          hmoPlan: confidential?.hmoPlan ?? ep?.hmoPlan ?? null,
          dependants: confidential?.dependants ?? ep?.dependants ?? null,
          pensionProvider: confidential?.pensionProvider ?? ep?.pensionProvider ?? null,
          pensionContribution: confidential?.pensionContribution ?? ep?.pensionContribution ?? null,
          workingPattern: ep?.workingPattern ?? null,
          workingHours: ep?.workingHours ?? null,
          noticePeriod: confidential?.noticePeriod ?? ep?.noticePeriod ?? null,
        }
      : null,
    leave: {
      annualEntitlement: currentLeave?.allocation ?? ep?.annualLeaveAllocation ?? 25,
      used: currentLeave?.used ?? 0,
      carriedForward: currentLeave?.carriedForward ?? 0,
      remaining: (currentLeave?.allocation ?? ep?.annualLeaveAllocation ?? 25) - (currentLeave?.used ?? 0),
      sicknessCount,
    },
    projects: employee.projectMemberships.map((pm: {
      id: string
      projectRole: string | null
      project: { id: string; name: string; code: string | null; status: string; stage: string }
    }) => ({
      membershipId: pm.id,
      role: pm.projectRole,
      project: pm.project,
      weeklyHours: allocationByProject[pm.project.id]?.hours ?? null,
    })),
    capacity: {
      totalAllocatedHours,
      standardWeeklyHours,
      availableCapacity,
    },
    training: {
      mandatoryComplete,
      totalCompletions: trainingCompletions.length,
      cpdHours: totalCpdHours,
      completions: trainingCompletions.slice(0, 10),
    },
    assets: employee.assetAssignments,
    hrDocumentCounts,
    // Bank details — visible to self (own bank info), manager (view+approve), HR (edit)
    bankDetails: showConfidential
      ? {
          accountName: confidential?.bankAccountName ?? null,
          accountNumber: confidential?.bankAccountNumber ?? null,
          bankName: confidential?.bankName ?? null,
          bankCode: confidential?.bankCode ?? null,
          sortCode: confidential?.bankSortCode ?? null,
          format: bankFormatFor(employee.office?.country, firmCountry),
          verified: confidential?.bankVerified ?? false,
          verifiedAt: confidential?.bankVerifiedAt ?? null,
          approvalStatus: confidential?.bankApprovalStatus ?? null,
          approvedBy: confidential?.bankApprovedBy ?? null,
          approvedAt: confidential?.bankApprovedAt ?? null,
          rejectionReason: confidential?.bankRejectionReason ?? null,
        }
      : null,
    isAdmin: hasHRAccess,
    hasHRAccess,
    isSelf,
    privacy: (() => {
      const senior = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
      const anonymised = String(employee.email ?? '').endsWith('@anonymised.invalid')
      const days = retentionDays()
      const at = employee.deactivatedAt ? new Date(employee.deactivatedAt) : null
      return {
        canExport: isSelf || hasHRAccess,
        canAnonymise: senior && !isSelf && employee.status === 'DEACTIVATED' && employee.orgPermission !== 'OWNER',
        canErase: profile.orgPermission === 'OWNER',
        anonymised,
        retentionDays: days,
        retentionEndsAt: employee.status === 'DEACTIVATED' && at ? new Date(at.getTime() + days * 86_400_000).toISOString() : null,
      }
    })(),
  })
})

/**
 * PATCH /api/staffing/employees/[profileId]/profile
 *
 * Update employee profile fields.
 * - Employees: own phone, emergency contact, availability
 * - HR/Admin: everything including salary, benefits, contract details
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)\/profile/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const hasHRAccess = hasFullStaffingAccess(profile.orgPermission as OrgPermission)
  const isSelf = profileId === profile.id

  if (!hasHRAccess && !isSelf) {
    throw new PermissionError('You can only update your own profile')
  }

  // Verify the target exists and is in the same org
  const target = await modulesPrisma.profile.findUnique({
    where: { id: profileId },
    select: { organisationId: true },
  })
  if (!target) throw new NotFoundError('Employee not found')
  if (target.organisationId !== profile.organisationId) {
    throw new PermissionError('You do not have access to this employee')
  }

  const body = await parseBody(request)

  // Fields any user can update on their own profile
  const profileData: Record<string, unknown> = {}
  const empData: Record<string, unknown> = {}

  // Self-editable fields
  if (isSelf || hasHRAccess) {
    const phone = optionalString(body.phone as unknown, 'phone', 50)
    if (phone !== null) profileData.phone = phone

    const emergencyName = optionalString(body.emergencyName as unknown, 'emergencyName', 200)
    if (emergencyName !== null) empData.emergencyName = emergencyName

    const emergencyPhone = optionalString(body.emergencyPhone as unknown, 'emergencyPhone', 50)
    if (emergencyPhone !== null) empData.emergencyPhone = emergencyPhone

    const emergencyRelation = optionalString(body.emergencyRelation as unknown, 'emergencyRelation', 100)
    if (emergencyRelation !== null) empData.emergencyRelation = emergencyRelation

    const availabilityStatus = optionalString(body.availabilityStatus as unknown, 'availabilityStatus', 50)
    if (availabilityStatus !== null) empData.availabilityStatus = availabilityStatus
  }

  // HR+-only fields — HR can't set their own pay, allowance, status, grade, probation or manager (another admin does)
  const SELF_LOCKED = [
    'salary', 'salaryCurrency', 'salaryFrequency', 'benefits', 'pensionProvider', 'pensionContribution', 'hmoProvider', 'hmoPlan', 'dependants', 'noticePeriod',
    'annualLeaveAllocation', 'status', 'managerId', 'grade', 'employmentType', 'contractType', 'workingHours', 'workingPattern',
    'probationStatus', 'probationLength', 'probationStartDate', 'probationEndDate', 'officeId', 'roleId',
  ]
  if (hasHRAccess && isSelf && profile.orgPermission !== 'OWNER') {
    // The edit form sends every field on each save, so only a value that actually CHANGES is blocked
    const [cur, emp, conf] = await Promise.all([
      prisma.profile.findUnique({ where: { id: profileId }, select: { managerId: true, roleId: true, officeId: true, status: true } }),
      modulesPrisma.employeeProfile.findUnique({ where: { profileId } }).catch(() => null),
      modulesPrisma.confidentialEmployeeData.findUnique({ where: { profileId } }).catch(() => null),
    ])
    const stored: Record<string, unknown> = { ...(emp ?? {}), ...(conf ?? {}), ...(cur ?? {}) }
    const norm = (v: unknown): string => {
      if (v === undefined || v === null || v === '') return ''
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
      if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) return String(Number(v))
      return String(v).trim()
    }
    const changed = SELF_LOCKED.filter((k) => body[k] !== undefined && norm(body[k]) !== norm(stored[k]))
    if (changed.length) throw new PermissionError('Ask another admin to change your own pay, benefits, allowance, status, probation or manager')
  }
  if (hasHRAccess) {
    for (const k of ['officeId', 'managerId', 'lineManagerId']) {
      const v = body[k]
      if (typeof v === 'string' && v) {
        if (k === 'officeId') await assertOrgOffice(v, profile.organisationId)
        else await assertOrgProfile(v, profile.organisationId, 'Manager')
      }
    }
    // Profile fields
    const jobTitle = optionalString(body.jobTitle as unknown, 'jobTitle', 200)
    if (jobTitle !== null) profileData.jobTitle = jobTitle

    const officeId = optionalString(body.officeId as unknown, 'officeId', 50)
    if (officeId !== null) profileData.officeId = officeId

    const managerId = optionalString(body.managerId as unknown, 'managerId', 50)
    if (managerId !== null) profileData.managerId = managerId || null

    const roleId = optionalString(body.roleId as unknown, 'roleId', 50)
    if (roleId !== null) profileData.roleId = roleId || null

    // EmployeeProfile fields
    const grade = optionalString(body.grade as unknown, 'grade', 100)
    if (grade !== null) empData.grade = grade

    const department = optionalString(body.department as unknown, 'department', 200)
    if (department !== null) empData.department = department

    const employmentType = optionalString(body.employmentType as unknown, 'employmentType', 50)
    if (employmentType !== null) empData.employmentType = employmentType

    const contractType = optionalString(body.contractType as unknown, 'contractType', 50)
    if (contractType !== null) empData.contractType = contractType

    const salary = optionalNumber(body.salary as unknown, 'salary', { min: 0 })
    if (salary !== null) empData.salary = salary

    const salaryFrequency = optionalString(body.salaryFrequency as unknown, 'salaryFrequency', 50)
    if (salaryFrequency !== null) empData.salaryFrequency = salaryFrequency

    const salaryCurrency = optionalString(body.salaryCurrency as unknown, 'salaryCurrency', 10)
    if (salaryCurrency !== null) empData.salaryCurrency = salaryCurrency

    const benefits = optionalString(body.benefits as unknown, 'benefits', 2000)
    if (benefits !== null) empData.benefits = benefits

    const hmoProvider = optionalString(body.hmoProvider as unknown, 'hmoProvider', 200)
    if (hmoProvider !== null) empData.hmoProvider = hmoProvider

    const hmoPlan = optionalString(body.hmoPlan as unknown, 'hmoPlan', 200)
    if (hmoPlan !== null) empData.hmoPlan = hmoPlan

    const dependants = optionalNumber(body.dependants as unknown, 'dependants', { min: 0, max: 50 })
    if (dependants !== null) empData.dependants = dependants

    const pensionProvider = optionalString(body.pensionProvider as unknown, 'pensionProvider', 200)
    if (pensionProvider !== null) empData.pensionProvider = pensionProvider

    const pensionContribution = optionalNumber(body.pensionContribution as unknown, 'pensionContribution', { min: 0, max: 100 })
    if (pensionContribution !== null) empData.pensionContribution = pensionContribution

    const workingPattern = optionalString(body.workingPattern as unknown, 'workingPattern', 200)
    if (workingPattern !== null) empData.workingPattern = workingPattern

    const workingHours = optionalNumber(body.workingHours as unknown, 'workingHours', { min: 0, max: 168 })
    if (workingHours !== null) empData.workingHours = workingHours

    const noticePeriod = optionalString(body.noticePeriod as unknown, 'noticePeriod', 100)
    if (noticePeriod !== null) empData.noticePeriod = noticePeriod

    const probationLength = optionalNumber(body.probationLength as unknown, 'probationLength', { min: 0, max: 60 })
    if (probationLength !== null) empData.probationLength = probationLength

    const probationStatus = optionalString(body.probationStatus as unknown, 'probationStatus', 50)
    if (probationStatus !== null) {
      if (!isValidProbationStatus(probationStatus)) throw new ValidationError(`probationStatus must be one of: ${PROBATION_STATUS_OPTIONS.map((o) => o.value).join(', ')}`)
      empData.probationStatus = probationStatus
    }

    const probationStartDate = optionalDate(body.probationStartDate as unknown, 'probationStartDate')
    if (probationStartDate !== null) empData.probationStartDate = probationStartDate

    const probationEndDate = optionalDate(body.probationEndDate as unknown, 'probationEndDate')
    if (probationEndDate !== null) empData.probationEndDate = probationEndDate
    {
      const ps = (empData.probationStartDate as Date | undefined) ?? null
      const pe = (empData.probationEndDate as Date | undefined) ?? null
      if (ps && pe && pe < ps) throw new ValidationError('Probation end date cannot be before the start date')
    }

    const annualLeaveAllocation = optionalNumber(body.annualLeaveAllocation as unknown, 'annualLeaveAllocation', { min: 0, max: 365 })
    if (annualLeaveAllocation !== null) empData.annualLeaveAllocation = annualLeaveAllocation
  }

  // ── Bank details ──
  // Self: submit own bank details → status PENDING
  // HR: edit bank details directly → status APPROVED
  const bankConfidentialData: Record<string, unknown> = {}
  if (isSelf || hasHRAccess) {
    const bankAccountNumber = optionalString(body.bankAccountNumber as unknown, 'bankAccountNumber', 40)
    const bankCode = optionalString(body.bankCode as unknown, 'bankCode', 11)
    const bankAccountName = optionalString(body.bankAccountName as unknown, 'bankAccountName', 200)
    const bankName = optionalString(body.bankName as unknown, 'bankName', 200)
    const bankSortCode = optionalString(body.bankSortCode as unknown, 'bankSortCode', 10)
    // "Verified" is never taken from the browser: it is set only by the Paystack check below
    const wantsVerify = body.bankVerified === true
    let bankVerified: boolean | null = null
    const storedBank = await modulesPrisma.confidentialEmployeeData.findUnique({ where: { profileId }, select: { bankAccountName: true, bankVerified: true } }).catch(() => null)

    // Format follows the person's office country (else the firm's): IBAN in Estonia, sort code in the UK, NUBAN in Nigeria
    if (bankAccountNumber !== null) {
      const office = await prisma.profile.findUnique({ where: { id: profileId }, select: { office: { select: { country: true } } } }).catch(() => null)
      const format = bankFormatFor(office?.office?.country, await firmCountryOf(profile.organisationId))
      // UK: an account-number change can reuse the sort code already on file
      const storedSort = format === 'uk_sort_code' && !bankSortCode
        ? (await modulesPrisma.confidentialEmployeeData.findUnique({ where: { profileId }, select: { bankSortCode: true } }).catch(() => null))?.bankSortCode ?? null
        : null
      const checked = validateBank(format, { accountNumber: bankAccountNumber, sortCode: bankSortCode ?? storedSort, bankCode })
      if (!checked.ok) throw new ValidationError(checked.error)
      bankConfidentialData.bankAccountNumber = checked.accountNumber
      if (checked.sortCode) bankConfidentialData.bankSortCode = checked.sortCode
      if (format !== 'nuban') { bankConfidentialData.bankCode = checked.bankCode; bankVerified = false } // only Nigerian accounts can be checked automatically
      else if (wantsVerify) {
        // Never trust the browser's "verified": check again with Paystack here and use the name it returns
        const r = await resolveNigerianAccount(checked.accountNumber, String(bankCode ?? ''))
        bankVerified = r.verified
        if (r.verified) { bankConfidentialData.bankAccountName = r.accountName; bankConfidentialData.bankName = r.bankName }
        else throw new ValidationError(r.error)
      }
    }
    if (bankAccountNumber !== null && bankVerified === null) bankVerified = false // a new number that wasn't checked
    if (bankAccountNumber === null && bankAccountName !== null && storedBank?.bankVerified && bankAccountName.trim() !== (storedBank.bankAccountName ?? '').trim()) {
      bankVerified = false // a hand-typed name replaces a verified one — needs checking again
    }
    if (bankCode !== null && bankConfidentialData.bankCode === undefined) bankConfidentialData.bankCode = bankCode
    if (bankAccountName !== null && bankConfidentialData.bankAccountName === undefined) bankConfidentialData.bankAccountName = bankAccountName
    if (bankName !== null && bankConfidentialData.bankName === undefined) bankConfidentialData.bankName = bankName
    if (bankSortCode !== null && bankConfidentialData.bankSortCode === undefined && bankAccountNumber === null) {
      const sc = normaliseSortCode(bankSortCode)
      if (!sc) throw new ValidationError('Sort code must be 6 digits, e.g. 20-00-00')
      bankConfidentialData.bankSortCode = sc
    }
    if (bankVerified !== null) {
      bankConfidentialData.bankVerified = bankVerified
      if (bankVerified) bankConfidentialData.bankVerifiedAt = new Date()
    }

    // Set approval status based on who is submitting
    if (Object.keys(bankConfidentialData).length > 0) {
      if (hasHRAccess && !isSelf) {
        // HR editing directly → auto-approve
        bankConfidentialData.bankApprovalStatus = 'APPROVED'
        bankConfidentialData.bankApprovedBy = profile.id
        bankConfidentialData.bankApprovedAt = new Date()
        bankConfidentialData.bankRejectionReason = null
      } else {
        // Self submitting → pending approval
        bankConfidentialData.bankApprovalStatus = 'PENDING'
        bankConfidentialData.bankApprovedBy = null
        bankConfidentialData.bankApprovedAt = null
        bankConfidentialData.bankRejectionReason = null
      }
    }
  }

  // Write bank details to confidential table
  if (Object.keys(bankConfidentialData).length > 0) {
    try {
      await modulesPrisma.confidentialEmployeeData.upsert({
        where: { profileId },
        create: { profileId, ...bankConfidentialData },
        update: bankConfidentialData,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('does not exist') && !msg.includes('P2021')) throw err
    }
  }

  // Update Profile table fields
  if (Object.keys(profileData).length > 0) {
    await modulesPrisma.profile.update({
      where: { id: profileId },
      data: profileData,
    })
  }

  // Update EmployeeProfile fields via upsert. Salary, benefits, HMO, pension and notice period live only in
  // ConfidentialEmployeeData (written below) — never in the old employee_profiles columns again.
  const LEGACY_CONFIDENTIAL = new Set(['salary', 'salaryFrequency', 'salaryCurrency', 'benefits', 'hmoProvider', 'hmoPlan', 'dependants', 'pensionProvider', 'pensionContribution', 'noticePeriod'])
  const empWrite = Object.fromEntries(Object.entries(empData).filter(([k]) => !LEGACY_CONFIDENTIAL.has(k)))
  if (Object.keys(empWrite).length > 0) {
    await modulesPrisma.employeeProfile.upsert({
      where: { profileId },
      create: { profileId, ...empWrite },
      update: empWrite,
    })
  }

  // Leave balances read this year's LeaveBalance row first, so a changed allowance must land there too —
  // otherwise HR's edit is saved but every balance screen keeps showing the old figure (Ayo, 7 Nov)
  if (typeof empData.annualLeaveAllocation === 'number') {
    await modulesPrisma.leaveBalance.updateMany({
      where: { profileId, year: new Date().getFullYear() },
      data: { allocation: empData.annualLeaveAllocation },
    })
  }
  if (Object.keys(empData).length > 0 || Object.keys(profileData).length > 0) {
    await invalidateCache(cacheKey.staffingAll(profile.organisationId))
  }

  // ── Auto-generate probation reviews when probation fields are set ──
  if (hasHRAccess && empData.probationStartDate) {
    const startDate = empData.probationStartDate as Date
    const lengthMonths = (empData.probationLength as number) ?? 3 // default 3 months

    // Define review milestones based on probation length (same schedule as onboarding assignment)
    const milestones: { type: string; daysOffset: number }[] = [{ type: 'Initial objectives', daysOffset: 7 }]
    if (lengthMonths >= 1) milestones.push({ type: '30-day', daysOffset: 30 })
    if (lengthMonths >= 2) milestones.push({ type: '60-day', daysOffset: 60 })
    if (lengthMonths >= 3) milestones.push({ type: '90-day', daysOffset: 90 })
    // Final review at probation end — replaces a milestone on the same day rather than duplicating it
    const finalOffset = lengthMonths * 30
    const same = milestones.findIndex((m) => m.daysOffset === finalOffset)
    if (same >= 0) milestones[same] = { type: 'final', daysOffset: finalOffset }
    else milestones.push({ type: 'final', daysOffset: finalOffset })

    // Re-saving probation dates only regenerates reviews nobody has started. Drafts, submitted,
    // returned and finalised reviews (and anything completed) are kept untouched.
    try {
      await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
        await tx.probationReview.deleteMany({
          where: { profileId, completedDate: null, workflowStatus: 'SCHEDULED' },
        })
        const kept = await tx.probationReview.findMany({ where: { profileId }, select: { reviewType: true } })
        const keptTypes = new Set(kept.map((k: { reviewType: string }) => k.reviewType))

        for (const milestone of milestones) {
          if (keptTypes.has(milestone.type)) continue // an in-progress or completed review already covers it
          const scheduledDate = new Date(startDate)
          scheduledDate.setDate(scheduledDate.getDate() + milestone.daysOffset)
          await tx.probationReview.create({
            data: { profileId, reviewType: milestone.type, scheduledDate },
          })
        }
      })
    } catch (err: unknown) {
      // Swallow only "table does not exist" errors
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('does not exist') && !msg.includes('P2021')) throw err
    }
  }

  // Confidential fields go to ConfidentialEmployeeData only
  const confidentialFieldKeys = [
    'salary', 'salaryFrequency', 'salaryCurrency', 'benefits',
    'hmoProvider', 'hmoPlan', 'dependants',
    'pensionProvider', 'pensionContribution', 'noticePeriod',
  ] as const
  const confidentialFields: Record<string, unknown> = {}
  for (const key of confidentialFieldKeys) {
    if (key in empData) {
      confidentialFields[key] = empData[key]
    }
  }
  if (Object.keys(confidentialFields).length > 0) {
    try {
      await modulesPrisma.confidentialEmployeeData.upsert({
        where: { profileId },
        create: { profileId, ...confidentialFields },
        update: confidentialFields,
      })
    } catch (err: unknown) {
      // Swallow only "relation does not exist" (table not migrated yet)
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('does not exist') && !msg.includes('P2021')) throw err
    }
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.employee_profile_updated',
    entityType: 'profile',
    entityId: profileId,
    metadata: { fields: Object.keys({ ...profileData, ...empData, ...bankConfidentialData }) },
  })

  return success({ updated: true })
})
