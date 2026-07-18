import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health — Health check endpoint.
 * Tests database connectivity with SELECT 1 so monitoring can distinguish
 * "app is up but DB is down" from "deploy is broken".
 *
 * Returns 200 if all checks pass, 503 if any check fails.
 * Includes response times for each check.
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs: number; error?: string }> = {}

  // Database readiness probe
  const dbStart = Date.now()
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[health] Database check failed:', message)
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: message }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    },
    { status: allHealthy ? 200 : 503 },
  )
}
