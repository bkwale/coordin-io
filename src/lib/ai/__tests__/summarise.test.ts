import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { docxToPages, docxXmlToPages, sniffZip } from '../docx'
import { around, repeats, resolveLanguage, chunkPages, checkItem, checkSummary, checkContradictions, readDocumentPages, sectionSize, SECTION_CHARS, SECTION_CHARS_MAX } from '../summary-core'
import { DocumentSummarySchema, SectionNotesSchema, ContradictionsSchema, normaliseSummary, normaliseNotes, normaliseContradictions } from '../schemas-summary'
import { IngestError, cleanText } from '../document-ingest'

/** Smallest valid ZIP with the given entries (deflated), enough for the reader under test. */
function zip(entries: Record<string, string>, opts: { store?: boolean } = {}): Uint8Array {
  const enc = new TextEncoder()
  const locals: Buffer[] = [], centrals: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.from(enc.encode(content))
    const data = opts.store ? raw : deflateRawSync(raw)
    const nameB = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(opts.store ? 0 : 8, 8)
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameB.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(opts.store ? 0 : 8, 10)
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameB.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, nameB, data); centrals.push(central, nameB)
    offset += 30 + nameB.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8); eocd.writeUInt16LE(Object.keys(entries).length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]))
}
const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
const doc = (inner: string) => `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${inner}</w:body></w:document>`
const filler = 'Projekteerija esitab eelprojekti tellijale läbivaatamiseks kokkulepitud tähtajaks. '.repeat(6)

describe('Word reader', () => {
  it('reads paragraphs, entities and Estonian letters from a deflated .docx', () => {
    const bytes = zip({ '[Content_Types].xml': '<x/>', 'word/document.xml': doc(p('Koosoleku protokoll nr 7') + p('Tööd &amp; tähtajad: õ ä ö ü š ž') + p(filler)) })
    expect(sniffZip(bytes)).toBe(true)
    const text = docxToPages(bytes).join('\n')
    expect(text).toContain('Koosoleku protokoll nr 7')
    expect(text).toContain('Tööd & tähtajad: õ ä ö ü š ž')
  })
  it('reads a stored (uncompressed) entry too', () => {
    expect(docxToPages(zip({ 'word/document.xml': doc(p('Stored entry') + p(filler)) }, { store: true })).join(' ')).toContain('Stored entry')
  })
  it('honours page breaks', () => {
    const xml = doc(p('Page one text ' + filler) + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + p('Page two text ' + filler))
    const pages = docxXmlToPages(xml)
    expect(pages).toHaveLength(2)
    expect(pages[1]).toContain('Page two text')
  })
  it('keeps a table row on one line', () => {
    const xml = doc(`<w:tbl><w:tr><w:tc>${p('Tegevus')}</w:tc><w:tc>${p('Vastutaja')}</w:tc></w:tr><w:tr><w:tc>${p('Geoloogia tellimine')}</w:tc><w:tc>${p('Mari Tamm')}</w:tc></w:tr></w:tbl>` + p(filler))
    expect(docxXmlToPages(xml).join('\n')).toMatch(/Geoloogia tellimine \| Mari Tamm/)
  })
  it('splits a document with no page breaks into even pages', () => {
    const pages = docxXmlToPages(doc(Array.from({ length: 120 }, (_, i) => p(`Lõik ${i}. ${filler}`)).join('')))
    expect(pages.length).toBeGreaterThan(5)
  })
  it('refuses a zip that is not a Word file, and non-zip bytes', () => {
    expect(() => docxToPages(zip({ 'xl/workbook.xml': '<x/>' }))).toThrow(IngestError)
    expect(() => docxToPages(new TextEncoder().encode('hello'))).toThrow(IngestError)
  })
  it('refuses an almost empty file', () => {
    expect(() => docxToPages(zip({ 'word/document.xml': doc(p('Hi')) }))).toThrow(/almost no text/)
  })
  it('readDocumentPages picks the reader from the bytes, not the name', async () => {
    const r = await readDocumentPages(zip({ 'word/document.xml': doc(p('Tehniline kirjeldus') + p(filler)) }), 'looks-like.pdf')
    expect(r.format).toBe('docx')
    await expect(readDocumentPages(new TextEncoder().encode('MZ binary'), 'tool.exe')).rejects.toThrow(/Only PDF and Word/)
  })
})

