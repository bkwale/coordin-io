import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Summaries: reading the stored file and turning confirmed actions into tasks. Database and storage are faked. */

type Row = Record<string, any>
const db = { documents: [] as Row[], runs: [] as Row[], tasks: [] as Row[] }
const audit = vi.fn().mockResolvedValue(undefined)
const budget = vi.fn().mockResolvedValue(undefined)
const assignable = vi.fn().mockResolvedValue(undefined)
const download = vi.fn()
const readPages = vi.fn()

const runApi = {
  create: vi.fn(async ({ data }: Row) => { const r = { id: `run${db.runs.length + 1}`, citations: null, mapping: null, ...data }; db.runs.push(r); return r }),
  findFirst: vi.fn(async ({ where }: Row) => db.runs.find((r) =>
    (!where.id || r.id === where.id) && r.projectId === where.projectId && r.surface === where.surface &&
    (!where.status || where.status.in.includes(r.status)) && (!where.inputSummary || r.inputSummary.includes(where.inputSummary.contains))) ?? null),
  update: vi.fn(async ({ where, data }: Row) => { const r = db.runs.find((x) => x.id === where.id)!; Object.assign(r, data); return r }),
}
const tx = {
  $queryRaw: vi.fn(async () => []),
  aIRun: runApi,
  task: { create: vi.fn(async ({ data }: Row) => { const t = { id: `task${db.tasks.length + 1}`, ...data }; db.tasks.push(t); return t }) },
  auditEvent: { create: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findFirst: vi.fn(async ({ where }: Row) => db.documents.find((d) => d.id === where.id && d.projectId === where.projectId) ?? null) },
    aIRun: runApi,
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  },
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => ({ download: (...a: unknown[]) => download(...a) }) } }) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...a), AuditActions: { AI_SUMMARY_RUN: 'ai.summary_run', AI_SUMMARY_TASKS_CREATED: 'ai.summary_tasks_created', TASK_CREATED: 'task.created' } }))
vi.mock('@/lib/ai/budget', () => ({ assertAiBudget: (...a: unknown[]) => budget(...a) }))
vi.mock('@/lib/assignable', () => ({ assertAssignable: (...a: unknown[]) => assignable(...a) }))
vi.mock('@/lib/ai/summary-shared', () => ({ readDocumentPages: (...a: unknown[]) => readPages(...a), SUMMARY_PROMPT_VERSION_FOR_RUNS: 'summary-test' }))

const { startSummary, latestSummary, createTasksFromSummary } = await import('@/lib/ai/summary-service')
const { IngestError } = await import('@/lib/ai/document-ingest')

const ORG = 'org1', PROJECT = 'proj1', DOC = 'cdocument0000000000000001'
const input = { projectId: PROJECT, organisationId: ORG, authUserId: 'auth1', profileId: 'prof1', documentId: DOC, language: 'same' as const }
const blob = (size = 1000) => ({ size, arrayBuffer: async () => new ArrayBuffer(8) })
const doc = (fileUrl: string | null) => ({ id: DOC, projectId: PROJECT, title: 'Protokoll nr 4', revisions: fileUrl === null ? [] : [{ id: 'rev1', revision: 'A', fileUrl }] })
const mapping = (n = 3) => ({ kind: 'summary', actions: Array.from({ length: n }, (_, i) => ({ text: `Action ${i}`, owner: i === 0 ? 'Liis Kask' : null, due: i === 0 ? '10.11.2026' : null, page: 2, quote: `quote ${i}`, verified: true })) })
const seedRun = (over: Row = {}): Row => { const r: Row = { id: 'run-s', projectId: PROJECT, surface: 'EXTRACTION', status: 'AWAITING_CONFIRMATION', inputSummary: JSON.stringify({ kind: 'summary', documentId: DOC, title: 'Protokoll nr 4' }), mapping: mapping(), citations: null, ...over }; db.runs.push(r); return r }

beforeEach(() => {
  db.documents = []; db.runs = []; db.tasks = []
  for (const f of [audit, budget, assignable, download, readPages]) f.mockReset()
  audit.mockResolvedValue(undefined); budget.mockResolvedValue(undefined); assignable.mockResolvedValue(undefined)
  download.mockResolvedValue({ data: blob(), error: null })
  readPages.mockResolvedValue({ pages: ['page one', 'page two'], format: 'pdf', truncated: false })
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
})

