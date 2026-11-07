import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Sprint 2.2/2.3 — Regulatory API route tests.
 * Exercises the POST write path (versioning, preserve architect items, drop stale, diff, audit),
 * the GET shape the UI depends on, the add-missing-item endpoint, and the two production scenarios
 * verified by hand on 4 Nov 2026 as regression fixtures.
 */

// ── In-memory "DB" ─────────────────────────────────────────
type Item = Record<string, any>
const db = {
  profiles: [] as Item[],
  registers: [] as Item[],
  items: [] as Item[],
}
let idSeq = 0
const nextId = (p: string) => `${p}-${++idSeq}`

function matchWhere(row: Item, where: Item): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Item[]).some((w) => matchWhere(row, w))
    if (k === 'NOT') return !matchWhere(row, v as Item)
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      if ('notIn' in v) return !(v.notIn as unknown[]).includes(row[k])
      if ('in' in v) return (v.in as unknown[]).includes(row[k])
    }
    return row[k] === v
  })
}

const tx = {
  projectProfile: {
    findFirst: vi.fn(async ({ where }: Item) => {
      const rows = db.profiles.filter((r) => matchWhere(r, where)).sort((a, b) => b.version - a.version)
      return rows[0] ?? null
    }),
    create: vi.fn(async ({ data }: Item) => {
      if (db.profiles.some((p) => p.projectId === data.projectId && p.version === data.version)) throw Object.assign(new Error('unique'), { code: 'P2002' })
      const row = { id: nextId('prof'), createdAt: new Date(), ...data }
      db.profiles.push(row)
      return row
    }),
  },
  complianceRegister: {
    findFirst: vi.fn(async ({ where, include }: Item) => {
      const r = db.registers.find((x) => matchWhere(x, where)) ?? null
      if (!r) return null
      return include?.items ? { ...r, items: db.items.filter((i) => i.registerId === r.id) } : r
    }),
    create: vi.fn(async ({ data }: Item) => {
      const row = { id: nextId('reg'), updatedAt: new Date(), ...data }
      db.registers.push(row)
      return { ...row, items: [] }
    }),
    update: vi.fn(async ({ where, data }: Item) => {
      const r = db.registers.find((x) => x.id === where.id)!
      Object.assign(r, data, { updatedAt: new Date() })
      return r
    }),
  },
  complianceItem: {
    findMany: vi.fn(async ({ where }: Item) => db.items.filter((i) => matchWhere(i, where))),
    findFirst: vi.fn(async ({ where, orderBy }: Item) => {
      const rows = db.items.filter((i) => matchWhere(i, where))
      if (orderBy?.sortOrder === 'desc') rows.sort((a, b) => b.sortOrder - a.sortOrder)
      return rows[0] ?? null
    }),
    deleteMany: vi.fn(async ({ where }: Item) => {
      const before = db.items.length
      db.items = db.items.filter((i) => !matchWhere(i, where))
      return { count: before - db.items.length }
    }),
    createMany: vi.fn(async ({ data }: Item) => {
      for (const d of data) db.items.push({ id: nextId('item'), status: 'NOT_STARTED', addedByArchitect: false, origin: 'RULE', ...d })
      return { count: data.length }
    }),
    create: vi.fn(async ({ data }: Item) => {
      const row = { id: nextId('item'), status: 'NOT_STARTED', addedByArchitect: false, origin: 'RULE', ...data }
      db.items.push(row)
      return row
    }),
    update: vi.fn(async ({ where, data }: Item) => {
      const r = db.items.find((x) => x.id === where.id)!
      Object.assign(r, data)
      return r
    }),
  },
}

const transactionOpts: Item[] = []
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ...tx,
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>, opts?: Item) => {
      transactionOpts.push(opts ?? {})
      return fn(tx)
    }),
  },
}))

const audit = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', () => ({
  recordAuditEvent: (...a: unknown[]) => audit(...a),
  AuditActions: { AI_PROJECT_CONFIGURED: 'ai.project_configured' },
}))

