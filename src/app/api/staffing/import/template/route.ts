import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { PermissionError } from '@/lib/errors'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing/import/template
 *
 * Returns a downloadable CSV template for bulk employee import.
 * HR / ADMIN / OWNER only.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission as string)) {
    throw new PermissionError('Only HR, Admin or Owner can download import templates')
  }

  const template = [
    'fullName,email,jobTitle,department,office,startDate,employmentType,probationMonths',
    'Jane Smith,jane@example.com,Senior Engineer,Engineering,Lagos Office,2026-11-01,FULL_TIME,3',
    'John Doe,john@example.com,Project Manager,PMO,Abuja Office,2026-11-15,FULL_TIME,6',
  ].join('\n')

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="employee-import-template.csv"',
    },
  })
})
