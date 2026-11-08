import { describe, it, expect } from 'vitest'
import { wizardPrefill, readingSummary } from '../wizard-prefill'
import type { ProjectSetupMapping } from '../map-project'

const base = (over: Partial<ProjectSetupMapping> = {}): ProjectSetupMapping => ({
  kind: 'planning_conditions',
  document: { number: '2699999/00042', issuer: 'Viimsi Vallavalitsus', issuedAt: '2026-09-01', validUntil: null, legalBasis: null, ehrCode: null, address: 'Kaluri tee 7, Haabneeme alevik, Viimsi vald', projectName: null, client: 'Mari Tamm' },
  prefills: [
    { key: 'buildingType', value: 'detached_house', kind: 'value', label: '', because: '', confidence: 0.9, page: 1, quote: 'üksikelamu', preAccept: true },
    { key: 'workType', value: 'new_build', kind: 'value', label: '', because: '', confidence: 0.9, page: 1, quote: '', preAccept: true },
    { key: 'storeys', value: 2, kind: 'value', label: '', because: '', confidence: 0.4, page: 1, quote: '', preAccept: false },
    { key: 'height', value: 8.5, kind: 'bound', label: '≤ 8.5 m', because: '', confidence: 0.9, page: 1, quote: '', preAccept: false },
  ],
  conditions: [{ topic: 'Parking', text: '2 spaces on the plot', page: 2, mandatory: true, citation: 'PT p.2', source: 'PT' } as never],
  bounds: { maxHeightM: 8.5, maxStoreys: 2, maxFootprint: null, minSetbackM: null },
  warnings: [],
  ...over,
})

describe('wizardPrefill', () => {
  it('moves plain project facts only', () => {
    const f = wizardPrefill(base())
    expect(f).toMatchObject({ name: 'Kaluri tee 7', clientBrand: 'Mari Tamm', siteAddress: 'Kaluri tee 7, Haabneeme alevik, Viimsi vald', planningAuthority: 'Viimsi Vallavalitsus', projectType: 'RESIDENTIAL', developmentType: 'NEW_BUILD' })
  })
  it('skips uncertain values and never turns a limit into a design value', () => {
    const f = wizardPrefill(base())
    expect(f.numberOfFloors).toBeUndefined() // storeys not confident
    expect(JSON.stringify(f)).not.toContain('8.5')
  })
  it('prefers the project name in a brief, and finds the city in an English address', () => {
    const f = wizardPrefill(base({ kind: 'brief', document: { ...base().document, projectName: 'Clifton Mews', address: '4 Clifton Mews, Bristol BS8 1AA', issuer: null } }))
    expect(f.name).toBe('Clifton Mews')
    expect(f.siteCity).toBe('Bristol')
  })
  it('summarises what was found for the wizard', () => {
    const s = readingSummary(base())
    expect(s.conditions).toBe(1)
    expect(s.limits).toBe(2)
    expect(s.facts.some((x) => x.includes('PT nr 2699999/00042'))).toBe(true)
  })
})
