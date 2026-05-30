'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { getProject, getProjectDocuments, getProjectTransmittals, USERS } from '@/lib/mock-data'
import { DocumentRecord, DocumentTransmittal, RIBA_STAGES } from '@/lib/types'
import { cn, formatDate, documentStatusColor, transmittalStatusColor } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { TabBar } from '@/components/TabBar'

type MainTab = 'documents' | 'transmittals'
type DocumentCategory = 'all' | 'drawing' | 'report' | 'specification' | 'correspondence' | 'other'

export default function ProjectDocumentsPage() {
  const params = useParams()
  const project = getProject(params.id as string)
  const [mainTab, setMainTab] = useState<MainTab>('documents')
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory>('all')

  if (!project) {
    return <EmptyState message="Project not found." />
  }

  const documents = getProjectDocuments(project.id)
  const transmittals = getProjectTransmittals(project.id)

  // ── Category Filter Logic ──────────────────────────────────
  const filteredDocuments = categoryFilter === 'all'
    ? documents
    : categoryFilter === 'other'
      ? documents.filter(d => !['drawing', 'report', 'specification', 'correspondence'].includes(d.category))
      : documents.filter(d => d.category === categoryFilter)

  // ── Summary Card Counts ────────────────────────────────────
  const approvedCount = documents.filter(d => d.status === 'approved').length
  const forReviewCount = documents.filter(d => d.status === 'for_review').length

  const docsByStage = (Object.entries(RIBA_STAGES) as [string, string][]).map(([stageKey, label]) => {
    const stage = parseInt(stageKey) as unknown as import('@/lib/types').RIBAStage
    const count = documents.filter(d => d.stage === stage).length
    return { stage, label, count }
  }).filter(s => s.count > 0)

  // ── Category Tab Options ───────────────────────────────────
  const categoryTabs: { key: DocumentCategory; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: documents.length },
    { key: 'drawing', label: 'Drawings', count: documents.filter(d => d.category === 'drawing').length },
    { key: 'report', label: 'Reports', count: documents.filter(d => d.category === 'report').length },
    { key: 'specification', label: 'Specifications', count: documents.filter(d => d.category === 'specification').length },
    { key: 'correspondence', label: 'Correspondence', count: documents.filter(d => d.category === 'correspondence').length },
    { key: 'other', label: 'Other', count: documents.filter(d => !['drawing', 'report', 'specification', 'correspondence'].includes(d.category)).length },
  ]

  // ── Transmittal Summary ────────────────────────────────────
  const issuedCount = transmittals.filter(t => t.status === 'issued').length
  const draftCount = transmittals.filter(t => t.status === 'draft').length
  const acknowledgedCount = transmittals.filter(t => t.status === 'acknowledged').length

  // ── Main Tabs ──────────────────────────────────────────────
  const mainTabs: { key: MainTab; label: string; count: number }[] = [
    { key: 'documents', label: 'Document Register', count: documents.length },
    { key: 'transmittals', label: 'Transmittals', count: transmittals.length },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink-900">Documents & Transmittals</h1>
        <p className="text-sm text-ink-400 mt-1">{project.name} — {project.client}</p>
      </div>

      {/* ── Main Tab Bar ────────────────────────────────────── */}
      <TabBar tabs={mainTabs} activeKey={mainTab} onSelect={(key) => setMainTab(key as MainTab)} />

      {/* ── DOCUMENTS TAB ─────────────────────────────────────── */}
      {mainTab === 'documents' && (
        <div className="space-y-6">
          {/* ── Summary Cards ────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard value={documents.length} label="Total Documents" />
            <SummaryCard value={approvedCount} label="Approved" />
            <SummaryCard value={forReviewCount} label="For Review" />
            <SummaryCard
              value={docsByStage.length}
              label="By Stage"
              bgColor="bg-surface-50"
              textColor="text-accent-700"
              labelColor="text-ink-400"
            />
          </div>

          {/* ── Category Filter Tabs ─────────────────────── */}
          <TabBar
            tabs={categoryTabs}
            activeKey={categoryFilter}
            onSelect={(key) => setCategoryFilter(key as DocumentCategory)}
          />

          {/* ── Document Table ───────────────────────────── */}
          {filteredDocuments.length === 0 ? (
            <EmptyState message={categoryFilter === 'all' ? 'No documents uploaded.' : `No ${categoryFilter} documents.`} />
          ) : (
            <div className="card-premium overflow-hidden">
              {/* Mobile: Cards */}
              <div className="sm:hidden divide-y divide-surface-200/60">
                {filteredDocuments.map(doc => {
                  const uploader = USERS.find(u => u.id === doc.uploaded_by_user_id)
                  return (
                    <div key={doc.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-ink-300 uppercase tracking-[0.08em]">
                            {doc.document_ref}
                          </p>
                          <h3 className="text-sm font-semibold text-ink-900 mt-1">{doc.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-surface-100 text-ink-600 uppercase">
                          {doc.category}
                        </span>
                        <span className="text-[11px] text-ink-400">Rev {doc.revision}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-ink-400">
                          <span>Stage: <span className="text-ink-600 font-medium">{RIBA_STAGES[doc.stage]}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge label={doc.status.replace('_', ' ')} colorClass={documentStatusColor(doc.status)} />
                        </div>
                        {uploader && <p className="text-xs text-ink-400">Updated {formatDate(doc.updated_at)}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: Table */}
              <table className="hidden sm:w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200/60 bg-surface-50">
                    <th className="text-left px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Ref</th>
                    <th className="text-left px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Title</th>
                    <th className="text-center px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Category</th>
                    <th className="text-center px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Rev</th>
                    <th className="text-left px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Stage</th>
                    <th className="text-center px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="stripe-row border-b border-surface-200/60 last:border-0 hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-medium text-ink-600 font-mono">{doc.document_ref}</span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-ink-900">{doc.title}</p>
                        {doc.description && <p className="text-xs text-ink-400 mt-0.5">{doc.description}</p>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-surface-100 text-ink-600 uppercase">
                          {doc.category === 'drawing' && 'Draw'}
                          {doc.category === 'specification' && 'Spec'}
                          {doc.category === 'report' && 'Report'}
                          {doc.category === 'correspondence' && 'Corr'}
                          {doc.category === 'certificate' && 'Cert'}
                          {doc.category === 'schedule' && 'Sched'}
                          {doc.category === 'other' && 'Other'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-[11px] font-semibold text-ink-600">{doc.revision}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] text-ink-600 font-medium">{RIBA_STAGES[doc.stage]}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StatusBadge label={doc.status.replace('_', ' ')} colorClass={documentStatusColor(doc.status)} />
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-ink-400">{formatDate(doc.updated_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSMITTALS TAB ────────────────────────────────── */}
      {mainTab === 'transmittals' && (
        <div className="space-y-6">
          {/* ── Summary Cards ────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard value={transmittals.length} label="Total Transmittals" />
            <SummaryCard value={issuedCount} label="Issued" />
            <SummaryCard value={draftCount} label="Draft" />
            <SummaryCard value={acknowledgedCount} label="Acknowledged" />
          </div>

          {/* ── Transmittal Cards ────────────────────────── */}
          {transmittals.length === 0 ? (
            <EmptyState message="No transmittals recorded." />
          ) : (
            <div className="space-y-3">
              {transmittals.map(transmittal => {
                const docCount = transmittal.document_ids.length
                const purposeColorMap: Record<string, string> = {
                  'for_information': 'bg-slate-100 text-slate-700',
                  'for_approval': 'bg-amber-100 text-amber-700',
                  'for_construction': 'bg-blue-100 text-blue-700',
                  'for_comment': 'bg-violet-100 text-violet-700',
                  'as_built': 'bg-emerald-100 text-emerald-700',
                }

                const purposeLabel: Record<string, string> = {
                  'for_information': 'For Information',
                  'for_approval': 'For Approval',
                  'for_construction': 'For Construction',
                  'for_comment': 'For Comment',
                  'as_built': 'As Built',
                }

                return (
                  <div key={transmittal.id} className="card-premium p-5">
                    <div className="space-y-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-semibold text-ink-600 uppercase tracking-wide">
                              {transmittal.transmittal_ref}
                            </span>
                            <StatusBadge
                              label={transmittal.status}
                              colorClass={transmittalStatusColor(transmittal.status as any)}
                            />
                          </div>
                          <h3 className="text-sm font-semibold text-ink-900">
                            {transmittal.recipient}
                          </h3>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-2.5 bg-surface-50 rounded-lg">
                          <p className="text-[10px] font-bold text-ink-300 uppercase mb-0.5">Date Issued</p>
                          <p className="text-xs text-ink-700 font-medium">{formatDate(transmittal.issued_date)}</p>
                        </div>
                        <div className="p-2.5 bg-surface-50 rounded-lg">
                          <p className="text-[10px] font-bold text-ink-300 uppercase mb-0.5">Purpose</p>
                          <span className={cn(
                            'inline-block text-[10px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide',
                            purposeColorMap[transmittal.purpose] || 'bg-slate-100 text-slate-700'
                          )}>
                            {purposeLabel[transmittal.purpose]}
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface-50 rounded-lg">
                          <p className="text-[10px] font-bold text-ink-300 uppercase mb-0.5">Documents</p>
                          <p className="text-xs text-ink-700 font-semibold">{docCount} attached</p>
                        </div>
                        <div className="p-2.5 bg-surface-50 rounded-lg sm:hidden md:block">
                          <p className="text-[10px] font-bold text-ink-300 uppercase mb-0.5">Status</p>
                          <p className="text-xs text-ink-700 font-medium capitalize">{transmittal.status}</p>
                        </div>
                      </div>

                      {/* Notes */}
                      {transmittal.notes && (
                        <div className="p-3 bg-surface-50 rounded-lg border border-surface-200/60">
                          <p className="text-[10px] font-bold text-ink-300 uppercase mb-1">Notes</p>
                          <p className="text-xs text-ink-700">{transmittal.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