const ctx = { role: 'PROJECT_LEAD' }
const ROLE_RANK: Record<string, number> = { PROJECT_LEAD: 0, PROJECT_ARCHITECT: 1, DESIGN_LEAD: 2, SENIOR_ARCHITECT: 3, ARCHITECT: 4, TEAM_MEMBER: 5, EXTERNAL_CONSULTANT: 6, CONTRACTOR: 7 }
vi.mock('@/lib/with-project-access', () => ({
  withProjectAccess: (handler: any, opts?: { minProjectRole?: string }) => async (req: any) => {
    try {
      if (opts?.minProjectRole && ROLE_RANK[ctx.role] > ROLE_RANK[opts.minProjectRole]) {
        return new Response(JSON.stringify({ error: 'Insufficient project role' }), { status: 403 })
      }
      return await handler(req, {
        authUserId: 'auth-1',
        profile: { id: 'actor-1' },
        project: { id: 'project-1', organisationId: 'org-1' },
        membership: { projectRole: ctx.role },
        projectId: 'project-1',
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: err.statusCode ?? 500 })
    }
  },
}))

const { GET, POST } = await import('@/app/api/projects/[id]/regulatory/route')
const { STALE_PREFIX } = await import('@/lib/rules/apply')
const { POST: POST_ITEM } = await import('@/app/api/projects/[id]/regulatory/items/route')
const { match, getRuleSet } = await import('@/lib/rules')

const DETACHED = { jurisdiction: 'EE', buildingType: 'detached_house', workType: 'new_build', grossFloorArea: 160, height: 7, storeys: 2, heatedArea: 150, enclosedNetArea: 150, detailedPlanExists: false, urbanArea: false }
const BLOCK = { ...DETACHED, buildingType: 'apartment_block', grossFloorArea: 2400, height: 17, storeys: 5, apartments: 24, parkingSpaces: 30 }

