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
  it('handles compound labels, initials and Estonian name fields', () => {
    const { text } = maskPersonalData('Contact Officer: Jane Doe\nCase officer: Matthew Dempsey\nNimi: Mari Tamm\nName: John Smith\nSigned: J Smith\nApplicant name: Joe Bloggs')
    for (const leak of ['Jane Doe', 'Matthew Dempsey', 'Mari Tamm', 'John Smith', 'J Smith', 'Joe Bloggs']) expect(text, leak).not.toContain(leak)
  })
  it('does not eat label words, organisations or measurements', () => {
    const src = 'Officer Report Date: 12 May 2025\nAgent Address: 11 - 13 Batemans Row\nOwner: Tallinna Linnavalitsus approved\nTo: Planning Committee\nHeight: +12 345\nDoc ref AB123456C\nDear Sir/Madam'
    const { text } = maskPersonalData(src)
    expect(text).toContain('Officer Report Date: 12 May 2025')
    expect(text).toContain('Agent Address: 11 - 13 Batemans Row')
    expect(text).toContain('Tallinna Linnavalitsus approved')
    expect(text).toContain('To: Planning Committee')
    expect(text).toContain('Height: +12 345')
    expect(text).toContain('Doc ref AB123456C')
  })
})
