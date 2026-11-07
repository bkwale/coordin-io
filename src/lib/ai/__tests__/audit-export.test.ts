import { describe, it, expect, vi, beforeEach } from 'vitest'

const db: { runs: any[]; events: any[]; projects: any[]; profiles: any[]; docs: any[] } = { runs: [], events: [], projects: [], profiles: [], docs: [] }
vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIRun: { findMany: vi.fn(async ({ where }: any) => db.runs.filter((r) => r.organisationId === where.organisationId)) },
    auditEvent: { findMany: vi.fn(async () => db.events) },
    project: { findMany: vi.fn(async ({ where }: any) => db.projects.filter((p) => where.id.in.includes(p.id) && p.organisationId === where.organisationId)) },
    profile: { findMany: vi.fn(async () => db.profiles) },
    document: { findMany: vi.fn(async () => db.docs) },
  },
}))

const { buildAiRunRows, aiRunsCsv, csvCell, compareValues, AI_RUN_CSV_HEADER } = await import('@/lib/ai/audit-export')

const ORG = 'org-1'
beforeEach(() => {
  db.runs = []; db.events = []
  db.projects = [{ id: 'p1', name: 'Kase maja', organisationId: ORG }]
  db.profiles = [{ id: 'prof-1', authUserId: 'auth-1', fullName: 'Ayo Karim' }]
  db.docs = [{ id: 'doc-1', title: 'Projekteerimistingimused — PT-42.pdf' }]
})

const base = {
  organisationId: ORG, projectId: 'p1', surface: 'PROJECT_SETUP', promptVersion: 'pt-0.3', model: 'mistral/mistral-large-latest',
  inputSummary: JSON.stringify({ kind: 'planning_conditions', documentId: 'doc-1', fileName: 'PT-42.pdf' }),
  createdBy: 'auth-1', confirmedBy: 'auth-1', confirmedAt: new Date('2026-11-06T10:05:00Z'), createdAt: new Date('2026-11-06T10:00:00Z'),
  confidence: 0.873, latencyMs: 41_200, tokensUsed: 9123, error: null, errorKind: null,
  mapping: {
    kind: 'planning_conditions',
    prefills: [
      { key: 'buildingType', value: 'detached_house', kind: 'value' },
      { key: 'storeys', value: 2, kind: 'value' },
      { key: 'height', value: 9, kind: 'bound' },
    ],
    conditions: [{}, {}, {}, {}],
    warnings: ['Valid until has passed'],
  },
}

describe('AI runs audit export (S4.4)', () => {
  it('one row per run with model, prompt version, source document, who confirmed and what was accepted', async () => {
    db.runs = [{ ...base, id: 'run-1', status: 'APPLIED' }]
    db.events = [{ metadata: { sourceRunId: 'run-1', parameters: { buildingType: 'detached_house', storeys: 3 }, municipalAccepted: 3, municipalRejected: 1 } }]
    const [r] = await buildAiRunRows(ORG, new Date('2026-11-01'), new Date('2026-11-30'))
    expect(r).toMatchObject({
      'Run ID': 'run-1', 'Surface': 'Project setup from document', 'Document kind': 'Planning conditions',
      'Project': 'Kase maja', 'Source document': 'Projekteerimistingimused — PT-42.pdf', 'Source document ID': 'doc-1',
      'Status': 'APPLIED', 'Model': 'mistral/mistral-large-latest', 'Prompt version': 'pt-0.3',
      'Started by': 'Ayo Karim', 'Confirmed by': 'Ayo Karim', 'Confirmed at': '2026-11-06 10:05:00',
      'Confidence': '0.87', 'Seconds': '41.2', 'Tokens': '9123',
      // bounds are not "values"; storeys was changed from 2 to 3
      'Values proposed': '2', 'Values accepted as proposed': '1', 'Values changed or rejected': '1',
      'Conditions proposed': '4', 'Conditions accepted': '3', 'Conditions rejected': '1',
      'Warnings': 'Valid until has passed', 'Failure kind': '', 'Failure message': '',
    })
  })

  it('unconfirmed and failed runs are listed too, with the failure', async () => {
    db.runs = [
      { ...base, id: 'run-2', status: 'AWAITING_CONFIRMATION', confirmedBy: null, confirmedAt: null },
      { ...base, id: 'run-3', status: 'FAILED', confirmedBy: null, confirmedAt: null, mapping: null, error: 'The AI service isn’t responding right now.', errorKind: 'unavailable' },
    ]
    const rows = await buildAiRunRows(ORG, new Date('2026-11-01'), new Date('2026-11-30'))
    expect(rows.find((r) => r['Run ID'] === 'run-2')).toMatchObject({ 'Confirmed by': '', 'Values accepted as proposed': '', 'Conditions accepted': '' })
    expect(rows.find((r) => r['Run ID'] === 'run-3')).toMatchObject({ 'Status': 'FAILED', 'Failure kind': 'unavailable', 'Failure message': expect.stringContaining('isn’t responding') })
  })

  it('practice setup runs show module decisions and overrides', async () => {
    db.runs = [{ ...base, id: 'run-4', surface: 'PRACTICE_SETUP', projectId: null, inputSummary: 'https://salto.ee', status: 'APPLIED', mapping: { warnings: [] } }]
    db.events = [{ metadata: { runId: 'run-4', decisions: [{}, {}, {}], overriddenKeys: ['expenses'] } }]
    const [r] = await buildAiRunRows(ORG, new Date('2026-11-01'), new Date('2026-11-30'))
    expect(r).toMatchObject({ 'Surface': 'Practice setup', 'Source document': 'https://salto.ee', 'Modules decided': '3', 'Modules overridden': '1', 'Values proposed': '' })
  })

  it('another organisation’s runs never appear', async () => {
    db.runs = [{ ...base, id: 'run-x', organisationId: 'org-2', status: 'APPLIED' }]
    expect(await buildAiRunRows(ORG, new Date('2026-11-01'), new Date('2026-11-30'))).toEqual([])
  })

  it('CSV has the header and neutralises spreadsheet formulas', async () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('a,b')).toBe('"a,b"')
    db.runs = [{ ...base, id: 'run-1', status: 'APPLIED' }]
    const csv = aiRunsCsv(await buildAiRunRows(ORG, new Date('2026-11-01'), new Date('2026-11-30')))
    const [header, line] = csv.split('\n')
    expect(header.split(',')).toHaveLength(AI_RUN_CSV_HEADER.length)
    expect(line).toContain('run-1')
  })

  it('compareValues: numbers compare by value, missing confirmation gives no verdict', () => {
    const p = [{ key: 'gfa', value: 185.5, kind: 'value' as const }]
    expect(compareValues(p, { gfa: 185.5 })).toEqual({ proposed: 1, accepted: 1, changed: 0 })
    expect(compareValues(p, null)).toEqual({ proposed: 1, accepted: null, changed: null })
  })
})
