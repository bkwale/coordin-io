import { error } from '@/lib/api-response'
import { NextRequest, NextResponse, after } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { startPracticeSetup, executePracticeSetup, executeRegistryOnlySetup } from '@/lib/ai/practice-setup'
import { normaliseUrl } from '@/lib/ai/crawl'
import { isRegistryConfigured, type RegistryJurisdiction } from '@/lib/registry'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/practice-setup  { url }
 * Platform-admin demo surface for Sprint 1. Creates an AIRun, kicks off
 * crawl → extract → map in the background (after()), returns the run id to poll.
 */
export const POST = withSuperAdmin(async (request: NextRequest, { authUserId }) => {
  const limited = await checkRateLimit(`ai:${authUserId}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const raw = typeof body.url === 'string' ? body.url.trim() : ''
  const registryCode = typeof body.registryCode === 'string' ? body.registryCode.trim().toUpperCase() : ''
  const jurisdiction: RegistryJurisdiction = body.jurisdiction === 'GB' ? 'GB' : 'EE'
  if (!raw && !registryCode) return NextResponse.json({ error: 'A website or a registry number is required', code: 'VALIDATION' }, { status: 400 })
  if (registryCode && !(jurisdiction === 'EE' ? /^\d{8}$/ : /^[A-Z0-9]{8}$/).test(registryCode)) {
    return NextResponse.json({ error: jurisdiction === 'EE' ? 'Estonian registry code is 8 digits' : 'UK company number is 8 characters', code: 'VALIDATION' }, { status: 400 })
  }
  if (registryCode && !isRegistryConfigured(jurisdiction)) return NextResponse.json({ error: 'Companies House lookup is not configured yet', code: 'VALIDATION' }, { status: 400 })

  let url: string | null = null
  if (raw) { try { url = normaliseUrl(raw).toString() } catch { return NextResponse.json({ error: 'Not a valid URL', code: 'VALIDATION' }, { status: 400 }) } }

  let run: Awaited<ReturnType<typeof startPracticeSetup>>
  try { run = await startPracticeSetup({ url, registryCode: registryCode || null, jurisdiction, createdBy: authUserId }) }
  catch (e) { return error(e) }
  const registry = registryCode ? { jurisdiction, registryCode } : null

  after(async () => {
    try {
      if (url) await executePracticeSetup(run.id, url, registry)
      else await executeRegistryOnlySetup(run.id, jurisdiction, registryCode)
    } catch { /* recorded on the run */ }
  })

  return NextResponse.json({ data: { id: run.id, status: run.status, url, registryCode: registryCode || null, jurisdiction } }, { status: 202 })
})
