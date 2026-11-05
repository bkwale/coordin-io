/**
 * Signed demo cookie. The server issues it (POST /api/demo/start) as HttpOnly `${start}.${hmac}`,
 * so a visitor can't mint or extend one in the browser.
 *
 * Rollout: enforcement switches on automatically once DEMO_COOKIE_SECRET (≥ 32 chars) is set in the
 * environment. Without it we accept the legacy unsigned value and warn — safe because the anonymous
 * demo is read-only (see demo-guard.ts). Uses Web Crypto so it runs in middleware (edge) and Node.
 */
const MIN_SECRET = 32
const CLOCK_SKEW_MS = 60_000

export function demoSecret(): string | null {
  const s = process.env.DEMO_COOKIE_SECRET
  return s && s.length >= MIN_SECRET ? s : null
}

const b64url = (buf: ArrayBuffer) => {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Cookie value for a demo that starts at `start` (ms). */
export async function signDemoStart(start: number, secret = demoSecret()): Promise<string> {
  const ts = String(Math.floor(start))
  return secret ? `${ts}.${await hmac(secret, `demo:${ts}`)}` : ts
}

let warned = false
/** Demo start time from a cookie value, or NaN if missing, malformed, forged or from the future. */
export async function readDemoStart(value: string | null | undefined, secret = demoSecret(), now = Date.now()): Promise<number> {
  if (!value) return NaN
  const [ts, sig, ...rest] = value.split('.')
  if (rest.length || !/^\d{10,15}$/.test(ts ?? '')) return NaN
  const start = Number(ts)
  if (start > now + CLOCK_SKEW_MS) return NaN
  if (secret) {
    if (!sig || !safeEqual(sig, await hmac(secret, `demo:${ts}`))) return NaN
    return start
  }
  if (!warned) { warned = true; console.warn('[DemoCookie] DEMO_COOKIE_SECRET not set — accepting unsigned demo cookies (demo is read-only)') }
  return start
}
