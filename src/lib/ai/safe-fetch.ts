/**
 * Outbound fetch for URLs a user typed in (practice website crawl). Refuses anything that resolves to a
 * private, loopback, link-local, CGNAT or unique-local address, non-standard ports and non-http schemes,
 * re-checks every redirect hop, and caps the body size. Stops the crawler being pointed at internal
 * services or cloud metadata endpoints.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class UnsafeUrlError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsafeUrlError' }
}

function v4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 169 && b === 254) return true // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true // multicast + reserved
  return false
}

/** Expand an IPv6 address (any notation, incl. a trailing dotted IPv4) to 8 numbers. */
function v6Hextets(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number)
    s = s.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0
  if (fill < 0) return null
  const parts = [...head, ...Array(fill).fill('0'), ...tail]
  if (parts.length !== 8) return null
  const nums = parts.map((h) => parseInt(h, 16))
  return nums.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : nums
}

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return v4Private(ip)
  if (kind !== 6) return true
  const h = v6Hextets(ip)
  if (!h) return true
  const zeroTo = (n: number) => h.slice(0, n).every((x) => x === 0)
  if (h.every((x) => x === 0)) return true // ::
  if (zeroTo(7) && h[7] === 1) return true // ::1
  if (zeroTo(5) && h[5] === 0xffff) return v4Private(v4From(h[6], h[7])) // ::ffff:a.b.c.d (any notation)
  if (zeroTo(6)) return v4Private(v4From(h[6], h[7])) // ::a.b.c.d (IPv4-compatible)
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return v4Private(v4From(h[6], h[7])) // NAT64
  if (h[0] === 0x2002) return v4Private(v4From(h[1], h[2])) // 6to4
  if ((h[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h[0] & 0xff00) === 0xff00) return true // multicast
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true // documentation
  return false
}

/** Throws UnsafeUrlError unless the URL is http(s) on 80/443 and every resolved address is public. */
export async function assertPublicUrl(u: URL): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeUrlError('Only http and https links can be read')
  if (u.port && u.port !== '80' && u.port !== '443') throw new UnsafeUrlError('Only standard web ports can be read')
  if (u.username || u.password) throw new UnsafeUrlError('Links with credentials cannot be read')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new UnsafeUrlError('That address is not a public website')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true })
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError('That address is not a public website')
}

const MAX_BYTES = 2_000_000

/** Read a response body as text, stopping at a byte cap. */
export async function readCapped(res: Response, maxBytes = MAX_BYTES): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel().catch(() => {}); break }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * One request, no automatic redirects (callers follow them, calling this again per hop),
 * after checking the target is public.
 */
export async function safeFetch(u: URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  await assertPublicUrl(u)
  const { timeoutMs = 12_000, ...rest } = init
  return fetch(u, { ...rest, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
}

/** safeFetch that follows up to `maxHops` redirects, re-checking each hop. */
export async function safeFetchFollow(u: URL, init: RequestInit & { timeoutMs?: number } = {}, maxHops = 5): Promise<Response> {
  let current = u
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await safeFetch(current, init)
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return res
      current = new URL(loc, current)
      continue
    }
    return res
  }
  throw new UnsafeUrlError('Too many redirects')
}
