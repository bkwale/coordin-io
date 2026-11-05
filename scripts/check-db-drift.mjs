#!/usr/bin/env node
/**
 * Schema drift guard (added 2026-11-05).
 *
 * Compares prisma/schema.prisma with the live database: every mapped table, column and enum value.
 * Production had drifted silently (probation_goals, approval multi-approver columns, the whole
 * invoicing module) — the code deployed but the tables never did, so pages 500'd for users.
 *
 *   node scripts/check-db-drift.mjs        → exit 1 on drift (runs in `npm run build`)
 *
 * Connection problems only warn (a flaky DB must not block every deploy); real drift fails the build.
 * Set SKIP_DB_DRIFT_CHECK=1 to bypass in an emergency.
 */
import fs from 'node:fs'
import pg from 'pg'

if (process.env.SKIP_DB_DRIFT_CHECK === '1') {
  console.warn('[db-drift] skipped (SKIP_DB_DRIFT_CHECK=1)')
  process.exit(0)
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.warn('[db-drift] no DATABASE_URL — skipping check')
  process.exit(0)
}

// ── Parse schema.prisma ────────────────────────────────────────────────
const src = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
const blocks = [...src.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
const modelNames = new Set(blocks.filter((b) => b[1] === 'model').map((b) => b[2]))
const expectedCols = new Map() // table -> Set(columns)
const expectedEnums = new Map() // db enum name -> values
for (const [, kind, name, body] of blocks) {
  const mapped = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
  if (kind === 'enum') {
    expectedEnums.set(mapped, lines.map((l) => l.match(/@map\("([^"]+)"\)/)?.[1] ?? l.split(/\s+/)[0]))
    continue
  }
  const cols = new Set()
  for (const l of lines) {
    const [field, type] = l.split(/\s+/)
    if (!type) continue
    const base = type.replace(/[?[\]]/g, '')
    if (modelNames.has(base)) continue // relation field
    cols.add(l.match(/@map\("([^"]+)"\)/)?.[1] ?? field)
  }
  expectedCols.set(mapped, cols)
}

if (process.env.DB_DRIFT_DRY === '1') { console.log(JSON.stringify({ tables: expectedCols.size, columns: [...expectedCols.values()].reduce((a, s) => a + s.size, 0), enums: expectedEnums.size, sample: [...(expectedCols.get('approval_step_instances') ?? [])] })); process.exit(0) }
// ── Read the database ──────────────────────────────────────────────────
const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } })
try {
  await client.connect()
} catch (e) {
  console.warn(`[db-drift] could not connect (${e.message}) — skipping check`)
  process.exit(0)
}
let colRows, enumRows
try {
  ;({ rows: colRows } = await client.query(`select table_name, column_name from information_schema.columns where table_schema = 'public'`))
  ;({ rows: enumRows } = await client.query(`select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'`))
} catch (e) {
  console.warn(`[db-drift] query failed (${e.message}) — skipping check`)
  await client.end().catch(() => {})
  process.exit(0)
}
await client.end().catch(() => {})

const dbCols = new Map()
for (const r of colRows) {
  if (!dbCols.has(r.table_name)) dbCols.set(r.table_name, new Set())
  dbCols.get(r.table_name).add(r.column_name)
}
const dbEnums = new Map()
for (const r of enumRows) {
  if (!dbEnums.has(r.typname)) dbEnums.set(r.typname, new Set())
  dbEnums.get(r.typname).add(r.enumlabel)
}

// ── Compare ────────────────────────────────────────────────────────────
const problems = []
for (const [table, cols] of expectedCols) {
  const have = dbCols.get(table)
  if (!have) { problems.push(`missing table: ${table}`); continue }
  const missing = [...cols].filter((c) => !have.has(c))
  if (missing.length) problems.push(`missing columns in ${table}: ${missing.join(', ')}`)
}
for (const [en, values] of expectedEnums) {
  const have = dbEnums.get(en)
  if (!have) { problems.push(`missing enum: ${en}`); continue }
  const missing = values.filter((v) => !have.has(v))
  if (missing.length) problems.push(`missing values in enum ${en}: ${missing.join(', ')}`)
}

if (problems.length) {
  console.error('\n[db-drift] The database does not match prisma/schema.prisma:\n')
  for (const p of problems) console.error('  ✗ ' + p)
  console.error('\nApply the migration (scripts/migrations/) before deploying this code.\n')
  process.exit(1)
}
console.log(`[db-drift] OK — ${expectedCols.size} tables and ${expectedEnums.size} enums match the database`)
