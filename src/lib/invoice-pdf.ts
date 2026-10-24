/**
 * Outbound Invoice PDF generator — produces a professional invoice PDF using PDFKit.
 *
 * Mirrors the quote-pdf.ts pattern: practice header, client details, line items table,
 * totals, notes, T&Cs, and a footer with invoice number + page number.
 */

import PDFDocument from 'pdfkit'

/* ── Types ─────────────────────────────────────────────── */

export interface InvoicePdfLineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineTotal: number
}

export interface InvoicePdfData {
  invoiceNumber: string
  title?: string | null
  clientName: string
  clientEmail: string | null
  clientAddress: string | null
  lineItems: InvoicePdfLineItem[]
  netAmount: number
  taxRate: number
  vatAmount: number
  grossAmount: number
  currency: string
  invoiceDate: string
  dueDate: string | null
  notes: string | null
  termsAndConditions: string | null
  createdByName: string
  organisationName: string
  projectName: string | null
  status: string
}

/* ── Currency formatting ───────────────────────────────── */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  NGN: '₦',
}

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' '
  return `${sym}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ── Colours ───────────────────────────────────────────── */

const BRAND = '#18181b'         // zinc-900
const ACCENT = '#2563eb'        // blue-600
const MUTED = '#71717a'         // zinc-500
const BORDER = '#e4e4e7'        // zinc-200
const TABLE_HEAD_BG = '#f4f4f5' // zinc-100

/* ── PDF Builder ───────────────────────────────────────── */

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `Invoice ${data.invoiceNumber}`,
        Author: data.organisationName,
        Subject: 'Invoice',
        Creator: 'Coordin.io',
      },
      bufferPages: true,
    })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = 595.28 // A4
    const contentW = pageW - 100
    let y = 50

    /* ── Header ────────────────────────────────────── */

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(BRAND)
      .text(data.organisationName, 50, y)

    // Invoice number + date — right-aligned
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(data.invoiceNumber, 50, y, { width: contentW, align: 'right' })
      .text(fmtDate(data.invoiceDate), 50, y + 12, { width: contentW, align: 'right' })

    y += 36

    // Accent line
    doc
      .moveTo(50, y)
      .lineTo(pageW - 50, y)
      .strokeColor(ACCENT)
      .lineWidth(2)
      .stroke()

    y += 16

    /* ── "INVOICE" label ──────────────────────────── */

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(ACCENT)
      .text('INVOICE', 50, y)

    y += 24

    /* ── Title (if present) ───────────────────────── */

    if (data.title) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(BRAND)
        .text(data.title, 50, y)
      y += 18
    }

    /* ── Client & Invoice Info columns ─────────────── */

    const leftColX = 50
    const rightColX = 320

    // Left: Bill To
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('BILL TO', leftColX, y)
    y += 14
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text(data.clientName, leftColX, y)
    y += 14
    if (data.clientEmail) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(data.clientEmail, leftColX, y)
      y += 12
    }
    if (data.clientAddress) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(data.clientAddress, leftColX, y, { width: 240 })
      y += doc.heightOfString(data.clientAddress, { width: 240 }) + 4
    }

    // Right: Invoice metadata
    const metaStartY = y - 40
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('INVOICE DETAILS', rightColX, metaStartY < 100 ? 100 : metaStartY)
    let my = (metaStartY < 100 ? 100 : metaStartY) + 14

    const addMeta = (label: string, value: string) => {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, rightColX, my)
      doc.font('Helvetica').fontSize(9).fillColor(BRAND).text(value, rightColX + 90, my)
      my += 14
    }

    addMeta('Invoice No:', data.invoiceNumber)
    addMeta('Date:', fmtDate(data.invoiceDate))
    if (data.dueDate) addMeta('Due Date:', fmtDate(data.dueDate))
    addMeta('Currency:', data.currency)
    if (data.projectName) addMeta('Project:', data.projectName)
    addMeta('Issued By:', data.createdByName)

    y = Math.max(y, my) + 16

    /* ── Line Items Table ──────────────────────────── */

    const cols = {
      num:   { x: 50,  w: 30 },
      desc:  { x: 80,  w: 220 },
      qty:   { x: 300, w: 45 },
      price: { x: 345, w: 70 },
      vat:   { x: 415, w: 50 },
      total: { x: 465, w: 80 },
    }
    const tableRight = cols.total.x + cols.total.w
    const rowH = 22

    // Page break check
    const estimatedTableHeight = (data.lineItems.length + 4) * rowH + 60
    if (y + estimatedTableHeight > 750) {
      doc.addPage()
      y = 50
    }

    // Table header
    doc.rect(50, y, tableRight - 50, rowH).fill(TABLE_HEAD_BG)

    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    doc.text('#', cols.num.x + 4, y + 7, { width: cols.num.w, align: 'left' })
    doc.text('Description', cols.desc.x + 4, y + 7, { width: cols.desc.w, align: 'left' })
    doc.text('Qty', cols.qty.x, y + 7, { width: cols.qty.w, align: 'right' })
    doc.text('Unit Price', cols.price.x, y + 7, { width: cols.price.w, align: 'right' })
    doc.text('VAT %', cols.vat.x, y + 7, { width: cols.vat.w, align: 'right' })
    doc.text('Total', cols.total.x, y + 7, { width: cols.total.w, align: 'right' })

    y += rowH

    // Table rows
    data.lineItems.forEach((li, idx) => {
      if (y + rowH > 750) {
        doc.addPage()
        y = 50
      }

      if (idx % 2 === 1) {
        doc.rect(50, y, tableRight - 50, rowH).fill('#fafafa')
      }

      doc.moveTo(50, y + rowH).lineTo(tableRight, y + rowH).strokeColor(BORDER).lineWidth(0.5).stroke()

      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      doc.text(String(idx + 1), cols.num.x + 4, y + 6, { width: cols.num.w, align: 'left' })

      doc.font('Helvetica').fontSize(9).fillColor(BRAND)
      doc.text(li.description, cols.desc.x + 4, y + 6, { width: cols.desc.w - 8, align: 'left' })

      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      doc.text(String(li.quantity), cols.qty.x, y + 6, { width: cols.qty.w, align: 'right' })
      doc.text(fmtMoney(li.unitPrice, data.currency), cols.price.x, y + 6, { width: cols.price.w, align: 'right' })
      doc.text(`${li.vatRate}%`, cols.vat.x, y + 6, { width: cols.vat.w, align: 'right' })

      doc.font('Helvetica').fontSize(9).fillColor(BRAND)
      doc.text(fmtMoney(li.lineTotal, data.currency), cols.total.x, y + 6, { width: cols.total.w, align: 'right' })

      y += rowH
    })

    y += 4

    /* ── Totals ────────────────────────────────────── */

    const totalsX = cols.price.x
    const totalsValX = cols.total.x
    const totalsW = cols.total.w

    // Net
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Net Total', totalsX, y, { width: cols.price.w + cols.vat.w, align: 'right' })
    doc.font('Helvetica').fontSize(9).fillColor(BRAND).text(fmtMoney(data.netAmount, data.currency), totalsValX, y, { width: totalsW, align: 'right' })
    y += 16

    // VAT
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`VAT (${data.taxRate}%)`, totalsX, y, { width: cols.price.w + cols.vat.w, align: 'right' })
    doc.font('Helvetica').fontSize(9).fillColor(BRAND).text(fmtMoney(data.vatAmount, data.currency), totalsValX, y, { width: totalsW, align: 'right' })
    y += 16

    // Gross — bold line above
    doc.moveTo(totalsX, y).lineTo(tableRight, y).strokeColor(BRAND).lineWidth(1).stroke()
    y += 6
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Amount Due', totalsX, y, { width: cols.price.w + cols.vat.w, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text(fmtMoney(data.grossAmount, data.currency), totalsValX, y, { width: totalsW, align: 'right' })
    y += 28

    /* ── Notes ─────────────────────────────────────── */

    if (data.notes) {
      if (y + 60 > 750) { doc.addPage(); y = 50 }
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('NOTES', 50, y)
      y += 14
      doc.font('Helvetica').fontSize(9).fillColor(BRAND).text(data.notes, 50, y, { width: contentW })
      y += doc.heightOfString(data.notes, { width: contentW }) + 16
    }

    /* ── Terms & Conditions ────────────────────────── */

    if (data.termsAndConditions) {
      if (y + 60 > 750) { doc.addPage(); y = 50 }
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('PAYMENT TERMS', 50, y)
      y += 14
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(data.termsAndConditions, 50, y, { width: contentW })
      y += doc.heightOfString(data.termsAndConditions, { width: contentW }) + 16
    }

    /* ── Footer on every page ──────────────────────── */

    const pageCount = doc.bufferedPageRange().count
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i)

      doc.moveTo(50, 790).lineTo(pageW - 50, 790).strokeColor(BORDER).lineWidth(0.5).stroke()

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `${data.invoiceNumber} — Generated by Coordin.io`,
          50,
          796,
          { width: contentW / 2, align: 'left' },
        )

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `Page ${i + 1} of ${pageCount}`,
          pageW / 2,
          796,
          { width: contentW / 2, align: 'right' },
        )
    }

    doc.end()
  })
}
