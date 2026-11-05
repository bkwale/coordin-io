/**
 * One place every failure goes. captureError() never throws and returns a short reference the user
 * can quote ("ERR-7K2M9QXA"). Each capture:
 *   1. writes one structured line to the server log (Vercel logs),
 *   2. stores a row in error_events (platform admins see it at /admin/errors),
 *   3. forwards to Sentry when SENTRY_DSN is set (plain HTTP — no SDK),
 *   4. emails ERROR_ALERT_EMAIL the first time a new kind of error is seen in 24 h (if set).
 * No request bodies, no form contents. Emails and long digit runs are masked in messages.
 */
import { createHash, randomBytes } from 'node:crypto'
import { after } from 'next/server'

export type ErrorSource = 'api' | 'ai' | 'cron' | 'client' | 'background'
export type ErrorLevel = 'error' | 'warning'

export interface ErrorContext {
  source: ErrorSource
  route?: string | null
  method?: string | null
  statusCode?: number | null
  code?: string | null
  organisationId?: string | null
  profileId?: string | null
  runId?: string | null
  /** Small, non-personal facts only (ids, kinds, counts). */
  extra?: Record<string, unknown>
}

const REPORTED = Symbol.for('coordin.errorReported')

/** Has this error object already been captured (avoid double rows when it bubbles)? */
export function alreadyReported(err: unknown): string | null {
  return err && typeof err === 'object' && (err as Record<symbol, unknown>)[REPORTED] ? String((err as Record<symbol, unknown>)[REPORTED]) : null
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newErrorRef(): string {
  const b = randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length]
  return `ERR-${s}`
}

/** Mask emails and long digit runs (bank/phone/ID numbers) before anything leaves the process. */
export function scrub(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d[\d -]{7,}\d\b/g, '[number]')
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  if (typeof err === 'string') return err
  try { return JSON.stringify(err).slice(0, 500) } catch { return String(err) }
}

