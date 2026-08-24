/**
 * Tests for timesheet PDF generation and export utilities.
 */
import { describe, it, expect } from 'vitest'
import { generateTimesheetPdf, type TimesheetPdfData } from '@/lib/timesheet-pdf'
import { generateCsv, TIMESHEET_COLUMNS, TIMESHEET_ENTRY_COLUMNS, EXPORT_COLUMNS } from '@/lib/export-utils'

/* ── Fixtures ──────────────────────────────────────────── */

const SAMPLE_WEEK: TimesheetPdfData['weeks'][number] = {
  weekStarting: '2026-08-17T00:00:00.000Z',
  status: 'APPROVED',
  totalHours: 37.5,
  billableHours: 30,
  employeeName: 'Wale Koleosho',
  employeeJobTitle: 'QA Lead & Tech PM',
  entries: [
    {
      date: '2026-08-17T00:00:00.000Z',
      projectName: 'PRJ-001 Riverside Development',
      workStage: 'Technical Design',
      activity: 'Code review',
      description: 'Reviewed pull requests for sprint deliverables',
      hours: 7.5,
      isBillable: true,
      isOvertime: false,
      locationType: 'Office',
    },
    {
      date: '2026-08-18T00:00:00.000Z',
      projectName: 'PRJ-001 Riverside Development',
      workStage: 'Technical Design',
      activity: 'Testing',
      description: 'Integration test suite updates',
      hours: 6,
      isBillable: true,
      isOvertime: false,
      locationType: 'Remote',
    },
    {
      date: '2026-08-19T00:00:00.000Z',
      projectName: null,
      workStage: null,
      activity: 'Admin',
      description: 'Team meeting and sprint planning',
      hours: 4,
      isBillable: false,
      isOvertime: false,
      locationType: 'Office',
    },
    {
      date: '2026-08-19T00:00:00.000Z',
      projectName: 'PRJ-002 Tower Block',
      workStage: 'Concept Design',
      activity: 'Design coordination',
      description: null,
      hours: 3.5,
      isBillable: true,
      isOvertime: false,
      locationType: 'Office',
    },
    {
      date: '2026-08-20T00:00:00.000Z',
      projectName: 'PRJ-001 Riverside Development',
      workStage: 'Technical Design',
      activity: 'Documentation',
      description: 'Updated technical specifications',
      hours: 8,
      isBillable: true,
      isOvertime: true,
      locationType: 'Remote',
    },
    {
      date: '2026-08-21T00:00:00.000Z',
      projectName: 'PRJ-003 Town Centre',
      workStage: 'Planning',
      activity: 'Client meeting',
      description: 'Planning application review',
      hours: 8.5,
      isBillable: true,
      isOvertime: false,
      locationType: 'Site',
    },
  ],
  submittedAt: '2026-08-22T09:00:00.000Z',
  approvedAt: '2026-08-22T14:30:00.000Z',
}

const SAMPLE_DATA: TimesheetPdfData = {
  organisationName: 'CWA Homes Ltd',
  reportTitle: 'Team Timesheets — 2026-08-17 to 2026-08-23',
  weeks: [SAMPLE_WEEK],
  generatedAt: '2026-08-24T10:00:00.000Z',
  generatedBy: 'Wale Koleosho',
}

/* ── PDF Generation Tests ──────────────────────────────── */

