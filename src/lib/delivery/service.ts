/**
 * Delivery frameworks — persistence (FEAT-017). Routes stay thin; all rules live here or in frameworks.ts.
 */
import { prisma } from '@/lib/prisma'
import { recordAuditEvent } from '@/lib/audit'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors'
import { buildStages, gateDecisionProblems, statusForDecision, TEMPLATE_VERSIONS, FRAMEWORK_LABELS, ITEM_KIND_LABELS, stageProgress } from './frameworks'
import type { Framework, GateDecision, ItemKind } from './types'

export const FRAMEWORKS: Framework[] = ['RIBA', 'CWA', 'CUSTOM']
const ITEM_STATUSES = ['OPEN', 'DONE', 'NOT_APPLICABLE'] as const
const STAGE_MANUAL_STATUSES = ['NOT_STARTED', 'IN_PROGRESS'] as const
const DECISIONS: GateDecision[] = ['PASS', 'CONDITIONAL_PASS', 'HOLD']

export async function getDelivery(projectId: string) {
  const [project, stages] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { deliveryFramework: true, accorOverlay: true, projectType: true } }),
    prisma.deliveryStage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } } }),
  ])
  return {
    framework: project?.deliveryFramework ?? null,
    accorOverlay: project?.accorOverlay ?? false,
    projectType: project?.projectType ?? null,
    stages: stages.map((s) => ({ ...s, progress: stageProgress(s.items) })),
    catalogue: { frameworks: FRAMEWORK_LABELS, itemKinds: ITEM_KIND_LABELS },
  }
}

/** Apply (or re-apply) a framework. Refused once any gate decision or completed item exists — evidence is never discarded. */
export async function applyFramework(opts: {
  projectId: string; organisationId: string; actorId: string
  framework: Framework; accorOverlay?: boolean; customStages?: { name: string; code?: string }[]
}) {
  if (!FRAMEWORKS.includes(opts.framework)) throw new ValidationError('framework must be RIBA, CWA or CUSTOM')
  let built
  try { built = buildStages(opts.framework, { accorOverlay: !!opts.accorOverlay, customStages: opts.customStages }) }
  catch (e) { throw new ValidationError(e instanceof Error ? e.message : 'Invalid stages') }

  const existing = await prisma.deliveryStage.findMany({ where: { projectId: opts.projectId }, select: { id: true, decision: true, items: { where: { status: { not: 'OPEN' } }, select: { id: true }, take: 1 } } })
  if (existing.some((s) => s.decision || s.items.length)) {
    throw new ConflictError('This project already has gate decisions or completed items. Stages can no longer be replaced.')
  }

  const templateVersion = TEMPLATE_VERSIONS[opts.framework]
  await prisma.$transaction(async (tx) => {
    if (existing.length) await tx.deliveryStage.deleteMany({ where: { projectId: opts.projectId } })
    await tx.project.update({ where: { id: opts.projectId }, data: { deliveryFramework: opts.framework, accorOverlay: opts.framework === 'CWA' && !!opts.accorOverlay } })
    for (const s of built) {
      const stage = await tx.deliveryStage.create({
        data: { projectId: opts.projectId, framework: opts.framework, templateVersion, code: s.code, name: s.name, outcome: s.outcome ?? null, purpose: s.purpose ?? null, sortOrder: s.sortOrder, designFreeze: false },
      })
      if (s.items.length) {
        await tx.deliveryStageItem.createMany({
          data: s.items.map((it, i) => ({ stageId: stage.id, kind: it.kind, title: it.title.slice(0, 500), responsibleParty: it.responsibleParty ?? null, sortOrder: i })),
        })
      }
    }
  }, { timeout: 30_000 })

  await recordAuditEvent({
    organisationId: opts.organisationId, actorId: opts.actorId, action: 'project.delivery_framework_applied', entityType: 'project', entityId: opts.projectId,
    metadata: { framework: opts.framework, templateVersion, accorOverlay: !!opts.accorOverlay, stages: built.length, items: built.reduce((n, s) => n + s.items.length, 0), replaced: existing.length },
  })
  return getDelivery(opts.projectId)
}

async function stageInProject(projectId: string, stageId: string) {
  const stage = await prisma.deliveryStage.findUnique({ where: { id: stageId }, include: { items: true } })
  if (!stage || stage.projectId !== projectId) throw new NotFoundError('Stage not found')
  return stage
}

export async function updateStage(projectId: string, stageId: string, body: Record<string, unknown>, actor: { organisationId: string; id: string }) {
  const stage = await stageInProject(projectId, stageId)
  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!(STAGE_MANUAL_STATUSES as readonly string[]).includes(String(body.status))) throw new ValidationError('Use the gate decision to pass, conditionally pass or hold a stage')
    if (stage.decision) throw new ConflictError('This gate has a recorded decision; reopen is not supported')
    data.status = body.status
    if (body.status === 'IN_PROGRESS' && !stage.actualStart) data.actualStart = new Date()
  }
  for (const k of ['plannedStart', 'plannedEnd', 'actualStart'] as const) {
    if (body[k] === null) data[k] = null
    else if (body[k] !== undefined) {
      const d = new Date(String(body[k]))
      if (isNaN(+d)) throw new ValidationError(`${k} is not a date`)
      data[k] = d
    }
  }
  if (body.leadId !== undefined) data.leadId = body.leadId ? String(body.leadId) : null
  if (!Object.keys(data).length) throw new ValidationError('Nothing to update')
  const updated = await prisma.deliveryStage.update({ where: { id: stageId }, data })
  await recordAuditEvent({ organisationId: actor.organisationId, actorId: actor.id, action: 'project.delivery_stage_updated', entityType: 'delivery_stage', entityId: stageId, metadata: { projectId, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) } })
  return updated
}

