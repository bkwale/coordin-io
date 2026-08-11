/**
 * Schema Contract Test
 *
 * Parses prisma/schema.prisma and scans all route files that use modulesPrisma
 * to verify every top-level select/include field actually exists in the schema.
 *
 * This catches the class of bug where `modulesPrisma` (cast to `any`) references
 * field names that don't exist — e.g. `corporateRole.title` when the schema has `name`.
 *
 * Runs as a static analysis test — no database needed, executes in milliseconds.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ── Parse Prisma Schema ─────────────────────────────────────

interface SchemaModel {
  fields: Set<string>      // scalar fields + enum fields
  relations: Set<string>   // relation names (also appear in fields)
}

function parsePrismaSchema(schemaPath: string): Map<string, SchemaModel> {
  const content = fs.readFileSync(schemaPath, 'utf-8')
  const models = new Map<string, SchemaModel>()

  // First pass: collect all model names
  const modelNames = new Set<string>()
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^model\s+(\w+)\s*\{/)
    if (m) modelNames.add(m[1])
  }

  // Known Prisma scalar types
  const scalarTypes = new Set([
    'String', 'Int', 'Float', 'Boolean', 'DateTime', 'BigInt',
    'Decimal', 'Bytes', 'Json',
  ])

  let currentModel: string | null = null
  let braceDepth = 0

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/)
    if (modelMatch) {
      currentModel = modelMatch[1]
      models.set(currentModel, { fields: new Set(), relations: new Set() })
      braceDepth = 1
      continue
    }

    if (trimmed.match(/^enum\s+\w+\s*\{/)) {
      currentModel = null
      continue
    }

    if (currentModel) {
      // Skip comments and directives BEFORE brace tracking —
      // comments like `// JSON array of {url, fileName}` contain braces
      // that would break depth counting.
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue

      if (trimmed === '{') braceDepth++
      if (trimmed.includes('}')) {
        braceDepth--
        if (braceDepth <= 0) {
          currentModel = null
          continue
        }
      }

      const fieldMatch = trimmed.match(/^(\w+)\s+(\S+)/)
      if (fieldMatch) {
        const [, fieldName, fieldType] = fieldMatch
        const model = models.get(currentModel)!
        const cleanType = fieldType.replace(/[?\[\]]/g, '')

        // Everything is selectable as a field
        model.fields.add(fieldName)

        // If it references another model, it's also a relation
        if (modelNames.has(cleanType)) {
          model.relations.add(fieldName)
        }
      }
    }
  }

  return models
}

// ── Scan Route Files for modulesPrisma Queries ──────────────

interface QueryField {
  model: string
  field: string
  file: string
  line: number
}

function findAllTsFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        results.push(...findAllTsFiles(fullPath))
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(fullPath)
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return results
}

/**
 * Find the balanced closing brace for an opening brace at position `start`.
 * Returns the index of the closing `}`, or -1 if not found.
 */
function findMatchingBrace(code: string, start: number): number {
  let depth = 0
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Extract top-level keys from an object literal starting at `startIdx`.
 * startIdx should point at or before the opening `{`.
 * Returns keys at depth 1 only (skips nested object values).
 */
function extractTopLevelKeys(code: string, startIdx: number): string[] {
  const keys: string[] = []
  let i = startIdx

  // Find opening brace
  while (i < code.length && code[i] !== '{') i++
  if (i >= code.length) return keys
  i++ // skip `{`

  let depth = 1
  let currentToken = ''

  while (i < code.length && depth > 0) {
    const ch = code[i]

    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
    } else if (depth === 1) {
      if (ch === ':') {
        const key = currentToken.trim()
        if (key && /^\w+$/.test(key)) {
          keys.push(key)
        }
        currentToken = ''
      } else if (ch === ',' || ch === '\n') {
        currentToken = ''
      } else if (/\S/.test(ch)) {
        currentToken += ch
      }
    }

    i++
  }

  return keys
}

/**
 * Scan all route files for modulesPrisma queries.
 * For each query, extract only the TOP-LEVEL select/include keys
 * (the ones that belong to the queried model).
 */
