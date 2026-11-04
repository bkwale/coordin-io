/**
 * Sprint 0.5 fixtures → Sprint 2 engine. These tests are expected to FAIL until src/lib/rules/engine.ts
 * and src/lib/rules/datasets/ee.ts exist. They are the contract.
 */
import { describe, it, expect } from 'vitest'
import { EE_FIXTURES, EE_RULE_IDS } from './ee.fixtures'

let match: ((p: any, rs: any) => { ruleId: string }[]) | null = null
let EE_RULESET: any = null
try {
  // Deferred (and path-indirected) so the fixture file is useful — and type-checks — before the engine exists.
  const enginePath = '../engine', datasetPath = '../datasets/ee'
  match = (await import(/* @vite-ignore */ enginePath)).match
  EE_RULESET = (await import(/* @vite-ignore */ datasetPath)).EE_RULESET
} catch {
  /* engine not built yet */
}

describe('EE rules fixtures (contract)', () => {
  it('has ≥ 60 fixtures covering 10 disciplines', () => {
    expect(EE_FIXTURES.length).toBeGreaterThanOrEqual(60)
    const disciplines = new Set(EE_RULE_IDS.map((id) => id.split('.')[1]))
    expect(disciplines.size).toBeGreaterThanOrEqual(10)
  })

  it('every fixture has a unique name', () => {
    const names = EE_FIXTURES.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('references a stable set of rule IDs', () => {
    expect(EE_RULE_IDS.length).toBeGreaterThanOrEqual(80)
    for (const id of EE_RULE_IDS) expect(id).toMatch(/^EE\.[A-Z]+\.[A-Z0-9_]+$/)
  })
})

const engineReady = match && EE_RULESET
;(engineReady ? describe : describe.skip)('EE rules engine', () => {
  it('defines every rule ID the fixtures reference', () => {
    const defined = new Set(EE_RULESET.rules.map((r: any) => r.id))
    const missing = EE_RULE_IDS.filter((id) => !defined.has(id))
    expect(missing).toEqual([])
  })

  for (const f of EE_FIXTURES) {
    it(f.name, () => {
      const ids = new Set(match!(f.params, EE_RULESET).map((c) => c.ruleId))
      for (const id of f.expect) expect(ids, `expected ${id}`).toContain(id)
      for (const id of f.absent ?? []) expect(ids, `did not expect ${id}`).not.toContain(id)
    })
  }
})