describe('startSummary: which file may be read', () => {
  it('reads the latest file of a document in this project and creates a queued run', async () => {
    db.documents.push(doc(`/api/files?b=documents&p=${ORG}%2F${PROJECT}%2F123-minutes.pdf`))
    const { run, pages } = await startSummary(input)
    expect(download).toHaveBeenCalledWith(`${ORG}/${PROJECT}/123-minutes.pdf`)
    expect(pages).toEqual(['page one', 'page two'])
    expect(run.status).toBe('QUEUED')
    expect(JSON.parse(run.inputSummary)).toMatchObject({ kind: 'summary', documentId: DOC, revision: 'A', title: 'Protokoll nr 4', pages: 2 })
    expect(budget).toHaveBeenCalledWith(ORG)
  })
  it('checks the daily AI allowance before touching anything', async () => {
    budget.mockRejectedValue(new Error('limit'))
    db.documents.push(doc(`/api/files?b=documents&p=${ORG}%2F${PROJECT}%2Fa.pdf`))
    await expect(startSummary(input)).rejects.toThrow('limit')
    expect(download).not.toHaveBeenCalled()
  })
  it('a document from another project is not found', async () => {
    db.documents.push({ ...doc(`/api/files?b=documents&p=${ORG}%2Fother%2Fa.pdf`), projectId: 'other' })
    await expect(startSummary(input)).rejects.toThrow(/not found/i)
    expect(download).not.toHaveBeenCalled()
  })
  it('refuses a file stored under another firm or another project, without downloading it', async () => {
    for (const path of [`otherorg%2F${PROJECT}%2Fa.pdf`, `${ORG}%2Fotherproject%2Fa.pdf`, `${ORG}%2F${PROJECT}%2F..%2F..%2Fsecret.pdf`]) {
      db.documents = [doc(`/api/files?b=documents&p=${path}`)]
      await expect(startSummary(input)).rejects.toThrow(/does not belong to this project/)
    }
    expect(download).not.toHaveBeenCalled()
  })
  it('refuses a link to a file kept elsewhere, and the receipts bucket', async () => {
    for (const url of ['https://contoso.sharepoint.com/sites/x/spec.pdf', `/api/files?b=receipts&p=${ORG}%2F${PROJECT}%2Fa.pdf`, 'http://169.254.169.254/latest/meta-data']) {
      db.documents = [doc(url)]
      await expect(startSummary(input)).rejects.toThrow(/Only files stored in Coordin/)
    }
    expect(download).not.toHaveBeenCalled()
  })
  it('a document with no file says so', async () => {
    db.documents.push(doc(null))
    await expect(startSummary(input)).rejects.toThrow(/no file yet/)
  })
  it('an unreadable file fails clearly and is recorded, so it counts against the allowance', async () => {
    db.documents.push(doc(`/api/files?b=documents&p=${ORG}%2F${PROJECT}%2Fscan.pdf`))
    readPages.mockRejectedValue(new IngestError('no_text_layer', 'This PDF has no text layer (it is a scan).'))
    await expect(startSummary(input)).rejects.toThrow(/no text layer/)
    expect(db.runs).toHaveLength(1)
    expect(db.runs[0]).toMatchObject({ status: 'FAILED', errorKind: 'input', surface: 'EXTRACTION' })
  })
  it('a file over the size limit is refused and recorded', async () => {
    db.documents.push(doc(`/api/files?b=documents&p=${ORG}%2F${PROJECT}%2Fbig.pdf`))
    download.mockResolvedValue({ data: blob(60 * 1024 * 1024), error: null })
    await expect(startSummary(input)).rejects.toThrow(/over \d+ MB/)
    expect(readPages).not.toHaveBeenCalled()
    expect(db.runs[0].status).toBe('FAILED')
  })
})

describe('latestSummary', () => {
  it('finds only summary runs of this document in this project', async () => {
    seedRun({ id: 'mine' })
    db.runs.push({ id: 'other-doc', projectId: PROJECT, surface: 'EXTRACTION', status: 'APPLIED', inputSummary: JSON.stringify({ kind: 'summary', documentId: 'cdocument0000000000000002' }) })
    db.runs.push({ id: 'setup', projectId: PROJECT, surface: 'PROJECT_SETUP', status: 'APPLIED', inputSummary: JSON.stringify({ kind: 'summary', documentId: DOC }) })
    expect((await latestSummary(PROJECT, DOC))?.id).toBe('mine')
    expect(await latestSummary('other-project', DOC)).toBeNull()
  })
})

