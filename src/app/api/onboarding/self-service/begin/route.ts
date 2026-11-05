import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { modulesPrisma } from '@/lib/prisma-modules'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { startWindowOnActivation, windowForLink } from '@/lib/onboarding/window-service'

/**
 * POST /api/onboarding/self-service/begin  { token }
 *
 * Public (token-authenticated). The employee pressed "Begin": this — not opening the link — starts the
 * seven-day window. A POST from a button, so email security scanners that open links can't start the
 * clock early. Idempotent: pressing it again just returns the existing window.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limited = await checkRateLimit(`self-service-begin:${ip}`, { ...RateLimitPresets.auth, failClosed: true })
  if (limited) return limited

  const body = await request.json().catch(() => ({})) as { token?: unknown }
  const token = typeof body.token === 'string' ? body.token : ''
  if (token.length < 32) return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })

  const t = await modulesPrisma.onboardingSelfServiceToken.findUnique({
    where: { token },
    select: { id: true, assignmentId: true, usedAt: true, revokedAt: true, completedAt: true, expiresAt: true },
  })
  if (!t) return NextResponse.json({ error: 'Invalid invitation link. Please contact your HR team for a new one.' }, { status: 404 })
  if (t.revokedAt) return NextResponse.json({ error: 'This invitation has been revoked. Please contact your HR team for a new one.' }, { status: 410 })
  if (new Date() > t.expiresAt) return NextResponse.json({ error: 'This invitation has expired. Please contact your HR team for a new one.' }, { status: 410 })
  if (t.completedAt) return NextResponse.json({ error: 'This onboarding has already been completed.' }, { status: 410 })

  if (!t.usedAt) {
    await modulesPrisma.onboardingSelfServiceToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } })
  }
  await startWindowOnActivation(t.assignmentId ?? null, t.id)

  return success({ window: await windowForLink(t.assignmentId ?? null) })
}
