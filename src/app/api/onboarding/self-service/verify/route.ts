import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { modulesPrisma } from '@/lib/prisma-modules'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/onboarding/self-service/verify?token=xxx
 *
 * Public endpoint — no Supabase auth required.
 * Validates the token and returns employee info + step progress.
 * Rate-limited to prevent brute-force token guessing.
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitResponse = await checkRateLimit(`self-service-verify:${ip}`, RateLimitPresets.auth)
  if (rateLimitResponse) return rateLimitResponse

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
  }

  // Look up the token
  const selfServiceToken = await modulesPrisma.onboardingSelfServiceToken.findUnique({
    where: { token },
    include: {
      profile: {
        select: {
          id: true,
          fullName: true,
          email: true,
          startDate: true,
          jobTitle: true,
          avatarUrl: true,
        },
      },
      organisation: {
        select: { id: true, name: true },
      },
    },
  })

  if (!selfServiceToken) {
    return NextResponse.json({ error: 'Invalid invitation link. Please contact your HR team for a new one.' }, { status: 404 })
  }

  // Check if revoked
  if (selfServiceToken.revokedAt) {
    return NextResponse.json({ error: 'This invitation has been revoked. Please contact your HR team for a new one.' }, { status: 410 })
  }

  // Check if expired
  if (new Date() > selfServiceToken.expiresAt) {
    return NextResponse.json({ error: 'This invitation has expired. Please contact your HR team for a new one.' }, { status: 410 })
  }

  // Check if already completed
  if (selfServiceToken.completedAt) {
    return NextResponse.json({ error: 'This onboarding has already been completed. If you need to make changes, contact your HR team.' }, { status: 410 })
  }

  // Mark token as used (first access)
  if (!selfServiceToken.usedAt) {
    await modulesPrisma.onboardingSelfServiceToken.update({
      where: { id: selfServiceToken.id },
      data: { usedAt: new Date() },
    })
  }

  // Get self-service task progress
  const tasks = await modulesPrisma.onboardingTask.findMany({
    where: {
      assigneeId: selfServiceToken.profileId,
      isSelfService: true,
      selfServiceStep: { not: null },
    },
    select: {
      id: true,
      title: true,
      selfServiceStep: true,
      status: true,
      completedAt: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  const steps = tasks.map((t: { id: string; title: string; selfServiceStep: string | null; status: string; completedAt: Date | null }) => ({
    id: t.id,
    step: t.selfServiceStep,
    title: t.title,
    status: t.status,
    completedAt: t.completedAt,
  }))

  // Get the employee's manager name for the branded landing page (Schneier: anti-phishing)
  let managerName: string | null = null
  const profileFull = await modulesPrisma.profile.findUnique({
    where: { id: selfServiceToken.profileId },
    select: { managerId: true },
  })
  if (profileFull?.managerId) {
    const manager = await modulesPrisma.profile.findUnique({
      where: { id: profileFull.managerId },
      select: { fullName: true },
    })
    managerName = manager?.fullName || null
  }

  return success({
    tokenId: selfServiceToken.id,
    employee: {
      id: selfServiceToken.profile.id,
      fullName: selfServiceToken.profile.fullName,
      email: selfServiceToken.profile.email,
      jobTitle: selfServiceToken.profile.jobTitle,
      startDate: selfServiceToken.profile.startDate,
    },
    organisation: {
      id: selfServiceToken.organisation.id,
      name: selfServiceToken.organisation.name,
    },
    managerName,
    expiresAt: selfServiceToken.expiresAt,
    steps,
    allCompleted: steps.length > 0 && steps.every((s: { status: string }) => s.status === 'COMPLETED'),
  })
}
