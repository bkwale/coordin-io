import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { docxToPages, docxXmlToPages, sniffZip } from '../docx'
import { chunkPages, checkItem, checkSummary, readDocumentPages, SECTION_CHARS } from '../summary-core'
import { DocumentSummarySchema, SectionNotesSchema, normaliseSummary, normaliseNotes } from '../schemas-summary'
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
    const sections = chunkPages(pages)
    expect(sections.flat().map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const s of sections) expect(s.reduce((a, x) => a + x.text.length, 0)).toBeLessThanOrEqual(SECTION_CHARS)
    expect(sections).toHaveLength(5)
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
  it('quote running over a page break is verified', () => expect(checkItem(item('olema vähemalt 2. otsustati: fassaadi', 2), pages).verified).toBe(true))

  it('checkSummary counts unverified items and says so', () => {
    const raw = ['Hoone suurim lubatud kõrgus on 9 m maapinnast.', 'Projekteerija esitab eelprojekti hiljemalt 15.12.2026.']
    const m = checkSummary({
      title: 'PT', documentType: 'permit', language: 'et', summary: 's',
      keyPoints: [{ text: 'Kõrgus kuni 9 m', page: 1, quote: 'suurim lubatud kõrgus on 9 m' }],
      decisions: [{ text: 'Made up', page: 1, quote: 'seda lauset dokumendis ei ole' }],
      actions: [{ text: 'Esita eelprojekt', owner: 'Projekteerija', due: '15.12.2026', page: 2, quote: 'esitab eelprojekti hiljemalt 15.12.2026' }],
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
