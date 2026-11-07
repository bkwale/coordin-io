import { describe, it, expect } from 'vitest'
import { GB_FIXTURES, GB_RULE_IDS } from './gb.fixtures'
import { match } from '../engine'
import { GB_RULESET, gbPlanningRoute, gbIsHigherRisk } from '../datasets/gb'
import { getRuleSet, AVAILABLE_JURISDICTIONS } from '../index'
import { ProjectParametersSchema } from '../schema'

describe('England rule set (GB-ENG-1.0)', () => {
  it('is registered and available', () => {
    expect(getRuleSet('GB')).toBe(GB_RULESET)
    expect(AVAILABLE_JURISDICTIONS).toContain('GB')
  })

  it('has ≥ 60 fixtures over ≥ 9 disciplines, unique names', () => {
    expect(GB_FIXTURES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(GB_FIXTURES.map((f) => f.name)).size).toBe(GB_FIXTURES.length)
    const disciplines = new Set(GB_RULE_IDS.map((id) => id.split('.')[1]))
    expect(disciplines.size).toBeGreaterThanOrEqual(9)
  })

  it('every rule has a unique, well-formed ID, an English title, a citation and a source', () => {
    const ids = GB_RULESET.rules.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of GB_RULESET.rules) {
      expect(r.id).toMatch(/^GB\.[A-Z]+\.[A-Z0-9_]+$/)
      expect(r.jurisdiction).toBe('GB')
      expect(r.title.length).toBeGreaterThan(5)
      expect(r.citation.length).toBeGreaterThan(2)
      expect(r.source.length).toBeGreaterThan(3)
    }
  })

  it('defines every rule ID the fixtures reference, and every rule is exercised by a fixture', () => {
    const defined = new Set(GB_RULESET.rules.map((r) => r.id))
    expect(GB_RULE_IDS.filter((id) => !defined.has(id))).toEqual([])
    const used = new Set(GB_RULE_IDS)
    expect(GB_RULESET.rules.map((r) => r.id).filter((id) => !used.has(id))).toEqual([])
  })

  for (const f of GB_FIXTURES) {
    it(f.name, () => {
      const ids = new Set(match(f.params, GB_RULESET).map((c) => c.ruleId))
      for (const id of f.expect) expect(ids, `expected ${id}`).toContain(id)
      for (const id of f.absent ?? []) expect(ids, `did not expect ${id}`).not.toContain(id)
    })
  }

  it('exactly one planning route per extension project', () => {
    const route = ['GB.PLANNING.PERMITTED_DEVELOPMENT', 'GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL', 'GB.PLANNING.HOUSEHOLDER_APPLICATION', 'GB.PLANNING.FULL_APPLICATION']
    for (const depth of [1, 3, 4, 5, 6, 7, 8, 9, undefined]) {
      for (const buildingType of ['semi_detached', 'detached_house', 'terraced'] as const) {
        const items = match({ jurisdiction: 'GB', buildingType, workType: 'extension', grossFloorArea: 20, height: 3, storeys: 1, extensionDepth: depth }, GB_RULESET)
        expect(items.filter((i) => route.includes(i.ruleId)), `${buildingType} ${depth}`).toHaveLength(1)
      }
    }
  })

  it('exposes the planning route and HRB test', () => {
    expect(gbPlanningRoute({ jurisdiction: 'GB', buildingType: 'semi_detached', workType: 'extension', grossFloorArea: 18, height: 3, storeys: 1, extensionDepth: 5 })).toBe('larger_home_extension')
    expect(gbIsHigherRisk({ jurisdiction: 'GB', buildingType: 'apartment_block', workType: 'new_build', grossFloorArea: 5000, height: 19, storeys: 6, apartments: 40 })).toBe(true)
  })

  it('every checklist item carries the GB rule-set version', () => {
    const items = match(GB_FIXTURES[0].params, GB_RULESET)
    expect(items.every((i) => i.ruleSetVersion === 'GB-ENG-1.0')).toBe(true)
  })

  it('the API schema accepts the England questions and rejects bad flood zones', () => {
    expect(ProjectParametersSchema.safeParse({ ...GB_FIXTURES[0].params, floodZone: 3, siteAreaHa: 0.1, conservationArea: true }).success).toBe(true)
    expect(ProjectParametersSchema.safeParse({ ...GB_FIXTURES[0].params, floodZone: 4 }).success).toBe(false)
  })
})