describe('sections for long documents', () => {
  const pages = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, text: 'x'.repeat(15_000) }))
  it('keeps pages whole, in order, within the size', () => {
    const sections = chunkPages(pages, 40_000)
    expect(sections.flat().map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const s of sections) expect(s.reduce((a, x) => a + x.text.length, 0)).toBeLessThanOrEqual(40_000)
    expect(sections).toHaveLength(5)
  })
  it('section size: small for recall, larger for long documents, capped', () => {
    expect(sectionSize(20_000)).toBe(SECTION_CHARS)
    expect(sectionSize(200_000)).toBe(25_000)
    expect(sectionSize(900_000)).toBe(SECTION_CHARS_MAX)
  })
  it('an oversized page is its own section', () => {
    const s = chunkPages([{ n: 1, text: 'a'.repeat(90_000) }, { n: 2, text: 'b' }])
    expect(s.map((x) => x.map((y) => y.n))).toEqual([[1], [2]])
  })
})

describe('checking quotes against the document', () => {
  const pages = [
    'Tellija: Kodu Arendus OÜ. Hoone suurim lubatud kõrgus on 9 m maapinnast.',
    'Projekteerija esitab eelprojekti hiljemalt 15.12.2026. Parkimiskohti peab olema vähemalt 2.',
    'Otsustati: fassaadi viimistlus on puitlaudis. Järgmine koosolek toimub 12.01.2027.',
  ].map(cleanText).map((s) => s.toLowerCase())
  const item = (quote: string | null, page: number | null) => ({ text: 't', page, quote })

  it('quote on the cited page is verified', () => expect(checkItem(item('suurim lubatud kõrgus on 9 m', 1), pages)).toMatchObject({ verified: true, page: 1 }))
  it('ignores case, spacing and quote marks', () => expect(checkItem(item('Suurim  lubatud\nkõrgus on 9 m', 1), pages).verified).toBe(true))
  it('quote on another page: page corrected', () => expect(checkItem(item('eelprojekti hiljemalt 15.12.2026', 1), pages)).toMatchObject({ verified: true, page: 2 }))
  it('quote nowhere in the document: kept but unverified', () => expect(checkItem(item('kõrgus on 12 m maapinnast', 1), pages)).toMatchObject({ verified: false, page: 1 }))
  it('a changed number is not verified', () => expect(checkItem(item('vähemalt 3', 2), pages).verified).toBe(false))
  it('no quote: unverified', () => expect(checkItem(item(null, 2), pages).verified).toBe(false))
  it('page outside the document is removed', () => expect(checkItem(item('nothing here at all', 99), pages)).toMatchObject({ page: null, verified: false }))
  it('a quote shortened with [...] is verified when every piece is on the page, in order', () => {
    expect(checkItem(item('Projekteerija esitab eelprojekti [...] Parkimiskohti peab olema vähemalt 2', 2), pages).verified).toBe(true)
    expect(checkItem(item('Parkimiskohti peab olema … Projekteerija esitab eelprojekti', 2), pages).verified).toBe(false) // wrong order
    expect(checkItem(item('Projekteerija esitab eelprojekti ... fassaadi viimistlus on puitlaudis', 2), pages).verified).toBe(false) // pieces from two pages
  })
  it('quote running over a page break is verified', () => expect(checkItem(item('olema vähemalt 2. otsustati: fassaadi', 2), pages).verified).toBe(true))

  it('checkSummary counts unverified items and says so', () => {
    const raw = ['Hoone suurim lubatud kõrgus on 9 m maapinnast.', 'Projekteerija esitab eelprojekti hiljemalt 15.12.2026.']
    const m = checkSummary({
      title: 'PT', documentType: 'permit', language: 'et', summary: 's',
      keyPoints: [{ text: 'Kõrgus kuni 9 m', page: 1, quote: 'suurim lubatud kõrgus on 9 m' }],
      decisions: [{ text: 'Made up', page: 1, quote: 'seda lauset dokumendis ei ole' }],
      actions: [{ text: 'Esita eelprojekt', owner: 'Projekteerija', due: '15.12.2026', page: 2, quote: 'esitab eelprojekti hiljemalt 15.12.2026' }],
      openQuestions: [],
      warnings: [],
    }, raw, { sections: 1, truncated: true, engineWarnings: ['1 passage in this document addressed an AI system and was ignored.'] })
    expect(m.coverage).toEqual({ pages: 2, sections: 1, truncated: true, unverified: 1 })
    expect(m.decisions[0].verified).toBe(false)
    expect(m.actions[0]).toMatchObject({ verified: true, owner: 'Projekteerija', due: '15.12.2026' })
    expect(m.warnings[0]).toMatch(/Only the first 2 pages/)
    expect(m.warnings.join(' ')).toMatch(/addressed an AI/)
    expect(m.warnings.join(' ')).toMatch(/1 item could not be matched/)
  })
})

