'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function IntegrationsPage() {
  const [xero, setXero] = useState<{ connected: boolean; tenantName?: string; lastSync?: string; loading: boolean }>({ connected: false, loading: true })
  const [ms, setMs] = useState<{ connected: boolean; email?: string; services?: string[]; lastSync?: string; loading: boolean }>({ connected: false, loading: true })
  const [stripe, setStripe] = useState<{ plan?: string; status?: string; hasSub: boolean; loading: boolean }>({ hasSub: false, loading: true })
  const [syncingXero, setSyncingXero] = useState(false)
  const [syncingMs, setSyncingMs] = useState(false)

  const fetchAll = async () => {
    const [xR, mR, sR] = await Promise.allSettled([
      fetch('/api/integrations/xero').then(r => r.ok ? r.json() : null),
      fetch('/api/integrations/microsoft').then(r => r.ok ? r.json() : null),
      fetch('/api/billing/status').then(r => r.ok ? r.json() : null),
    ])
    setXero({
      connected: xR.status === 'fulfilled' && xR.value?.data?.connection != null,
      tenantName: xR.status === 'fulfilled' ? xR.value?.data?.connection?.xeroTenantName : undefined,
      lastSync: xR.status === 'fulfilled' ? xR.value?.data?.connection?.lastSyncAt : undefined,
      loading: false,
    })
    setMs({
      connected: mR.status === 'fulfilled' && mR.value?.data?.connection != null,
      email: mR.status === 'fulfilled' ? mR.value?.data?.connection?.msUserEmail : undefined,
      services: mR.status === 'fulfilled' && mR.value?.data?.connection
        ? [mR.value.data.connection.syncCalendar && 'Calendar', mR.value.data.connection.syncFiles && 'SharePoint', mR.value.data.connection.syncMail && 'Mail'].filter(Boolean) as string[]
        : undefined,
      lastSync: mR.status === 'fulfilled' ? mR.value?.data?.connection?.lastSyncAt : undefined,
      loading: false,
    })
    setStripe({
      plan: sR.status === 'fulfilled' ? sR.value?.data?.plan?.name : undefined,
      status: sR.status === 'fulfilled' ? sR.value?.data?.subscription?.status : undefined,
      hasSub: sR.status === 'fulfilled' && sR.value?.data?.subscription?.hasSubscription,
      loading: false,
    })
  }

  useEffect(() => { fetchAll() }, [])

  const triggerSync = async (provider: 'xero' | 'microsoft') => {
    const setter = provider === 'xero' ? setSyncingXero : setSyncingMs
    setter(true)
    try {
      await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' })
      await fetchAll()
    } catch { /* ignore */ }
    setter(false)
  }

  const connectedCount = [xero.connected, ms.connected, stripe.hasSub].filter(Boolean).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Integrations</h1>
        <p className="text-[13px] text-ink-400 mt-1">{connectedCount} of 3 integrations active</p>
      </div>

      {/* Xero */}
      <IntCard
        name="Xero" category="Accounting" desc="Bidirectional sync of invoices, contacts and financial data"
        connected={xero.connected} loading={xero.loading}
        detail={xero.tenantName ? `Connected to ${xero.tenantName}` : null}
        lastSync={xero.lastSync ?? null} syncItems={['Invoices', 'Contacts']}
        syncing={syncingXero} onSync={() => triggerSync('xero')}
      />

      {/* Microsoft 365 */}
      <IntCard
        name="Microsoft 365" category="Productivity" desc="Outlook calendar, email and SharePoint/OneDrive file sync"
        connected={ms.connected} loading={ms.loading}
        detail={ms.email ?? null}
        lastSync={ms.lastSync ?? null} syncItems={ms.services ?? []}
        syncing={syncingMs} onSync={() => triggerSync('microsoft')}
      />

      {/* Stripe */}
      <div className="bg-white rounded-xl border border-ink-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white text-[14px] font-bold', stripe.hasSub ? 'bg-violet-600' : 'bg-ink-200')}>S</div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-ink-900">Stripe</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-200 text-ink-400 font-medium">Billing</span>
                {stripe.hasSub && <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium"><CheckCircle className="w-3 h-3" /> Active</span>}
              </div>
              <p className="text-[11px] text-ink-400 mt-0.5">Subscription billing and payment processing</p>
              {stripe.hasSub && <p className="text-[11px] text-ink-500 mt-0.5 font-medium">{stripe.plan} plan · {stripe.status}</p>}
            </div>
          </div>
          {stripe.loading ? <Loader2 className="w-4 h-4 animate-spin text-ink-300" /> : (
            <a href="/settings?tab=billing" className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors flex items-center gap-1.5">
              Manage <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Coming soon */}
      <div className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Coming Soon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: 'QuickBooks', desc: 'Accounting and bookkeeping' },
            { name: 'Google Workspace', desc: 'Calendar, email and Drive' },
            { name: 'Slack', desc: 'Team notifications and alerts' },
            { name: 'Revit', desc: 'BIM model data sync' },
          ].map(item => (
            <div key={item.name} className="p-4 bg-surface-50 rounded-lg border border-dashed border-surface-200">
              <p className="text-[13px] font-medium text-ink-500">{item.name}</p>
              <p className="text-[11px] text-ink-300 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IntCard({ name, category, desc, connected, loading, detail, lastSync, syncItems, syncing, onSync }: {
  name: string; category: string; desc: string; connected: boolean; loading: boolean
  detail: string | null; lastSync: string | null; syncItems: string[]; syncing: boolean; onSync: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white text-[14px] font-bold', connected ? 'bg-emerald-600' : 'bg-ink-200')}>{name[0]}</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-ink-900">{name}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-200 text-ink-400 font-medium">{category}</span>
              {connected && <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium"><CheckCircle className="w-3 h-3" /> Connected</span>}
            </div>
            <p className="text-[11px] text-ink-400 mt-0.5">{desc}</p>
            {detail && <p className="text-[11px] text-ink-500 mt-0.5 font-medium">{detail}</p>}
          </div>
        </div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-ink-300" /> : connected ? (
          <button onClick={onSync} disabled={syncing} className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now
          </button>
        ) : (
          <a href="/settings?tab=integrations" className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors">Connect</a>
        )}
      </div>
      {connected && syncItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-100 flex items-center gap-4 text-[11px] flex-wrap">
          <span className="text-ink-400">Syncing:</span>
          {syncItems.map(s => <span key={s} className="flex items-center gap-1 text-ink-600 font-medium"><CheckCircle className="w-3 h-3 text-emerald-500" /> {s}</span>)}
          {lastSync && <span className="ml-auto text-ink-300">Last sync: {new Date(lastSync).toLocaleString()}</span>}
        </div>
      )}
    </div>
  )
}
