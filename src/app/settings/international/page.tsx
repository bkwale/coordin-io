'use client'

import { getOrganisationSettings, getJurisdictionPacks } from '@/lib/mock-data'
import { JurisdictionPack, OrganisationSettings, RIBA_STAGES, RIBAStage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

export default function InternationalSettingsPage() {
  const settings: OrganisationSettings = getOrganisationSettings()
  const packs: JurisdictionPack[] = getJurisdictionPacks()

  // Find the active pack
  const activePack = settings.jurisdiction_pack_id
    ? packs.find(p => p.id === settings.jurisdiction_pack_id)
    : undefined

  // Helper to render RIBA stage labels as a compact list
  const ribaStageList = (labels: Record<RIBAStage, string>) => {
    return (
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        {(Object.entries(labels) as [string, string][]).map(([stage, label]) => (
          <div key={stage} className="flex items-start gap-1">
            <span className="text-ink-400 font-mono">Stage {stage}:</span>
            <span className="text-ink-600 leading-tight">{label}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Settings' },
            { label: 'International' },
          ]}
        />

        <div className="mt-6">
          <h1 className="font-display text-[2rem] text-ink-900 mb-2">
            International & Jurisdiction
          </h1>
          <p className="text-[13px] text-ink-400">
            Configure currencies, units, date formats, and jurisdiction packs
          </p>
        </div>
      </section>

      {/* ━━━ ORGANISATION SETTINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <div className="card-premium p-6">
          <h2 className="font-display text-[1.25rem] text-ink-900 mb-6">
            Organisation Settings
          </h2>

          <div className="space-y-0">
            {/* Currency */}
            <div className="flex justify-between items-center py-3 border-b border-surface-200/60">
              <span className="text-[13px] font-medium text-ink-700">
                Default Currency
              </span>
              <span className="text-[13px] text-ink-500 font-mono">
                {settings.default_currency}
              </span>
            </div>

            {/* Units */}
            <div className="flex justify-between items-center py-3 border-b border-surface-200/60">
              <span className="text-[13px] font-medium text-ink-700">
                Units System
              </span>
              <span className="text-[13px] text-ink-500 capitalize">
                {settings.default_units}
              </span>
            </div>

            {/* Date Format */}
            <div className="flex justify-between items-center py-3 border-b border-surface-200/60">
              <span className="text-[13px] font-medium text-ink-700">
                Date Format
              </span>
              <span className="text-[13px] text-ink-500 font-mono">
                {settings.date_format}
              </span>
            </div>

            {/* Project Number Template */}
            <div className="flex justify-between items-center py-3 border-b border-surface-200/60">
              <span className="text-[13px] font-medium text-ink-700">
                Project Number Template
              </span>
              <span className="text-[13px] text-ink-500 font-mono">
                {settings.project_number_template || '—'}
              </span>
            </div>

            {/* Active Jurisdiction Pack */}
            <div className="flex justify-between items-center py-3">
              <span className="text-[13px] font-medium text-ink-700">
                Active Jurisdiction Pack
              </span>
              <div className="text-right">
                <div className="text-[13px] text-ink-500">
                  {activePack ? (
                    <>
                      {activePack.country}
                      {activePack.region && <span className="text-ink-400"> — {activePack.region}</span>}
                    </>
                  ) : (
                    <span className="text-ink-300">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ JURISDICTION PACKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12 border-t border-surface-200 pt-12">
        <div className="mb-8">
          <h2 className="font-display text-[1.25rem] text-ink-900 mb-2">
            Jurisdiction Packs
          </h2>
          <p className="text-[13px] text-ink-400">
            Pre-configured regional settings for different countries and regulatory environments
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {packs.map(pack => {
            const isActive = activePack?.id === pack.id
            return (
              <div
                key={pack.id}
                className={cn(
                  'card-premium p-6',
                  isActive
                    ? '!border-emerald-300 !bg-emerald-50/40'
                    : ''
                )}
              >
                {/* Header with title and active badge */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-ink-900">
                      {pack.country}
                      {pack.region && <span className="text-ink-600"> — {pack.region}</span>}
                    </h3>
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-[0.08em]">
                      Active
                    </span>
                  )}
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-surface-200/60">
                  <div>
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-1">
                      Language
                    </p>
                    <p className="text-[13px] text-ink-700 capitalize">
                      {pack.language === 'en' ? 'English' : pack.language}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-1">
                      Currency
                    </p>
                    <p className="text-[13px] text-ink-700 font-mono">
                      {pack.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-1">
                      Units
                    </p>
                    <p className="text-[13px] text-ink-700 capitalize">
                      {pack.units}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-1">
                      Date Format
                    </p>
                    <p className="text-[13px] text-ink-700 font-mono">
                      {pack.date_format}
                    </p>
                  </div>
                </div>

                {/* RIBA Stages */}
                <div className="mb-6 pb-6 border-b border-surface-200/60">
                  <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-3">
                    RIBA Stage Labels
                  </p>
                  {ribaStageList(pack.stage_labels)}
                </div>

                {/* Terminology Notes */}
                {pack.terminology_notes && (
                  <div className="mb-4 pb-4 border-b border-surface-200/60">
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-2">
                      Terminology Notes
                    </p>
                    <p className="text-[12px] text-ink-600 leading-relaxed">
                      {pack.terminology_notes}
                    </p>
                  </div>
                )}

                {/* Reference Guidance */}
                {pack.reference_guidance_notes && (
                  <div>
                    <p className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.1em] mb-2">
                      Reference Guidance
                    </p>
                    <p className="text-[12px] text-ink-600 leading-relaxed">
                      {pack.reference_guidance_notes}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ━━━ TERMINOLOGY OVERRIDES ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12 border-t border-surface-200 pt-12">
        <h2 className="font-display text-[1.25rem] text-ink-900 mb-6">
          Terminology Overrides
        </h2>

        {(!settings.terminology_overrides || Object.keys(settings.terminology_overrides).length === 0) ? (
          <div className="bg-surface-50 rounded-2xl border border-surface-200 p-6 text-center">
            <p className="text-[13px] text-ink-400 italic">
              No custom terminology overrides configured.
            </p>
          </div>
        ) : (
          <div className="card-premium p-6">
            <div className="space-y-0">
              {Object.entries(settings.terminology_overrides).map(([original, override], i, arr) => (
                <div
                  key={original}
                  className={cn(
                    'flex justify-between items-center py-3',
                    i < arr.length - 1 && 'border-b border-surface-200/60'
                  )}
                >
                  <span className="text-[13px] text-ink-600">
                    {original}
                  </span>
                  <span className="text-[13px] font-medium text-ink-900">
                    {override}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
