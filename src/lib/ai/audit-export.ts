/**
 * S4.4 — AI runs in the audit export. One row per AI run in the organisation: what was read, by which
 * model and prompt version, who started and confirmed it, and what the person accepted or changed.
 * Built for an inspector's question: "show me every decision the AI touched, and who signed it off".
 */
import { prisma } from '@/lib/prisma'

export const AI_RUN_CSV_HEADER = [
  'Date', 'Time', 'Run ID', 'Surface', 'Document kind', 'Project', 'Source document', 'Source document ID',
  'Status', 'Model', 'Prompt version', 'Started by', 'Confirmed by', 'Confirmed at',
  'Confidence', 'Seconds', 'Tokens',
  'Values proposed', 'Values accepted as proposed', 'Values changed or rejected',
  'Conditions proposed', 'Conditions accepted', 'Conditions rejected',
  'Modules decided', 'Modules overridden',
  'Warnings', 'Failure kind', 'Failure message',
] as const

type Row = Record<(typeof AI_RUN_CSV_HEADER)[number], string>

/** CSV cell: quoted when needed, and neutralised when it starts like a spreadsheet formula. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

type Prefill = { key: string; value: unknown; kind: 'value' | 'bound' }
type ProjectMapping = { kind?: string; prefills?: Prefill[]; conditions?: unknown[]; warnings?: string[] }
type PracticeMapping = { modules?: unknown[]; decisions?: unknown[]; warnings?: string[] }

const same = (a: unknown, b: unknown) => {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Proposed values vs what was confirmed: a value counts as accepted only if the confirmed parameter equals it. */
export function compareValues(prefills: Prefill[] | undefined, confirmed: Record<string, unknown> | null | undefined) {
  const values = (prefills ?? []).filter((p) => p.kind === 'value')
  if (!confirmed) return { proposed: values.length, accepted: null as number | null, changed: null as number | null }
  const accepted = values.filter((p) => p.key in confirmed && same(confirmed[p.key], p.value)).length
  return { proposed: values.length, accepted, changed: values.length - accepted }
}

