import { describe, it, expect } from 'vitest'
import {
  AppError,
  AuthError,
  PermissionError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  RateLimitedError,
  ErrorCode,
  fromPrismaError,
  formatAPIError,
} from '../errors'

// ── AppError.toJSON() ──────────────────────────────────────────

describe('AppError', () => {
  it('toJSON produces correct shape without metadata', () => {
    const err = new AppError('something broke', ErrorCode.UNKNOWN, 500)
    const json = err.toJSON()

    expect(json).toEqual({
      error: 'something broke',
      code: 'UNKNOWN',
    })
    expect(json).not.toHaveProperty('details')
  })

  it('toJSON includes details when metadata is present', () => {
    const err = new AppError('bad input', ErrorCode.VALIDATION_FAILED, 400, {
      field: 'email',
    })
    const json = err.toJSON()

    expect(json).toEqual({
      error: 'bad input',
      code: 'VALIDATION_FAILED',
      details: { field: 'email' },
    })
  })
})

// ── Subclass status codes ──────────────────────────────────────

describe('error subclass status codes', () => {
  it('AuthError defaults to 401', () => {
    expect(new AuthError().statusCode).toBe(401)
  })

  it('PermissionError defaults to 403', () => {
    expect(new PermissionError().statusCode).toBe(403)
  })

  it('ValidationError defaults to 400', () => {
    expect(new ValidationError().statusCode).toBe(400)
  })

  it('NotFoundError defaults to 404', () => {
    expect(new NotFoundError().statusCode).toBe(404)
  })

  it('ConflictError defaults to 409', () => {
    expect(new ConflictError().statusCode).toBe(409)
  })

  it('DatabaseError defaults to 500', () => {
    expect(new DatabaseError().statusCode).toBe(500)
  })

  it('ExternalServiceError defaults to 502', () => {
    expect(new ExternalServiceError().statusCode).toBe(502)
  })

  it('RateLimitedError defaults to 429', () => {
    expect(new RateLimitedError().statusCode).toBe(429)
  })
})

// ── fromPrismaError ────────────────────────────────────────────

describe('fromPrismaError', () => {
  it('wraps P2002 (unique constraint) as ConflictError', () => {
    const prismaErr = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['email'] },
    })
    const wrapped = fromPrismaError(prismaErr)

    expect(wrapped).toBeInstanceOf(ConflictError)
    expect(wrapped.statusCode).toBe(409)
    expect(wrapped.message).toContain('email')
  })

  it('wraps P2025 (not found) as NotFoundError', () => {
    const prismaErr = Object.assign(new Error('Record not found'), {
      code: 'P2025',
    })
    const wrapped = fromPrismaError(prismaErr)

    expect(wrapped).toBeInstanceOf(NotFoundError)
    expect(wrapped.statusCode).toBe(404)
  })

  it('wraps P2003 (foreign key) as ValidationError', () => {
    const prismaErr = Object.assign(new Error('Foreign key constraint'), {
      code: 'P2003',
    })
    const wrapped = fromPrismaError(prismaErr)

    expect(wrapped).toBeInstanceOf(ValidationError)
    expect(wrapped.statusCode).toBe(400)
  })

  it('wraps unknown Prisma code as DatabaseError', () => {
    const prismaErr = Object.assign(new Error('Unknown'), {
      code: 'P9999',
    })
    const wrapped = fromPrismaError(prismaErr)

    expect(wrapped).toBeInstanceOf(DatabaseError)
    expect(wrapped.statusCode).toBe(500)
  })

  it('wraps a plain Error (no code property) as AppError with 500', () => {
    const plain = new Error('plain failure')
    const wrapped = fromPrismaError(plain)
    expect(wrapped).toBeInstanceOf(AppError)
    expect(wrapped.statusCode).toBe(500)
    expect(wrapped.message).toBe('plain failure')
  })

  it('wraps generic Error as AppError with 500', () => {
    const err = new Error('generic failure')
    const wrapped = fromPrismaError(err)

    expect(wrapped).toBeInstanceOf(AppError)
    expect(wrapped.statusCode).toBe(500)
  })
})

// ── formatAPIError ─────────────────────────────────────────────

describe('formatAPIError', () => {
  it('formats an AppError directly', () => {
    const err = new PermissionError('denied')
    const result = formatAPIError(err)

    expect(result.statusCode).toBe(403)
    expect(result.body.error).toBe('denied')
    expect(result.body.code).toBe('PERMISSION_DENIED')
  })

  it('wraps a generic Error as 500', () => {
    const err = new Error('oops')
    const result = formatAPIError(err)

    expect(result.statusCode).toBe(500)
    expect(result.body.error).toBe('An unexpected error occurred')
    expect(result.body.code).toBe('UNKNOWN')
  })

  it('wraps a non-Error value as 500', () => {
    const result = formatAPIError('string error')

    expect(result.statusCode).toBe(500)
    expect(result.body.error).toBe('An unexpected error occurred')
  })

  it('wraps a Prisma-like error via fromPrismaError', () => {
    const prismaErr = Object.assign(new Error('unique'), {
      code: 'P2002',
      name: 'PrismaClientKnownRequestError',
      meta: { target: ['slug'] },
    })
    const result = formatAPIError(prismaErr)

    expect(result.statusCode).toBe(409)
    expect(result.body.code).toBe('CONFLICT')
  })
})
