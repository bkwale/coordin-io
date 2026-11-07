/**
 * Mask personal data before a document leaves the EU (fallback model only).
 * Deterministic and conservative: it removes contact details, personal ID numbers, bank details
 * and the names that follow common labels. Addresses, plan numbers, dates and measurements stay —
 * the model needs those to read planning documents.
 */

const digitsIn = (s: string) => s.replace(/\D/g, '').length

/** Words that end a name: label words, organisation words, common document nouns. */
const NOT_A_NAME = /^(date|address|report|ref|reference|no|number|tel|telephone|phone|email|e-mail|council|borough|district|county|city|authority|committee|department|planning|services|team|ltd|limited|plc|llp|oü|as|mtü|vald|vallavalitsus|linnavalitsus|linn|valitsus|amet|keskus|kuupäev|aadress|telefon|e-post|the|and|of|for|on|at|approved|refused|granted)$/i

/** If any of these follow the label, it is an organisation, not a person — leave it alone. */
const ORGANISATION = /^(council|borough|district|county|authority|committee|department|ltd|limited|plc|llp|inc|gmbh|oü|as|mtü|sa|vald|vallavalitsus|linnavalitsus|valitsus|amet|keskus|ministeerium|ministry|trust|association|partnership|architects?|arhitektid|bureau|büroo|group|council's)$/i

/** A labelled personal name: label + colon, optional title, then capitalised words or initials. */
const LABEL = String.raw`(?:(?:Case|Contact|Planning|Responsible|Principal)\s+)?(?:Applicant|Agent|Owner|Client|Contact|Officer|Case officer|Prepared by|Signed|Signed by|Attn|Name|Applicant name|Agent name|Taotleja|Omanik|Esindaja|Kontaktisik|Koostaja|Allkirjastaja|Projekteerija|Tellija|Nimi|Ees- ja perekonnanimi)(?:\s+name|\s+nimi)?`
const LABELLED_NAME = new RegExp(String.raw`\b(${LABEL})([ \t]*:[ \t]*)((?:Mr|Mrs|Ms|Miss|Dr)\.?[ \t]+)?((?:[A-ZÀ-ÖØ-ÞŠŽÕÄÖÜ](?:[\p{L}'’-]+|\.)?[ \t]?){1,4})`, 'gu')

type Rule = (text: string, count: () => void) => string

const RULES: Rule[] = [
  // e-mail
  (t, c) => t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => (c(), '[email]')),
  // IBAN (EE, GB, DE …)
  (t, c) => t.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g, () => (c(), '[iban]')),
  // Estonian personal ID code (isikukood): 11 digits, first digit 1–6, valid month/day
  (t, c) => t.replace(/\b[1-6]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{4}\b/g, () => (c(), '[id-code]')),
  // UK National Insurance number — spaced form, or after an NI label (bare 2+6+1 strings are often document refs)
  (t, c) => t.replace(/\b[A-CEGHJ-PR-TW-Z]{2} \d{2} \d{2} \d{2} [A-D]\b/g, () => (c(), '[ni-number]')),
  (t, c) => t.replace(/\b(NI(?:NO| number| no\.?)?|National Insurance(?: number)?)([ \t]*:?[ \t]*)[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, (_m, l, sep) => (c(), `${l}${sep}[ni-number]`)),
  // phone numbers — phone-shaped runs only, so drawing numbers, dates, heights and references survive
  (t, c) => t.replace(/\+\d{1,3}[ \t-]?(?:\(\d{1,5}\)[ \t-]?)?\d{1,5}(?:[ \t-]?\d{2,5}){1,4}/g, (m) => {
    const n = digitsIn(m); if (n < 8 || n > 15) return m
    c(); return '[phone]'
  }),
  (t, c) => t.replace(/(?<![\d/.-])\(?0\d{2,4}\)?[ \t-]?\d{3,4}[ \t-]?\d{3,4}(?![\d/.-])/g, (m) => {
    const n = digitsIn(m); if (n < 10 || n > 11) return m
    c(); return '[phone]'
  }),
  (t, c) => t.replace(/(?<![\d/.-])5\d{2,3}[ \t]\d{4}(?![\d/.-])/g, () => (c(), '[phone]')),
  // labelled names (EN + ET): keep the label, mask the name words, stop at label/organisation words
  (t, c) => t.replace(LABELLED_NAME, (m, label: string, sep: string, title: string | undefined, name: string) => {
    const words = name.trim().split(/[ \t]+/)
    if (words.some((w) => ORGANISATION.test(w.replace(/[.,]$/, '')))) return m
    const keep: string[] = []
    for (const w of words) { if (NOT_A_NAME.test(w.replace(/[.,]$/, ''))) break; keep.push(w) }
    if (keep.length === 0) return m
    const rest = name.slice(name.indexOf(keep[keep.length - 1]) + keep[keep.length - 1].length)
    c()
    return `${label}${sep}${title ?? ''}[name]${rest}`
  }),
  // titled names anywhere: Mr John Smith, Dr J. Smith
  (t, c) => t.replace(/\b(Mr|Mrs|Ms|Miss|Dr)\.?[ \t]+(?!\[name\])((?:[A-Z](?:[\p{L}'’-]+|\.)?[ \t]?){1,3})/gu, (m, title: string, name: string) => {
    const first = name.trim().split(/[ \t]+/)[0]
    if (NOT_A_NAME.test(first)) return m
    c(); return `${title} [name]${/[ \t]$/.test(name) ? ' ' : ''}`
  }),
]

export function maskPersonalData(text: string): { text: string; masked: number } {
  let masked = 0
  const count = () => { masked++ }
  let out = text
  for (const rule of RULES) out = rule(out, count)
  return { text: out, masked }
}
