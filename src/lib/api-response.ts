// ── Standard API Response Helpers ────────────────────────────
//
// Wrap all API route responses through these helpers so every
// endpoint returns a consistent JSON shape.

import { NextResponse } from 'next/server'
import { AppError, formatAPIError } from '@/lib/errors'

/**
 * Return a success response.
 *
 * Shape: `{ data: T }`
 */
export function success<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

/**
 * Return an error response.
 *
 * Accepts an AppError, a Prisma error, a generic Error, or any
 * unknown thrown value. Always produces:
 * `{ error: string, code: string, details?: object }`
 */
export function error(err: AppError | unknown): NextResponse {
  const formatted = formatAPIError(err)
  return NextResponse.json(formatted.body, { status: formatted.statusCode })
}

/**
 * Return a paginated success response.
 *
 * Shape:
 * ```json
 * {
 *   "data": T[],
 *   "pagination": {
 *     "total": number,
 *     "page": number,
 *     "pageSize": number,
 *     "totalPages": number
 *   }
 * }
 * ```
 */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): NextResponse {
  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
