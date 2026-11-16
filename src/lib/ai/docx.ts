/**
 * Word (.docx) → pages of plain text. A .docx is a ZIP holding word/document.xml; we read only that entry.
 * No dependency: the ZIP central directory is parsed by hand and the entry inflated with node:zlib.
 * Guards: only the one entry is inflated, with a hard cap on its unpacked size (zip bombs).
 */
import { inflateRawSync } from 'node:zlib'
import { IngestError, cleanText, paginateText } from './document-ingest'

const MAX_XML_BYTES = 30 * 1024 * 1024
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

/** True if the bytes begin with the ZIP local-file header (docx, xlsx… all start this way). */
export function sniffZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function readZipEntry(bytes: Uint8Array, wanted: string): Uint8Array | null {
  // End of central directory: search back from the end (comment may follow it)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = u16(bytes, eocd + 10)
  let p = u32(bytes, eocd + 16)
  const dec = new TextDecoder()
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (u32(bytes, p) !== 0x02014b50) return null
    const method = u16(bytes, p + 10)
    const compSize = u32(bytes, p + 20)
    const size = u32(bytes, p + 24)
    const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32)
    const local = u32(bytes, p + 42)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (name === wanted) {
      if (size > MAX_XML_BYTES) throw new IngestError('too_large', 'This Word file is too large to read.')
      if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034b50) return null
      const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
      const data = bytes.subarray(start, start + compSize)
      if (method === 0) return data
      if (method !== 8) return null
      return inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES })
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescapeXml = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? '')

/** word/document.xml → pages. Explicit page breaks are honoured; a document without any is split every ~4,000 characters. */
export function docxXmlToPages(xml: string): string[] {
  const body = xml.slice(Math.max(0, xml.indexOf('<w:body')))
  const pages: string[] = []
  let cur = ''
  const re = /<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g
  for (const m of body.matchAll(re)) {
    const para = m[0]
    let text = ''
    for (const t of para.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(\s[^>]*)?\/>|<w:lastRenderedPageBreak\/>|<w:cr\/>/g)) {
      const tok = t[0]
      if (tok.startsWith('<w:t>') || tok.startsWith('<w:t ')) text += unescapeXml(t[1] ?? '')
      else if (tok === '<w:tab/>') text += '\t'
      else if (tok === '<w:lastRenderedPageBreak/>' || /w:type="page"/.test(tok)) { cur += text; text = ''; if (cur.trim()) pages.push(cur); cur = '' }
      else text += '\n'
    }
    // table cells: keep a row on one line
    const after = body.slice(m.index! + para.length, m.index! + para.length + 16)
    cur += text + (after.startsWith('</w:tc>') && !after.startsWith('</w:tc></w:tr>') ? ' | ' : '\n')
  }
  if (cur.trim()) pages.push(cur)
  const cleaned = pages.map(cleanText).filter(Boolean)
  // Word only records page breaks if it has laid the file out; fall back to even splits so page refs still mean something
  if (cleaned.length <= 1 || cleaned.some((p) => p.length > 12_000)) return paginateText(cleaned.join('\n\n'))
  return cleaned
}

export function docxToPages(bytes: Uint8Array): string[] {
  if (!sniffZip(bytes)) throw new IngestError('not_pdf', 'This is not a Word (.docx) file.')
  let xml: Uint8Array | null
  try { xml = readZipEntry(bytes, 'word/document.xml') } catch (e) {
    if (e instanceof IngestError) throw e
    throw new IngestError('unreadable', 'The Word file could not be read. It may be damaged or password-protected.')
  }
  if (!xml) throw new IngestError('unreadable', 'The Word file could not be read. Old .doc files are not supported: save it as .docx or PDF.')
  const pages = docxXmlToPages(new TextDecoder('utf-8').decode(xml))
  if (pages.join('').length < 300) throw new IngestError('empty', 'The Word file has almost no text in it.')
  return pages
}