describe('summary normaliser', () => {
  it('accepts sloppy model output and makes it schema-valid', () => {
    const v = DocumentSummarySchema.safeParse(normaliseSummary({
      title: ' Protokoll ', type: 'Minutes', language: 'ET', summary: 'Kokkuvõte.',
      points: ['Lihtne punkt', { point: 'Kõrgus 9 m', page: 'p. 3', quote: 'kõrgus 9 m' }, null, { page: 2 }],
      decisions: [{ decision: 'Fassaad puidust', page: 4, quote: 'x'.repeat(900) }],
      actionItems: [{ task: 'Telli geoloogia', who: 'Mari Tamm', deadline: '01.12.2026', page: '5' }],
      warnings: ['mustand', 7],
    }))
    expect(v.success).toBe(true)
    if (!v.success) return
    expect(v.data.documentType).toBe('minutes')
    expect(v.data.keyPoints).toEqual([{ text: 'Lihtne punkt', page: null, quote: null }, { text: 'Kõrgus 9 m', page: 3, quote: 'kõrgus 9 m' }])
    expect(v.data.decisions[0].quote).toHaveLength(400)
    expect(v.data.actions[0]).toEqual({ text: 'Telli geoloogia', page: 5, quote: null, owner: 'Mari Tamm', due: '01.12.2026' })
    expect(v.data.warnings).toEqual(['mustand', '7'])
  })
  it('unknown document type becomes other; an empty summary fails the schema', () => {
    expect((normaliseSummary({ documentType: 'memo', summary: 'x' }) as { documentType: string }).documentType).toBe('other')
    expect(DocumentSummarySchema.safeParse(normaliseSummary({ summary: '' })).success).toBe(false)
  })
  it('section notes normalise the same way', () => {
    expect(SectionNotesSchema.safeParse(normaliseNotes({ summary: 'Osa 2', keyPoints: ['a'], actions: [{ action: 'b', owner: null }] })).success).toBe(true)
  })
})

