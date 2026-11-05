'use client'

import { useEffect, useState } from 'react'
import { reportClientError } from '@/lib/client/report-client-error'

/** Last-resort boundary (the root layout itself failed) — plain markup, no app styles available. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [ref, setRef] = useState<string | null>(null)
  useEffect(() => { reportClientError(error).then(setRef) }, [error])
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0, background: '#f8fafc' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>Coordin couldn’t load this page. Try again — if it keeps happening, contact support.</p>
          <button onClick={reset} style={{ padding: '10px 20px', borderRadius: 8, border: 0, background: '#4f46e5', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Try again</button>
          {(ref || error.digest) && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 20 }}>Error reference: <code>{ref ?? error.digest}</code></p>}
        </div>
      </body>
    </html>
  )
}
