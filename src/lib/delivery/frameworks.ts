/**
 * Project delivery frameworks (FEAT-017, PT 2026-11-05).
 * Catalogue lives in code; applying a framework SNAPSHOTS stages + items into the project, so a later
 * guide revision never changes a live project (Fowler). Custom stages are rows with framework CUSTOM.
 */
import { STAGE_TEMPLATES } from '@/lib/stage-templates'
import { CWA_GATES, CWA_TEMPLATE_VERSION } from './cwa-gates'
import type { Framework, FrameworkStageTemplate, FrameworkItemTemplate, GateDecision, ItemKind } from './types'

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  RIBA: 'RIBA Plan of Work',
  EVS: 'Estonian design stages (EVS 932)',
  CWA: 'CWA Project Delivery Framework (G0–G10)',
  CUSTOM: 'Custom project stages',
}

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  DRAWING: 'Mandatory drawings / models', REPORT: 'Reports / schedules / specifications', EXIT_CRITERION: 'Gate exit criteria',
  APPROVAL: 'Internal approval', ACCOR: 'Accor milestone', DELIVERABLE: 'Deliverables',
}

/** CWA internal approval gateway (guide p.8): six steps recorded per gate. */
export const CWA_APPROVAL_STEPS: FrameworkItemTemplate[] = [
  { kind: 'APPROVAL', title: '1. Author self-check against brief, standards and previous comments', responsibleParty: 'Author' },
  { kind: 'APPROVAL', title: '2. Technical check — dimensions, coordination, calculations, schedules', responsibleParty: 'Technical checker' },
  { kind: 'APPROVAL', title: '3. Coordination review — drawings, models, reports and registers align', responsibleParty: 'Coordinator' },
  { kind: 'APPROVAL', title: '4. CWA specialist review (MEP / site / QS / F&J / compliance as applicable)', responsibleParty: 'CWA Specialist' },
  { kind: 'APPROVAL', title: '5. CWA Design Lead approval — accepts open-item list, authorises issue', responsibleParty: 'CWA Design Lead' },
  { kind: 'APPROVAL', title: '6. Owner / external gate (Shoreline, Accor, client or authority where required)', responsibleParty: 'Owner / External' },
]

/** Accor milestone overlay (guide p.10): Accor reviews mapped onto the CWA gate where they close. */
export const ACCOR_OVERLAY: Record<string, string[]> = {
  G0: ['HCSA committed / site evaluation — confirm site, PAP/PIP, consultant needs and initial brand direction'],
  G1: ['Kick-off — brand standards, design brief, CRS, concept guidance and hotel programme'],
  G3: ['Concept / schematic review — concept planning, architecture, infrastructure, fit-out and operational equipment'],
  G5: ['Detailed design — detailed plans/layouts, committee review, final hotel programme and MUR package'],
  G6: ['Mock-up room validation — build, inspect, correct and approve benchmark guestroom'],
  G8: ['Construction / conversion — progress/site reviews and compliance monitoring'],
  G9: ['Pre-opening assistance — full site review, completion validation and opening sign-off'],
  G10: ['Handover / operations transition — final records, close-out and transition to operations'],
}

const RIBA_NAMES = ['Strategic Definition', 'Preparation & Briefing', 'Concept Design', 'Spatial Coordination', 'Technical Design', 'Manufacturing & Construction', 'Handover', 'Use']
export const RIBA_STAGES: FrameworkStageTemplate[] = RIBA_NAMES.map((name, i) => ({
  code: String(i), name,
  items: STAGE_TEMPLATES.filter((t) => t.stage === i).sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({ kind: (t.required_flag ? 'EXIT_CRITERION' : 'DELIVERABLE') as ItemKind, title: t.task_title })),
}))

/**
 * Estonian design stages (EVS 932:2017 Ehitusprojekt) with the permits that hang off them:
 * the building permit application needs at least an eelprojekt; works start on a põhiprojekt; occupancy permit at the end.
 */
