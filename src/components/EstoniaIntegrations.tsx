'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

interface MeritStatus {
  connected: boolean
  waiting: number
  connection: { defaultTaxName: string | null; defaultTaxPct: number | null; sendEInvoice: boolean; lastSyncAt: string | null; lastSyncError: string | null } | null
}

const errText = (d: { error?: unknown }, fallback: string) =>
  (typeof d.error === 'string' ? d.error : (d.error as { message?: string } | undefined)?.message) || fallback

const Tag = ({ tone, children }: { tone: 'live' | 'ready' | 'planned'; children: React.ReactNode }) => (
  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tone === 'live' ? 'bg-emerald-50 text-emerald-700' : tone === 'ready' ? 'bg-accent-50 text-accent-700' : 'bg-surface-200 text-ink-500'}`}>{children}</span>
)

/** Settings → Integrations, shown to Estonian firms only: Merit Aktiva (working), plus what is planned for Estonia. */
export function EstoniaIntegrations() {
  const [status, setStatus] = useState<MeritStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [apiId, setApiId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [sendEInvoice, setSendEInvoice] = useState(true)
  const [busy, setBusy] = useState<null | 'connect' | 'sync' | 'disconnect'>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/integrations/merit')
      const d = await res.json().catch(() => ({}))
      setStatus(res.ok ? d.data : { connected: false, waiting: 0, connection: null })
    } catch { setStatus({ connected: false, waiting: 0, connection: null }) }
  }
  useEffect(() => { load() }, [])

  const run = async (kind: 'connect' | 'sync' | 'disconnect') => {
    setBusy(kind); setError(null); setNotice(null)
    try {
      const res = kind === 'connect'
        ? await fetch('/api/integrations/merit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiId, apiKey, sendEInvoice }) })
        : kind === 'sync'
          ? await fetch('/api/integrations/merit/sync', { method: 'POST' })
          : await fetch('/api/integrations/merit', { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'That did not work. Please try again.'))
      if (kind === 'connect') { setApiId(''); setApiKey(''); setOpen(false); setNotice('Merit is connected.') }
      if (kind === 'disconnect') setConfirmOff(false)
      if (kind === 'sync') {
        const r = d.data as { synced: number; failed: number; eInvoiced: number; errors: Array<{ invoiceNumber: string; message: string }> }
        setNotice(r.synced === 0 && r.failed === 0 ? 'Nothing to send. Every invoice is already in Merit.'
          : `${r.synced} sent to Merit${r.eInvoiced ? `, ${r.eInvoiced} delivered as e-invoices` : ''}${r.failed ? `, ${r.failed} not sent` : ''}.`)
        if (r.errors[0]) setError(`${r.errors[0].invoiceNumber}: ${r.errors[0].message}`)
      }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'That did not work. Please try again.') }
    finally { setBusy(null) }
  }

  const c = status?.connection
  const input = 'w-full rounded-lg border border-surface-300 px-3 py-2 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-200'

  return (
    <div className="mt-8 pt-6 border-t border-surface-200">
      <h3 className="text-[13px] font-semibold text-ink-900">For Estonian practices</h3>
      <p className="text-[11px] text-ink-400 mt-1">What works today, and what we are building next for firms in Estonia.</p>

      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">{notice}</div>}

      <div className="mt-4 space-y-4">
        {/* Merit Aktiva */}
        <div className="p-4 bg-surface-50 rounded-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-medium text-ink-900">Merit Aktiva</p>
                <Tag tone="planned">Accounting</Tag>
                {status?.connected ? <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium"><CheckCircle className="w-3 h-3" />Connected</span> : <Tag tone="ready">Ready to connect</Tag>}
              </div>
              <p className="text-[11px] text-ink-400 mt-1">Sales invoices raised in Coordin go straight into your Merit books, with the client and VAT filled in.</p>
              {status?.connected && c && (
                <p className="text-[11px] text-ink-500 mt-0.5 font-medium">
                  {c.defaultTaxName ? `VAT: ${c.defaultTaxName}` : 'No matching VAT rate found in Merit yet'}
                  {c.sendEInvoice ? ' · e-invoices on' : ''}
                  {` · ${status.waiting} invoice${status.waiting === 1 ? '' : 's'} waiting`}
                  {c.lastSyncAt ? ` · last sent ${new Date(c.lastSyncAt).toLocaleDateString('et-EE')}` : ''}
                </p>
              )}
            </div>
            {!status ? <Loader2 className="w-4 h-4 animate-spin text-ink-300" /> : status.connected ? (
              confirmOff ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-500">Disconnect Merit? The stored key is removed.</span>
                  <button onClick={() => run('disconnect')} disabled={busy !== null} className="text-[12px] text-white bg-red-600 hover:bg-red-700 font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">{busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}</button>
                  <button onClick={() => setConfirmOff(false)} className="text-[12px] text-ink-500 hover:text-ink-700 font-medium px-2 py-1.5">Keep</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => run('sync')} disabled={busy !== null} className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 disabled:opacity-50">{busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send invoices to Merit'}</button>
                  <button onClick={() => { setConfirmOff(true); setError(null) }} className="text-[12px] text-ink-500 hover:text-red-600 font-medium px-3 py-1.5 border border-surface-300 rounded-lg hover:border-red-200">Disconnect</button>
                </div>
              )
            ) : !open ? (
              <button onClick={() => { setOpen(true); setError(null) }} className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50">Connect</button>
            ) : null}
          </div>

          {open && !status?.connected && (
            <form className="mt-4 pt-4 border-t border-surface-200 space-y-3 max-w-md" onSubmit={(e) => { e.preventDefault(); run('connect') }}>
              <p className="text-[11px] text-ink-500">In Merit, go to Settings → API settings and create an API ID and key. Paste both here. Coordin checks them with Merit, then stores them encrypted.</p>
              <div>
                <label htmlFor="merit-api-id" className="block text-[11px] font-medium text-ink-700 mb-1">API ID</label>
                <input id="merit-api-id" className={input} value={apiId} onChange={(e) => setApiId(e.target.value)} autoComplete="off" required />
              </div>
              <div>
                <label htmlFor="merit-api-key" className="block text-[11px] font-medium text-ink-700 mb-1">API key</label>
                <input id="merit-api-key" type="password" className={input} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" required />
              </div>
              <label className="flex items-start gap-2 text-[12px] text-ink-700">
                <input type="checkbox" className="mt-0.5" checked={sendEInvoice} onChange={(e) => setSendEInvoice(e.target.checked)} />
                <span>Also deliver each invoice as an e-invoice (e-arve) when the client can receive them</span>
              </label>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy !== null || !apiId.trim() || !apiKey.trim()} className="text-[12px] text-white bg-accent-600 hover:bg-accent-700 font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">{busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check and connect'}</button>
                <button type="button" onClick={() => { setOpen(false); setApiId(''); setApiKey('') }} className="text-[12px] text-ink-500 hover:text-ink-700 font-medium px-2 py-1.5">Cancel</button>
              </div>
            </form>
          )}
        </div>

        {[
          { name: 'E-invoices (e-arve)', category: 'Invoicing', tone: 'ready' as const, label: 'Through Merit today', text: 'With Merit connected, invoices are delivered as e-invoices through Merit’s operator. Next: sending directly from Coordin over the Peppol network (EN 16931), for firms that do not use Merit.', next: 'Direct sending: planned' },
          { name: 'Digital signing', category: 'Contracts', tone: 'planned' as const, label: 'Planned', text: 'Sign fee proposals, contracts and approvals with Smart-ID, Mobile-ID or ID-card, and keep the signed file on the project.', next: null },
          { name: 'Building Register (EHR)', category: 'Regulatory', tone: 'live' as const, label: 'Live', text: 'Link a project to its building in the register and pull the registered facts into the regulatory checklist. Find it on a project under Regulatory.', next: null },
        ].map((x) => (
          <div key={x.name} className="flex items-center justify-between gap-4 p-4 bg-surface-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-medium text-ink-900">{x.name}</p>
                <Tag tone="planned">{x.category}</Tag>
                <Tag tone={x.tone}>{x.label}</Tag>
              </div>
              <p className="text-[11px] text-ink-400 mt-1">{x.text}</p>
            </div>
            {x.next && <span className="text-[11px] text-ink-300 font-medium whitespace-nowrap">{x.next}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