export async function buildAiRunRows(organisationId: string, from: Date, to: Date): Promise<Row[]> {
  const runs = await prisma.aIRun.findMany({
    where: { organisationId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })
  if (!runs.length) return []

  // Confirmations are audit events that point back at their run
  const confirmEvents = await prisma.auditEvent.findMany({
    where: { organisationId, action: { in: ['ai.project_configured', 'ai.practice_configured'] }, createdAt: { gte: from } },
    select: { metadata: true, actorId: true },
  })
  const confirmByRun = new Map<string, Record<string, unknown>>()
  for (const e of confirmEvents) {
    const m = (e.metadata ?? {}) as Record<string, unknown>
    const id = (m.sourceRunId ?? m.runId) as string | undefined
    if (id) confirmByRun.set(id, m)
  }

  const projectIds = Array.from(new Set(runs.map((r) => r.projectId).filter((x): x is string => !!x)))
  const authIds = Array.from(new Set(runs.flatMap((r) => [r.createdBy, r.confirmedBy]).filter((x): x is string => !!x)))
  const docIds = new Set<string>()
  const summaries = new Map<string, { kind?: string; documentId?: string | null; fileName?: string | null }>()
  for (const r of runs) {
    try {
      const s = JSON.parse(r.inputSummary) as { kind?: string; documentId?: string | null; fileName?: string | null }
      summaries.set(r.id, s)
      if (s.documentId) docIds.add(s.documentId)
    } catch { /* inputSummary is a URL for practice setup */ }
  }

  const [projects, people, docs] = await Promise.all([
    projectIds.length ? prisma.project.findMany({ where: { id: { in: projectIds }, organisationId }, select: { id: true, name: true } }) : [],
    authIds.length ? prisma.profile.findMany({ where: { OR: [{ authUserId: { in: authIds } }, { id: { in: authIds } }] }, select: { id: true, authUserId: true, fullName: true } }) : [],
    docIds.size ? prisma.document.findMany({ where: { id: { in: Array.from(docIds) } }, select: { id: true, title: true } }) : [],
  ])
  const projectName = new Map(projects.map((p) => [p.id, p.name]))
  const personName = new Map<string, string>()
  for (const p of people) { personName.set(p.id, p.fullName); if (p.authUserId) personName.set(p.authUserId, p.fullName) }
  const docTitle = new Map(docs.map((d) => [d.id, d.title]))

  return runs.map((r) => {
    const dt = new Date(r.createdAt)
    const summary = summaries.get(r.id)
    const confirm = confirmByRun.get(r.id)
    const mapping = (r.mapping ?? {}) as ProjectMapping & PracticeMapping
    const isProject = r.surface === 'PROJECT_SETUP'
    const values = isProject ? compareValues(mapping.prefills, (confirm?.parameters as Record<string, unknown>) ?? null) : null
    const conditionsProposed = isProject && mapping.kind !== 'brief' ? (mapping.conditions?.length ?? 0) : null
    const decisions = !isProject ? (confirm?.decisions as unknown[] | undefined) : undefined
    const overridden = !isProject ? (confirm?.overriddenKeys as unknown[] | undefined) : undefined
    const n = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x))

    return {
      'Date': dt.toISOString().slice(0, 10),
      'Time': dt.toISOString().slice(11, 19),
      'Run ID': r.id,
      'Surface': r.surface === 'PROJECT_SETUP' ? 'Project setup from document' : r.surface === 'PRACTICE_SETUP' ? 'Practice setup' : r.surface,
      'Document kind': summary?.kind === 'brief' ? 'Client brief' : summary?.kind === 'planning_conditions' ? 'Planning conditions' : '',
      'Project': r.projectId ? projectName.get(r.projectId) ?? r.projectId : '',
      'Source document': summary?.documentId ? docTitle.get(summary.documentId) ?? summary.fileName ?? '' : summary?.fileName ?? (isProject ? 'Pasted text' : r.inputSummary),
      'Source document ID': summary?.documentId ?? '',
      'Status': r.status,
      'Model': r.model ?? '',
      'Prompt version': r.promptVersion,
      'Started by': personName.get(r.createdBy) ?? (r.createdBy ? 'Platform admin' : ''),
      'Confirmed by': r.confirmedBy ? personName.get(r.confirmedBy) ?? r.confirmedBy : '',
      'Confirmed at': r.confirmedAt ? new Date(r.confirmedAt).toISOString().replace('T', ' ').slice(0, 19) : '',
      'Confidence': r.confidence === null || r.confidence === undefined ? '' : r.confidence.toFixed(2),
      'Seconds': r.latencyMs ? (r.latencyMs / 1000).toFixed(1) : '',
      'Tokens': n(r.tokensUsed),
      'Values proposed': values ? String(values.proposed) : '',
      'Values accepted as proposed': values ? n(values.accepted) : '',
      'Values changed or rejected': values ? n(values.changed) : '',
      'Conditions proposed': n(conditionsProposed),
      'Conditions accepted': confirm && isProject ? n(confirm.municipalAccepted as number) : '',
      'Conditions rejected': confirm && isProject ? n(confirm.municipalRejected as number) : '',
      'Modules decided': decisions ? String(decisions.length) : '',
      'Modules overridden': overridden ? String(overridden.length) : '',
      'Warnings': (mapping.warnings ?? []).join(' | '),
      'Failure kind': (r as { errorKind?: string | null }).errorKind ?? '',
      'Failure message': r.status === 'FAILED' ? r.error ?? '' : '',
    }
  })
}

export function aiRunsCsv(rows: Row[]): string {
  return [AI_RUN_CSV_HEADER.join(','), ...rows.map((r) => AI_RUN_CSV_HEADER.map((h) => csvCell(r[h])).join(','))].join('\n')
}
