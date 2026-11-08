import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError } from '@/lib/errors'
import { getRuleSet, groupByDiscipline, DISCIPLINE_LABELS } from '@/lib/rules'
import { applyProjectParameters, APPLY_TX_OPTIONS } from '@/lib/rules/apply'
import { ProjectParametersSchema } from '@/lib/rules/schema'
import { defaultJurisdiction, orgCountry } from '@/lib/region'

export const dynamic = 'force-dynamic'

export { STALE_PREFIX } from '@/lib/rules/apply'

/**
 * GET /api/projects/[id]/regulatory
 * Latest project profile (questionnaire answers), the REGULATORY register and its items grouped by discipline.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const [profile, register, proj] = await Promise.all([
    prisma.projectProfile.findFirst({ where: { projectId }, orderBy: { version: 'desc' } }),
    prisma.complianceRegister.findFirst({ where: { projectId, registerType: 'REGULATORY' }, include: { items: { orderBy: { sortOrder: 'asc' } } } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { jurisdiction: true, siteCountry: true, organisation: { select: { settings: true, defaultCurrency: true, offices: { select: { country: true, isHeadOffice: true } } } } } }),
  ])
  const items = register?.items ?? []
  const generated = items.filter((i) => i.origin === 'RULE')
  const added = items.filter((i) => i.origin === 'ARCHITECT')
  const municipal = items.filter((i) => i.origin === 'MUNICIPALITY')
  const jurisdiction = (profile?.parameters as { jurisdiction?: string } | null)?.jurisdiction
  const currentRuleSetVersion = jurisdiction ? getRuleSet(jurisdiction as Parameters<typeof getRuleSet>[0])?.version ?? null : null
  const grouped: Record<string, typeof items> = {}
  for (const i of generated) (grouped[i.section ?? 'other'] ??= []).push(i)
  return success({
    profile,
    register: register ? { id: register.id, name: register.name, templateVersion: register.templateVersion, updatedAt: register.updatedAt } : null,
    grouped,
    added,
    municipal,
    disciplineLabels: DISCIPLINE_LABELS,
    counts: { generated: generated.length, added: added.length, municipal: municipal.length, stale: generated.filter((i) => i.confidence === 'stale').length },
    currentRuleSetVersion,
    defaultJurisdiction: defaultJurisdiction({ projectJurisdiction: proj?.jurisdiction, siteCountry: proj?.siteCountry, orgCountry: orgCountry(proj?.organisation) }),
    outdated: !!(register?.templateVersion && currentRuleSetVersion && register.templateVersion !== currentRuleSetVersion),
  })
})

/**
 * POST /api/projects/[id]/regulatory  { parameters }
 * Saves a new ProjectProfile version, runs the deterministic rules engine, (re)writes the REGULATORY register.
 * Architect-added items are preserved. Returns the checklist plus a diff against the previous version.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile: actor, project }) => {
  const body = await request.json().catch(() => ({}))
  const parsed = ProjectParametersSchema.safeParse(body.parameters)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return error(new ValidationError(`${first.path.join('.')}: ${first.message}`))
  }
  const params = parsed.data
  const ruleSet = getRuleSet(params.jurisdiction)
  if (!ruleSet) return error(new ValidationError(`No rule set available yet for ${params.jurisdiction}`))

  const result = await prisma.$transaction((tx) => applyProjectParameters(tx, { projectId, parameters: params, createdBy: actor.id }), APPLY_TX_OPTIONS)
  const { checklist, diff } = result

  await recordAuditEvent({
    organisationId: project.organisationId,
    actorId: actor.id,
    action: AuditActions.AI_PROJECT_CONFIGURED,
    entityType: 'project',
    entityId: projectId,
    metadata: {
      profileVersion: result.profile.version,
      ruleSetVersion: ruleSet.version,
      parameters: params as any,
      items: checklist.length,
      citations: checklist.map((c) => `${c.ruleId} ${c.citation}`),
      added: diff.added.map((i) => i.ruleId),
      removed: diff.removed.map((i) => i.ruleId),
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({
    profile: result.profile,
    registerId: result.registerId,
    ruleSetVersion: ruleSet.version,
    grouped: groupByDiscipline(checklist),
    disciplineLabels: DISCIPLINE_LABELS,
    diff: { added: diff.added.map((i) => i.ruleId), removed: diff.removed.map((i) => i.ruleId) },
  })
}, { minProjectRole: 'PROJECT_LEAD' })
