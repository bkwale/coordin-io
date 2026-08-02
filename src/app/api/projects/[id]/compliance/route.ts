import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, requireString, optionalString, optionalEnum } from '@/lib/validation'

const REGISTER_TYPES = [
  'BRPD', 'CDM', 'BUILDING_REGS', 'FIRE_SAFETY',
  'EDGE', 'BREEAM', 'LEED', 'CUSTOM',
] as const

const OVERALL_STATUSES = [
  'NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED',
  'UNDER_REVIEW', 'COMPLIANT', 'NON_COMPLIANT', 'ACTION_REQUIRED',
  'APPROVED_WITH_CONDITION', 'CLOSED',
] as const

/**
 * GET /api/projects/[id]/compliance — List compliance registers for a project.
 * Supports query param: registerType
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const registerType = url.searchParams.get('registerType')

  const where: Record<string, unknown> = { projectId }
  if (registerType && REGISTER_TYPES.includes(registerType as typeof REGISTER_TYPES[number])) {
    where.registerType = registerType
  }

  const registers = await (prisma as any).complianceRegister.findMany({
    where,
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return success({ registers })
})

/**
 * POST /api/projects/[id]/compliance — Create a new compliance register.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const registerType = optionalEnum(body.registerType, 'Register type', REGISTER_TYPES)
  if (!registerType) {
    const { ValidationError } = await import('@/lib/errors')
    throw new ValidationError('Register type is required')
  }
  const description = optionalString(body.description, 'Description', 5000)
  const templateVersion = optionalString(body.templateVersion, 'Template version', 100)

  const register = await (prisma as any).complianceRegister.create({
    data: {
      projectId,
      name,
      registerType,
      description,
      templateVersion,
      overallStatus: 'NOT_STARTED',
    },
    include: { _count: { select: { items: true } } },
  })

  return success({ register }, 201)
})
