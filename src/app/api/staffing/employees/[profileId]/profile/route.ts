import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, optionalNumber, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { hasFullStaffingAccess } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

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

  // HR+-only fields
  if (hasHRAccess) {
    // Profile fields
    const jobTitle = optionalString(body.jobTitle as unknown, 'jobTitle', 200)
    if (jobTitle !== null) profileData.jobTitle = jobTitle

    const officeId = optionalString(body.officeId as unknown, 'officeId', 50)
    if (officeId !== null) profileData.officeId = officeId

    const managerId = optionalString(body.managerId as unknown, 'managerId', 50)
    if (managerId !== null) profileData.managerId = managerId

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
    if (probationStatus !== null) empData.probationStatus = probationStatus

    const probationStartDate = optionalDate(body.probationStartDate as unknown, 'probationStartDate')
    if (probationStartDate !== null) empData.probationStartDate = probationStartDate

    const probationEndDate = optionalDate(body.probationEndDate as unknown, 'probationEndDate')
    if (probationEndDate !== null) empData.probationEndDate = probationEndDate

    const annualLeaveAllocation = optionalNumber(body.annualLeaveAllocation as unknown, 'annualLeaveAllocation', { min: 0, max: 365 })
    if (annualLeaveAllocation !== null) empData.annualLeaveAllocation = annualLeaveAllocation
  }

  // ── Bank details ──
  // Self: submit own bank details → status PENDING
  // HR: edit bank details directly → status APPROVED
  const bankConfidentialData: Record<string, unknown> = {}
  if (isSelf || hasHRAccess) {
    const bankAccountNumber = optionalString(body.bankAccountNumber as unknown, 'bankAccountNumber', 10)
    const bankCode = optionalString(body.bankCode as unknown, 'bankCode', 10)
    const bankAccountName = optionalString(body.bankAccountName as unknown, 'bankAccountName', 200)
    const bankName = optionalString(body.bankName as unknown, 'bankName', 200)
    const bankSortCode = optionalString(body.bankSortCode as unknown, 'bankSortCode', 10)
    const bankVerified = typeof body.bankVerified === 'boolean' ? body.bankVerified : null

    if (bankAccountNumber !== null) bankConfidentialData.bankAccountNumber = bankAccountNumber
    if (bankCode !== null) bankConfidentialData.bankCode = bankCode
    if (bankAccountName !== null) bankConfidentialData.bankAccountName = bankAccountName
    if (bankName !== null) bankConfidentialData.bankName = bankName
    if (bankSortCode !== null) bankConfidentialData.bankSortCode = bankSortCode
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

  // Update EmployeeProfile fields via upsert
  if (Object.keys(empData).length > 0) {
    await modulesPrisma.employeeProfile.upsert({
      where: { profileId },
      create: { profileId, ...empData },
      update: empData,
    })
  }

  // Dual-write: mirror confidential fields to ConfidentialEmployeeData table
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
