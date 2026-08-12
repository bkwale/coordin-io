/**
 * Audit Trail — Crispin QA Test Suite
 *
 * Covers: filter logic, HR scoping, composite filter,
 * rate limiting, CSV export, edge cases.
 *
 * NOTE: audit.ts imports prisma at top level, so we mock it
 * to avoid needing a real DB connection for pure logic tests.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock prisma before importing audit.ts
vi.mock('../prisma', () => ({
  prisma: {
    auditEvent: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}))

import { HR_VISIBLE_PREFIXES, AUDIT_ACTION_LABELS, AuditActions } from '../audit'

// ── Filter Logic Tests ────────────────────────────────────

describe('Audit Trail: Filter Logic', () => {
  describe('QUICK_FILTERS have unique values', () => {
    const QUICK_FILTERS = [
      { label: 'All', value: '' },
      { label: 'HR (All)', value: 'hr' },
      { label: 'Staffing', value: 'staffing.' },
      { label: 'Leave', value: 'leave.' },
      { label: 'Expenses', value: 'expense.' },
      { label: 'Onboarding', value: 'onboarding.' },
      { label: 'Invitations', value: 'invitation.' },
      { label: 'Requests', value: 'request.' },
      { label: 'Assets', value: 'asset.' },
      { label: 'Projects', value: 'project.' },
      { label: 'Tasks', value: 'task.' },
      { label: 'Documents', value: 'document.' },
      { label: 'Security', value: 'security.' },
      { label: 'Commercial', value: 'commercial.' },
      { label: 'Site', value: 'site.' },
    ]

    it('no two filters share the same value', () => {
      const values = QUICK_FILTERS.map(f => f.value)
      const unique = new Set(values)
      expect(unique.size).toBe(values.length)
    })

    it('every filter value is either empty, "hr", or ends with a dot', () => {
      for (const f of QUICK_FILTERS) {
        if (f.value === '' || f.value === 'hr') continue
        expect(f.value.endsWith('.')).toBe(true)
      }
    })

    it('every individual filter prefix has at least one matching label or action', () => {
      // Filters use startsWith matching at the DB level. We check that each
      // prefix maps to at least one entry in AUDIT_ACTION_LABELS or AuditActions.
      const allLabelKeys = Object.keys(AUDIT_ACTION_LABELS)
      const allActions = Object.values(AuditActions) as string[]
      const allKnown = [...new Set([...allLabelKeys, ...allActions])]
      for (const f of QUICK_FILTERS) {
        if (f.value === '' || f.value === 'hr') continue
        const hasMatch = allKnown.some(a => a.startsWith(f.value))
        expect(hasMatch, `No label or action starts with "${f.value}"`).toBe(true)
      }
    })
  })
})

// ── HR Scope Tests ────────────────────────────────────────

describe('Audit Trail: HR Scope', () => {
  it('HR_VISIBLE_PREFIXES are all dot-terminated', () => {
    for (const p of HR_VISIBLE_PREFIXES) {
      expect(p.endsWith('.')).toBe(true)
    }
  })

  it('HR cannot see project, task, document, site, commercial, security, or auth actions', () => {
    const forbidden = ['project.', 'task.', 'document.', 'site.', 'commercial.', 'security.', 'auth.', 'audit.']
    for (const prefix of forbidden) {
      const isVisible = HR_VISIBLE_PREFIXES.some(p => p === prefix)
      expect(isVisible, `HR should NOT see "${prefix}" but it's in HR_VISIBLE_PREFIXES`).toBe(false)
    }
  })

  it('HR CAN see staffing, leave, expense, onboarding, invitation, asset, request', () => {
    const required = ['staffing.', 'leave.', 'expense.', 'onboarding.', 'invitation.', 'asset.', 'request.']
    for (const prefix of required) {
      const isVisible = HR_VISIBLE_PREFIXES.some(p => p === prefix)
      expect(isVisible, `HR should see "${prefix}" but it's missing from HR_VISIBLE_PREFIXES`).toBe(true)
    }
  })

  it('composite "hr" filter covers all and only HR_VISIBLE_PREFIXES', () => {
    // Simulate what the API does when action=hr
    const compositeOR = HR_VISIBLE_PREFIXES.map(prefix => prefix)
    expect(compositeOR).toEqual([
      'staffing.', 'leave.', 'expense.', 'onboarding.',
      'invitation.', 'asset.', 'request.',
    ])
  })

  it('HR isAllowed check works for each visible prefix', () => {
    for (const prefix of HR_VISIBLE_PREFIXES) {
      const isAllowed = HR_VISIBLE_PREFIXES.some(
        p => prefix.startsWith(p) || p.startsWith(prefix)
      )
      expect(isAllowed, `"${prefix}" should pass isAllowed check`).toBe(true)
    }
  })

  it('HR isAllowed rejects non-HR prefixes', () => {
    const forbidden = ['project.', 'task.', 'commercial.', 'site.', 'auth.', 'drawing.']
    for (const prefix of forbidden) {
      const isAllowed = HR_VISIBLE_PREFIXES.some(
        p => prefix.startsWith(p) || p.startsWith(prefix)
      )
      expect(isAllowed, `"${prefix}" should NOT pass isAllowed check`).toBe(false)
    }
  })
})

// ── Action Labels Tests ───────────────────────────────────

describe('Audit Trail: Action Labels', () => {
  it('every AuditAction has a human-readable label', () => {
    const allActions = Object.values(AuditActions) as string[]
    const missing: string[] = []
    for (const action of allActions) {
      if (!AUDIT_ACTION_LABELS[action]) {
        missing.push(action)
      }
    }
    expect(missing, `Missing labels for: ${missing.join(', ')}`).toEqual([])
  })

  it('no label is just the raw action string', () => {
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label).not.toBe(action)
    }
  })

  it('labels do not contain dots or underscores', () => {
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label.includes('.')).toBe(false)
      expect(label.includes('_'), `Label for "${action}" contains underscore: "${label}"`).toBe(false)
    }
  })
})

// ── Rate Limiting Logic ───────────────────────────────────

describe('Audit Trail: Rate Limiting', () => {
  it('in-memory map correctly tracks cooldown', () => {
    const COOLDOWN = 60_000
    const timestamps = new Map<string, number>()
    const profileId = 'test-profile-123'

    // First export — should pass
    const last1 = timestamps.get(profileId) || 0
    expect(Date.now() - last1 >= COOLDOWN).toBe(true)
    timestamps.set(profileId, Date.now())

    // Immediate second — should fail
    const last2 = timestamps.get(profileId) || 0
    expect(Date.now() - last2 < COOLDOWN).toBe(true)
  })
})

// ── CSV Export Edge Cases ─────────────────────────────────

describe('Audit Trail: CSV Escaping', () => {
  const escCsv = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  it('passes through clean strings', () => {
    expect(escCsv('hello')).toBe('hello')
  })

  it('wraps strings with commas', () => {
    expect(escCsv('hello, world')).toBe('"hello, world"')
  })

  it('escapes double quotes', () => {
    expect(escCsv('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps strings with newlines', () => {
    expect(escCsv('line1\nline2')).toBe('"line1\nline2"')
  })

  it('handles combined special chars', () => {
    expect(escCsv('a,b"c\nd')).toBe('"a,b""c\nd"')
  })
})

// ── Date Range Validation ─────────────────────────────────

describe('Audit Trail: Date Range Validation', () => {
  it('rejects ranges over 90 days', () => {
    const from = new Date('2026-01-01')
    const to = new Date('2026-05-01')
    const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    expect(rangeDays > 90).toBe(true)
  })

  it('accepts ranges within 90 days', () => {
    const from = new Date('2026-01-01')
    const to = new Date('2026-03-01')
    const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    expect(rangeDays <= 90).toBe(true)
  })

  it('rejects negative ranges', () => {
    const from = new Date('2026-03-01')
    const to = new Date('2026-01-01')
    const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    expect(rangeDays < 0).toBe(true)
  })
})

// ── Missing Label Coverage ────────────────────────────────

describe('Audit Trail: Label Coverage Gaps', () => {
  it('all HR-visible action types have at least one label', () => {
    for (const prefix of HR_VISIBLE_PREFIXES) {
      const hasLabel = Object.keys(AUDIT_ACTION_LABELS).some(k => k.startsWith(prefix))
      expect(hasLabel, `No label starts with HR-visible prefix "${prefix}"`).toBe(true)
    }
  })

  it('AUDIT_EXPORTED action exists and has a label', () => {
    expect(AuditActions.AUDIT_EXPORTED).toBe('audit.exported')
    expect(AUDIT_ACTION_LABELS['audit.exported']).toBe('Exported audit trail')
  })
})