/** Same problem → same fingerprint: ids, numbers and quoted values are stripped before hashing. */
export function fingerprintOf(source: ErrorSource, route: string | null | undefined, message: string, stack?: string | null): string {
  const normalised = message
    .replace(/\b[a-z0-9]{20,}\b/gi, ':id')
    .replace(/\d+/g, 'N')
    .replace(/"[^"]*"|'[^']*'/g, ':v')
    .slice(0, 200)
  const route0 = (route ?? '').replace(/\/[a-z0-9]{20,}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:n')
  const frame = (stack ?? '').split('\n').find((l) => l.includes('/src/')) ?? ''
  return createHash('sha1').update(`${source}|${route0}|${normalised}|${frame.trim().replace(/:\d+:\d+\)?$/, '')}`).digest('hex').slice(0, 16)
}

/**
 * Capture an error. Returns the reference immediately; storage/forwarding run in the background
 * (kept alive with next/server after() when inside a request).
 */
export function captureError(err: unknown, ctx: ErrorContext, level: ErrorLevel = 'error'): string {
  try {
    const existing = alreadyReported(err)
    if (existing) return existing
    const ref = newErrorRef()
    if (err && typeof err === 'object') {
      try { Object.defineProperty(err, REPORTED, { value: ref, enumerable: false }) } catch { /* frozen */ }
    }
    const message = scrub(messageOf(err)).slice(0, 1000)
    const stack = err instanceof Error && err.stack ? scrub(err.stack).slice(0, 4000) : null
    const fingerprint = fingerprintOf(ctx.source, ctx.route, message, stack)
    const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null

    console[level === 'error' ? 'error' : 'warn']('[ErrorReport]', JSON.stringify({
      ref, level, fingerprint, source: ctx.source, route: ctx.route, method: ctx.method, status: ctx.statusCode, code: ctx.code,
      org: ctx.organisationId, profile: ctx.profileId, run: ctx.runId, message, release, ...(ctx.extra ? { extra: ctx.extra } : {}),
    }))

    const work = persist({ ref, level, fingerprint, message, stack, release, ctx }).catch((e) => {
      console.warn('[ErrorReport] could not store', ref, e instanceof Error ? e.message : e)
    })
    keepAlive(work)
    return ref
  } catch {
    return 'ERR-UNRECORDED'
  }
}

/** Await the background work (tests, cron jobs that end right after). */
export async function captureErrorAndWait(err: unknown, ctx: ErrorContext, level: ErrorLevel = 'error'): Promise<string> {
  const ref = captureError(err, ctx, level)
  await Promise.allSettled(pending)
  return ref
}

const pending = new Set<Promise<unknown>>()
function keepAlive(p: Promise<unknown>) {
  pending.add(p)
  p.finally(() => pending.delete(p))
  // Inside a request, ask Next to keep the function alive until the write finishes.
  try { after(p) } catch { /* outside a request scope — the promise still runs */ }
}

interface PersistInput { ref: string; level: ErrorLevel; fingerprint: string; message: string; stack: string | null; release: string | null; ctx: ErrorContext }

async function persist(i: PersistInput): Promise<void> {
  const { prisma } = await import('@/lib/prisma')
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const seenRecently = await prisma.errorEvent.count({ where: { fingerprint: i.fingerprint, createdAt: { gte: since } } })
  await prisma.errorEvent.create({
    data: {
      ref: i.ref, fingerprint: i.fingerprint, level: i.level, source: i.ctx.source,
      route: i.ctx.route ?? null, method: i.ctx.method ?? null, statusCode: i.ctx.statusCode ?? null, code: i.ctx.code ?? null,
      message: i.message, stack: i.stack, organisationId: i.ctx.organisationId ?? null, profileId: i.ctx.profileId ?? null,
      runId: i.ctx.runId ?? null, context: (i.ctx.extra ?? undefined) as never, release: i.release,
    },
  })
  // Housekeeping: keep 90 days (cheap, occasional)
  if (Math.random() < 0.01) {
    await prisma.errorEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60_000) } } }).catch(() => {})
  }
  await Promise.allSettled([
    forwardToSentry(i),
    seenRecently === 0 && i.level === 'error' ? alertByEmail(i) : Promise.resolve(),
  ])
}

/** Sentry envelope over HTTP, only when SENTRY_DSN is configured. */
export function sentryEnvelope(dsn: string, i: PersistInput): { url: string; body: string; auth: string } | null {
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/)
  if (!m) return null
  const [, key, host, project] = m
  const eventId = randomBytes(16).toString('hex')
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: i.level,
    release: i.release ?? undefined,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    fingerprint: [i.fingerprint],
    message: { formatted: i.message },
    tags: { ref: i.ref, source: i.ctx.source, route: i.ctx.route ?? '', code: i.ctx.code ?? '' },
    extra: { stack: i.stack, runId: i.ctx.runId, organisationId: i.ctx.organisationId, ...(i.ctx.extra ?? {}) },
  }
  const body = [JSON.stringify({ event_id: eventId, dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n')
  return { url: `https://${host}/api/${project}/envelope/`, body, auth: `Sentry sentry_version=7, sentry_key=${key}, sentry_client=coordin/1.0` }
}

async function forwardToSentry(i: PersistInput): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  const env = sentryEnvelope(dsn, i)
  if (!env) return
  await fetch(env.url, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope', 'x-sentry-auth': env.auth }, body: env.body, signal: AbortSignal.timeout(3000) })
}

async function alertByEmail(i: PersistInput): Promise<void> {
  const to = process.env.ERROR_ALERT_EMAIL
  if (!to || !process.env.RESEND_API_KEY) return
  const { sendErrorAlertEmail } = await import('@/lib/email')
  await sendErrorAlertEmail({
    to,
    ref: i.ref,
    source: i.ctx.source,
    route: i.ctx.route ?? null,
    message: i.message,
    level: i.level,
  })
}
