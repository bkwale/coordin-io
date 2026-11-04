import { describe, it, expect } from 'vitest'
import { parseAriregisterCard } from '@/lib/registry/ee'
import { overlayRegistryFacts, profileFromRegistry } from '@/lib/ai/registry-overlay'
import { mapPracticeProfile } from '@/lib/ai/map-practice'
import type { CompanyFacts } from '@/lib/registry'

// Synthetic card in the Äriregister layout. Names and the 11-digit code are fictional.
const CARD = `<html><head><title>Näidis Arhitektid OÜ &vert; e-Äriregister</title></head><body>
<script>var x = 1;</script>
<div>Registrikood</div><div>12345678</div><div>EUID</div><div>EEARIREG.12345678</div>
<div>Õiguslik vorm</div><div>Osaühing</div><div>Staatus</div><div>Registrisse kantud</div>
<div>Registrisse kantud (03.09.2012)</div><div>Osaühing</div><div>Osakapital on</div><div>2 500.00 €</div>
<div>Aadress</div><div>Tartu maakond, Tartu linn, Kesklinn, Rüütli tn 2, 51007</div><div>Ava kaart</div>
<div>Põhitegevusala</div><div>Tegevusala</div><div>(EMTAK 2025)</div><div>71111 - Arhitektitegevused</div><div>NACE kood</div><div>71.11</div>
<div>Mari Mets</div><div>48001010000</div><div>Juhatuse liige</div><div>03.09.2012</div>
<div>Jaan Tamm</div><div>38001010000</div><div>Juhatuse liige</div><div>01.01.2015</div>
</body></html>`

describe('Äriregister card parser', () => {
  const f = parseAriregisterCard(CARD, '12345678', 'https://ariregister.rik.ee/est/company/12345678/x')!
  it('extracts company facts', () => {
    expect(f.legalName).toBe('Näidis Arhitektid OÜ')
    expect(f.registryCode).toBe('12345678')
    expect(f.status).toBe('active')
    expect(f.legalForm).toBe('Osaühing')
    expect(f.registeredAt).toBe('2012-09-03')
    expect(f.city).toBe('Tartu linn')
    expect(f.postcode).toBe('51007')
    expect(f.activity).toEqual({ code: '71111', label: 'Arhitektitegevused', scheme: 'EMTAK' })
    expect(f.isArchitecturePractice).toBe(true)
    expect(f.capital).toBe('2 500.00 €')
  })
  it('takes board member NAMES and never the personal ID code', () => {
    expect(f.board).toEqual(['Mari Mets', 'Jaan Tamm'])
    expect(JSON.stringify(f)).not.toMatch(/\d{11}/)
  })
  it('returns null when there is no company title', () => {
    expect(parseAriregisterCard('<html><title></title></html>', '1', 'x')).toBeNull()
  })
})

const FACTS: CompanyFacts = {
  jurisdiction: 'EE', registryCode: '12345678', legalName: 'Näidis Arhitektid OÜ', historicalNames: [], status: 'active', statusRaw: 'Registrisse kantud',
  legalForm: 'Osaühing', registeredAt: '2012-09-03', address: 'Rüütli tn 2, 51007', city: 'Tartu linn', postcode: '51007',
  activity: { code: '71111', label: 'Arhitektitegevused', scheme: 'EMTAK' }, isArchitecturePractice: true, board: ['Mari Mets', 'Jaan Tamm'],
  capital: null, sourceUrl: 'https://ariregister.rik.ee/est/company/12345678/x', fetchedAt: '2026-11-04T00:00:00Z',
}

describe('registry overlay', () => {
  it('profileFromRegistry builds a valid profile with no model, mapper picks EE jurisdiction', () => {
    const p = profileFromRegistry(FACTS)
    expect(p.practice.legalName).toMatchObject({ value: 'Näidis Arhitektid OÜ', confidence: 1 })
    expect(p.practice.tradingName.value).toBe('Näidis Arhitektid')
    expect(p.practice.founded).toMatchObject({ value: 2012, confidence: 1 })
    expect(p.practice.country.value).toBe('EE')
    expect(p.people.map((x) => x.name)).toEqual(['Mari Mets', 'Jaan Tamm'])
    expect(p.people.every((x) => x.partner && x.confidence === 1)).toBe(true)
    const m = mapPracticeProfile(p)
    expect(m.jurisdiction).toBe('EE')
    expect(m.modules.length).toBeGreaterThan(0)
  })
  it('overlay: registry beats website on legal facts, keeps website-only facts, merges people without duplicates', () => {
    const web = profileFromRegistry({ ...FACTS, legalName: 'Wrong Name OÜ', board: [] })
    web.practice.legalName = { value: 'Wrong Name OÜ', confidence: 0.6, source: 'https://naidis.ee' }
    web.practice.website = { value: 'https://naidis.ee', confidence: 1, source: 'https://naidis.ee' }
    web.practice.founded = { value: 2010, confidence: 0.4, source: 'https://naidis.ee' }
    web.people = [{ name: 'mari mets', role: 'Architect', chartered: null, partner: false, onLeave: false, confidence: 0.8, source: 'https://naidis.ee' }]
    const out = overlayRegistryFacts(web, FACTS)
    expect(out.practice.legalName.value).toBe('Näidis Arhitektid OÜ')
    expect(out.practice.founded?.value).toBe(2012)
    expect(out.practice.website.value).toBe('https://naidis.ee') // untouched
    expect(out.people).toHaveLength(2)
    expect(out.people.find((x) => x.name === 'mari mets')).toMatchObject({ partner: true, role: 'Architect', confidence: 1 })
    expect(out.people.find((x) => x.name === 'Jaan Tamm')).toMatchObject({ role: 'Juhatuse liige' })
  })
})
