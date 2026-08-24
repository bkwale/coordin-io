/**
 * Timesheet PDF generator — produces a professional timesheet report using PDFKit.
 *
 * Renders: organisation header, employee info, week summary cards,
 * daily entry table, totals row, and page footers.
 */

import PDFDocument from 'pdfkit'

/* ── Types ─────────────────────────────────────────────── */

export interface TimesheetPdfEntry {
  date: string
  projectName: string | null
  workStage: string | null
  activity: string | null
  description: string | null
  hours: number
  isBillable: boolean
  isOvertime: boolean
  locationType: string | null
}

export interface TimesheetPdfWeek {
  weekStarting: string
  status: string
  totalHours: number
  billableHours: number
  employeeName: string
  employeeJobTitle: string | null
  entries: TimesheetPdfEntry[]
  submittedAt: string | null
  approvedAt: string | null
}

export interface TimesheetPdfData {
  organisationName: string
  /** When exporting multiple weeks, this is the date range label */
  reportTitle: string
  weeks: TimesheetPdfWeek[]
  generatedAt: string
  generatedBy: string
}

/* ── Colours ───────────────────────────────────────────── */

const BRAND = '#18181b'
const ACCENT = '#2563eb'
const MUTED = '#71717a'
const BORDER = '#e4e4e7'
const TABLE_HEAD_BG = '#f4f4f5'
const BILLABLE_BG = '#ecfdf5'
const OVERTIME_BG = '#fef3c7'

/* ── Helpers ───────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function fmtHours(h: number): string {
  return h.toFixed(1)
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CHANGES_REQUIRED: 'Changes Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  LOCKED: 'Locked',
  REOPENED: 'Reopened',
}

/* ── PDF Builder ───────────────────────────────────────── */

