import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent } from '@/lib/audit'
import { ValidationError } from '@/lib/errors'
import { parseBody, requireString, optionalString } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/regulatory/items  { requirement, section?, citation?, source? }
 * The architect adds an obligation the engine missed. Flagged addedByArchitect and audited —
 * this is the feedback loop that improves the rule set.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile: actor, project }) => {
  const body = await parseBody(request)
  const requirement = requireString(body.requirement, 'Requirement', 500)
  const section = optionalString(body.section, 'Section', 40) ?? 'other'
  const citation = optionalString(body.citation, 'Citation', 120)
  const source = optionalString(body.source, 'Source', 200)

  const register = await prisma.complianceRegister.findFirst({ where: { projectId, registerType: 'REGULATORY' } })
  if (!register) return error(new ValidationError('Generate the regulatory checklist first'))

  const last = await prisma.complianceItem.findFirst({ where: { registerId: register.id }, orderBy: { sortOrder: 'desc' } })
  const item = await prisma.complianceItem.create({
    data: { registerId: register.id, requirement, section, citation: citation ?? null, source: source ?? null, addedByArchitect: true, origin: 'ARCHITECT', confidence: 'architect', sortOrder: (last?.sortOrder ?? 0) + 10 },
  })

  await recordAuditEvent({
    organisationId: project.organisationId,
    actorId: actor.id,
    action: 'ai.checklist_item_added_by_architect',
    entityType: 'compliance_item',
    entityId: item.id,
    metadata: { projectId, requirement, section, citation: citation ?? null, ruleSetVersion: register.templateVersion },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ item }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
