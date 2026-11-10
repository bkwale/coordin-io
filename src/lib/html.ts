/** HTML escaping for anything user-typed that goes into an email or HTML string. */
export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Escape every string (and string array) in a template's params; leave numbers/booleans alone. */
export function escapeParams<T extends Record<string, unknown>>(p: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) {
    out[k] = typeof v === 'string' ? escapeHtml(v) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? escapeHtml(x) : x)) : v
  }
  return out as T
}

/** Only http(s) links or app-relative paths — never javascript:, data: or protocol-relative. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null
  const u = url.trim()
  if (u.startsWith('/') && !u.startsWith('//')) return u
  return /^https?:\/\//i.test(u) ? u : null
}
