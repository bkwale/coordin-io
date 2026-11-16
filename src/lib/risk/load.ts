/** Reads a project's records in the shape the risk rules need. Server-only. */
import { prisma } from '@/lib/prisma'
import { computeSignals, countSignals, DEFAULT_THRESHOLDS, type RiskInput, type RiskThresholds, type DocumentContradictionIn } from './signals'

interface SummaryRunInput { kind?: string; documentId?: string; revisionId?: string; revision?: string }

/**
 * Figures that disagree, from the newest finished summary of each document — but only while that summary is of the
 * document's current file. Once a new revision is uploaded the old finding is stale and is not shown.
 */
async function documentContradictions(projectId: string): Promise<DocumentContradictionIn[]> {
  const runs = await prisma.aIRun.findMany({
    where: { projectId, surface: 'EXTRACTION', status: { in: ['AWAITING_CONFIRMATION', 'APPLIED'] }, inputSummary: { contains: '"kind":"summary"' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, inputSummary: true, mapping: true },
    take: 200,
  })
  const newest = new Map<string, { runId: string; revisionId: string | null; revision: string | null; contradictions: DocumentContradictionIn['contradictions'] }>()
  for (const run of runs) {
    let input: SummaryRunInput
    try { input = JSON.parse(run.inputSummary) as SummaryRunInput } catch { continue }
    if (!input.documentId || newest.has(input.documentId)) continue
    const list = (run.mapping as { contradictions?: unknown } | null)?.contradictions
    newest.set(input.documentId, { runId: run.id, revisionId: input.revisionId ?? null, revision: input.revision ?? null, contradictions: Array.isArray(list) ? (list as DocumentContradictionIn['contradictions']) : [] })
  }
  const withFindings = [...newest.entries()].filter(([, v]) => v.contradictions.length > 0)
  if (withFindings.length === 0) return []
  const docs = await prisma.document.findMany({
    where: { projectId, id: { in: withFindings.map(([id]) => id) } },
    select: { id: true, title: true, revisions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
  })
  const out: DocumentContradictionIn[] = []
  for (const [documentId, v] of withFindings) {
    const doc = docs.find((d) => d.id === documentId)
    if (!doc) continue
    if (v.revisionId && doc.revisions[0]?.id !== v.revisionId) continue // a newer file has replaced the one that was summarised
    out.push({ documentId, documentTitle: doc.title, revision: v.revision, runId: v.runId, contradictions: v.contradictions })
  }
  return out
}

export async function loadRiskInput(projectId: string): Promise<RiskInput> {
  const [tasks, milestones, applications, regulatoryItems, contradictions] = await Promise.all([
    prisma.task.findMany({ where: { projectId, archivedAt: null, status: { not: 'COMPLETED' } }, select: { id: true, title: true, status: true, priority: true, dueDate: true, ownerId: true, milestoneId: true, archivedAt: true, updatedAt: true } }),
    prisma.projectMilestone.findMany({ where: { projectId }, select: { id: true, title: true, status: true, dueDate: true, completedDate: true } }),
    prisma.planningApplication.findMany({
      where: { projectId },
      select: { id: true, reference: true, authority: true, status: true, targetDecision: true, decisionDate: true, expiryDate: true, conditions: { select: { id: true, conditionNumber: true, description: true, conditionType: true, status: true, dueDate: true, ownerId: true, submissionDate: true } } },
    }),
    prisma.complianceItem.findMany({ where: { register: { projectId, registerType: 'REGULATORY' } }, select: { id: true, requirement: true, titleLocal: true, status: true, origin: true, dueDate: true, ownerId: true, citation: true } }),
    documentContradictions(projectId),
  ])
  // Milestone health needs the linked tasks that are done as well, to know how many there are in total
  const milestoneIds = milestones.filter((m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED').map((m) => m.id)
  const doneLinked = milestoneIds.length
    ? await prisma.task.findMany({ where: { projectId, archivedAt: null, status: 'COMPLETED', milestoneId: { in: milestoneIds } }, select: { id: true, title: true, status: true, priority: true, dueDate: true, ownerId: true, milestoneId: true, archivedAt: true, updatedAt: true } })
    : []
  return {
    projectId,
    tasks: [...tasks, ...doneLinked],
    milestones,
    applications: applications.map(({ conditions: _c, ...a }) => a),
    conditions: applications.flatMap((a) => a.conditions.map((c) => ({ ...c, applicationRef: a.reference }))),
    regulatoryItems,
    documentContradictions: contradictions,
  }
}

export async function projectRiskSignals(projectId: string, now: Date = new Date(), thresholds: RiskThresholds = DEFAULT_THRESHOLDS) {
  const signals = computeSignals(await loadRiskInput(projectId), now, thresholds)
  return { signals, counts: countSignals(signals), generatedAt: now.toISOString() }
}