/** Record a gate decision (PASS / CONDITIONAL_PASS / HOLD). Conditional pass creates the open items. G2/G4 freeze the design baseline. */
export async function decideGate(projectId: string, stageId: string, body: Record<string, unknown>, actor: { organisationId: string; id: string }) {
  const stage = await stageInProject(projectId, stageId)
  const decision = String(body.decision) as GateDecision
  if (!DECISIONS.includes(decision)) throw new ValidationError('decision must be PASS, CONDITIONAL_PASS or HOLD')
  if (stage.decision === 'PASS' || stage.decision === 'CONDITIONAL_PASS') throw new ConflictError('This gate has already been passed')
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : null
  const openItems = Array.isArray(body.openItems) ? (body.openItems as { title?: string; assigneeId?: string; dueDate?: string }[]).slice(0, 50) : []
  const problems = gateDecisionProblems(stage.framework, stage.items, decision, { notes, openItems: openItems.map((o) => ({ title: String(o.title ?? ''), assigneeId: o.assigneeId ?? null, dueDate: o.dueDate ?? null })) })
  if (problems.length) throw new ValidationError(problems.join('; '))

  const now = new Date()
  const freeze = stage.framework === 'CWA' && (stage.code === 'G2' || stage.code === 'G4') && decision !== 'HOLD'
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.deliveryStage.updateMany({
      where: { id: stageId, decision: stage.decision }, // optimistic: nobody decided in between
      data: { decision, decisionNotes: notes, decidedById: actor.id, decidedAt: now, status: statusForDecision(decision), actualEnd: decision === 'HOLD' ? null : now, ...(freeze ? { designFreeze: true, frozenAt: now } : {}) },
    })
    if (res.count !== 1) throw new ConflictError('Someone else just recorded a decision — reload')
    if (decision === 'CONDITIONAL_PASS' && openItems.length) {
      await tx.deliveryStageItem.createMany({
        data: openItems.map((o, i) => ({ stageId, kind: 'DELIVERABLE', title: `Open item: ${String(o.title).trim().slice(0, 480)}`, assigneeId: o.assigneeId!, dueDate: new Date(o.dueDate!), isOpenItem: true, sortOrder: 1000 + i })),
      })
    }
    return tx.deliveryStage.findUnique({ where: { id: stageId }, include: { items: { orderBy: { sortOrder: 'asc' } } } })
  })
  await recordAuditEvent({ organisationId: actor.organisationId, actorId: actor.id, action: 'project.delivery_gate_decided', entityType: 'delivery_stage', entityId: stageId, metadata: { projectId, code: stage.code, decision, openItems: openItems.length, designFreeze: freeze || undefined } })
  return updated
}

export async function addItem(projectId: string, body: Record<string, unknown>, actor: { organisationId: string; id: string }) {
  const stage = await stageInProject(projectId, String(body.stageId ?? ''))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) throw new ValidationError('title is required')
  const kind = (['DRAWING', 'REPORT', 'EXIT_CRITERION', 'DELIVERABLE', 'ACCOR'].includes(String(body.kind)) ? body.kind : 'DELIVERABLE') as ItemKind
  const item = await prisma.deliveryStageItem.create({
    data: {
      stageId: stage.id, kind, title: title.slice(0, 500), responsibleParty: typeof body.responsibleParty === 'string' ? body.responsibleParty.slice(0, 120) : null,
      assigneeId: body.assigneeId ? String(body.assigneeId) : null, dueDate: body.dueDate ? new Date(String(body.dueDate)) : null, sortOrder: 500 + stage.items.length,
    },
  })
  await recordAuditEvent({ organisationId: actor.organisationId, actorId: actor.id, action: 'project.delivery_item_added', entityType: 'delivery_stage_item', entityId: item.id, metadata: { projectId, stageId: stage.id, kind } })
  return item
}

export async function updateItem(projectId: string, itemId: string, body: Record<string, unknown>, actor: { organisationId: string; id: string; canApprove: boolean }) {
  const item = await prisma.deliveryStageItem.findUnique({ where: { id: itemId }, include: { stage: { select: { projectId: true, designFreeze: true, code: true } } } })
  if (!item || item.stage.projectId !== projectId) throw new NotFoundError('Item not found')
  if (item.kind === 'APPROVAL' && !actor.canApprove) throw new ValidationError('Only the project lead or design lead can record approvals')
  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!(ITEM_STATUSES as readonly string[]).includes(String(body.status))) throw new ValidationError('status must be OPEN, DONE or NOT_APPLICABLE')
    data.status = body.status
    if (body.status === 'OPEN') { data.completedAt = null; data.completedById = null }
    else { data.completedAt = new Date(); data.completedById = actor.id }
  }
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId ? String(body.assigneeId) : null
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null
  if (body.documentUrl !== undefined) {
    const u = body.documentUrl ? String(body.documentUrl) : null
    if (u && !/^https?:\/\//.test(u)) throw new ValidationError('documentUrl must be an http(s) link')
    data.documentUrl = u?.slice(0, 1000) ?? null
  }
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 2000) : null
  if (body.responsibleParty !== undefined) data.responsibleParty = body.responsibleParty ? String(body.responsibleParty).slice(0, 120) : null
  if (!Object.keys(data).length) throw new ValidationError('Nothing to update')
  const updated = await prisma.deliveryStageItem.update({ where: { id: itemId }, data })
  await recordAuditEvent({ organisationId: actor.organisationId, actorId: actor.id, action: 'project.delivery_item_updated', entityType: 'delivery_stage_item', entityId: itemId, metadata: { projectId, kind: item.kind, status: data.status ?? undefined, stage: item.stage.code } })
  return updated
}
