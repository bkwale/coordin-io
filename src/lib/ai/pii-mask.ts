/**
 * Mask personal data before a document leaves the EU (fallback model only).
 * Deterministic and conservative: it removes contact details, personal ID numbers, bank details
 * and the names that follow common labels. Addresses, plan numbers, dates and measurements stay —
 * the model needs those to read planning documents.
 */
const RULES: Array<[RegExp, string]> = [
  // e-mail
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // IBAN (EE, GB, DE … 15–34 chars, optional spaces)
  [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g, '[iban]'],
  // Estonian personal ID code (isikukood): 11 digits, first digit 1–6
  [/\b[1-6]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{4}\b/g, '[id-code]'],
  // UK National Insurance number
  [/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g, '[ni-number]'],
  // phone numbers — only phone-shaped runs, so drawing numbers, dates and references survive:
  // international (+44 20 7974 4444, +372 5123 4567), UK national (020 7974 4444, 07700 900123), Estonian mobile (5123 4567)
  [/\+\d{1,3}[ \t-]?(?:\(\d{1,5}\)[ \t-]?)?\d{1,5}(?:[ \t-]?\d{2,5}){1,4}/g, '[phone]'],
  [/(?<![\d/-])\(?0\d{2,4}\)?[ \t-]?\d{3,4}[ \t-]?\d{3,4}(?![\d/-])/g, '[phone]'],
  [/(?<![\d/-])5\d{2,3}[ \t]\d{4}(?![\d/-])/g, '[phone]'],
  // names after labels (EN + ET). Keeps the label, masks up to 4 capitalised words.
  [/\b(Applicant|Agent|Owner|Client|Contact|Case officer|Officer|Prepared by|Signed|Dear|To|Attn|Taotleja|Omanik|Esindaja|Kontaktisik|Koostaja|Allkirjastaja|Projekteerija|Tellija)([ \t]*[:\-–]?[ \t]*)((?:Mr|Mrs|Ms|Miss|Dr)\.?[ \t]+)?((?:[A-ZÀ-ÖØ-ÞŠŽÕÄÖÜ][\p{L}'’-]+[ \t]?){1,4})/gu, '$1$2$3[name]'],
  // titled names anywhere: Mr John Smith
  [/\b(Mr|Mrs|Ms|Miss|Dr)\.?[ \t]+(?!\[name\])(?:[A-Z][\p{L}'’-]+[ \t]?){1,3}/gu, '$1 [name]'],
]

export function maskPersonalData(text: string): { text: string; masked: number } {
  let masked = 0
  let out = text
  for (const [re, rep] of RULES) {
    out = out.replace(re, (...args) => {
      masked++
      return rep.replace(/\$(\d)/g, (_, i) => (args[Number(i)] as string | undefined) ?? '')
    })
  }
  return { text: out, masked }
}
