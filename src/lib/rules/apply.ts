import type { Prisma } from '@/generated/prisma/client'
import { match, getRuleSet, diffChecklists, type ChecklistItem, type ProjectParameters } from '@/lib/rules'

/** Prefix on `because` for RULE items that no longer apply but were kept because the architect had worked on them. */
export const STALE_PREFIX = '[No longer applies with current parameters]'

export const REGISTER_NAME: Record<string, string> = { EE: 'Ehitusseadustik checklist', GB: 'Building Regulations checklist', PL: 'Prawo budowlane checklist', ES: 'CTE checklist' }

export type ApplyParametersInput = {
  projectId: string
  parameters: ProjectParameters
  createdBy: string
  /** AIRun id when the parameters came from a document (Sprint 3). */
  sourceRunId?: string | null
}

export type ApplyParametersResult = {
  profile: { id: string; version: number }
  registerId: string
  checklist: ChecklistItem[]
  ruleSetVersion: string
  diff: { added: ChecklistItem[]; removed: ChecklistItem[]; unchanged: ChecklistItem[] }
}

type Tx = Prisma.TransactionClient

/**
 * The regulatory write path, shared by the questionnaire POST and (Sprint 3) document confirm.
 * Runs inside the caller's transaction:
 *  - new ProjectProfile version
 *  - REGULATORY register created/updated
 *  - RULE items: stale ones deleted if untouched, kept+flagged if worked on; survivors updated in place (status/evidence preserved)
 *  - MUNICIPALITY and ARCHITECT items are never touched here
 * Throws if the jurisdiction has no rule set — validate before calling.
 */
export async function applyProjectParameters(tx: Tx, input: ApplyParametersInput): Promise<ApplyParametersResult> {
  const { projectId, parameters, createdBy, sourceRunId } = input
  const ruleSet = getRuleSet(parameters.jurisdiction)
  if (!ruleSet) throw new Error(`No rule set available yet for ${parameters.jurisdiction}`)
  const checklist = match(parameters, ruleSet)

  const prev = await tx.projectProfile.findFirst({ where: { projectId }, orderBy: { version: 'desc' } })
  const version = (prev?.version ?? 0) + 1
  const profile = await tx.projectProfile.create({
    data: { projectId, version, parameters: parameters as any, ruleSetVersion: ruleSet.version, createdBy, sourceRunId: sourceRunId ?? null },
  })

  let register = await tx.complianceRegister.findFirst({ where: { projectId, registerType: 'REGULATORY' }, include: { items: true } })
  const before: ChecklistItem[] = (register?.items ?? []).filter((i) => i.origin === 'RULE' && i.ruleId && i.confidence !== 'stale').map((i) => ({
    ruleId: i.ruleId!, discipline: (i.section ?? 'other') as any, title: i.requirement, citation: i.citation ?? '', source: i.source ?? '', confidence: (i.confidence ?? 'medium') as any, ruleSetVersion: i.ruleSetVersion ?? '',
  }))

  if (!register) {
    register = await tx.complianceRegister.create({
      data: { projectId, registerType: 'REGULATORY', name: REGISTER_NAME[parameters.jurisdiction] ?? 'Regulatory checklist', description: `Generated from ${ruleSet.version}`, templateVersion: ruleSet.version },
      include: { items: true },
    })
  } else {
    await tx.complianceRegister.update({ where: { id: register.id }, data: { templateVersion: ruleSet.version, description: `Generated from ${ruleSet.version} (profile v${version})` } })
    const keepIds = Array.from(new Set(checklist.map((c) => c.ruleId)))
    const stale = { registerId: register.id, origin: 'RULE' as const, OR: [{ ruleId: null }, { ruleId: { notIn: keepIds } }] }
    await tx.complianceItem.deleteMany({ where: { ...stale, status: 'NOT_STARTED' } })
    const touched = await tx.complianceItem.findMany({ where: { ...stale, NOT: { status: 'NOT_STARTED' } } })
    await Promise.all(touched.map((i) => tx.complianceItem.update({
      where: { id: i.id },
      data: { because: `${STALE_PREFIX} ${(i.because ?? '').replace(STALE_PREFIX, '').trim()}`.trim(), confidence: 'stale' },
    })))
  }

  const existing = new Map((await tx.complianceItem.findMany({ where: { registerId: register.id, origin: 'RULE' } })).map((i) => [i.ruleId, i]))
  const toCreate: Prisma.ComplianceItemCreateManyInput[] = []
  const toUpdate: Array<{ id: string; data: Prisma.ComplianceItemUpdateInput }> = []
  let order = 0
  for (const c of checklist) {
    order += 10
    const data = {
      section: c.discipline, requirement: c.title, titleLocal: c.titleLocal ?? null, source: c.source, version: c.ruleSetVersion,
      ruleId: c.ruleId, ruleSetVersion: c.ruleSetVersion, citation: c.citation, because: c.because ?? null, confidence: c.confidence,
      comments: c.requirement ?? null, sortOrder: order,
    }
    const ex = existing.get(c.ruleId)
    if (ex) toUpdate.push({ id: ex.id, data })
    else toCreate.push({ ...data, registerId: register.id, origin: 'RULE' })
  }
  if (toCreate.length) await tx.complianceItem.createMany({ data: toCreate })
  await Promise.all(toUpdate.map((u) => tx.complianceItem.update({ where: { id: u.id }, data: u.data })))

  return { profile: { id: profile.id, version }, registerId: register.id, checklist, ruleSetVersion: ruleSet.version, diff: diffChecklists(before, checklist) }
}

export const APPLY_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const
