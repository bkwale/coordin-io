// ── Centralised Error Types & Handling ──────────────────────
//
// All application errors extend AppError. API routes use
// formatAPIError() to produce a consistent JSON shape.
// Prisma errors are wrapped via fromPrismaError() so internal
// database details never leak to the client.

// ── Error Codes ─────────────────────────────────────────────

export const ErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

// ── Base Error Class ────────────────────────────────────────

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly metadata: Record<string, unknown>

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode: number = 500,
    metadata: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.metadata = metadata

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(Object.keys(this.metadata).length > 0 ? { details: this.metadata } : {}),
    }
  }
}

// ── Specific Error Subclasses ───────────────────────────────

export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCode.AUTH_REQUIRED,
    metadata: Record<string, unknown> = {},
  ) {
    super(message, code, 401, metadata)
    this.name = 'AuthError'
  }
}

export class PermissionError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.PERMISSION_DENIED, 403, metadata)
    this.name = 'PermissionError'
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = 'The provided data is invalid',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.VALIDATION_FAILED, 400, metadata)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = 'The requested resource was not found',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.NOT_FOUND, 404, metadata)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = 'This action conflicts with an existing resource',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.CONFLICT, 409, metadata)
    this.name = 'ConflictError'
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string = 'A database error occurred',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.DATABASE_ERROR, 500, metadata)
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message: string = 'An external service is unavailable',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.EXTERNAL_SERVICE_ERROR, 502, metadata)
    this.name = 'ExternalServiceError'
  }
}

export class RateLimitedError extends AppError {
  constructor(
    message: string = 'Too many requests — please try again shortly',
    metadata: Record<string, unknown> = {},
  ) {
    super(message, ErrorCode.RATE_LIMITED, 429, metadata)
    this.name = 'RateLimitedError'
  }
}

// ── Prisma Error Wrapping ───────────────────────────────────

/**
 * Converts Prisma client errors into safe AppError instances.
 * Internal database details (table names, column names, constraint
 * names) are stripped so they never reach the client.
 */
export function fromPrismaError(error: unknown): AppError {
  // PrismaClientKnownRequestError has a `code` property (e.g. P2002)
  if (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    const prismaCode = (error as { code: string }).code
    const meta = 'meta' in error ? (error as { meta?: Record<string, unknown> }).meta : undefined

    switch (prismaCode) {
      case 'P2002': {
        // Unique constraint violation
        const target = meta?.target
        const fields = Array.isArray(target) ? target.join(', ') : undefined
        return new ConflictError(
          fields
            ? `A record with that ${fields} already exists`
            : 'A record with those details already exists',
        )
      }

      case 'P2025':
        // Record not found
        return new NotFoundError('The requested record was not found')

      case 'P2003':
        // Foreign key constraint failure
        return new ValidationError('A referenced record does not exist')

      case 'P2014':
        // Relation violation
        return new ValidationError('This change would break a required relationship')

      case 'P2021':
        // Table does not exist
        return new DatabaseError('A database configuration error occurred')

      case 'P2022':
        // Column does not exist
        return new DatabaseError('A database configuration error occurred')

      default:
        return new DatabaseError('A database error occurred')
    }
  }

  // PrismaClientValidationError — bad query shape
  if (error instanceof Error && error.name === 'PrismaClientValidationError') {
    return new ValidationError('Invalid query parameters')
  }

  // Fallback
  if (error instanceof AppError) return error
  if (error instanceof Error) {
    return new AppError(error.message, ErrorCode.UNKNOWN, 500)
  }
  return new AppError('An unexpected error occurred', ErrorCode.UNKNOWN, 500)
}

// ── Structured Logging ──────────────────────────────────────

function logError(error: AppError, originalError?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    code: error.code,
    status: error.statusCode,
    message: error.message,
    ...(Object.keys(error.metadata).length > 0 ? { metadata: error.metadata } : {}),
    ...(originalError instanceof Error && originalError !== error
      ? { originalMessage: originalError.message, stack: originalError.stack }
      : {}),
  }
  console.error('[AppError]', JSON.stringify(entry))
}

// ── API Error Formatting ────────────────────────────────────

export interface FormattedAPIError {
  body: { error: string; code: string; details?: Record<string, unknown> }
  statusCode: number
}

/**
 * Catches any thrown value and returns a safe, consistent
 * JSON body + status code ready for NextResponse.
 */
export function formatAPIError(error: unknown): FormattedAPIError {
  // Already an AppError — use directly
  if (error instanceof AppError) {
    logError(error)
    return {
      body: error.toJSON(),
      statusCode: error.statusCode,
    }
  }

  // Prisma errors
  if (
    error instanceof Error &&
    (error.name === 'PrismaClientKnownRequestError' ||
      error.name === 'PrismaClientValidationError' ||
      error.name === 'PrismaClientUnknownRequestError' ||
      ('code' in error && typeof (error as { code: unknown }).code === 'string' &&
        (error as { code: string }).code.startsWith('P')))
  ) {
    const wrapped = fromPrismaError(error)
    logError(wrapped, error)
    return {
      body: wrapped.toJSON(),
      statusCode: wrapped.statusCode,
    }
  }

  // Generic Error
  if (error instanceof Error) {
    const wrapped = new AppError(
      'An unexpected error occurred',
      ErrorCode.UNKNOWN,
      500,
    )
    logError(wrapped, error)
    return {
      body: wrapped.toJSON(),
      statusCode: 500,
    }
  }

  // Completely unknown value
  const fallback = new AppError('An unexpected error occurred', ErrorCode.UNKNOWN, 500)
  logError(fallback)
  return {
    body: fallback.toJSON(),
    statusCode: 500,
  }
}
