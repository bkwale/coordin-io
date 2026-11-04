import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError } from '@/lib/errors'
import { match, getRuleSet, groupByDiscipline, diffChecklists, DISCIPLINE_LABELS, type ChecklistItem } from '@/lib/rules'
import { ProjectParametersSchema } from '@/lib/rules/schema'

export const dynamic = 'force-dynamic'

const REGISTER_NAME: Record<string, string> = { EE: 'Ehitusseadustik checklist', GB: 'Building Regulations checklist', PL: 'Prawo budowlane checklist', ES: 'CTE checklist' }

/**
 * GET /api/projects/[id]/regulatory
 * Latest project profile (questionnaire answers), the REGULATORY register and its items grouped by discipline.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const [profile, register] = await Promise.all([
    prisma.projectProfile.findFirst({ where: { projectId }, orderBy: { version: 'desc' } }),
    prisma.complianceRegister.findFirst({ where: { projectId, registerType: 'REGULATORY' }, include: { items: { orderBy: { sortOrder: 'asc' } } } }),
  ])
  const items = register?.items ?? []
  const generated = items.filter((i) => !i.addedByArchitect)
  const added = items.filter((i) => i.addedByArchitect)
  const grouped: Record<string, typeof items> = {}
  for (const i of generated) (grouped[i.section ?? 'other'] ??= []).push(i)
  return success({
    profile,
    register: register ? { id: register.id, name: register.name, templateVersion: register.templateVersion, updatedAt: register.updatedAt } : null,
    grouped,
    added,
    disciplineLabels: DISCIPLINE_LABELS,
    counts: { generated: generated.length, added: added.length },
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

  const checklist = match(params, ruleSet)

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.projectProfile.findFirst({ where: { projectId }, orderBy: { version: 'desc' } })
    const version = (prev?.version ?? 0) + 1
    const newProfile = await tx.projectProfile.create({
      data: { projectId, version, parameters: params as any, ruleSetVersion: ruleSet.version, createdBy: actor.id },
    })

    let register = await tx.complianceRegister.findFirst({ where: { projectId, registerType: 'REGULATORY' }, include: { items: true } })
    const before: ChecklistItem[] = (register?.items ?? []).filter((i) => !i.addedByArchitect && i.ruleId).map((i) => ({
      ruleId: i.ruleId!, discipline: (i.section ?? 'other') as any, title: i.requirement, citation: i.citation ?? '', source: i.source ?? '', confidence: (i.confidence ?? 'medium') as any, ruleSetVersion: i.ruleSetVersion ?? '',
    }))

    if (!register) {
      register = await tx.complianceRegister.create({
        data: { projectId, registerType: 'REGULATORY', name: REGISTER_NAME[params.jurisdiction] ?? 'Regulatory checklist', description: `Generated from ${ruleSet.version}`, templateVersion: ruleSet.version },
        include: { items: true },
      })
    } else {
      await tx.complianceRegister.update({ where: { id: register.id }, data: { templateVersion: ruleSet.version, description: `Generated from ${ruleSet.version} (profile v${version})` } })
      // keep status/evidence of items that survive; drop generated items no longer applicable
      const keepIds = new Set(checklist.map((c) => c.ruleId))
      await tx.complianceItem.deleteMany({ where: { registerId: register.id, addedByArchitect: false, OR: [{ ruleId: null }, { ruleId: { notIn: Array.from(keepIds) } }] } })
    }

    const existing = new Map((await tx.complianceItem.findMany({ where: { registerId: register.id, addedByArchitect: false } })).map((i) => [i.ruleId, i]))
    let order = 0
    for (const c of checklist) {
      order += 10
      const data = {
        section: c.discipline, requirement: c.title, titleLocal: c.titleLocal ?? null, source: c.source, version: c.ruleSetVersion,
        ruleId: c.ruleId, ruleSetVersion: c.ruleSetVersion, citation: c.citation, because: c.because ?? null, confidence: c.confidence,
        comments: c.requirement ?? null, sortOrder: order,
      }
      const ex = existing.get(c.ruleId)
      if (ex) await tx.complianceItem.update({ where: { id: ex.id }, data })
      else await tx.complianceItem.create({ data: { ...data, registerId: register.id } })
    }
    return { newProfile, registerId: register.id, before }
  })

  const diff = diffChecklists(result.before, checklist)

  await recordAuditEvent({
    organisationId: project.organisationId,
    actorId: actor.id,
    action: AuditActions.AI_PROJECT_CONFIGURED,
    entityType: 'project',
    entityId: projectId,
    metadata: {
      profileVersion: result.newProfile.version,
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
    profile: result.newProfile,
    registerId: result.registerId,
    ruleSetVersion: ruleSet.version,
    grouped: groupByDiscipline(checklist),
    disciplineLabels: DISCIPLINE_LABELS,
    diff: { added: diff.added.map((i) => i.ruleId), removed: diff.removed.map((i) => i.ruleId) },
  })
})
