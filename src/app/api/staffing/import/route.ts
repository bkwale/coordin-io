import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { PermissionError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import type { OrgPermission } from '@/generated/prisma/client'

// ── CSV Parsing ─────────────────────────────────────────────

/**
 * Parse a single CSV line, handling quoted fields that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip next quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Parse full CSV text into an array of row objects keyed by header names.
 */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows }
}

// ── Validation helpers ──────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT']

interface RowError {
  row: number
  field: string
  message: string
}

interface ValidatedRow {
  fullName: string
  email: string
  jobTitle: string | null
  department: string | null
  officeId: string | null
  startDate: Date | null
  employmentType: string | null
  probationMonths: number | null
}

function validateRow(
  row: Record<string, string>,
  rowIndex: number,
  existingEmails: Set<string>,
  officeMap: Map<string, string>,
): { data: ValidatedRow | null; errors: RowError[] } {
  const errors: RowError[] = []

  // fullName — required, max 200
  const fullName = (row['fullName'] ?? '').trim()
  if (!fullName) {
    errors.push({ row: rowIndex, field: 'fullName', message: 'Full name is required' })
  } else if (fullName.length > 200) {
    errors.push({ row: rowIndex, field: 'fullName', message: 'Full name must be 200 characters or fewer' })
  }

  // email — required, valid format, unique within batch
  const email = (row['email'] ?? '').trim().toLowerCase()
  if (!email) {
    errors.push({ row: rowIndex, field: 'email', message: 'Email is required' })
  } else if (!EMAIL_RE.test(email)) {
    errors.push({ row: rowIndex, field: 'email', message: 'Invalid email format' })
  } else if (existingEmails.has(email)) {
    errors.push({ row: rowIndex, field: 'email', message: 'Duplicate email in CSV' })
  }

  // jobTitle — optional, max 200
  const jobTitle = (row['jobTitle'] ?? '').trim() || null
  if (jobTitle && jobTitle.length > 200) {
    errors.push({ row: rowIndex, field: 'jobTitle', message: 'Job title must be 200 characters or fewer' })
  }

  // department — optional, max 100
  const department = (row['department'] ?? '').trim() || null
  if (department && department.length > 100) {
    errors.push({ row: rowIndex, field: 'department', message: 'Department must be 100 characters or fewer' })
  }

  // office — optional, match by name
  const officeName = (row['office'] ?? '').trim()
  let officeId: string | null = null
  if (officeName) {
    officeId = officeMap.get(officeName.toLowerCase()) ?? null
    if (!officeId) {
      errors.push({
        row: rowIndex,
        field: 'office',
        message: `Office "${officeName}" not found. Available offices must be created first in Settings.`,
      })
    }
  }

  // startDate — optional, YYYY-MM-DD
  let startDate: Date | null = null
  const startDateStr = (row['startDate'] ?? '').trim()
  if (startDateStr) {
    if (!DATE_RE.test(startDateStr)) {
      errors.push({ row: rowIndex, field: 'startDate', message: 'Start date must be in YYYY-MM-DD format' })
    } else {
      const parsed = new Date(startDateStr + 'T00:00:00Z')
      if (isNaN(parsed.getTime())) {
        errors.push({ row: rowIndex, field: 'startDate', message: 'Invalid date' })
      } else {
        startDate = parsed
      }
    }
  }

  // employmentType — optional, enum check
  const employmentType = (row['employmentType'] ?? '').trim().toUpperCase() || null
  if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    errors.push({
      row: rowIndex,
      field: 'employmentType',
      message: `Employment type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`,
    })
  }

  // probationMonths — optional, 1-12
  let probationMonths: number | null = null
  const probStr = (row['probationMonths'] ?? '').trim()
  if (probStr) {
    const num = parseInt(probStr, 10)
    if (isNaN(num) || num < 1 || num > 12) {
      errors.push({ row: rowIndex, field: 'probationMonths', message: 'Probation months must be between 1 and 12' })
    } else {
      probationMonths = num
    }
  }

  if (errors.length > 0) {
    return { data: null, errors }
  }

  // Track this email as seen
  existingEmails.add(email)

  return {
    data: {
      fullName,
      email,
      jobTitle,
      department,
      officeId,
      startDate,
      employmentType,
      probationMonths,
    },
    errors: [],
  }
}

// ── Required CSV headers ────────────────────────────────────

const REQUIRED_HEADERS = ['fullName', 'email']
const ALL_HEADERS = [
  'fullName',
  'email',
  'jobTitle',
  'department',
  'office',
  'startDate',
  'employmentType',
  'probationMonths',
]

// ── POST handler ────────────────────────────────────────────

