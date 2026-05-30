'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'

import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { SummaryCard } from '@/components/SummaryCard'
import { cn, formatDate, briefSectionStatusColor, briefSectionStatusLabel } from '@/lib/utils'
import { getProject, getProjectBrief, getUser } from '@/lib/mock-data'

export default function ProjectBriefPage() {
  const params = useParams()
  const projectId = params.id as string

  const project = getProject(projectId)
  const brief = getProjectBrief(projectId)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-50 p-8">
        <EmptyState message="Project not found" />
      </div>
    )
  }

  // Calculate completeness
  const sections = brief?.sections || []
  const totalSections = sections.length
  const emptySectionCount = sections.filter(s => s.status === 'empty').length
  const draftSectionCount = sections.filter(s => s.status === 'draft').length
  const completeSectionCount = sections.filter(s => s.status === 'complete').length
  const approvedSectionCount = sections.filter(s => s.status === 'approved').length

  const completenessPercent = totalSections > 0 ? Math.round((approvedSectionCount / totalSections) * 100) : 0

  // Check if all required sections are approved
  const allRequiredApproved = sections
    .filter(s => s.required)
    .every(s => s.status === 'approved')

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="font-display text-3xl text-ink-950">Project Brief</h1>
                {brief && (
                  <StatusBadge
                    label={`v${brief.version}`}
                    colorClass="bg-slate-100 text-slate-700"
                  />
                )}
              </div>
              {brief && brief.status === 'issued' ? (
                <div className="space-y-1 text-sm text-ink-600">
                  <p>Issued {brief.issued_date ? formatDate(brief.issued_date) : 'date unknown'}</p>
                  {brief.issued_to && <p>Issued to: {brief.issued_to}</p>}
                </div>
              ) : (
                <p className="text-sm text-ink-500">No brief created yet</p>
              )}
            </div>
            <StatusBadge
              label={brief?.status === 'issued' ? 'Issued' : brief?.status === 'draft' ? 'Draft' : 'Superseded'}
              colorClass={
                brief?.status === 'issued'
                  ? 'bg-emerald-100 text-emerald-700'
                  : brief?.status === 'draft'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
              }
            />
          </div>
        </div>

        {/* Show empty state if no brief */}
        {!brief ? (
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-12">
            <EmptyState message="No brief created yet. Start by adding content to the sections below." />
          </div>
        ) : (
          <>
            {/* Completeness Bar */}
            <div className="mb-10 bg-white rounded-2xl border border-surface-200 shadow-card p-6">
              <h2 className="text-sm font-semibold text-ink-900 mb-4">Brief Completeness</h2>
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-600">Approved sections</span>
                    <span className="text-sm font-semibold text-ink-900">{completenessPercent}%</span>
                  </div>
                  <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${completenessPercent}%` }}
                    />
                  </div>
                </div>

                {/* Status counts */}
                <div className="grid grid-cols-4 gap-3 pt-2">
                  <SummaryCard
                    value={emptySectionCount}
                    label="Empty"
                    bgColor="bg-slate-50"
                    borderColor="border-slate-200"
                    textColor="text-slate-600"
                    labelColor="text-slate-500"
                  />
                  <SummaryCard
                    value={draftSectionCount}
                    label="Draft"
                    bgColor="bg-amber-50"
                    borderColor="border-amber-200"
                    textColor="text-amber-700"
                    labelColor="text-amber-600"
                  />
                  <SummaryCard
                    value={completeSectionCount}
                    label="Complete"
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200"
                    textColor="text-blue-700"
                    labelColor="text-blue-600"
                  />
                  <SummaryCard
                    value={approvedSectionCount}
                    label="Approved"
                    bgColor="bg-emerald-50"
                    borderColor="border-emerald-200"
                    textColor="text-emerald-700"
                    labelColor="text-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Brief Sections */}
            <div className="space-y-4 mb-10">
              <h2 className="font-display text-lg text-ink-900 px-2">Brief Sections</h2>
              {sections.map(section => {
                const isExpanded = expandedSection === section.id
                const statusColor = briefSectionStatusColor(section.status)
                const statusLabel = briefSectionStatusLabel(section.status)
                const lastEditor = section.last_edited_by_user_id ? getUser(section.last_edited_by_user_id) : null
                const approver = section.approved_by_user_id ? getUser(section.approved_by_user_id) : null

                return (
                  <div
                    key={section.id}
                    className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden"
                  >
                    {/* Card Header (always visible) */}
                    <button
                      onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-ink-600 w-8 text-center">
                            {section.section_number}
                          </span>
                          <div>
                            <h3 className="font-semibold text-ink-900">{section.title}</h3>
                            <p className="text-xs text-ink-500">{section.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {section.required && (
                          <span className="text-[10px] font-semibold text-red-600 px-2 py-1 bg-red-50 rounded">
                            REQUIRED
                          </span>
                        )}
                        <StatusBadge label={statusLabel} colorClass={statusColor} />
                        <svg
                          className={cn(
                            'w-5 h-5 text-ink-400 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Card Body (conditional) */}
                    {isExpanded && (
                      <>
                        <div className="border-t border-surface-200/60" />
                        <div className="px-6 py-4 space-y-4">
                          {/* Content */}
                          {section.content ? (
                            <div>
                              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                                Content
                              </p>
                              <p className="text-sm text-ink-700 leading-relaxed">{section.content}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-ink-400 italic">No content added yet.</p>
                          )}

                          {/* Last Edited */}
                          {section.last_edited_at && (
                            <div className="pt-3 border-t border-surface-200/60">
                              <p className="text-xs text-ink-500">
                                Last edited by {lastEditor?.name || 'unknown'} on {formatDate(section.last_edited_at)}
                              </p>
                            </div>
                          )}

                          {/* Approval Info */}
                          {section.approved_at && (
                            <div className="pt-3 border-t border-surface-200/60">
                              <p className="text-xs text-ink-600 font-medium">
                                Approved by {approver?.name || 'unknown'} on {formatDate(section.approved_at)}
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Actions Bar */}
            <div className="border-t border-surface-200/60 pt-8 flex gap-4 justify-end">
              <button
                disabled={!allRequiredApproved}
                className={cn(
                  'px-6 py-2 rounded-lg font-semibold text-sm transition-all',
                  allRequiredApproved
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                Issue Brief
              </button>
              <button className="px-6 py-2 rounded-lg font-semibold text-sm bg-slate-100 text-ink-700 hover:bg-slate-200 transition-all">
                Export PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