const X = (title: string) => ({ kind: 'EXIT_CRITERION' as ItemKind, title })
const D = (title: string) => ({ kind: 'DELIVERABLE' as ItemKind, title })
export const EVS_STAGES: FrameworkStageTemplate[] = [
  { code: 'E1', name: 'Eskiisprojekt — sketch design', items: [X('Design brief (lähteülesanne) agreed with the client'), X('Topographic survey (geodeetiline alusplaan) obtained'), D('Sketch plans, sections and massing'), X('Client approval of the sketch design')] },
  { code: 'E2', name: 'Eelprojekt — preliminary design', items: [X('Planning conditions (projekteerimistingimused) or detailed plan checked against the design'), D('Architectural plans, sections and façades to scale'), D('Structural, services and fire safety concepts'), D('Utility connection conditions (liitumistingimused) requested'), X('Building permit application submitted in the building register (EHR)')] },
  { code: 'E3', name: 'Põhiprojekt — main design', items: [X('All disciplines coordinated'), D('Energy performance calculation'), D('Expert assessment (ekspertiis) where required'), X('Building permit or notice in force before works start')] },
  { code: 'E4', name: 'Tööprojekt — working design', items: [D('Working drawings and details'), D('Specifications and bill of quantities'), D('Tender documents')] },
  { code: 'E5', name: 'Ehitus — construction', items: [X("Owner's supervision (omanikujärelevalve) appointed"), D('Author supervision (autorijärelevalve) visits recorded'), D('Construction log (ehituspäevik) kept'), D('As-built documentation')] },
  { code: 'E6', name: 'Kasutusluba — occupancy and handover', items: [X('Occupancy permit (kasutusluba) application submitted in EHR'), D('Use and maintenance manual (kasutus- ja hoolduskava)'), X('Handover to the client')] },
]

export const TEMPLATE_VERSIONS: Record<Framework, string> = { RIBA: 'RIBA-2020', EVS: 'EVS-932-2017', CWA: CWA_TEMPLATE_VERSION, CUSTOM: 'custom' }

export type BuiltStage = FrameworkStageTemplate & { sortOrder: number }

/** Build the stages + items to snapshot into a project. */
export function buildStages(framework: Framework, opts: { accorOverlay?: boolean; customStages?: { name: string; code?: string }[] } = {}): BuiltStage[] {
  if (framework === 'CUSTOM') {
    const stages = (opts.customStages ?? []).map((s) => s.name?.trim()).filter(Boolean)
    if (!stages.length) throw new Error('Add at least one stage')
    if (stages.length > 30) throw new Error('At most 30 custom stages')
    return (opts.customStages ?? []).filter((s) => s.name?.trim()).map((s, i) => ({
      code: (s.code?.trim() || `S${i + 1}`).slice(0, 12), name: s.name.trim().slice(0, 120), items: [], sortOrder: i,
    }))
  }
  const base = framework === 'CWA' ? CWA_GATES : framework === 'EVS' ? EVS_STAGES : RIBA_STAGES
  return base.map((s, i) => ({
    ...s,
    sortOrder: i,
    items: [
      ...s.items,
      ...(framework === 'CWA' ? CWA_APPROVAL_STEPS : []),
      ...(framework === 'CWA' && opts.accorOverlay ? (ACCOR_OVERLAY[s.code] ?? []).map((t) => ({ kind: 'ACCOR' as const, title: t, responsibleParty: 'Accor / Operator' })) : []),
    ],
  }))
}

type ItemState = { kind: string; status: string; title: string }
type OpenItem = { title: string; assigneeId?: string | null; dueDate?: string | Date | null }

/**
 * Gate approval rules (guide p.9): a gate is an evidence-based decision, not a percentage estimate.
 * PASS — every exit criterion met (done or N/A) and the Design Lead approval recorded (CWA).
 * CONDITIONAL_PASS — progress with a written open-item list; every open item needs an owner and a date.
 * HOLD — record why.
 * Returns problems (empty = decision allowed).
 */
export function gateDecisionProblems(framework: string, items: ItemState[], decision: GateDecision, input: { notes?: string | null; openItems?: OpenItem[] }): string[] {
  const problems: string[] = []
  const unresolvedExit = items.filter((i) => i.kind === 'EXIT_CRITERION' && i.status === 'OPEN')
  if (decision === 'PASS') {
    if (unresolvedExit.length) problems.push(`${unresolvedExit.length} exit criteria still open — resolve them or use Conditional pass`)
    if (framework === 'CWA') {
      const lead = items.find((i) => i.kind === 'APPROVAL' && i.title.startsWith('5.'))
      if (lead && lead.status !== 'DONE') problems.push('CWA Design Lead approval is not recorded')
    }
  }
  if (decision === 'CONDITIONAL_PASS') {
    const open = input.openItems ?? []
    if (!open.length && !unresolvedExit.length) problems.push('A conditional pass needs a written open-item list')
    const incomplete = open.filter((o) => !o.title?.trim() || !o.assigneeId || !o.dueDate)
    if (incomplete.length) problems.push('Every open item needs a description, an owner and a due date')
  }
  if (decision === 'HOLD' && !input.notes?.trim()) problems.push('Say why the gate is on hold')
  return problems
}

export function statusForDecision(d: GateDecision) {
  return ({ PASS: 'PASSED', CONDITIONAL_PASS: 'CONDITIONAL', HOLD: 'HOLD' } as const)[d]
}

export function stageProgress(items: { status: string }[]) {
  const total = items.length
  const resolved = items.filter((i) => i.status !== 'OPEN').length
  return { total, resolved, pct: total ? Math.round((resolved / total) * 100) : 0 }
}