export async function generateTimesheetPdf(data: TimesheetPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      info: {
        Title: data.reportTitle,
        Author: data.organisationName,
        Subject: 'Timesheet Report',
        Creator: 'Coordin.io',
      },
      bufferPages: true,
    })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = 841.89 // A4 landscape
    const contentW = pageW - 80

    /* ── Render each week ─────────────────────────── */

    data.weeks.forEach((week, weekIdx) => {
      if (weekIdx > 0) doc.addPage()

      let y = 40

      /* Header */
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(BRAND)
        .text(data.organisationName, 40, y)

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(`Generated ${fmtDate(data.generatedAt)} by ${data.generatedBy}`, 40, y, {
          width: contentW,
          align: 'right',
        })

      y += 24

      // Accent line
      doc.moveTo(40, y).lineTo(pageW - 40, y).strokeColor(ACCENT).lineWidth(2).stroke()
      y += 12

      /* Employee + Week Info */
      doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND).text(week.employeeName, 40, y)
      if (week.employeeJobTitle) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(week.employeeJobTitle, 40, y + 16)
        y += 14
      }
      y += 20

      // Week metadata row
      const metaY = y
      const addTag = (label: string, value: string, x: number) => {
        doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(label, x, metaY)
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(value, x, metaY + 10)
      }

      const weekEnd = new Date(week.weekStarting)
      weekEnd.setDate(weekEnd.getDate() + 6)
      addTag('WEEK', `${fmtDate(week.weekStarting)} — ${fmtDate(weekEnd.toISOString())}`, 40)
      addTag('STATUS', STATUS_LABELS[week.status] || week.status, 220)
      addTag('TOTAL HOURS', fmtHours(week.totalHours), 360)
      addTag('BILLABLE', fmtHours(week.billableHours), 460)
      addTag(
        'BILLABLE %',
        week.totalHours > 0 ? `${Math.round((week.billableHours / week.totalHours) * 100)}%` : '—',
        560,
      )
      if (week.submittedAt) addTag('SUBMITTED', fmtDate(week.submittedAt), 650)

      y = metaY + 30

      /* Entry Table */
      if (week.entries.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No entries for this week.', 40, y)
        return
      }

      // Sort entries by date
      const sorted = [...week.entries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )

      // Column layout (landscape has ~762pt content width)
      const cols = {
        day: { x: 40, w: 90 },
        project: { x: 130, w: 150 },
        stage: { x: 280, w: 90 },
        activity: { x: 370, w: 120 },
        desc: { x: 490, w: 140 },
        hours: { x: 630, w: 50 },
        billable: { x: 680, w: 50 },
        overtime: { x: 730, w: 50 },
      }
      const tableRight = cols.overtime.x + cols.overtime.w
      const rowH = 20

      // Table header
      doc.rect(40, y, tableRight - 40, rowH).fill(TABLE_HEAD_BG)

      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
      doc.text('Day', cols.day.x + 4, y + 6, { width: cols.day.w })
      doc.text('Project', cols.project.x + 4, y + 6, { width: cols.project.w })
      doc.text('Stage', cols.stage.x + 4, y + 6, { width: cols.stage.w })
      doc.text('Activity', cols.activity.x + 4, y + 6, { width: cols.activity.w })
      doc.text('Description', cols.desc.x + 4, y + 6, { width: cols.desc.w })
      doc.text('Hours', cols.hours.x, y + 6, { width: cols.hours.w, align: 'right' })
      doc.text('Bill.', cols.billable.x, y + 6, { width: cols.billable.w, align: 'center' })
      doc.text('OT', cols.overtime.x, y + 6, { width: cols.overtime.w, align: 'center' })

      y += rowH

      // Rows
      sorted.forEach((entry, idx) => {
        // Page break check (landscape page height ~555pt usable)
        if (y + rowH > 540) {
          doc.addPage()
          y = 40
          // Re-draw header on new page
          doc.rect(40, y, tableRight - 40, rowH).fill(TABLE_HEAD_BG)
          doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
          doc.text('Day', cols.day.x + 4, y + 6, { width: cols.day.w })
          doc.text('Project', cols.project.x + 4, y + 6, { width: cols.project.w })
          doc.text('Stage', cols.stage.x + 4, y + 6, { width: cols.stage.w })
          doc.text('Activity', cols.activity.x + 4, y + 6, { width: cols.activity.w })
          doc.text('Description', cols.desc.x + 4, y + 6, { width: cols.desc.w })
          doc.text('Hours', cols.hours.x, y + 6, { width: cols.hours.w, align: 'right' })
          doc.text('Bill.', cols.billable.x, y + 6, { width: cols.billable.w, align: 'center' })
          doc.text('OT', cols.overtime.x, y + 6, { width: cols.overtime.w, align: 'center' })
          y += rowH
        }

        // Alternating row + special backgrounds
        if (entry.isBillable && idx % 2 === 0) {
          doc.rect(40, y, tableRight - 40, rowH).fill(BILLABLE_BG)
        } else if (idx % 2 === 1) {
          doc.rect(40, y, tableRight - 40, rowH).fill('#fafafa')
        }

        // Row border
        doc.moveTo(40, y + rowH).lineTo(tableRight, y + rowH).strokeColor(BORDER).lineWidth(0.5).stroke()

        doc.font('Helvetica').fontSize(8).fillColor(BRAND)
        doc.text(fmtDay(entry.date), cols.day.x + 4, y + 6, { width: cols.day.w - 8 })

        doc.fillColor(BRAND).text(
          entry.projectName || '—',
          cols.project.x + 4,
          y + 6,
          { width: cols.project.w - 8, lineBreak: false },
        )

        doc.fillColor(MUTED).text(
          entry.workStage || '—',
          cols.stage.x + 4,
          y + 6,
          { width: cols.stage.w - 8, lineBreak: false },
        )

        doc.fillColor(MUTED).text(
          entry.activity || '—',
          cols.activity.x + 4,
          y + 6,
          { width: cols.activity.w - 8, lineBreak: false },
        )

        doc.fillColor(MUTED).text(
          entry.description || '—',
          cols.desc.x + 4,
          y + 6,
          { width: cols.desc.w - 8, lineBreak: false },
        )

        doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND)
        doc.text(fmtHours(entry.hours), cols.hours.x, y + 6, { width: cols.hours.w, align: 'right' })

        doc.font('Helvetica').fontSize(8)
        doc.fillColor(entry.isBillable ? '#059669' : MUTED)
          .text(entry.isBillable ? 'Yes' : 'No', cols.billable.x, y + 6, { width: cols.billable.w, align: 'center' })

        doc.fillColor(entry.isOvertime ? '#d97706' : MUTED)
          .text(entry.isOvertime ? 'Yes' : '—', cols.overtime.x, y + 6, { width: cols.overtime.w, align: 'center' })

        y += rowH
      })

      // Totals row — page break guard
      if (y + rowH + 4 > 540) {
        doc.addPage()
        y = 40
      }
      y += 2
      doc.rect(40, y, tableRight - 40, rowH + 2).fill(TABLE_HEAD_BG)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND)
      doc.text('TOTAL', cols.day.x + 4, y + 7, { width: 200 })
      doc.text(fmtHours(week.totalHours), cols.hours.x, y + 7, { width: cols.hours.w, align: 'right' })

      const billableCount = sorted.filter(e => e.isBillable).length
      doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      doc.text(`${billableCount}/${sorted.length}`, cols.billable.x, y + 7, { width: cols.billable.w, align: 'center' })

      const otCount = sorted.filter(e => e.isOvertime).length
      if (otCount > 0) {
        doc.text(`${otCount}`, cols.overtime.x, y + 7, { width: cols.overtime.w, align: 'center' })
      }
    })

    /* ── Footer on every page ──────────────────────── */

    const pageCount = doc.bufferedPageRange().count
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i)

      doc.moveTo(40, 555).lineTo(pageW - 40, 555).strokeColor(BORDER).lineWidth(0.5).stroke()

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(`${data.reportTitle} — Generated by Coordin.io`, 40, 560, {
          width: contentW / 2,
          align: 'left',
        })

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(`Page ${i + 1} of ${pageCount}`, pageW / 2, 560, {
          width: contentW / 2,
          align: 'right',
        })
    }

    doc.end()
  })
}
