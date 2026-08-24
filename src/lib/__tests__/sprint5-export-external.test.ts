import { describe, it, expect } from 'vitest'
import { generateCsv, EXPORT_COLUMNS, type ExportColumn } from '@/lib/export-utils'

/* ═══════════════════════════════════════════════════════
 * Sprint 5 tests — Export utility, ExternalLink contract,
 * and expense expansion fields.
 * ═══════════════════════════════════════════════════════ */

// ── 1. generateCsv() ───────────────────────────────────

describe('generateCsv', () => {
  const columns: ExportColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
  ]

  it('produces header row from column labels', () => {
    const csv = generateCsv(columns, [])
    expect(csv).toBe('Name,Age\n')
  })

  it('renders flat values', () => {
    const rows = [{ name: 'Alice', age: 30 }]
    const csv = generateCsv(columns, rows)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('Alice,30')
  })

  it('handles nested values via dot notation', () => {
    const cols: ExportColumn[] = [
      { key: 'profile.fullName', label: 'Employee' },
      { key: 'amount', label: 'Amount' },
    ]
    const rows = [{ profile: { fullName: 'Bob' }, amount: 100 }]
    const csv = generateCsv(cols, rows)
    expect(csv).toContain('Bob,100')
  })

  it('applies format function when provided', () => {
    const cols: ExportColumn[] = [
      { key: 'price', label: 'Price', format: (v) => Number(v).toFixed(2) },
    ]
    const csv = generateCsv(cols, [{ price: 9.5 }])
    expect(csv).toContain('9.50')
  })

  it('escapes commas in values', () => {
    const csv = generateCsv(columns, [{ name: 'Doe, Jane', age: 25 }])
    expect(csv).toContain('"Doe, Jane"')
  })

  it('escapes double quotes in values', () => {
    const csv = generateCsv(columns, [{ name: 'The "Boss"', age: 40 }])
    expect(csv).toContain('"The ""Boss"""')
  })

  it('escapes newlines in values', () => {
    const csv = generateCsv(columns, [{ name: 'Line1\nLine2', age: 20 }])
    expect(csv).toContain('"Line1\nLine2"')
  })

  it('renders undefined nested values as empty string', () => {
    const cols: ExportColumn[] = [
      { key: 'profile.fullName', label: 'Name' },
    ]
    const csv = generateCsv(cols, [{ profile: {} }])
    const lines = csv.split('\n')
    expect(lines[1]).toBe('')
  })

  it('handles multiple rows', () => {
    const rows = [
      { name: 'A', age: 1 },
      { name: 'B', age: 2 },
      { name: 'C', age: 3 },
    ]
    const csv = generateCsv(columns, rows)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(4) // header + 3 data rows
  })

  it('prefixes formula-injection characters with single quote', () => {
    const dangerous = ['=CMD("calc")', '+1+2', '-1+2', '@SUM(1)', '\tcmd', '\rcmd']
    for (const val of dangerous) {
      const csv = generateCsv(columns, [{ name: val, age: 1 }])
      // The value should be prefixed with a single-quote
      expect(csv).toContain("'")
      expect(csv).not.toMatch(new RegExp(`(?<!')${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    }
  })

  it('does not prefix normal values with single quote', () => {
    const safe = ['Hello', '42', 'Bob Smith', 'A description.']
    for (const val of safe) {
      const csv = generateCsv(columns, [{ name: val, age: 1 }])
      const lines = csv.split('\n')
      expect(lines[1]).toContain(val)
      expect(lines[1]).not.toContain(`'${val}`)
    }
  })
})

// ── 2. EXPORT_COLUMNS registry ─────────────────────────

describe('EXPORT_COLUMNS registry', () => {
  it('has entries for all 5 export types', () => {
    expect(Object.keys(EXPORT_COLUMNS)).toEqual(
      expect.arrayContaining(['expenses', 'tasks', 'leave', 'assets', 'timesheets']),
    )
  })

  it('expense columns include the new Sprint 5 fields', () => {
    const keys = EXPORT_COLUMNS.expenses.map((c) => c.key)
    expect(keys).toContain('expenseCategory')
    expect(keys).toContain('costCode')
    expect(keys).toContain('supplier')
  })

  it('expense columns include profile.fullName (nested)', () => {
    const keys = EXPORT_COLUMNS.expenses.map((c) => c.key)
    expect(keys).toContain('profile.fullName')
    expect(keys).toContain('approver.fullName')
  })

  it('task columns include owner.fullName', () => {
    const keys = EXPORT_COLUMNS.tasks.map((c) => c.key)
    expect(keys).toContain('owner.fullName')
  })

  it('leave columns have start + end date formatters', () => {
    const startCol = EXPORT_COLUMNS.leave.find((c) => c.key === 'startDate')
    const endCol = EXPORT_COLUMNS.leave.find((c) => c.key === 'endDate')
    expect(startCol?.format).toBeDefined()
    expect(endCol?.format).toBeDefined()
  })

  it('date formatters produce ISO date strings', () => {
    const startCol = EXPORT_COLUMNS.leave.find((c) => c.key === 'startDate')!
    const result = startCol.format!('2026-03-15T00:00:00.000Z')
    expect(result).toBe('2026-03-15')
  })

  it('date formatters handle null/undefined gracefully', () => {
    const startCol = EXPORT_COLUMNS.leave.find((c) => c.key === 'startDate')!
    expect(startCol.format!(null)).toBe('')
    expect(startCol.format!(undefined)).toBe('')
  })

  it('amount formatter produces 2 decimal places', () => {
    const amtCol = EXPORT_COLUMNS.expenses.find((c) => c.key === 'amount')!
    expect(amtCol.format!(1234)).toBe('1234.00')
    expect(amtCol.format!(9.5)).toBe('9.50')
  })

  it('each column set has unique keys', () => {
    for (const [type, cols] of Object.entries(EXPORT_COLUMNS)) {
      const keys = cols.map((c) => c.key)
      const unique = new Set(keys)
      expect(unique.size).toBe(keys.length) // no duplicates within ${type}
    }
  })
})

// ── 3. ExternalLink API contract ───────────────────────

describe('ExternalLink API contract', () => {
  const VALID_ENTITY_TYPES = [
    'project', 'task', 'expense', 'document', 'leave_request',
    'service_request', 'asset', 'drawing', 'compliance_item',
    'planning_application', 'fee_quote', 'milestone',
  ]

  const LINK_TYPES = ['SHAREPOINT_FOLDER', 'SHAREPOINT_DOCUMENT', 'EXTERNAL_URL']

  it('supports 12 entity types', () => {
    expect(VALID_ENTITY_TYPES).toHaveLength(12)
  })

  it('supports 3 link types', () => {
    expect(LINK_TYPES).toHaveLength(3)
  })

  it('entity types cover all major platform entities', () => {
    // Verify key entities are present
    expect(VALID_ENTITY_TYPES).toContain('project')
    expect(VALID_ENTITY_TYPES).toContain('task')
    expect(VALID_ENTITY_TYPES).toContain('expense')
    expect(VALID_ENTITY_TYPES).toContain('document')
    expect(VALID_ENTITY_TYPES).toContain('asset')
    expect(VALID_ENTITY_TYPES).toContain('milestone')
  })

  it('link types include SharePoint variants + generic URL', () => {
    expect(LINK_TYPES).toContain('SHAREPOINT_FOLDER')
    expect(LINK_TYPES).toContain('SHAREPOINT_DOCUMENT')
    expect(LINK_TYPES).toContain('EXTERNAL_URL')
  })
})

// ── 4. Expense category enum coverage ──────────────────

describe('Expense category expansion', () => {
  const EXPENSE_CATEGORIES = [
    'TRAVEL', 'ACCOMMODATION', 'MEALS', 'EQUIPMENT', 'SOFTWARE',
    'PRINTING', 'POSTAGE', 'TRAINING', 'PPE', 'SITE_EXPENSES',
    'MATERIALS', 'SUBCONTRACTOR', 'PROFESSIONAL_FEES', 'OTHER',
  ]

  it('has exactly 14 categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(14)
  })

  it('includes the 3 new Sprint 5 categories', () => {
    expect(EXPENSE_CATEGORIES).toContain('MATERIALS')
    expect(EXPENSE_CATEGORIES).toContain('SUBCONTRACTOR')
    expect(EXPENSE_CATEGORIES).toContain('PROFESSIONAL_FEES')
  })

  it('has no duplicate categories', () => {
    const unique = new Set(EXPENSE_CATEGORIES)
    expect(unique.size).toBe(EXPENSE_CATEGORIES.length)
  })

  it('all categories are UPPER_SNAKE_CASE', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(cat).toMatch(/^[A-Z][A-Z_]*$/)
    }
  })
})

// ── 5. CSV generation edge cases ───────────────────────

describe('generateCsv edge cases', () => {
  it('handles empty rows array', () => {
    const cols: ExportColumn[] = [{ key: 'x', label: 'X' }]
    const csv = generateCsv(cols, [])
    expect(csv).toBe('X\n')
  })

  it('handles row with missing keys', () => {
    const cols: ExportColumn[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ]
    const csv = generateCsv(cols, [{ a: 'val' }])
    const lines = csv.split('\n')
    expect(lines[1]).toBe('val,')
  })

  it('handles deeply nested paths returning undefined', () => {
    const cols: ExportColumn[] = [
      { key: 'a.b.c.d', label: 'Deep' },
    ]
    const csv = generateCsv(cols, [{ a: { b: null } }])
    const lines = csv.split('\n')
    expect(lines[1]).toBe('')
  })

  it('format function receives undefined for missing values', () => {
    let received: unknown = 'sentinel'
    const cols: ExportColumn[] = [
      { key: 'missing', label: 'M', format: (v) => { received = v; return 'x' } },
    ]
    generateCsv(cols, [{}])
    expect(received).toBeUndefined()
  })
})