/**
 * POST /api/staffing/import
 *
 * Bulk import employees from CSV. HR / ADMIN / OWNER only.
 *
 * Form data:
 *   - file: CSV file
 *   - mode: "new" (default) | "existing"
 *
 * mode=new  → creates profiles with PENDING status, sends invitation
 * mode=existing → creates profiles with ACTIVE status, no invitation
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Permission check
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission as string)) {
    throw new PermissionError('Only HR, Admin or Owner can import employees')
  }

  // Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file')
  const mode = ((formData.get('mode') as string) ?? 'new').toLowerCase()

  if (mode !== 'new' && mode !== 'existing') {
    throw new ValidationError('Mode must be "new" or "existing"')
  }

  if (!file || !(file instanceof Blob)) {
    throw new ValidationError('CSV file is required. Upload a file with the "file" field.')
  }

  // Read and parse CSV
  const text = await file.text()
  if (!text.trim()) {
    throw new ValidationError('CSV file is empty')
  }

  const { headers, rows } = parseCsv(text)

  // Validate headers
  for (const reqHeader of REQUIRED_HEADERS) {
    if (!headers.includes(reqHeader)) {
      throw new ValidationError(
        `Missing required CSV header: "${reqHeader}". Expected headers: ${ALL_HEADERS.join(', ')}`,
      )
    }
  }

  if (rows.length === 0) {
    throw new ValidationError('CSV file contains no data rows')
  }

  if (rows.length > 500) {
    throw new ValidationError('CSV file exceeds maximum of 500 rows per import')
  }

  // Load org offices for name matching
  const offices = await prisma.office.findMany({
    where: { organisationId: profile.organisationId },
    select: { id: true, name: true },
  })
  const officeMap = new Map<string, string>()
  for (const office of offices) {
    officeMap.set(office.name.toLowerCase(), office.id)
  }

  // Load existing org emails for duplicate detection
  const existingProfiles = await modulesPrisma.profile.findMany({
    where: { organisationId: profile.organisationId },
    select: { id: true, email: true },
  })
  const orgEmailToProfileId = new Map<string, string>()
  for (const p of existingProfiles) {
    orgEmailToProfileId.set(p.email.toLowerCase(), p.id)
  }

  // Validate all rows first
  const batchEmails = new Set<string>()
  const allErrors: RowError[] = []
  const validatedRows: Array<{ rowNum: number; data: ValidatedRow }> = []

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // 1-indexed, skip header row
    const { data, errors } = validateRow(rows[i], rowNum, batchEmails, officeMap)
    if (errors.length > 0) {
      allErrors.push(...errors)
    }
    if (data) {
      validatedRows.push({ rowNum, data })
    }
  }

  // Process valid rows
  let imported = 0
  let updated = 0
  const isExistingMode = mode === 'existing'

  for (const { rowNum, data } of validatedRows) {
    try {
      const existingProfileId = orgEmailToProfileId.get(data.email)

      if (existingProfileId) {
        // Update existing — don't overwrite with empty values
        const updateData: Record<string, unknown> = {}
        if (data.fullName) updateData.fullName = data.fullName
        if (data.jobTitle) updateData.jobTitle = data.jobTitle
        if (data.department) updateData.department = data.department
        if (data.officeId) updateData.officeId = data.officeId
        if (data.startDate) updateData.startDate = data.startDate

        if (Object.keys(updateData).length > 0) {
          await modulesPrisma.profile.update({
            where: { id: existingProfileId },
            data: updateData,
          })
        }

        // Update employee profile fields if present
        if (data.employmentType || data.probationMonths) {
          const empUpdate: Record<string, unknown> = {}
          if (data.employmentType) empUpdate.employmentType = data.employmentType
          if (data.probationMonths) empUpdate.probationLength = data.probationMonths

          await modulesPrisma.employeeProfile.upsert({
            where: { profileId: existingProfileId },
            update: empUpdate,
            create: {
              profileId: existingProfileId,
              ...empUpdate,
            },
          })
        }

        updated++
      } else {
        // Create new profile
        const newProfile = await modulesPrisma.profile.create({
          data: {
            organisationId: profile.organisationId,
            fullName: data.fullName,
            email: data.email,
            jobTitle: data.jobTitle,
            department: data.department,
            officeId: data.officeId,
            startDate: data.startDate,
            status: isExistingMode ? 'ACTIVE' : 'INVITED',
            orgPermission: 'MEMBER',
          },
        })

        // Create employee profile
        const empData: Record<string, unknown> = {
          profileId: newProfile.id,
        }
        if (data.employmentType) empData.employmentType = data.employmentType
        if (data.probationMonths) empData.probationLength = data.probationMonths

        await modulesPrisma.employeeProfile.create({ data: empData })

        // Track the new email so subsequent rows treat it as existing
        orgEmailToProfileId.set(data.email, newProfile.id)

        imported++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error processing row'
      allErrors.push({ row: rowNum, field: '_row', message })
    }
  }

  // Audit event
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'BULK_IMPORT_EMPLOYEES',
    entityType: 'Profile',
    entityId: profile.organisationId,
    metadata: {
      mode,
      totalRows: rows.length,
      imported,
      updated,
      errorCount: allErrors.length,
    },
  })

  return success({
    imported,
    updated,
    errors: allErrors,
  })
})
