'use client'

import { getAISourcePermissions, getAILogs, USERS, getUser, getAllVisibilityRules } from '@/lib/mock-data'
import { AISourcePermission, AISourceCategory, AILog } from '@/lib/types'
import { cn, formatDate, featureAreaLabel, roleLabel } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

// ── Helper: Human-readable category labels ──────────────────
function getCategoryLabel(category: AISourceCategory): string {
  switch (category) {
    case 'project_data': return 'Project Data'
    case 'project_documents': return 'Project Documents'
    case 'knowledge_base': return 'Knowledge Base'
    case 'reference_uploads': return 'Reference Uploads'
    case 'fee_data': return 'Fee Data'
  }
}

function getCategoryDescription(category: AISourceCategory): string {
  switch (category) {
    case 'project_data':
      return 'Risk registers, tasks, issues, approvals, and project metadata'
    case 'project_documents':
      return 'Drawings, specifications, transmittals, and uploaded files'
    case 'knowledge_base':
      return 'Office procedures, templates, lessons learned, and guidance'
    case 'reference_uploads':
      return 'Reference documents and external reference materials'
    case 'fee_data':
      return 'Fee schedules, cost data, and fee clause templates'
  }
}

// ── Helper: Truncate prompt to 80 chars ─────────────────────
function truncatePrompt(prompt: string, maxLength: number = 80): string {
  if (prompt.length <= maxLength) return prompt
  return prompt.substring(0, maxLength) + '…'
}

// ── Helper: Get sources as array ────────────────────────────
function getSourceBadges(sources: AISourceCategory[]): string[] {
  return sources.map(s => getCategoryLabel(s))
}

// ── Helper: Color badge based on confidence ─────────────────
function getConfidenceBadgeClass(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return 'bg-emerald-50 text-emerald-700'
    case 'medium':
      return 'bg-amber-50 text-amber-700'
    case 'low':
      return 'bg-red-50 text-red-700'
  }
}

export default function AdminControlsPage() {
  const permissions = getAISourcePermissions()
  const logs = getAILogs()
  const visibilityRules = getAllVisibilityRules()

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Settings', href: '/settings' },
            { label: 'Admin Controls' },
          ]}
        />

        <div className="mt-8">
          <h1 className="font-display text-[2rem] text-ink-900 mb-2">Admin Controls</h1>
          <p className="text-[13px] text-ink-400">
            Manage AI governance, source permissions, and audit logs
          </p>
        </div>
      </section>

      {/* ━━━ AI SOURCE PERMISSIONS SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div>
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">AI Source Permissions</h2>

          <div className="space-y-3">
            {permissions.map(perm => {
              const category = perm.source_category
              const label = getCategoryLabel(category)
              const description = getCategoryDescription(category)
              const isEnabled = perm.enabled

              return (
                <div
                  key={perm.id}
                  className="flex items-center justify-between p-4 card-premium"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900">{label}</p>
                    <p className="text-[11px] text-ink-400 mt-1">{description}</p>
                  </div>

                  {/* Toggle Indicator */}
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        isEnabled ? 'bg-emerald-500' : 'bg-surface-300'
                      )}
                    />
                    <span className={cn(
                      'text-[11px] font-medium uppercase tracking-[0.08em]',
                      isEnabled ? 'text-emerald-700' : 'text-ink-400'
                    )}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ AI AUDIT LOG SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <div className="mb-6">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-2">AI Audit Log</h2>
            <p className="text-[12px] text-ink-300">
              All AI prompts and outputs are logged for governance and review.
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="card-premium p-10 text-center">
              <p className="text-[13px] text-ink-300">No AI interactions logged yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      User
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      Project
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      Prompt
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      Sources Used
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      Confidence
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const user = getUser(log.user_id)
                    const project = log.project_id ? null : null // Could fetch project if needed

                    return (
                      <tr key={log.id} className="stripe-row border-b border-surface-200/40 hover:bg-surface-50 transition-colors">
                        {/* User */}
                        <td className="py-3 px-4 text-ink-700">
                          {user?.name || 'Unknown'}
                        </td>

                        {/* Project */}
                        <td className="py-3 px-4 text-ink-400">
                          {log.project_id ? `Project ${log.project_id}` : '—'}
                        </td>

                        {/* Prompt */}
                        <td className="py-3 px-4 text-ink-600 max-w-xs">
                          <span title={log.prompt} className="truncate block">
                            {truncatePrompt(log.prompt)}
                          </span>
                        </td>

                        {/* Sources Used */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {getSourceBadges(log.source_categories_used).map(badge => (
                              <span
                                key={badge}
                                className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Confidence */}
                        <td className="py-3 px-4">
                          <span className={cn(
                            'inline-block text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-[0.05em]',
                            getConfidenceBadgeClass(log.confidence_level)
                          )}>
                            {log.confidence_level === 'high'
                              ? 'High'
                              : log.confidence_level === 'medium'
                              ? 'Medium'
                              : 'Low'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-ink-400 font-mono text-[10px]">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ ROLE-BASED VISIBILITY SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <div className="mb-6">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-2">Role-Based Visibility</h2>
            <p className="text-[12px] text-ink-300">
              Control which features each role can access
            </p>
          </div>

          {/* Group rules by role */}
          {['practice_owner', 'project_lead', 'team_member'].map(role => {
            const rulesForRole = visibilityRules.filter(r => r.role === role)

            return (
              <div key={role} className="mb-8">
                {/* Role Subheading */}
                <h3 className="text-[13px] font-semibold text-ink-900 mb-4 uppercase tracking-[0.08em]">
                  {roleLabel(role)}
                </h3>

                {/* Role Visibility Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200/60">
                        <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          Feature Area
                        </th>
                        <th className="text-center py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          View
                        </th>
                        <th className="text-center py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          Edit
                        </th>
                        <th className="text-center py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          Delete
                        </th>
                        <th className="text-center py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          Export
                        </th>
                        <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesForRole.map(rule => (
                        <tr key={rule.id} className="stripe-row border-b border-surface-200/40 hover:bg-surface-50 transition-colors">
                          {/* Feature Area */}
                          <td className="py-3 px-4 text-ink-700 font-medium">
                            {featureAreaLabel(rule.feature_area)}
                          </td>

                          {/* View */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'inline-block text-lg font-semibold',
                              rule.can_view ? 'text-emerald-600' : 'text-red-400'
                            )}>
                              {rule.can_view ? '✓' : '✗'}
                            </span>
                          </td>

                          {/* Edit */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'inline-block text-lg font-semibold',
                              rule.can_edit ? 'text-emerald-600' : 'text-red-400'
                            )}>
                              {rule.can_edit ? '✓' : '✗'}
                            </span>
                          </td>

                          {/* Delete */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'inline-block text-lg font-semibold',
                              rule.can_delete ? 'text-emerald-600' : 'text-red-400'
                            )}>
                              {rule.can_delete ? '✓' : '✗'}
                            </span>
                          </td>

                          {/* Export */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'inline-block text-lg font-semibold',
                              rule.can_export ? 'text-emerald-600' : 'text-red-400'
                            )}>
                              {rule.can_export ? '✓' : '✗'}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-4 text-ink-400 text-[11px] italic">
                            {rule.restriction_notes ? rule.restriction_notes : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
