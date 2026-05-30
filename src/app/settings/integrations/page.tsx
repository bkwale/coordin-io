'use client'

import React from 'react'
import { getIntegrations, getIntegrationsByCategory, getUser, getQuoteAccountingLinks } from '@/lib/mock-data'
import { Integration, IntegrationStatus } from '@/lib/types'
import { cn, formatDate, integrationStatusColor, integrationStatusLabel, integrationStatusDot, accountingSyncStatusColor, accountingSyncStatusLabel } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

// ── Helper: Get provider icon and color ──────────────────────
function getProviderIcon(provider: string): { bg: string; text: string; letter: string } {
  switch (provider) {
    case 'xero':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', letter: 'X' }
    case 'quickbooks':
      return { bg: 'bg-blue-100', text: 'text-blue-700', letter: 'Q' }
    case 'outlook':
      return { bg: 'bg-blue-100', text: 'text-blue-700', letter: 'O' }
    case 'google_calendar':
      return { bg: 'bg-red-100', text: 'text-red-700', letter: 'G' }
    case 'sharepoint':
      return { bg: 'bg-teal-100', text: 'text-teal-700', letter: 'S' }
    case 'dropbox':
      return { bg: 'bg-blue-100', text: 'text-blue-700', letter: 'D' }
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', letter: '?' }
  }
}

// ── Helper: Get category label ──────────────────────────────
function getCategoryLabel(category: string): string {
  switch (category) {
    case 'accounting': return 'Accounting'
    case 'calendar': return 'Calendar & Email'
    case 'storage': return 'Document Storage'
    default: return category
  }
}

// ── Helper: Get last sync time for display ──────────────────
function getLastSyncDisplay(lastSyncAt?: string, syncFrequency?: number): string {
  if (!lastSyncAt) return 'Never'
  const date = new Date(lastSyncAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / 60000)
    return `${diffMins}m ago`
  }
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(lastSyncAt)
}

// ── Component: Summary Card ────────────────────────────────
function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-premium p-4">
      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">{label}</p>
      <p className="text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  )
}