describe('figures that disagree', () => {
  const pages = ['Katuse soojusläbivuse sihtväärtus on U = 0,10 W/(m²K). Välisseina U = 0,16 W/(m²K).', 'Hoones on 24 korterit.', 'Katuse U-arv on 0,12 W/(m²K) kogu katuse ulatuses.']
  const side = (value: string, page: number, quote: string) => ({ value, page, quote })
  it('keeps one where both quotes are in the document and the values differ', () => {
    const out = checkContradictions([{ subject: 'Katuse U-arv', a: side('0,10 W/(m²K)', 1, 'sihtväärtus on U = 0,10 W/(m²K)'), b: side('0,12 W/(m²K)', 3, 'Katuse U-arv on 0,12 W/(m²K)') }], pages)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ subject: 'Katuse U-arv', a: { page: 1 }, b: { page: 3 } })
  })
  it('drops one whose quote is not in the document', () => {
    expect(checkContradictions([{ subject: 'Korterite arv', a: side('24', 2, 'Hoones on 24 korterit'), b: side('26', 3, 'Hoones on 26 korterit') }], pages)).toEqual([])
  })
  it('drops one where the values are the same, or the quote does not contain the value', () => {
    expect(checkContradictions([{ subject: 'Katus', a: side('0,10', 1, 'sihtväärtus on U = 0,10 W/(m²K)'), b: side('0.10 W/(m²K)', 1, 'sihtväärtus on U = 0,10 W/(m²K)') }], pages)).toEqual([])
    expect(checkContradictions([{ subject: 'Katus', a: side('0,10', 1, 'sihtväärtus on U = 0,10 W/(m²K)'), b: side('0,12', 2, 'Hoones on 24 korterit') }], pages)).toEqual([])
  })
  it('drops different units, a side with several numbers, and lists the same pair once', () => {
    const p2 = ['Hoone brutopind on 2 180 m2. See on 80-leheküljeline seletuskiri. Hoones on 24 korterit.', 'Korterid: 6 ühetoalist, 12 kahetoalist ja 6 kolmetoalist. Katuse U on 0,10 W/(m2K).', 'Katuse U-arv on 0,12 W/(m2K). Katuse soojusläbivus 0,12 W/(m2K) kehtib kogu katusele.']
    expect(checkContradictions([{ subject: 'brutopind', a: side('2 180 m2', 1, 'Hoone brutopind on 2 180 m2'), b: side('80-leheküljeline seletuskiri', 1, 'See on 80-leheküljeline seletuskiri') }], p2)).toEqual([])
    expect(checkContradictions([{ subject: 'korterite arv', a: side('24 korterit', 1, 'Hoones on 24 korterit'), b: side('6 ühetoalist, 12 kahetoalist ja 6 kolmetoalist', 2, '6 ühetoalist, 12 kahetoalist ja 6 kolmetoalist') }], p2)).toEqual([])
    const twice = checkContradictions([
      { subject: 'katuse U', a: side('0,10 W/(m2K)', 2, 'Katuse U on 0,10 W/(m2K)'), b: side('0,12 W/(m2K)', 3, 'Katuse U-arv on 0,12 W/(m2K)') },
      { subject: 'katuse U-väärtus', a: side('0,10 W/(m²K)', 2, 'Katuse U on 0,10 W/(m2K)'), b: side('0,12 W/(m²K)', 3, 'Katuse soojusläbivus 0,12 W/(m2K)') },
    ], p2)
    expect(twice).toHaveLength(1)
  })
  it('reads a thousands space as one number', () => {
    const p3 = ['Köetav pind on 1 745 m2.', 'Köetav pind on 1 478 m2.']
    expect(checkContradictions([{ subject: 'köetav pind', a: side('1 745 m2', 1, 'Köetav pind on 1 745 m2'), b: side('1 478 m2', 2, 'Köetav pind on 1 478 m2') }], p3)).toHaveLength(1)
  })
  it('normaliser accepts a bare list and skips broken entries', () => {
    const v = ContradictionsSchema.safeParse(normaliseContradictions([{ what: 'Roof U', first: { value: '0.10', page: '8', quote: 'q1' }, second: { value: '0.12', page: 30, quote: 'q2' } }, { subject: 'x' }, null]))
    expect(v.success && v.data.contradictions).toEqual([{ subject: 'Roof U', a: { value: '0.10', page: 8, quote: 'q1' }, b: { value: '0.12', page: 30, quote: 'q2' } }])
  })
})

describe('open questions and figures in the schema', () => {
  it('summary carries open questions; missing list becomes empty', () => {
    const v = DocumentSummarySchema.safeParse(normaliseSummary({ summary: 's', open_questions: [{ text: 'Kes hakkab äripinda kasutama?', page: 72, quote: 'Ei ole otsustatud' }] }))
    expect(v.success && v.data.openQuestions).toEqual([{ text: 'Kes hakkab äripinda kasutama?', page: 72, quote: 'Ei ole otsustatud' }])
    const w = DocumentSummarySchema.safeParse(normaliseSummary({ summary: 's' }))
    expect(w.success && w.data.openQuestions).toEqual([])
  })
  it('section notes carry figures', () => {
    const v = SectionNotesSchema.safeParse(normaliseNotes({ gist: 'g', figures: [{ subject: 'roof U-value', value: '0.10 W/(m2K)', page: 8, quote: 'q' }, { subject: 'no value' }] }))
    expect(v.success && v.data.figures).toHaveLength(1)
  })
})