describe('createTasksFromSummary: a person confirms, then tasks exist', () => {
  const call = (picks: Array<{ index: number; ownerId: string | null; dueDate: Date | null }>, over: Row = {}) =>
    createTasksFromSummary({ runId: 'run-s', projectId: PROJECT, documentId: DOC, organisationId: ORG, profileId: 'prof1', authUserId: 'auth1', picks, ...over })

  it('creates the chosen tasks with the person\'s owner and date, and the document wording in the description', async () => {
    seedRun()
    const due = new Date('2026-11-10')
    const r = await call([{ index: 0, ownerId: 'prof2', dueDate: due }, { index: 2, ownerId: null, dueDate: null }])
    expect(r.created.map((c) => c.index)).toEqual([0, 2])
    expect(db.tasks).toHaveLength(2)
    expect(db.tasks[0]).toMatchObject({ projectId: PROJECT, title: 'Action 0', ownerId: 'prof2', dueDate: due })
    expect(db.tasks[0].description).toContain('Named in the document: Liis Kask')
    expect(db.tasks[0].description).toContain('page 2')
    expect(db.tasks[1]).toMatchObject({ title: 'Action 2', ownerId: null, dueDate: null })
  })
  it('the name in the document is never used as the owner', async () => {
    seedRun()
    await call([{ index: 0, ownerId: null, dueDate: null }])
    expect(db.tasks[0].ownerId).toBeNull()
  })
  it('remembers what was made, marks the run applied, and audits each task', async () => {
    const run = seedRun()
    await call([{ index: 1, ownerId: null, dueDate: null }])
    expect(run.status).toBe('APPLIED')
    expect(run.citations).toEqual({ tasks: { '1': 'task1' } })
    expect(run.confirmedBy).toBe('auth1')
    const actions = audit.mock.calls.map((c) => c[0].action)
    expect(actions).toEqual(['task.created', 'ai.summary_tasks_created'])
    expect(audit.mock.calls[0][0]).toMatchObject({ actorId: 'prof1', entityId: 'task1' })
  })
  it('a second request for the same action creates nothing', async () => {
    seedRun()
    await call([{ index: 1, ownerId: null, dueDate: null }])
    const again = await call([{ index: 1, ownerId: null, dueDate: null }, { index: 2, ownerId: null, dueDate: null }])
    expect(again.skipped).toEqual([1])
    expect(again.created.map((c) => c.index)).toEqual([2])
    expect(db.tasks).toHaveLength(2)
  })
  it('locks the run before reading it', async () => {
    seedRun()
    tx.$queryRaw.mockClear()
    await call([{ index: 0, ownerId: null, dueDate: null }])
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })
  it('refuses an action that is not in the summary, an empty choice, and too many', async () => {
    seedRun()
    await expect(call([{ index: 9, ownerId: null, dueDate: null }])).rejects.toThrow(/not in this summary/)
    await expect(call([])).rejects.toThrow(/at least one/)
    await expect(call(Array.from({ length: 41 }, (_, i) => ({ index: i, ownerId: null, dueDate: null })))).rejects.toThrow(/Too many/)
    expect(db.tasks).toHaveLength(0)
  })
  it('refuses a run from another project, another document, or one still running or failed', async () => {
    seedRun()
    await expect(call([{ index: 0, ownerId: null, dueDate: null }], { projectId: 'other' })).rejects.toThrow(/not found/i)
    await expect(call([{ index: 0, ownerId: null, dueDate: null }], { documentId: 'cdocument0000000000000002' })).rejects.toThrow(/not found/i)
    db.runs[0].status = 'RUNNING'
    await expect(call([{ index: 0, ownerId: null, dueDate: null }])).rejects.toThrow(/not found/i)
    db.runs[0].status = 'FAILED'
    await expect(call([{ index: 0, ownerId: null, dueDate: null }])).rejects.toThrow(/not found/i)
    expect(db.tasks).toHaveLength(0)
  })
  it('refuses an owner who cannot be given work in this firm, before creating anything', async () => {
    seedRun()
    assignable.mockRejectedValue(new Error('Owner is not an active member of your organisation'))
    await expect(call([{ index: 0, ownerId: 'outsider', dueDate: null }])).rejects.toThrow(/not an active member/)
    expect(assignable).toHaveBeenCalledWith(ORG, ['outsider'])
    expect(db.tasks).toHaveLength(0)
  })
})