const post = (parameters: unknown) => POST(new Request('http://x/api/projects/project-1/regulatory', { method: 'POST', body: JSON.stringify({ parameters }), headers: { 'content-type': 'application/json' } }) as any)
const get = () => GET(new Request('http://x/api/projects/project-1/regulatory') as any)
const postItem = (body: unknown) => POST_ITEM(new Request('http://x/api/projects/project-1/regulatory/items', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as any)
const json = async (r: Response) => (await r.json()) as any

beforeEach(() => {
  db.profiles = []; db.registers = []; db.items = []; idSeq = 0
  audit.mockClear(); transactionOpts.length = 0; ctx.role = 'PROJECT_LEAD'
  for (const m of Object.values(tx.complianceItem)) m.mockClear()
})

// ── Production scenarios (verified by hand on www.coordin.io, 4 Nov 2026) ──
describe('regression fixtures from production', () => {
  it('detached house 160 m² / 2 storeys → 26 obligations', () => {
    expect(match(DETACHED as any, getRuleSet('EE')!)).toHaveLength(26)
  })
  it('apartment block 2400 m² / 5 storeys / 24 flats → 48 obligations', () => {
    expect(match(BLOCK as any, getRuleSet('EE')!)).toHaveLength(48)
  })
  it('house uses notice of use (kasutusteatis); block needs use permit (kasutusluba)', () => {
    const house = match(DETACHED as any, getRuleSet('EE')!).map((c) => c.ruleId)
    const block = match(BLOCK as any, getRuleSet('EE')!).map((c) => c.ruleId)
    const houseUse = house.filter((id) => /USE/.test(id))
    const blockUse = block.filter((id) => /USE/.test(id))
    expect(houseUse).not.toEqual(blockUse)
    expect(house.filter((id) => block.includes(id)).length).toBeGreaterThan(10) // shared core
  })
})

// ── POST write path ────────────────────────────────────────
describe('POST /api/projects/[id]/regulatory', () => {
  it('rejects invalid parameters with a field-level message', async () => {
    const res = await post({ ...DETACHED, storeys: -1 })
    expect(res.status).toBe(400)
    expect((await json(res)).error ?? '').toMatch(/storeys/)
  })

  it('rejects jurisdictions with no rule set yet', async () => {
    const res = await post({ ...DETACHED, jurisdiction: 'PL' })
    expect(res.status).toBe(400)
    expect((await json(res)).error).toMatch(/PL/)
  })

  it('first run: creates profile v1, a REGULATORY register, one item per checklist entry, audits every citation', async () => {
    const res = await post(DETACHED)
    expect(res.status).toBe(200)
    const body = (await json(res)).data
    expect(body.profile.version).toBe(1)
    expect(body.ruleSetVersion).toBe('EE-1.0')
    expect(db.registers).toHaveLength(1)
    expect(db.registers[0].registerType).toBe('REGULATORY')
    expect(db.items).toHaveLength(26)
    expect(db.items.every((i) => i.ruleId && i.citation && i.ruleSetVersion === 'EE-1.0' && i.origin === 'RULE')).toBe(true)
    expect(body.diff).toEqual({ added: expect.arrayContaining(['EE.PERMIT.BUILDING_PERMIT']), removed: [] })
    expect(audit).toHaveBeenCalledTimes(1)
    const meta = audit.mock.calls[0][0].metadata
    expect(meta.citations).toHaveLength(26)
    expect(meta.citations[0]).toMatch(/^EE\./)
  })

  it('re-run: increments profile version, reuses the register, reports diff, keeps surviving item status', async () => {
    await post(DETACHED)
    const permit = db.items.find((i) => i.ruleId === 'EE.PERMIT.BUILDING_PERMIT')!
    permit.status = 'COMPLIANT' // architect marked it done

    const res = await post(BLOCK)
    const body = (await json(res)).data
    expect(body.profile.version).toBe(2)
    expect(db.profiles).toHaveLength(2)
    expect(db.registers).toHaveLength(1)
    expect(db.items).toHaveLength(48)
    expect(body.diff.added.length).toBe(32)
    expect(body.diff.removed.length).toBe(10)
    // survivor keeps its status and its row id — evidence/comments not lost
    const permitAfter = db.items.find((i) => i.ruleId === 'EE.PERMIT.BUILDING_PERMIT')!
    expect(permitAfter.id).toBe(permit.id)
    expect(permitAfter.status).toBe('COMPLIANT')
    expect(permitAfter.because).toMatch(/2400/)
  })

  it('re-run preserves architect-added items and deletes untouched generated items no longer applicable', async () => {
    await post(BLOCK)
    db.items.push({ id: 'arch-1', registerId: db.registers[0].id, requirement: 'Local noise bylaw', addedByArchitect: true, origin: 'ARCHITECT', ruleId: null, sortOrder: 9999 })
    await post(DETACHED)
    expect(db.items.find((i) => i.id === 'arch-1')).toBeTruthy()
    expect(db.items.filter((i) => i.origin === 'RULE')).toHaveLength(26)
    const blockOnly = match(BLOCK as any, getRuleSet('EE')!).map((c) => c.ruleId).filter((id) => !match(DETACHED as any, getRuleSet('EE')!).some((c) => c.ruleId === id))
    expect(db.items.some((i) => blockOnly.includes(i.ruleId))).toBe(false)
  })

  it('re-run KEEPS and flags no-longer-applicable items the architect had worked on (evidence never silently lost)', async () => {
    await post(BLOCK)
    const blockOnly = match(BLOCK as any, getRuleSet('EE')!).map((c) => c.ruleId).filter((id) => !match(DETACHED as any, getRuleSet('EE')!).some((c) => c.ruleId === id))
    const worked = db.items.find((i) => i.ruleId === blockOnly[0])!
    worked.status = 'COMPLIANT'; worked.comments = 'Evidence: fire cert #123'
    const originalBecause = worked.because

    await post(DETACHED)
    const kept = db.items.find((i) => i.id === worked.id)
    expect(kept).toBeTruthy()
    expect(kept!.status).toBe('COMPLIANT')
    expect(kept!.comments).toBe('Evidence: fire cert #123')
    expect(kept!.confidence).toBe('stale')
    expect(kept!.because.startsWith(STALE_PREFIX)).toBe(true)
    if (originalBecause) expect(kept!.because).toContain(originalBecause)
    expect(db.items.filter((i) => i.origin === 'RULE')).toHaveLength(27) // 26 + 1 kept
    // the other block-only items were untouched → deleted
    expect(db.items.filter((i) => blockOnly.includes(i.ruleId))).toHaveLength(1)
    // GET reports it
    const body = (await json(await get())).data
    expect(body.counts.stale).toBe(1)
  })

  it('a flagged item is un-flagged when parameters make it applicable again', async () => {
    await post(BLOCK)
    const blockOnly = match(BLOCK as any, getRuleSet('EE')!).map((c) => c.ruleId).filter((id) => !match(DETACHED as any, getRuleSet('EE')!).some((c) => c.ruleId === id))
    const worked = db.items.find((i) => i.ruleId === blockOnly[0])!
    worked.status = 'IN_PROGRESS'
    await post(DETACHED)
    expect(db.items.find((i) => i.id === worked.id)!.confidence).toBe('stale')
    await post(BLOCK)
    const back = db.items.find((i) => i.id === worked.id)!
    expect(back.confidence).not.toBe('stale')
    expect(back.because ?? '').not.toContain(STALE_PREFIX)
    expect(back.status).toBe('IN_PROGRESS')
  })

  it('re-run never touches MUNICIPALITY items (Sprint 3 contract)', async () => {
    await post(DETACHED)
    db.items.push({ id: 'muni-1', registerId: db.registers[0].id, requirement: 'Max height 6.5 m', origin: 'MUNICIPALITY', addedByArchitect: false, ruleId: null, status: 'NOT_STARTED', citation: 'PT nr 2611802/03126 p.4', sortOrder: 5000 })
    await post(BLOCK)
    const m = db.items.find((i) => i.id === 'muni-1')
    expect(m).toBeTruthy()
    expect(m!.confidence).toBeUndefined()
    expect(m!.because ?? '').not.toContain(STALE_PREFIX)
    const body = (await json(await get())).data
    expect(body.municipal).toHaveLength(1)
    expect(body.counts.municipal).toBe(1)
  })

  it('only PROJECT_LEAD can generate or add items; any member can read', async () => {
    await post(DETACHED)
    ctx.role = 'EXTERNAL_CONSULTANT'
    expect((await post(BLOCK)).status).toBe(403)
    expect((await postItem({ requirement: 'x' })).status).toBe(403)
    expect((await get()).status).toBe(200)
    expect(db.profiles).toHaveLength(1)
  })

  it('GET flags an outdated checklist when the rule set has moved on', async () => {
    await post(DETACHED)
    expect((await json(await get())).data.outdated).toBe(false)
    db.registers[0].templateVersion = 'EE-0.9'
    const body = (await json(await get())).data
    expect(body.outdated).toBe(true)
    expect(body.currentRuleSetVersion).toBe('EE-1.0')
  })

  it('runs the write inside one transaction with an extended timeout (PgBouncer fix)', async () => {
    await post(DETACHED)
    expect(transactionOpts[0]).toMatchObject({ timeout: 30_000 })
    // writes are batched: createMany once, no per-item create on first run
    expect(tx.complianceItem.createMany).toHaveBeenCalledTimes(1)
    expect(tx.complianceItem.create).not.toHaveBeenCalled()
  })
})

// ── GET shape ───────────────────────────────────────────────
describe('GET /api/projects/[id]/regulatory', () => {
  it('returns null register before first run', async () => {
    const body = (await json(await get())).data
    expect(body.register).toBeNull()
    expect(body.counts).toEqual({ generated: 0, added: 0, municipal: 0, stale: 0 })
    expect(body.disciplineLabels.permit.et).toBe('Load ja teatised')
  })

  it('groups generated items by discipline and separates architect-added', async () => {
    await post(DETACHED)
    await postItem({ requirement: 'Local noise bylaw', section: 'environment' })
    const body = (await json(await get())).data
    expect(body.profile.version).toBe(1)
    expect(body.register.templateVersion).toBe('EE-1.0')
    expect(Object.values(body.grouped).flat()).toHaveLength(26)
    expect(body.grouped.permit.length).toBeGreaterThan(0)
    expect(body.added).toHaveLength(1)
    expect(body.counts).toEqual({ generated: 26, added: 1, municipal: 0, stale: 0 })
  })
})

// ── Add missing item ───────────────────────────────────────
describe('POST /api/projects/[id]/regulatory/items', () => {
  it('refuses before a checklist exists', async () => {
    const res = await postItem({ requirement: 'x' })
    expect(res.status).toBe(400)
  })

  it('requires a requirement', async () => {
    await post(DETACHED)
    const res = await postItem({ requirement: '' })
    expect(res.status).toBe(400)
  })

  it('creates an architect-flagged item at the end and audits with the rule-set version', async () => {
    await post(DETACHED)
    const res = await postItem({ requirement: 'Tallinn construction noise hours 7–19', section: 'environment', citation: 'Tallinna heakorraeeskiri' })
    expect(res.status).toBe(201)
    const item = (await json(res)).data.item
    expect(item.addedByArchitect).toBe(true)
    expect(item.origin).toBe('ARCHITECT')
    expect(item.confidence).toBe('architect')
    expect(item.sortOrder).toBeGreaterThan(Math.max(...db.items.filter((i) => i.origin === 'RULE').map((i) => i.sortOrder)))
    const call = audit.mock.calls.find((c) => c[0].action === 'ai.checklist_item_added_by_architect')!
    expect(call[0].metadata.ruleSetVersion).toBe('EE-1.0')
  })
})