describe('language of the summary', () => {
  const et = 'Hoone on neljakorruseline ja selle katus on lame. Projekteerija peab esitama eelprojekti ning tellija kinnitab selle, kui see vastab lähteülesandele. '.repeat(6)
  const en = 'The building is four storeys and the roof is flat. The architect shall submit the design to the client for approval and this is not optional. '.repeat(6)
  it('a chosen language is kept', () => expect(resolveLanguage('en', [et])).toBe('en'))
  it('Estonian text gives Estonian, English text gives English', () => {
    expect(resolveLanguage('same', [et])).toBe('et')
    expect(resolveLanguage('same', [en + ' Sild Arhitektuur OÜ, Emajõe Kodu OÜ, Kasevälja 12, Tartu.'])).toBe('en')
  })
  it('too little text or an even mix is left to the model', () => {
    expect(resolveLanguage('same', ['Tere.'])).toBe('same')
    expect(resolveLanguage('same', [et + en])).toBe('same')
  })
})

describe('the passage around a quote', () => {
  const pages = ['x', 'Korteriprogramm sisaldab 24 korterit. Eluruumide köetav pind kokku on ligikaudu 1 478 m²; ülejäänud köetav pind kuulub trepikojale ja äripinnale. Igas eluruumis on aken.']
  it('includes the text before and after, so the reader sees what the value describes', () => {
    const p = around(pages, 2, 'köetav pind kokku on ligikaudu 1 478 m²')
    expect(p).toContain('Korteriprogramm sisaldab')
    expect(p).toContain('ülejäänud köetav pind kuulub trepikojale')
  })
  it('falls back to the quote when it cannot be placed', () => {
    expect(around(pages, null, 'köetav pind 1 745 m2')).toBe('köetav pind 1 745 m2')
    expect(around(pages, 1, 'seda siin ei ole üldse')).toBe('seda siin ei ole üldse')
  })
})

describe('key points do not repeat what has its own section', () => {
  const raw = ['Tellija kinnitas äripinna esialgseks kasutusprofiiliks kontori või vaikse teeninduse. Hoone brutopind on 2 180 m2, köetav pind 1 745 m2.', 'Katuse U-arvuks 0,12 W/(m2K) on märgitud lõikes 4.']
  const base = { title: 'P', documentType: 'minutes' as const, language: 'et', summary: 's', actions: [], openQuestions: [], warnings: [] }
  it('drops a key point quoting the same sentence as a decision, keeps the others', () => {
    const m = checkSummary({ ...base,
      keyPoints: [
        { text: 'Äripind on kontor', page: 1, quote: 'Tellija kinnitas äripinna esialgseks kasutusprofiiliks kontori või vaikse teeninduse.' },
        { text: 'Brutopind 2 180 m2', page: 1, quote: 'Hoone brutopind on 2 180 m2, köetav pind 1 745 m2.' },
      ],
      decisions: [{ text: 'Äripinna profiil kinnitatud', page: 1, quote: 'Tellija kinnitas äripinna esialgseks kasutusprofiiliks kontori või vaikse teeninduse' }],
    }, raw, { sections: 1, truncated: false })
    expect(m.keyPoints.map((k) => k.text)).toEqual(['Brutopind 2 180 m2'])
    expect(m.decisions).toHaveLength(1)
  })
  it('drops a key point that restates a flagged contradiction', () => {
    const m = checkSummary({ ...base, decisions: [], keyPoints: [{ text: 'Katuse U on vastuolus', page: 2, quote: 'Katuse U-arvuks 0,12 W/(m2K) on märgitud lõikes 4.' }] }, raw,
      { sections: 1, truncated: false, contradictions: [{ subject: 'katuse U', a: { value: '0,10', page: 1, quote: 'x' }, b: { value: '0,12 W/(m2K)', page: 2, quote: 'Katuse U-arvuks 0,12 W/(m2K)' } }] })
    expect(m.keyPoints).toEqual([])
  })
  it('short or missing quotes never count as a repeat', () => {
    expect(repeats('9 m', ['kõrgus on 9 m maapinnast'])).toBe(false)
    expect(repeats(null, ['anything long enough to matter here'])).toBe(false)
  })
})
