import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { modulesPrisma } from '@/lib/prisma-modules'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/onboarding/self-service/progress?token=xxx
 *
 * Public endpoint — returns step completion status for the self-service flow.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitResponse = await checkRateLimit(`self-service-progress:${ip}`, RateLimitPresets.standard)
  if (rateLimitResponse) return rateLimitResponse

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
  }

  // Validate token
  const selfServiceToken = await modulesPrisma.onboardingSelfServiceToken.findUnique({
    where: { token },
    select: {
      id: true,
      profileId: true,
      expiresAt: true,
      revokedAt: true,
      completedAt: true,
    },
  })

  if (!selfServiceToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (selfServiceToken.revokedAt || new Date() > selfServiceToken.expiresAt) {
    return NextResponse.json({ error: 'Token expired or revoked' }, { status: 410 })
  }

  // Get task progress
  const tasks = await modulesPrisma.onboardingTask.findMany({
    where: {
      assigneeId: selfServiceToken.profileId,
      isSelfService: true,
      selfServiceStep: { not: null },
    },
    select: {
      id: true,
      selfServiceStep: true,
      status: true,
      completedAt: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  const steps = tasks.map((t: { id: string; selfServiceStep: string | null; status: string; completedAt: Date | null }) => ({
    step: t.selfServiceStep,
    status: t.status,
    completedAt: t.completedAt,
  }))

  const completedCount = steps.filter((s: { status: string }) => s.status === 'COMPLETED').length
  const totalCount = steps.length

  return success({
    steps,
    completedCount,
    totalCount,
    allCompleted: totalCount > 0 && completedCount === totalCount,
    overallCompleted: selfServiceToken.completedAt !== null,
  })
}
