import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalId, parseBody } from '@/lib/validation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError } from '@/lib/errors'

/**
 * GET /api/categorisation-rules — List categorisation rules for the organisation.
 *
 * MANAGER+ can view. Supports ?supplierId= and ?projectId= filters.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) return success({ rules: [] })

  const url = new URL(request.url)
  const supplierId = url.searchParams.get('supplierId')
  const projectId = url.searchParams.get('projectId')
  const activeOnly = url.searchParams.get('active')

  const where: Record<string, unknown> = { organisationId: profile.organisationId }
  if (supplierId) where.supplierId = supplierId
  if (projectId) where.projectId = projectId
  if (activeOnly === 'true') where.active = true
  if (activeOnly === 'false') where.active = false

  const rules = await prisma.categorisationRule.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
    orderBy: { priority: 'desc' },
  })

  return success({ rules })
}, { requiredPermission: 'MANAGER' })

/**
 * POST /api/categorisation-rules — Create a new categorisation rule.
 *
 * ADMIN/OWNER only. Requires at least one of: supplierId, projectId, or keyword.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can create categorisation rules')
  }

  const body = await parseBody(request)

  const accountCode = requireString(body.accountCode, 'Account code', 20)
  const keyword = optionalString(body.keyword, 'Keyword', 200)
  const supplierId = optionalId(body.supplierId, 'Supplier ID')
  const projectId = optionalId(body.projectId, 'Project ID')
  const priority = typeof body.priority === 'number' ? Math.round(body.priority) : 0

  if (!supplierId && !projectId && !keyword) {
    throw new ValidationError('At least one of supplierId, projectId, or keyword is required')
  }

  // Verify supplier belongs to org
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organisationId: profile.organisationId },
    })
    if (!supplier) throw new ValidationError('Supplier not found in this organisation')
  }

  // Verify project belongs to org
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) throw new ValidationError('Project not found in this organisation')
  }

  const rule = await prisma.categorisationRule.create({
    data: {
      organisationId: profile.organisationId,
      supplierId,
      projectId,
      keyword,
      accountCode,
      priority,
      active: true,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  return success({ rule }, 201)
}, { requiredPermission: 'MANAGER' })
