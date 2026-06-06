'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Breadcrumb } from '@/components/Breadcrumb'
import { PROJECTS, getFeeQuoteTemplates } from '@/lib/mock-data'
import { QuoteMode, QuoteTemplateType } from '@/lib/types'
import { cn, quoteTemplateTypeColor, quoteTemplateTypeLabel } from '@/lib/utils'
import { FileText, Plus, FolderOpen, Briefcase, ChevronRight, Check } from 'lucide-react'

export default function NewQuotePage() {
  const templates = getFeeQuoteTemplates()

  // Step 1: Mode
  const [selectedMode, setSelectedMode] = useState<QuoteMode | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [projectTitle, setProjectTitle] = useState('')

  // Step 2: Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const canCreate = selectedMode && selectedTemplateId && (
    selectedMode === 'existing_project' ? selectedProjectId !== '' : clientName.trim() !== ''
  )

  return (
    <div className="min-h-screen bg-surface-50 animate-fade-in">
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Fee Quotes', href: '/fee-quotes' },
            { label: 'New Quote' },
          ]}
        />

        {/* Page Title */}
        <h1 className="font-display text-3xl font-semibold text-ink-900 mt-6 mb-8">
          Create New Quote
        </h1>

        {/* Step 1: Quote Mode */}
        <section className="mb-10">
          <h2 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-4">
            Step 1 — Quote Mode
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Linked to Project */}
            <button
              onClick={() => setSelectedMode('existing_project')}
              className={cn(
                'card-premium p-6 text-left transition-all cursor-pointer',
                selectedMode === 'existing_project'
                  ? 'ring-2 ring-accent-500 border-accent-300'
                  : 'hover:border-slate-300'
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  selectedMode === 'existing_project' ? 'bg-accent-100' : 'bg-slate-100'
                )}>
                  <FolderOpen className={cn(
                    'w-5 h-5',
                    selectedMode === 'existing_project' ? 'text-accent-600' : 'text-slate-500'
                  )} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-ink-900 mb-1">Linked to Project</h3>
                  <p className="text-[13px] text-ink-500">For an existing project already tracked in the system</p>
                </div>
                {selectedMode === 'existing_project' && (
                  <Check className="w-5 h-5 text-accent-600" />
                )}
              </div>
            </button>

            {/* Standalone Quote */}
            <button
              onClick={() => setSelectedMode('standalone')}
              className={cn(
                'card-premium p-6 text-left transition-all cursor-pointer',
                selectedMode === 'standalone'
                  ? 'ring-2 ring-accent-500 border-accent-300'
                  : 'hover:border-slate-300'
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  selectedMode === 'standalone' ? 'bg-accent-100' : 'bg-slate-100'
                )}>
                  <Briefcase className={cn(
                    'w-5 h-5',
                    selectedMode === 'standalone' ? 'text-accent-600' : 'text-slate-500'
                  )} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-ink-900 mb-1">Standalone Quote</h3>
                  <p className="text-[13px] text-ink-500">New opportunity — enter client and project details</p>
                </div>
                {selectedMode === 'standalone' && (
                  <Check className="w-5 h-5 text-accent-600" />
                )}
              </div>
            </button>
          </div>

          {/* Mode-specific fields */}
          {selectedMode === 'existing_project' && (
            <div className="mt-4 card-static p-5">
              <label className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-[14px] text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <option value="">Choose a project...</option>
                {PROJECTS.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.client}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedMode === 'standalone' && (
            <div className="mt-4 card-static p-5 space-y-4">
              <div>
                <label className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Harris Family Trust"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-[14px] text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                  Project Title
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g. Rear extension and loft conversion"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-[14px] text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Template Selection */}
        <section className="mb-10">
          <h2 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-4">
            Step 2 — Choose Template
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className={cn(
                  'card-static p-5 text-left transition-all cursor-pointer',
                  selectedTemplateId === template.id
                    ? 'ring-2 ring-accent-500 border-accent-300'
                    : 'hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn('status-pill text-[11px]', quoteTemplateTypeColor(template.template_type))}>
                    {quoteTemplateTypeLabel(template.template_type)}
                  </span>
                  {selectedTemplateId === template.id && (
                    <Check className="w-4 h-4 text-accent-600" />
                  )}
                </div>

                <h3 className="text-[14px] font-semibold text-ink-900 mb-2">{template.name}</h3>
                <p className="text-[12px] text-ink-500 mb-3 leading-relaxed">{template.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {template.suitable_for.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {template.suitable_for.length > 3 && (
                    <span className="text-[10px] text-slate-400">
                      +{template.suitable_for.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Create Button */}
        <section className="border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between">
            <Link
              href="/fee-quotes"
              className="text-[14px] text-ink-500 hover:text-ink-700 transition-colors"
            >
              Cancel
            </Link>

            <Link
              href="/fee-quotes/new-draft/edit"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-[14px] transition-colors',
                canCreate
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none'
              )}
            >
              <Plus className="w-4 h-4" />
              Create Quote
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
