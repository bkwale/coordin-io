import { describe, it, expect, vi } from 'vitest'

// Mock prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  formatRevisionCode,
  parseRevisionCode,
  getRevisionPrefix,
  compareRevisions,
} from '@/lib/revision-numbering'

// ── formatRevisionCode ─────────────────────────────────────
describe('formatRevisionCode', () => {
  it("('P', 1) -> 'P01'", () => {
    expect(formatRevisionCode('P', 1)).toBe('P01')
  })

  it("('P', 12) -> 'P12'", () => {
    expect(formatRevisionCode('P', 12)).toBe('P12')
  })

  it("('C', 1) -> 'C01'", () => {
    expect(formatRevisionCode('C', 1)).toBe('C01')
  })

  it("('C', 99) -> 'C99'", () => {
    expect(formatRevisionCode('C', 99)).toBe('C99')
  })
})

// ── parseRevisionCode ──────────────────────────────────────
describe('parseRevisionCode', () => {
  it("'P01' -> { prefix: 'P', sequence: 1 }", () => {
    expect(parseRevisionCode('P01')).toEqual({ prefix: 'P', sequence: 1 })
  })

  it("'C03' -> { prefix: 'C', sequence: 3 }", () => {
    expect(parseRevisionCode('C03')).toEqual({ prefix: 'C', sequence: 3 })
  })

  it("'P12' -> { prefix: 'P', sequence: 12 }", () => {
    expect(parseRevisionCode('P12')).toEqual({ prefix: 'P', sequence: 12 })
  })

  it("'X01' -> null (invalid prefix)", () => {
    expect(parseRevisionCode('X01')).toBeNull()
  })

  it("'P' -> null (no number)", () => {
    expect(parseRevisionCode('P')).toBeNull()
  })

  it("'' -> null (empty string)", () => {
    expect(parseRevisionCode('')).toBeNull()
  })

  it("'ABC' -> null (invalid format)", () => {
    expect(parseRevisionCode('ABC')).toBeNull()
  })
})

// ── getRevisionPrefix ──────────────────────────────────────
describe('getRevisionPrefix', () => {
  it("false -> 'P' (preliminary)", () => {
    expect(getRevisionPrefix(false)).toBe('P')
  })

  it("true -> 'C' (construction)", () => {
    expect(getRevisionPrefix(true)).toBe('C')
  })
})

// ── compareRevisions ───────────────────────────────────────
describe('compareRevisions', () => {
  it("('P01', 'P02') -> negative (P01 < P02)", () => {
    expect(compareRevisions('P01', 'P02')).toBeLessThan(0)
  })

  it("('P02', 'P01') -> positive (P02 > P01)", () => {
    expect(compareRevisions('P02', 'P01')).toBeGreaterThan(0)
  })

  it("('P01', 'P01') -> 0 (equal)", () => {
    expect(compareRevisions('P01', 'P01')).toBe(0)
  })

  it("('P01', 'C01') -> negative (P < C always)", () => {
    expect(compareRevisions('P01', 'C01')).toBeLessThan(0)
  })

  it("('C01', 'P99') -> positive (C > P always)", () => {
    expect(compareRevisions('C01', 'P99')).toBeGreaterThan(0)
  })

  it("('C01', 'C03') -> negative (C01 < C03)", () => {
    expect(compareRevisions('C01', 'C03')).toBeLessThan(0)
  })
})
