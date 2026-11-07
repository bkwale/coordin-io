import { describe, it, expect } from 'vitest'
import { maskPersonalData } from '../pii-mask'

describe('maskPersonalData — before a document leaves the EU', () => {
  it('masks contact details, ID codes, IBANs and labelled names', () => {
    const src = [
      'Applicant: Mr Joe Daggett',
      'Taotleja: Mari Tamm, isikukood 48501234215',
      'Email: planning@camden.gov.uk  Tel: 020 7974 4444  Mob: +372 5123 4567',
      'IBAN EE38 2200 2210 2014 5685',
      'NI number AB 12 34 56 C',
      'Dear Sir/Madam',
    ].join('\n')
    const { text, masked } = maskPersonalData(src)
    for (const leak of ['Daggett', 'Mari Tamm', '48501234215', 'planning@camden', '7974 4444', '5123 4567', 'EE38 2200', 'AB 12 34']) expect(text, leak).not.toContain(leak)
    expect(text).toContain('Applicant: Mr [name]')
    expect(masked).toBeGreaterThanOrEqual(7)
  })
  it('keeps what the model needs to read a planning document', () => {
    const src = 'Application No: 22/4128. Date: 13/06/2023. Height 6.5 m, 3 storeys, 105 litres per person per day. Drawing 1463-101 Rev. G. 776 & 778, Harrow Road, Wembley, HA0 2HE. EHR kood 120345678. Katastritunnus 79501:003:0123. 2026-06-12'
    expect(maskPersonalData(src).text).toBe(src)
  })
})