describe('generateTimesheetPdf', () => {
  it('returns a valid PDF buffer', async () => {
    const buffer = await generateTimesheetPdf(SAMPLE_DATA)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles empty entries', async () => {
    const data: TimesheetPdfData = {
      ...SAMPLE_DATA,
      weeks: [{ ...SAMPLE_WEEK, entries: [], totalHours: 0, billableHours: 0 }],
    }
    const buffer = await generateTimesheetPdf(data)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles multiple weeks (multi-page)', async () => {
    const data: TimesheetPdfData = {
      ...SAMPLE_DATA,
      weeks: [SAMPLE_WEEK, { ...SAMPLE_WEEK, weekStarting: '2026-08-24T00:00:00.000Z' }],
    }
    const buffer = await generateTimesheetPdf(data)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('handles week with many entries (page overflow)', async () => {
    const manyEntries = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-08-${17 + (i % 5)}T00:00:00.000Z`,
      projectName: `PRJ-${String(i + 1).padStart(3, '0')} Project ${i + 1}`,
      workStage: 'Design',
      activity: `Activity ${i + 1}`,
      description: `Description of work item ${i + 1}`,
      hours: 1 + (i % 4),
      isBillable: i % 3 !== 0,
      isOvertime: i % 7 === 0,
      locationType: ['Office', 'Remote', 'Site'][i % 3],
    }))
    const data: TimesheetPdfData = {
      ...SAMPLE_DATA,
      weeks: [{ ...SAMPLE_WEEK, entries: manyEntries, totalHours: 100 }],
    }
    const buffer = await generateTimesheetPdf(data)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles minimal data (null optional fields)', async () => {
    const minimal: TimesheetPdfData = {
      ...SAMPLE_DATA,
      weeks: [{
        weekStarting: '2026-08-17T00:00:00.000Z',
        status: 'DRAFT',
        totalHours: 2,
        billableHours: 0,
        employeeName: 'Test User',
        employeeJobTitle: null,
        entries: [{
          date: '2026-08-17T00:00:00.000Z',
          projectName: null,
          workStage: null,
          activity: null,
          description: null,
          hours: 2,
          isBillable: false,
          isOvertime: false,
          locationType: null,
        }],
        submittedAt: null,
        approvedAt: null,
      }],
    }
    const buffer = await generateTimesheetPdf(minimal)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles all timesheet statuses', async () => {
    const statuses = ['DRAFT', 'SUBMITTED', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'LOCKED', 'REOPENED']
    for (const status of statuses) {
      const data: TimesheetPdfData = {
        ...SAMPLE_DATA,
        weeks: [{ ...SAMPLE_WEEK, status }],
      }
      const buffer = await generateTimesheetPdf(data)
      expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    }
  })
})

/* ── CSV Generation Tests ──────────────────────────────── */

describe('Timesheet CSV export', () => {
  it('generates valid summary CSV', () => {
    const rows = [
      { profile: { fullName: 'Wale Koleosho' }, weekStarting: '2026-08-17', totalHours: 37.5, status: 'APPROVED' },
      { profile: { fullName: 'Jane Smith' }, weekStarting: '2026-08-17', totalHours: 40, status: 'SUBMITTED' },
    ]
    const csv = generateCsv(TIMESHEET_COLUMNS, rows)
    expect(csv).toContain('Employee,Week Starting,Total Hours,Status')
    expect(csv).toContain('Wale Koleosho')
    expect(csv).toContain('Jane Smith')
    expect(csv.split('\n').length).toBe(3) // header + 2 rows
  })

  it('generates valid entry-level CSV', () => {
    const rows = [
      {
        employeeName: 'Wale Koleosho',
        weekStarting: '2026-08-17',
        date: '2026-08-17T00:00:00.000Z',
        projectName: 'Riverside Development',
        workStage: 'Technical Design',
        activity: 'Code review',
        description: 'PR reviews',
        hours: 7.5,
        isBillable: true,
        isOvertime: false,
        locationType: 'Office',
      },
    ]
    const csv = generateCsv(TIMESHEET_ENTRY_COLUMNS, rows)
    expect(csv).toContain('Employee,Week Starting,Date,Project,Work Stage,Activity,Description,Hours,Billable,Overtime,Location')
    expect(csv).toContain('Riverside Development')
    expect(csv).toContain('7.5')
    expect(csv).toContain('Yes') // billable
  })

  it('escapes CSV special characters', () => {
    const rows = [{
      employeeName: 'O\'Brien, James',
      weekStarting: '2026-08-17',
      date: '2026-08-17T00:00:00.000Z',
      projectName: 'Project with, comma',
      workStage: '',
      activity: 'Meeting "urgent"',
      description: 'Multi\nline note',
      hours: 3,
      isBillable: false,
      isOvertime: false,
      locationType: '',
    }]
    const csv = generateCsv(TIMESHEET_ENTRY_COLUMNS, rows)
    // Commas and quotes should be properly escaped
    expect(csv).toContain('"Project with, comma"')
    expect(csv).toContain('"Meeting ""urgent"""')
  })
})

/* ── Export column definitions ─────────────────────────── */

describe('Export column registry', () => {
  it('includes timesheet entry columns in EXPORT_COLUMNS', () => {
    expect(EXPORT_COLUMNS).toHaveProperty('timesheet-entries')
    expect(EXPORT_COLUMNS['timesheet-entries']).toBe(TIMESHEET_ENTRY_COLUMNS)
  })

  it('TIMESHEET_ENTRY_COLUMNS has expected fields', () => {
    const keys = TIMESHEET_ENTRY_COLUMNS.map(c => c.key)
    expect(keys).toContain('employeeName')
    expect(keys).toContain('date')
    expect(keys).toContain('projectName')
    expect(keys).toContain('hours')
    expect(keys).toContain('isBillable')
    expect(keys).toContain('isOvertime')
    expect(keys).toContain('locationType')
  })

  it('TIMESHEET_COLUMNS (summary) has expected fields', () => {
    const keys = TIMESHEET_COLUMNS.map(c => c.key)
    expect(keys).toContain('profile.fullName')
    expect(keys).toContain('weekStarting')
    expect(keys).toContain('totalHours')
    expect(keys).toContain('status')
  })
})
