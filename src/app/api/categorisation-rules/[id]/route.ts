import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { optionalString, optionalId, parseBody } from '@/lib/validation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError, NotFoundError } from '@/lib/errors'

/**
 * GET /api/categorisation-rules/[id] — Get a single rule.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const rule = await prisma.categorisationRule.findFirst({
    where: { id, organisationId: profile.organisationId },
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  if (!rule) throw new NotFoundError('Categorisation rule')

  return success({ rule })
}, { requiredPermission: 'MANAGER' })

/**
 * PATCH /api/categorisation-rules/[id] — Update a rule.
 *
 * ADMIN/OWNER only.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can edit categorisation rules')
  }

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const existing = await prisma.categorisationRule.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Categorisation rule')

  const body = await parseBody(request)
  const updates: Record<string, unknown> = {}

  if (body.accountCode !== undefined) updates.accountCode = optionalString(body.accountCode, 'Account code', 20) ?? existing.accountCode
  if (body.keyword !== undefined) updates.keyword = optionalString(body.keyword, 'Keyword', 200)
  if (typeof body.priority === 'number') updates.priority = Math.round(body.priority)
  if (typeof body.active === 'boolean') updates.active = body.active

  if (body.supplierId !== undefined) {
    if (body.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, organisationId: profile.organisationId },
      })
      if (!supplier) throw new ValidationError('Supplier not found in this organisation')
      updates.supplierId = body.supplierId
    } else {
      updates.supplierId = null
    }
  }

  if (body.projectId !== undefined) {
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, organisationId: profile.organisationId },
      })
      if (!project) throw new ValidationError('Project not found in this organisation')
      updates.projectId = body.projectId
    } else {
      updates.projectId = null
    }
  }

  const rule = await prisma.categorisationRule.update({
    where: { id },
    data: updates,
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  return success({ rule })
}, { requiredPermission: 'MANAGER' })

/**
 * DELETE /api/categorisation-rules/[id] — Soft-delete (deactivate) a rule.
 *
 * ADMIN/OWNER only. Sets active=false rather than hard deleting.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can delete categorisation rules')
  }

  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const existing = await prisma.categorisationRule.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Categorisation rule')

  await prisma.categorisationRule.update({
    where: { id },
    data: { active: false },
  })

  return success({ deleted: true })
}, { requiredPermission: 'MANAGER' })
