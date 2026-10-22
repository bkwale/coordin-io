import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { canPerform } from '@/lib/role-permissions'
import { PermissionError } from '@/lib/errors'
import type { OrgPermission } from '@/generated/prisma/client'
import ExcelJS from 'exceljs'

/**
 * GET /api/staffing/export/payroll
 *
 * Generates a payroll export as .xlsx with salary, bank, and contract details.
 * Locked to HR + ADMIN + FINANCE + OWNER roles only.
 * Every export is audit-logged for compliance.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const role = profile.orgPermission as OrgPermission
  const orgId = profile.organisationId

  // Only roles with salary visibility can export payroll
  if (!canPerform(role, 'staffing', 'view_salary')) {
    throw new PermissionError('You do not have permission to export payroll data')
  }

  // ── Fetch all active employees with confidential data ──────
  const employees = await modulesPrisma.profile.findMany({
    where: {
      organisationId: orgId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      jobTitle: true,
      department: true,
      startDate: true,
      office: { select: { name: true } },
      employeeProfile: {
        select: {
          employeeId: true,
          contractType: true,
          noticePeriod: true,
        },
      },
    },
    orderBy: { fullName: 'asc' },
  })

  // Fetch confidential data for all employees in one query
  const profileIds = employees.map((e: { id: string }) => e.id)
  let confidentialRecords: {
    profileId: string
    salary: number | null
    salaryCurrency: string | null
    salaryFrequency: string | null
    bankName: string | null
    bankAccountName: string | null
    bankAccountNumber: string | null
    bankSortCode: string | null
    pensionProvider: string | null
    pensionContribution: number | null
  }[] = []

  try {
    confidentialRecords = await modulesPrisma.confidentialEmployeeData.findMany({
      where: { profileId: { in: profileIds } },
      select: {
        profileId: true,
        salary: true,
        salaryCurrency: true,
        salaryFrequency: true,
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankSortCode: true,
        pensionProvider: true,
        pensionContribution: true,
      },
    })
  } catch {
    // Table may not exist yet — continue with empty
  }

  const confidentialMap = new Map(
    confidentialRecords.map((r) => [r.profileId, r]),
  )

  // ── Build Excel workbook ───────────────────────────────────
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Coordin.io'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Payroll Export', {
    properties: { defaultColWidth: 18 },
  })

  // Define columns
  sheet.columns = [
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Job Title', key: 'jobTitle', width: 24 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Office', key: 'office', width: 20 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'Contract Type', key: 'contractType', width: 16 },
    { header: 'Salary', key: 'salary', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Frequency', key: 'frequency', width: 12 },
    { header: 'Bank Name', key: 'bankName', width: 22 },
    { header: 'Account Name', key: 'accountName', width: 24 },
    { header: 'Account Number', key: 'accountNumber', width: 18 },
    { header: 'Sort Code', key: 'sortCode', width: 12 },
    { header: 'Pension Provider', key: 'pensionProvider', width: 20 },
    { header: 'Pension Contribution (%)', key: 'pensionContribution', width: 22 },
    { header: 'Notice Period', key: 'noticePeriod', width: 14 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, size: 11, name: 'Arial' }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A1A2E' },
  }
  headerRow.font = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
  headerRow.height = 28

  // Add data rows
  for (const emp of employees) {
    const conf = confidentialMap.get(emp.id)
    sheet.addRow({
      name: emp.fullName,
      employeeId: emp.employeeProfile?.employeeId ?? '',
      email: emp.email,
      jobTitle: emp.jobTitle ?? '',
      department: emp.department ?? '',
      office: emp.office?.name ?? '',
      startDate: emp.startDate
        ? new Date(emp.startDate).toISOString().slice(0, 10)
        : '',
      contractType: emp.employeeProfile?.contractType ?? '',
      salary: conf?.salary ?? '',
      currency: conf?.salaryCurrency ?? '',
      frequency: conf?.salaryFrequency ?? '',
      bankName: conf?.bankName ?? '',
      accountName: conf?.bankAccountName ?? '',
      accountNumber: conf?.bankAccountNumber ?? '',
      sortCode: conf?.bankSortCode ?? '',
      pensionProvider: conf?.pensionProvider ?? '',
      pensionContribution: conf?.pensionContribution ?? '',
      noticePeriod: emp.employeeProfile?.noticePeriod ?? '',
    })
  }

  // Style data rows
  for (let i = 2; i <= employees.length + 1; i++) {
    const row = sheet.getRow(i)
    row.font = { size: 10, name: 'Arial' }
    row.alignment = { vertical: 'middle' }
    if (i % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      }
    }
  }

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: employees.length + 1, column: 18 },
  }

  // Add metadata sheet
  const metaSheet = workbook.addWorksheet('Export Info')
  metaSheet.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 40 },
  ]
  const metaHeaderRow = metaSheet.getRow(1)
  metaHeaderRow.font = { bold: true, size: 11, name: 'Arial' }

  metaSheet.addRow({ field: 'Export Date', value: new Date().toISOString().slice(0, 19).replace('T', ' ') })
  metaSheet.addRow({ field: 'Exported By', value: profile.fullName })
  metaSheet.addRow({ field: 'Role', value: role })
  metaSheet.addRow({ field: 'Total Employees', value: employees.length })
  metaSheet.addRow({ field: 'Classification', value: 'CONFIDENTIAL — Authorised personnel only' })

  // ── Generate buffer ────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()

  // ── Audit log ──────────────────────────────────────────────
  await recordAuditEvent({
    organisationId: orgId,
    actorId: profile.id,
    action: 'staffing.payroll_exported',
    entityType: 'payroll_export',
    entityId: orgId,
    metadata: {
      employeeCount: employees.length,
      exportedBy: profile.fullName,
      exporterRole: role,
    },
  })

  // ── Return as downloadable file ────────────────────────────
  const filename = `payroll-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})
