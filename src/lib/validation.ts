import { ValidationError } from '@/lib/errors'

// ── String validation ──────────────────────────────────────

/**
 * Validate a required string field. Returns the trimmed value.
 * Throws ValidationError if missing, wrong type, empty, or too long.
 */
export function requireString(
  value: unknown,
  fieldName: string,
  maxLength: number = 500,
): string {
  if (value === null || value === undefined || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`)
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be ${maxLength} characters or fewer (got ${trimmed.length})`,
    )
  }
  return trimmed
}

/**
 * Validate an optional string field. Returns trimmed value or null.
 * Throws ValidationError if present but too long.
 */
export function optionalString(
  value: unknown,
  fieldName: string,
  maxLength: number = 500,
): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be ${maxLength} characters or fewer (got ${trimmed.length})`,
    )
  }
  return trimmed
}

// ── UUID validation ────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUID_REGEX = /^c[a-z0-9]{24,}$/

/**
 * Validate that a value looks like a valid ID (UUID or CUID).
 * Prisma generates CUIDs by default; Supabase uses UUIDs.
 */
export function isValidId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return UUID_REGEX.test(value) || CUID_REGEX.test(value)
}

/**
 * Validate an optional ID field. Returns the value or null.
 * Throws ValidationError if present but not a valid ID format.
 */
export function optionalId(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null
  if (!isValidId(value)) {
    throw new ValidationError(`${fieldName} must be a valid ID`)
  }
  return value
}

/**
 * Validate a required ID field.
 * Throws ValidationError if missing or not a valid ID format.
 */
export function requireId(
  value: unknown,
  fieldName: string,
): string {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`)
  }
  if (!isValidId(value)) {
    throw new ValidationError(`${fieldName} must be a valid ID`)
  }
  return value
}

// ── Enum validation ────────────────────────────────────────

/**
 * Validate that a value is one of the allowed enum values.
 * Returns the value. Throws ValidationError if invalid.
 */
export function requireEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
): T {
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
    )
  }
  return value as T
}

/**
 * Validate an optional enum value.
 */
export function optionalEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
): T | undefined {
  if (value === null || value === undefined) return undefined
  return requireEnum(value, fieldName, allowedValues)
}

// ── Number validation ──────────────────────────────────────

/**
 * Validate an optional number. Returns the value or null.
 */
export function optionalNumber(
  value: unknown,
  fieldName: string,
  opts: { min?: number; max?: number } = {},
): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`)
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ValidationError(`${fieldName} must be at least ${opts.min}`)
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ValidationError(`${fieldName} must be at most ${opts.max}`)
  }
  return value
}

// ── Date validation ────────────────────────────────────────

/**
 * Validate an optional date string. Returns a Date or null.
 */
export function optionalDate(
  value: unknown,
  fieldName: string,
): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a date string`)
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${fieldName} is not a valid date`)
  }
  return d
}

// ── Request body size guard ────────────────────────────────

const MAX_BODY_SIZE = 64 * 1024 // 64 KB — generous for JSON payloads

/**
 * Parse JSON body with a size guard. Throws if body is too large.
 */
export async function parseBody<T = Record<string, unknown>>(
  request: Request,
  maxSize: number = MAX_BODY_SIZE,
): Promise<T> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new ValidationError(
      `Request body too large (max ${Math.round(maxSize / 1024)}KB)`,
    )
  }

  try {
    return await request.json() as T
  } catch {
    throw new ValidationError('Invalid JSON body')
  }
}