function scanRouteFiles(srcDir: string): QueryField[] {
  const results: QueryField[] = []
  const files = findAllTsFiles(srcDir)

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.includes('modulesPrisma')) continue

    // Find all modulesPrisma.model.method( patterns
    const queryRegex = /modulesPrisma\.(\w+)\.(\w+)\s*\(/g
    let queryMatch

    while ((queryMatch = queryRegex.exec(content)) !== null) {
      const modelName = queryMatch[1]
      const pascalModel = modelName.charAt(0).toUpperCase() + modelName.slice(1)
      const queryArgStart = queryMatch.index + queryMatch[0].length

      // Find the opening `{` of the query argument
      let braceStart = queryArgStart
      while (braceStart < content.length && content[braceStart] !== '{') {
        // If we hit `)` before `{`, there's no object argument (e.g. `.count()`)
        if (content[braceStart] === ')') break
        braceStart++
      }
      if (braceStart >= content.length || content[braceStart] !== '{') continue

      // Find the matching closing brace for the query argument
      const braceEnd = findMatchingBrace(content, braceStart)
      if (braceEnd === -1) continue

      // Extract just this query's argument block
      const queryBlock = content.substring(braceStart, braceEnd + 1)

      // Compute the line number for error reporting
      const lineNum = content.substring(0, queryMatch.index).split('\n').length

      // Find `select:` and `include:` at depth 1 within the query block
      // (depth 1 = directly inside the query arg object)
      const keywordRegex = /\b(select|include)\s*:\s*\{/g
      let kwMatch

      while ((kwMatch = keywordRegex.exec(queryBlock)) !== null) {
        // Check this keyword is at depth 1 in the queryBlock
        const beforeKw = queryBlock.substring(0, kwMatch.index)
        let depth = 0
        for (const ch of beforeKw) {
          if (ch === '{') depth++
          if (ch === '}') depth--
        }

        // depth === 1 means we're directly inside the query's top-level object
        if (depth === 1) {
          const selectStart = kwMatch.index + kwMatch[0].length - 1 // point at `{`
          const keys = extractTopLevelKeys(queryBlock, selectStart)

          for (const key of keys) {
            // Skip Prisma virtual fields
            if (key === '_count' || key === '_sum' || key === '_avg' || key === '_min' || key === '_max') continue

            results.push({
              model: pascalModel,
              field: key,
              file: filePath,
              line: lineNum,
            })
          }
        }
      }

      // Check orderBy at depth 1
      const orderByRegex = /\borderBy\s*:\s*\{/g
      let obMatch
      while ((obMatch = orderByRegex.exec(queryBlock)) !== null) {
        const beforeOb = queryBlock.substring(0, obMatch.index)
        let depth = 0
        for (const ch of beforeOb) {
          if (ch === '{') depth++
          if (ch === '}') depth--
        }
        if (depth === 1) {
          const obStart = obMatch.index + obMatch[0].length - 1
          const keys = extractTopLevelKeys(queryBlock, obStart)
          for (const key of keys) {
            results.push({
              model: pascalModel,
              field: key,
              file: filePath,
              line: lineNum,
            })
          }
        }
      }
    }
  }

  return results
}

// ── Model Name Resolution ───────────────────────────────────

/**
 * Prisma uses camelCase for model access (e.g., `prisma.hRDocument`),
 * but the schema defines PascalCase (e.g., `HRDocument`).
 * This resolves camelCase → PascalCase using the schema's model list.
 */
function resolveModelName(camelName: string, schemaModels: Map<string, SchemaModel>): string | null {
  // Direct match (already PascalCase from our charAt(0).toUpperCase())
  if (schemaModels.has(camelName)) return camelName

  // Try common Prisma casing transforms
  const lowerName = camelName.toLowerCase()
  for (const modelName of schemaModels.keys()) {
    if (modelName.toLowerCase() === lowerName) return modelName
  }

  return null
}

// ── The Test ────────────────────────────────────────────────

const SCHEMA_PATH = path.resolve(__dirname, '../../../prisma/schema.prisma')
const SRC_DIR = path.resolve(__dirname, '../../app')

describe('Schema contract: modulesPrisma queries match Prisma schema', () => {
  const schema = parsePrismaSchema(SCHEMA_PATH)
  const queryFields = scanRouteFiles(SRC_DIR)

  it('schema parser found models', () => {
    expect(schema.size).toBeGreaterThan(50)
  })

  it('scanner found modulesPrisma query fields to check', () => {
    expect(queryFields.length).toBeGreaterThan(20)
  })

  it('every top-level select/include/orderBy field in modulesPrisma queries exists in the schema', () => {
    const mismatches: string[] = []

    for (const q of queryFields) {
      const resolvedModel = resolveModelName(q.model, schema)

      if (!resolvedModel) {
        mismatches.push(
          `Model "${q.model}" not found in schema (${path.basename(q.file)}:${q.line})`
        )
        continue
      }

      const model = schema.get(resolvedModel)!

      if (!model.fields.has(q.field) && !model.relations.has(q.field)) {
        mismatches.push(
          `${resolvedModel}.${q.field} does not exist in schema (${path.basename(q.file)}:${q.line})`
        )
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        `Found ${mismatches.length} modulesPrisma field(s) that don't exist in the Prisma schema:\n\n` +
        mismatches.map((m) => `  • ${m}`).join('\n') +
        '\n\nFix: check prisma/schema.prisma for the correct field names.'
      )
    }
  })
})
