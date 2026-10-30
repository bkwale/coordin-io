import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { modulesPrisma } from '@/lib/prisma-modules'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { recordAuditEvent } from '@/lib/audit'

type StepName = 'PERSONAL_DETAILS' | 'BANK_DETAILS' | 'HMO_ENROLMENT' | 'DOCUMENT_UPLOAD' | 'EMERGENCY_CONTACTS' | 'POLICY_ACKNOWLEDGEMENT' | 'EQUIPMENT_REQUEST'

const VALID_STEPS: StepName[] = ['PERSONAL_DETAILS', 'BANK_DETAILS', 'HMO_ENROLMENT', 'DOCUMENT_UPLOAD', 'EMERGENCY_CONTACTS', 'POLICY_ACKNOWLEDGEMENT', 'EQUIPMENT_REQUEST']

/**
 * POST /api/onboarding/self-service/steps
 *
 * Public endpoint — submits data for one self-service onboarding step.
 * Token-based auth (no Supabase session).
 *
 * Body: { token, step, data: { ... } }
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitResponse = await checkRateLimit(`self-service-step:${ip}`, RateLimitPresets.standard)
  if (rateLimitResponse) return rateLimitResponse

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token : ''
  const step = typeof body.step === 'string' ? body.step : ''
  const data = typeof body.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : {}

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
  }

  if (!VALID_STEPS.includes(step as StepName)) {
    return NextResponse.json({ error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}` }, { status: 400 })
  }

  // Validate token
  const selfServiceToken = await modulesPrisma.onboardingSelfServiceToken.findUnique({
    where: { token },
    select: {
      id: true,
      profileId: true,
      organisationId: true,
      expiresAt: true,
      revokedAt: true,
      completedAt: true,
    },
  })

  if (!selfServiceToken) {
    return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
  }

  if (selfServiceToken.revokedAt) {
    return NextResponse.json({ error: 'This invitation has been revoked' }, { status: 410 })
  }

  if (new Date() > selfServiceToken.expiresAt) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  if (selfServiceToken.completedAt) {
    return NextResponse.json({ error: 'This onboarding has already been completed' }, { status: 410 })
  }

  // Find the matching self-service task
  const task = await modulesPrisma.onboardingTask.findFirst({
    where: {
      assigneeId: selfServiceToken.profileId,
      isSelfService: true,
      selfServiceStep: step,
    },
  })

  if (!task) {
    return NextResponse.json({ error: 'Self-service task not found for this step' }, { status: 404 })
  }

  if (task.status === 'COMPLETED') {
    return NextResponse.json({ error: 'This step has already been completed' }, { status: 409 })
  }

  // Process the step data
  try {
    switch (step as StepName) {
      case 'PERSONAL_DETAILS':
        await processPersonalDetails(selfServiceToken.profileId, data)
        break
      case 'BANK_DETAILS':
        await processBankDetails(selfServiceToken.profileId, selfServiceToken.organisationId, data)
        break
      case 'HMO_ENROLMENT':
        await processHmoEnrolment(selfServiceToken.profileId, data)
        break
      case 'DOCUMENT_UPLOAD':
        await processDocumentUpload(selfServiceToken.profileId, data)
        break
      case 'EMERGENCY_CONTACTS':
        await processEmergencyContacts(selfServiceToken.profileId, data)
        break
      case 'POLICY_ACKNOWLEDGEMENT':
        await processPolicyAcknowledgement(selfServiceToken.profileId, selfServiceToken.organisationId, data)
        break
      case 'EQUIPMENT_REQUEST':
        await processEquipmentRequest(selfServiceToken.profileId, selfServiceToken.organisationId, data)
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process step data'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Mark task as completed
  await modulesPrisma.onboardingTask.update({
    where: { id: task.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })

  // Check if all steps are now complete
  const remainingTasks = await modulesPrisma.onboardingTask.count({
    where: {
      assigneeId: selfServiceToken.profileId,
      isSelfService: true,
      selfServiceStep: { not: null },
      status: { not: 'COMPLETED' },
    },
  })

  if (remainingTasks === 0) {
    // Mark token as completed
    await modulesPrisma.onboardingSelfServiceToken.update({
      where: { id: selfServiceToken.id },
      data: { completedAt: new Date() },
    })
  }

  await recordAuditEvent({
    organisationId: selfServiceToken.organisationId,
    actorId: selfServiceToken.profileId,
    action: `self_service_onboarding.step_completed`,
    entityType: 'OnboardingTask',
    entityId: task.id,
    metadata: { step, allCompleted: remainingTasks === 0 },
  })

  return success({
    step,
    status: 'COMPLETED',
    allCompleted: remainingTasks === 0,
  })
}

// ── Step processors ────────────────────────────────────────

async function processPersonalDetails(profileId: string, data: Record<string, unknown>) {
  // Update Profile fields (phone)
  const profileUpdates: Record<string, unknown> = {}
  if (typeof data.phone === 'string' && data.phone.trim()) profileUpdates.phone = data.phone.trim()
  if (typeof data.fullName === 'string' && data.fullName.trim()) profileUpdates.fullName = data.fullName.trim()

  if (Object.keys(profileUpdates).length > 0) {
    await modulesPrisma.profile.update({
      where: { id: profileId },
      data: profileUpdates,
    })
  }

  // Update EmployeeProfile fields (emergency contacts, department, working pattern)
  const empUpdates: Record<string, unknown> = {}
  if (typeof data.emergencyName === 'string') empUpdates.emergencyName = data.emergencyName.trim()
  if (typeof data.emergencyPhone === 'string') empUpdates.emergencyPhone = data.emergencyPhone.trim()
  if (typeof data.emergencyRelation === 'string') empUpdates.emergencyRelation = data.emergencyRelation.trim()
  if (typeof data.department === 'string') empUpdates.department = data.department.trim()
  if (typeof data.workingPattern === 'string') empUpdates.workingPattern = data.workingPattern.trim()

  if (Object.keys(empUpdates).length > 0) {
    await modulesPrisma.employeeProfile.upsert({
      where: { profileId },
      create: { profileId, ...empUpdates },
      update: empUpdates,
    })
  }
}

async function processBankDetails(profileId: string, _organisationId: string, data: Record<string, unknown>) {
  // Bank details go to ConfidentialEmployeeData (Schneier: non-negotiable)
  const bankData: Record<string, unknown> = {}

  if (typeof data.bankAccountName === 'string') bankData.bankAccountName = data.bankAccountName.trim()
  if (typeof data.bankAccountNumber === 'string') bankData.bankAccountNumber = data.bankAccountNumber.trim()
  if (typeof data.bankName === 'string') bankData.bankName = data.bankName.trim()
  if (typeof data.bankSortCode === 'string') bankData.bankSortCode = data.bankSortCode.trim()
  if (typeof data.bankCode === 'string') bankData.bankCode = data.bankCode.trim()

  // Basic validation
  if (!bankData.bankAccountName || !bankData.bankAccountNumber) {
    throw new Error('Bank account name and number are required')
  }

  // Sort code validation (UK format: 6 digits)
  if (bankData.bankSortCode) {
    const sortCode = String(bankData.bankSortCode).replace(/[-\s]/g, '')
    if (!/^\d{6}$/.test(sortCode)) {
      throw new Error('Sort code must be 6 digits')
    }
    bankData.bankSortCode = sortCode
  }

  bankData.bankVerified = false
  bankData.bankApprovalStatus = 'PENDING'

  await modulesPrisma.confidentialEmployeeData.upsert({
    where: { profileId },
    create: {
      profileId,
      ...bankData,
    },
    update: bankData,
  })

  // Audit the bank submission specifically
  await recordAuditEvent({
    organisationId: _organisationId,
    actorId: profileId,
    action: 'bank_details.self_service_submitted',
    entityType: 'ConfidentialEmployeeData',
    entityId: profileId,
    metadata: { bankName: bankData.bankName, sortCode: bankData.bankSortCode ? '****' : null },
  })
}

async function processHmoEnrolment(profileId: string, data: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}

  if (typeof data.hmoProvider === 'string') updates.hmoProvider = data.hmoProvider.trim()
  if (typeof data.hmoPlan === 'string') updates.hmoPlan = data.hmoPlan.trim()

  // dependants is an Int field (count of dependants)
  if (typeof data.dependants === 'number' && Number.isInteger(data.dependants) && data.dependants >= 0) {
    updates.dependants = data.dependants
  }

  if (Object.keys(updates).length > 0) {
    await modulesPrisma.confidentialEmployeeData.upsert({
      where: { profileId },
      create: { profileId, ...updates },
      update: updates,
    })
  }
}

async function processDocumentUpload(profileId: string, data: Record<string, unknown>) {
  // For document acknowledgement — mark which documents the employee has reviewed
  if (Array.isArray(data.acknowledgedDocuments)) {
    const docIds = data.acknowledgedDocuments.filter((id: unknown) => typeof id === 'string')

    // Update each document's acknowledgement status (scoped to this employee's docs only)
    for (const docId of docIds) {
      try {
        await modulesPrisma.hRDocument.updateMany({
          where: { id: docId as string, profileId },
          data: {
            acknowledged: true,
            acknowledgedAt: new Date(),
          },
        })
      } catch {
        // Skip if document not found — non-fatal
      }
    }
  }

  // For file uploads, the actual files are handled by the existing upload API
  // The self-service UI calls /api/upload separately, then passes the URLs here
  if (Array.isArray(data.uploadedFileUrls)) {
    // Store reference to uploaded files if needed
    // For now, the upload endpoint already stores them
  }
}

async function processEmergencyContacts(profileId: string, data: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}
  if (typeof data.emergencyName === 'string') updates.emergencyName = data.emergencyName.trim()
  if (typeof data.emergencyPhone === 'string') updates.emergencyPhone = data.emergencyPhone.trim()
  if (typeof data.emergencyRelation === 'string') updates.emergencyRelation = data.emergencyRelation.trim()

  if (Object.keys(updates).length === 0) {
    throw new Error('At least one emergency contact is required')
  }

  await modulesPrisma.employeeProfile.upsert({
    where: { profileId },
    create: { profileId, ...updates },
    update: updates,
  })
}

async function processPolicyAcknowledgement(profileId: string, organisationId: string, data: Record<string, unknown>) {
  if (!Array.isArray(data.acknowledgedPolicies) || data.acknowledgedPolicies.length === 0) {
    throw new Error('You must acknowledge at least one policy')
  }

  const policyIds = data.acknowledgedPolicies.filter((id: unknown) => typeof id === 'string')

  for (const policyId of policyIds) {
    // Look up the policy to get its revision
    const policy = await modulesPrisma.policyDocument.findFirst({
      where: { id: policyId as string, organisationId },
      select: { id: true, revision: true },
    })

    if (!policy) continue

    // Upsert the acknowledgement record
    await modulesPrisma.policyAcknowledgement.upsert({
      where: {
        profileId_policyId_policyRevision: {
          profileId,
          policyId: policy.id,
          policyRevision: policy.revision,
        },
      },
      create: {
        profileId,
        policyId: policy.id,
        policyRevision: policy.revision,
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
      update: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    })

    await recordAuditEvent({
      organisationId,
      actorId: profileId,
      action: 'policy.acknowledged',
      entityType: 'PolicyDocument',
      entityId: policy.id,
      metadata: { source: 'self_service_onboarding' },
    })
  }
}

async function processEquipmentRequest(profileId: string, organisationId: string, data: Record<string, unknown>) {
  const items: string[] = []
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (typeof item === 'string' && item.trim()) items.push(item.trim())
    }
  }
  if (typeof data.notes === 'string' && data.notes.trim()) {
    items.push(`Notes: ${data.notes.trim()}`)
  }

  if (items.length === 0) {
    // Equipment request is optional — if nothing requested, just mark as done
    return
  }

  await modulesPrisma.serviceRequest.create({
    data: {
      profileId,
      organisationId,
      requestType: 'EQUIPMENT',
      title: 'New Starter Equipment Request',
      description: items.join('\n'),
      status: 'SUBMITTED',
      priority: 'MEDIUM',
    },
  })
}
