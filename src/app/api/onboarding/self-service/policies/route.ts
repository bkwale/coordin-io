import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { modulesPrisma } from '@/lib/prisma-modules'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/onboarding/self-service/policies?token=xxx
 *
 * Public endpoint — returns the organisation's mandatory policies
 * for the self-service policy acknowledgement step.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitResponse = await checkRateLimit(`self-service-policies:${ip}`, RateLimitPresets.standard)
  if (rateLimitResponse) return rateLimitResponse

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
  }

  const selfServiceToken = await modulesPrisma.onboardingSelfServiceToken.findUnique({
    where: { token },
    select: {
      organisationId: true,
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

  // Fetch mandatory policies for this organisation
  const policies = await modulesPrisma.policyDocument.findMany({
    where: {
      organisationId: selfServiceToken.organisationId,
    },
    select: {
      id: true,
      title: true,
      category: true,
      mandatory: true,
      revision: true,
    },
    orderBy: [{ mandatory: 'desc' }, { title: 'asc' }],
  })

  return success({
    policies: policies.map((p: { id: string; title: string; category: string; mandatory: boolean; revision: string }) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      mandatory: p.mandatory,
    })),
  })
}
