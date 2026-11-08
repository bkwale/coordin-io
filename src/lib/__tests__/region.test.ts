import { describe, it, expect } from 'vitest'
import { countryCode, orgCountry, defaultJurisdiction, resolveCurrency, vatRateFor, COUNTRIES } from '../region'

describe('region', () => {
  it('reads country text as stored in the database', () => {
    expect(countryCode('Estonia')).toBe('EE')
    expect(countryCode('EE')).toBe('EE')
    expect(countryCode('England')).toBe('GB')
    expect(countryCode('United Kingdom')).toBe('GB')
    expect(countryCode('Nigeria')).toBe('NG')
    expect(countryCode('Spain')).toBeNull()
    expect(countryCode(null)).toBeNull()
  })
  it('works out the firm country: settings, sandbox, head office, then currency', () => {
    expect(orgCountry({ settings: { country: 'EE' }, defaultCurrency: 'NGN' })).toBe('EE')
    expect(orgCountry({ settings: { sandbox: { region: 'GB' } } })).toBe('GB')
    expect(orgCountry({ settings: { sandbox: { region: 'GB', convertedAt: 'x' } }, offices: [{ country: 'EE' }] })).toBe('EE')
    expect(orgCountry({ offices: [{ country: 'United Kingdom' }, { country: 'Nigeria', isHeadOffice: true }] })).toBe('NG')
    expect(orgCountry({ defaultCurrency: 'GBP', offices: [{ country: null }] })).toBe('GB')
    expect(orgCountry({ defaultCurrency: 'EUR' })).toBeNull()
  })
  it('opens the questionnaire on the project country first, then the firm', () => {
    expect(defaultJurisdiction({ siteCountry: 'United Kingdom', orgCountry: 'EE' })).toBe('GB')
    expect(defaultJurisdiction({ projectJurisdiction: 'Nigeria-Lagos', orgCountry: 'EE' })).toBeNull()
    expect(defaultJurisdiction({ orgCountry: 'EE' })).toBe('EE')
    expect(defaultJurisdiction({})).toBeNull()
  })
  it('picks currency and VAT by country', () => {
    expect(resolveCurrency(undefined, null, 'GBP')).toBe('GBP')
    expect(resolveCurrency('XYZ')).toBe('EUR')
    expect(vatRateFor('EE')).toBe(24)
    expect(vatRateFor('GB')).toBe(20)
    expect(vatRateFor(null)).toBeNull()
    expect(COUNTRIES.NG.stageFramework).toBe('NIGERIAN_CWA')
  })
})
