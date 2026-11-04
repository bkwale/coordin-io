/**
 * Rules engine — deterministic matcher. No LLM. Pure function.
 *
 *   match(parameters, ruleSet) → ChecklistItem[]   (ordered by discipline, then rule order in the dataset)
 *
 * Every item carries its citation and the rule-set version so the audit trail can answer
 * "on what basis did you determine this applied?"
 */
import type { ChecklistItem, ProjectParameters, Rule, RuleSet } from './types'

const DISCIPLINE_ORDER: Rule['discipline'][] = ['permit', 'planning', 'design', 'supervision', 'fire', 'energy', 'sound', 'accessibility', 'infrastructure', 'environment']

export function match(params: ProjectParameters, ruleSet: RuleSet): ChecklistItem[] {
  if (params.jurisdiction !== ruleSet.jurisdiction) {
    throw new Error(`RuleSet is for ${ruleSet.jurisdiction}; project is ${params.jurisdiction}`)
  }
  const items: ChecklistItem[] = []
  for (const rule of ruleSet.rules) {
    let applies = false
    try { applies = rule.applies(params) } catch { applies = false }
    if (!applies) continue
    items.push({
      ruleId: rule.id,
      discipline: rule.discipline,
      title: rule.title,
      titleLocal: rule.titleLocal,
      citation: rule.citation,
      source: rule.source,
      requirement: rule.requirement,
      because: safe(() => rule.because?.(params)),
      confidence: rule.confidence,
      ruleSetVersion: ruleSet.version,
    })
  }
  return items.sort((a, b) => DISCIPLINE_ORDER.indexOf(a.discipline) - DISCIPLINE_ORDER.indexOf(b.discipline))
}

/** Group a checklist by discipline for rendering. */
export function groupByDiscipline(items: ChecklistItem[]): Record<string, ChecklistItem[]> {
  const out: Record<string, ChecklistItem[]> = {}
  for (const i of items) (out[i.discipline] ??= []).push(i)
  return out
}

/** Diff two checklists (e.g. after a design change) — new, removed, unchanged rule IDs. */
export function diffChecklists(before: ChecklistItem[], after: ChecklistItem[]) {
  const b = new Set(before.map((i) => i.ruleId)), a = new Set(after.map((i) => i.ruleId))
  return {
    added: after.filter((i) => !b.has(i.ruleId)),
    removed: before.filter((i) => !a.has(i.ruleId)),
    unchanged: after.filter((i) => b.has(i.ruleId)),
  }
}

function safe<T>(fn: () => T): T | undefined { try { return fn() } catch { return undefined } }