// ── Component: Integration Card ─────────────────────────────
function IntegrationCard({ integration }: { integration: Integration }) {
  const { bg, text, letter } = getProviderIcon(integration.provider)
  const user = integration.connected_by_user_id ? getUser(integration.connected_by_user_id) : null

  return (
    <div className="card-premium p-5">
      {/* Header: Icon + Title + Status */}
      <div className="flex gap-4 mb-4">
        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center font-semibold shrink-0', bg, text)}>
          {letter}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-ink-900">{integration.display_name}</h3>
          <p className="text-xs text-ink-400 mt-1 line-clamp-2">{integration.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('w-2 h-2 rounded-full', integrationStatusDot(integration.status))} />
          <span className={cn('text-xs font-medium uppercase tracking-[0.05em]', integrationStatusColor(integration.status))}>
            {integrationStatusLabel(integration.status)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 my-3" />

      {/* Status details and error message */}
      <div className="space-y-2 mb-4">
        {integration.status === 'connected' && user && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-xs text-ink-400">Connected by</p>
              <p className="text-xs text-ink-700 font-medium">{user.name}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-ink-400">Last sync</p>
              <p className="text-xs text-ink-700 font-medium">{getLastSyncDisplay(integration.last_sync_at, integration.sync_frequency_minutes)}</p>
            </div>
            {integration.sync_frequency_minutes && (
              <div className="flex justify-between items-center">
                <p className="text-xs text-ink-400">Sync frequency</p>
                <p className="text-xs text-ink-700 font-medium">Every {integration.sync_frequency_minutes}m</p>
              </div>
            )}
          </>
        )}

        {integration.status === 'error' && integration.config.error_message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700">{integration.config.error_message}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {integration.status === 'connected' ? (
          <>
            <button className="flex-1 px-3 py-2 text-xs font-medium text-ink-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Disconnect
            </button>
            <button className="flex-1 px-3 py-2 text-xs font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 transition-colors">
              Sync Now
            </button>
          </>
        ) : (
          <button className="w-full px-3 py-2 text-xs font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 transition-colors">
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsHubPage() {
  const integrations = getIntegrations()

  // Group integrations by category
  const byCategory = {
    accounting: getIntegrationsByCategory('accounting'),
    calendar: getIntegrationsByCategory('calendar'),
    storage: getIntegrationsByCategory('storage'),
  }

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb
          items={[
            { label: 'Settings' },
            { label: 'Integrations' },
          ]}
        />

        <div className="mt-8">
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] text-ink-900 mb-2">Integrations</h1>
          <p className="text-sm text-ink-400">
            Connect your practice tools to sync data automatically
          </p>
        </div>
      </section>

      {/* ━━━ ACCOUNTING INTEGRATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <div className="border-t border-slate-200 pt-8">
          <h2 className="font-display text-xl text-ink-900 mb-4">Accounting</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {byCategory.accounting.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ CALENDAR & EMAIL INTEGRATIONS ━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <div className="border-t border-slate-200 pt-8">
          <h2 className="font-display text-xl text-ink-900 mb-4">Calendar & Email</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {byCategory.calendar.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ DOCUMENT STORAGE INTEGRATIONS ━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <div className="border-t border-slate-200 pt-8">
          <h2 className="font-display text-xl text-ink-900 mb-4">Document Storage</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {byCategory.storage.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ QUOTE ACCOUNTING LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <QuoteAccountingLinksSection />
    </div>
  )
}

// ── Component: Quote Accounting Links Section ───────────────
function QuoteAccountingLinksSection() {
  const links = getQuoteAccountingLinks()

  const stats = {
    total: links.length,
    synced: links.filter(l => l.sync_status === 'synced').length,
    pending: links.filter(l => l.sync_status === 'pending').length,
    failed: links.filter(l => l.sync_status === 'failed').length,
  }

  return (
    <section className="pb-16">
      <div className="border-t border-surface-200/60 pt-10">
        <h2 className="font-display text-xl text-ink-900 mb-6">Quote → Invoice Sync</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Total Links" value={stats.total} />
          <SummaryCard label="Synced" value={stats.synced} />
          <SummaryCard label="Pending" value={stats.pending} />
          <SummaryCard label="Failed" value={stats.failed} />
        </div>

        {/* Links Table */}
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="px-6 py-3 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Fee Quote ID</th>
                  <th className="px-6 py-3 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Provider</th>
                  <th className="px-6 py-3 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">External Ref</th>
                  <th className="px-6 py-3 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Sync Status</th>
                  <th className="px-6 py-3 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Last Synced</th>
                  <th className="px-6 py-3 text-center text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Auto-Sync</th>
                  <th className="px-6 py-3 text-right text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {links.map(link => (
                  <React.Fragment key={link.id}>
                    <tr className="stripe-row hover:bg-surface-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-ink-900">{link.fee_quote_id}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', getProviderBadgeClass(link.provider))}>
                          {link.provider === 'xero' ? 'Xero' : link.provider === 'quickbooks' ? 'QuickBooks' : link.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700 font-mono">{link.external_ref}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', accountingSyncStatusColor(link.sync_status))}>
                          {accountingSyncStatusLabel(link.sync_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">{link.last_synced_at ? formatDate(link.last_synced_at) : 'Never'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn('w-2 h-2 rounded-full inline-block', link.auto_sync_enabled ? 'bg-emerald-500' : 'bg-slate-300')} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors">
                          View
                        </button>
                      </td>
                    </tr>

                    {/* Error Row */}
                    {link.sync_status === 'failed' && link.error_message && (
                      <tr className="bg-red-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-red-700"><strong>Error:</strong> {link.error_message}</p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Mapped Fields Row */}
                    {link.mapped_fields && link.mapped_fields.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="flex flex-wrap gap-2">
                            {link.mapped_fields.map((field, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-ink-100 text-ink-700 font-medium">
                                {field}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {links.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-400">No quote accounting links yet</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Helper: Get provider badge class ────────────────────────
function getProviderBadgeClass(provider: string): string {
  switch (provider) {
    case 'xero':
      return 'bg-emerald-100 text-emerald-700'
    case 'quickbooks':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
