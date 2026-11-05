/** Browser side: send a crash to /api/errors/client once per error object; resolves to the reference. */
const sent = new WeakMap<object, Promise<string | null>>()

export function reportClientError(error: Error & { digest?: string }): Promise<string | null> {
  const existing = sent.get(error)
  if (existing) return existing
  const p = fetch('/api/errors/client', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      message: String(error.message || error.name || 'Unknown error').slice(0, 500),
      stack: error.stack?.slice(0, 4000),
      digest: error.digest,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => (b?.data?.ref as string | undefined) ?? null)
    .catch(() => null)
  sent.set(error, p)
  return p
}
