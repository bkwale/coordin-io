/**
 * Export utility — shared Excel/CSV generation for all modules.
 *
 * Generates CSV format (universally compatible).
 * Each module registers its exportable columns.
 */

export interface ExportColumn {
  key: string
  label: string
  /** Optional formatter — receives the raw value, returns the display string */
  format?: (value: unknown) => string
}

/**
 * Convert rows to CSV string.
 */
export function generateCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',')

  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const raw = getNestedValue(row, col.key)
          const display = col.format ? col.format(raw) : String(raw ?? '')
          return escapeCsvField(display)
        })
        .join(','),
    )
    .join('\n')

  return `${header}\n${body}`
}

function escapeCsvField(value: string): string {
  // Guard against CSV formula injection (OWASP recommendation)
  const first = value.charAt(0)
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
    value = `'${value}`
  }
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

// ── Module column definitions ────────────────────────────

export const EXPENSE_COLUMNS: ExportColumn[] = [
  { key: 'profile.fullName', label: 'Employee' },
  { key: 'expenseCategory', label: 'Category' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount', format: (v) => Number(v).toFixed(2) },
  { key: 'currency', label: 'Currency' },
  { key: 'costCode', label: 'Cost Code' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Date', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'approver.fullName', label: 'Approver' },
]

export const TASK_COLUMNS: ExportColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'owner.fullName', label: 'Assigned To' },
  { key: 'dueDate', label: 'Due Date', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'deliverable', label: 'Deliverable' },
]

export const LEAVE_COLUMNS: ExportColumn[] = [
  { key: 'profile.fullName', label: 'Employee' },
  { key: 'leaveType', label: 'Type' },
  { key: 'startDate', label: 'Start', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'endDate', label: 'End', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'days', label: 'Days' },
  { key: 'status', label: 'Status' },
  { key: 'approver.fullName', label: 'Approver' },
]

export const ASSET_COLUMNS: ExportColumn[] = [
  { key: 'assetTag', label: 'Asset Tag' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'condition', label: 'Condition' },
  { key: 'location', label: 'Location' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'purchaseDate', label: 'Purchase Date', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
]

export const TIMESHEET_COLUMNS: ExportColumn[] = [
  { key: 'profile.fullName', label: 'Employee' },
  { key: 'weekStarting', label: 'Week Starting', format: (v) => v ? new Date(v as string).toISOString().slice(0, 10) : '' },
  { key: 'totalHours', label: 'Total Hours' },
  { key: 'status', label: 'Status' },
]

/**
 * Map of entity type to its export columns.
 */
export const EXPORT_COLUMNS: Record<string, ExportColumn[]> = {
  expenses: EXPENSE_COLUMNS,
  tasks: TASK_COLUMNS,
  leave: LEAVE_COLUMNS,
  assets: ASSET_COLUMNS,
  timesheets: TIMESHEET_COLUMNS,
}
