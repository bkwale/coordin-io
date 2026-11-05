/**
 * Document ingest for project setup. PDF or plain text → page-split, capped, control-char-stripped text.
 * Throws typed failures so the UI can say exactly what went wrong.
 */
export type IngestFailure = 'no_text_layer' | 'too_large' | 'not_pdf' | 'empty' | 'unreadable'
export class IngestError extends Error {
  constructor(public failure: IngestFailure, message: string) { super(message); this.name = 'IngestError' }
}

export const INGEST_LIMITS = {
  // Vercel rejects request bodies over 4.5 MB before our code runs. Larger PDFs need direct-to-storage upload (backlog).
  maxBytes: 4 * 1024 * 1024,
  maxChars: 60_000,
  minChars: 300,
  maxPages: 60,
} as const

export const INGEST_MESSAGE: Record<IngestFailure, string> = {
  no_text_layer: 'This PDF has no text layer (it is a scan). Ask the municipality for the digital original, or paste the text.',
  too_large: 'File is over 4 MB. Paste the text instead, or compress the PDF.',
  not_pdf: 'Only PDF files or pasted text are supported here.',
  empty: 'The document is empty.',
  unreadable: 'The PDF could not be read. It may be damaged or password-protected.',
}

/** True if the bytes begin with the PDF magic header. The declared MIME type is not trusted. */
export function sniffPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d // %PDF-
}

export function cleanText(s: string): string {
  // strip control chars except \n \t, collapse runs of blank lines, normalise NBSP
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Split pasted text into pseudo-pages (~4k chars) so page refs still mean something. */
export function paginateText(text: string, pageChars = 4000): string[] {
  const t = cleanText(text)
  if (!t) return []
  const pages: string[] = []
  let i = 0
  while (i < t.length) {
    let end = Math.min(i + pageChars, t.length)
    if (end < t.length) { const nl = t.lastIndexOf('\n', end); if (nl > i + pageChars * 0.5) end = nl }
    pages.push(t.slice(i, end).trim()); i = end
  }
  return pages
}

export async function pdfToPages(bytes: Uint8Array): Promise<string[]> {
  if (bytes.byteLength > INGEST_LIMITS.maxBytes) throw new IngestError('too_large', INGEST_MESSAGE.too_large)
  if (!sniffPdf(bytes)) throw new IngestError('not_pdf', INGEST_MESSAGE.not_pdf)
  // pdf-parse (pdf.js 1.10) — import the lib entry, not the package index (its index runs a debug self-test under ESM).
  // Pass a plain Uint8Array copy, never a Node Buffer: pdf.js 1.10 misreads pooled Buffer slices and throws "bad XRef entry".
  const mod = await import('pdf-parse/lib/pdf-parse.js')
  const pdfParse = (mod.default ?? mod) as unknown as (data: Uint8Array, opts?: Record<string, unknown>) => Promise<{ numpages: number; text: string }>
  const data = new Uint8Array(bytes.byteLength); data.set(bytes)
  const pages: string[] = []
  let result: { numpages: number }
  try {
    result = await pdfParse(data, {
      max: INGEST_LIMITS.maxPages,
      pagerender: async (pageData: { getTextContent: (o: Record<string, unknown>) => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
        const tc = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
        // group by line (y coordinate) so columns don't interleave into one long line
        let lastY: number | null = null, out = ''
        for (const it of tc.items) {
          const y = Math.round(it.transform[5])
          if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n'
          else if (out && !out.endsWith('\n')) out += ' '
          out += it.str; lastY = y
        }
        pages.push(out)
        return out
      },
    })
  } catch (e) {
    throw new IngestError('unreadable', INGEST_MESSAGE.unreadable + (e instanceof Error && /password/i.test(e.message) ? ' (password-protected)' : ''))
  }
  const cleaned = pages.map(cleanText)
  const total = cleaned.reduce((a, p) => a + p.length, 0)
  if (total < INGEST_LIMITS.minChars) throw new IngestError('no_text_layer', INGEST_MESSAGE.no_text_layer)
  return capPages(cleaned)
}

export function capPages(pages: string[]): string[] {
  let budget = INGEST_LIMITS.maxChars
  const out: string[] = []
  for (const p of pages) {
    if (budget <= 0) break
    out.push(p.length > budget ? p.slice(0, budget) : p)
    budget -= p.length
  }
  return out
}
