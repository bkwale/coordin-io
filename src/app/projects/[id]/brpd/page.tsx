'use client'

import { useParams } from 'next/navigation'
import {
  getProject,
  getProjectDutyholders,
  getProjectGateways,
  getProjectComplianceStatements,
  getProjectBRPDRequirements,
  getGatewayRequirements,
} from '@/lib/mock-data'
import { DutyholderRecord, BRPDGateway, ComplianceStatement, BRPDRequirement } from '@/lib/types'
import {
  cn,
  formatDate,
  complianceStatusColor,
  gatewayStatusColor,
  dutyholderRoleLabel,
  complianceStatementStatusColor,
  complianceStatementStatusLabel,
  brpdRequirementStatusColor,
  brpdRequirementStatusLabel,
  requirementCategoryLabel,
  requirementCategoryColor,
} from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

export default function BRPDPage() {
  const params = useParams()
  const project = getProject(params.id as string)

  if (!project) {
    return <EmptyState message="Project not found." />
  }

  const dutyholders = getProjectDutyholders(project.id)
  const gateways = getProjectGateways(project.id)
  const complianceStatements = getProjectComplianceStatements(project.id)
  const brpdRequirements = getProjectBRPDRequirements(project.id)

  // Section 1: Summary stats
  const compliantCount = dutyholders.filter(d => d.compliance_status === 'compliant').length
  const pendingCount = dutyholders.filter(d => d.compliance_status === 'pending_review').length

  // Compliance statement stats
  const csApprovedCount = complianceStatements.filter(cs => cs.status === 'approved').length
  const csUnderReviewCount = complianceStatements.filter(cs => cs.status === 'under_review').length
  const csDraftCount = complianceStatements.filter(cs => cs.status === 'draft').length
  const csExpiredCount = complianceStatements.filter(cs => cs.status === 'expired').length

  // Requirement progress
  const totalRequirements = brpdRequirements.length
  const completedRequirements = brpdRequirements.filter(r => r.status === 'evidenced' || r.status === 'verified').length
  const requirementProgress = totalRequirements > 0 ? Math.round((completedRequirements / totalRequirements) * 100) : 0

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* ── PAGE HEADER ── */}
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">BRPD & Dutyholder Coordination</h1>
        <p className="text-sm text-ink-400 mt-1">Manage Building Safety Act roles and compliance records</p>
      </div>

      {/* ── SECTION 1: SUMMARY STATS ── */}
      <div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard
            value={dutyholders.length}
            label="Total Dutyholders"
            bgColor="bg-surface-50"
            borderColor="border-surface-200"
            textColor="text-ink-900"
            labelColor="text-ink-400"
          />
          <SummaryCard
            value={compliantCount}
            label="Compliant"
            bgColor="bg-emerald-50"
            borderColor="border-emerald-200"
            textColor="text-emerald-700"
            labelColor="text-emerald-600"
          />
          <SummaryCard
            value={pendingCount}
            label="Pending Review"
            bgColor="bg-amber-50"
            borderColor="border-amber-200"
            textColor="text-amber-700"
            labelColor="text-amber-600"
          />
        </div>

        {/* Compliance Statements Stats */}
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard
            value={csApprovedCount}
            label="Approved"
            bgColor="bg-emerald-50"
            borderColor="border-emerald-200"
            textColor="text-emerald-700"
            labelColor="text-emerald-600"
          />
          <SummaryCard
            value={csUnderReviewCount}
            label="Under Review"
            bgColor="bg-blue-50"
            borderColor="border-blue-200"
            textColor="text-blue-700"
            labelColor="text-blue-600"
          />
          <SummaryCard
            value={csDraftCount}
            label="Draft"
            bgColor="bg-slate-50"
            borderColor="border-slate-200"
            textColor="text-slate-700"
            labelColor="text-slate-600"
          />
          <SummaryCard
            value={csExpiredCount}
            label="Expired"
            bgColor="bg-amber-50"
            borderColor="border-amber-200"
            textColor="text-amber-700"
            labelColor="text-amber-600"
          />
        </div>

        {/* Requirements Progress Bar */}
        <div className="mt-6 card-premium p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink-900">Requirement Progress</p>
            <p className="text-sm font-semibold text-brand-600">
              {completedRequirements} / {totalRequirements} evidenced or verified
            </p>
          </div>
          <div className="w-full bg-surface-200 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${requirementProgress}%` }}
            />
          </div>
          <p className="text-xs text-ink-400 mt-2">{requirementProgress}% Complete</p>
        </div>
      </div>

      {/* ── SECTION 2: COMPLIANCE STATEMENTS ── */}
      <div className="border-t border-surface-200/60 pt-10 mt-10">
        <h2 className="text-lg sm:text-xl font-display font-bold text-ink-900">Compliance Statements</h2>
        <p className="text-sm text-ink-400 mt-1">Building regulations and statutory compliance records</p>

        {complianceStatements.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No compliance statements added yet." />
          </div>
        ) : (
          <div className="mt-8 card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200/60">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Title
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Regulation Ref
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Submitted
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Dutyholder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {complianceStatements.map((cs, idx) => {
                    const dutyholder = dutyholders.find(d => d.id === cs.responsible_dutyholder_id)
                    return (
                      <tr
                        key={cs.id}
                        className={cn(
                          'stripe-row bg-white',
                          idx !== complianceStatements.length - 1 && 'border-b border-surface-200/60'
                        )}
                      >
                        <td className="px-5 py-4 font-medium text-ink-900 max-w-xs">
                          <span className="line-clamp-2">{cs.title}</span>
                        </td>
                        <td className="px-5 py-4 text-ink-600 font-mono text-xs">{cs.regulation_ref}</td>
                        <td className="px-5 py-4">
                          <StatusBadge
                            label={complianceStatementStatusLabel(cs.status)}
                            colorClass={complianceStatementStatusColor(cs.status)}
                          />
                        </td>
                        <td className="px-5 py-4 text-ink-600">{formatDate(cs.due_date)}</td>
                        <td className="px-5 py-4 text-ink-600">
                          {cs.submitted_date ? formatDate(cs.submitted_date) : <span className="text-ink-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {dutyholder ? (
                            <div>
                              <p className="text-sm font-medium">{dutyholder.organisation_name}</p>
                              <p className="text-xs text-ink-500">{dutyholder.contact_name}</p>
                            </div>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: REQUIREMENTS TRACKER ── */}
      <div className="border-t border-surface-200/60 pt-10 mt-10">
        <h2 className="text-lg sm:text-xl font-display font-bold text-ink-900">Requirements Tracker</h2>
        <p className="text-sm text-ink-400 mt-1">Building Safety Act gateway requirements and evidence status</p>

        {brpdRequirements.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No BRPD requirements configured for this project yet." />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {[1, 2, 3].map(gatewayNum => {
              const gatewayReqs = getGatewayRequirements(project.id, gatewayNum as 1 | 2 | 3)
              const completedGateway = gatewayReqs.filter(
                r => r.status === 'evidenced' || r.status === 'verified'
              ).length
              const progressPercent = gatewayReqs.length > 0 ? Math.round((completedGateway / gatewayReqs.length) * 100) : 0

              if (gatewayReqs.length === 0) {
                return null
              }

              return (
                <div key={gatewayNum}>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold text-ink-900">Gateway {gatewayNum}</h3>
                      <p className="text-sm text-ink-500">
                        {completedGateway} / {gatewayReqs.length} complete
                      </p>
                    </div>
                    <div className="w-full bg-surface-200 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gatewayReqs.map(req => {
                      const assignedDH = dutyholders.find(d => d.id === req.assigned_dutyholder_id)
                      return (
                        <div
                          key={req.id}
                          className="card-premium p-4"
                        >
                          {/* Header with ref and status */}
                          <div className="mb-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-xs font-mono text-ink-400 font-semibold">{req.requirement_ref}</p>
                              <StatusBadge
                                label={brpdRequirementStatusLabel(req.status)}
                                colorClass={brpdRequirementStatusColor(req.status)}
                              />
                            </div>
                            <h4 className="text-sm font-semibold text-ink-900 line-clamp-2">{req.title}</h4>
                          </div>

                          {/* Category badge */}
                          <div className="mb-3">
                            <StatusBadge
                              label={requirementCategoryLabel(req.category)}
                              colorClass={requirementCategoryColor(req.category)}
                            />
                          </div>

                          {/* Target date */}
                          <div className="mb-3 pb-3 border-b border-surface-200/60">
                            <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Target Date</p>
                            <p className="text-sm text-ink-700">{formatDate(req.target_date)}</p>
                          </div>

                          {/* Assigned dutyholder */}
                          {assignedDH && (
                            <div className="mb-3 pb-3 border-b border-surface-200/60">
                              <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Assigned To</p>
                              <p className="text-sm font-medium text-ink-900">{assignedDH.organisation_name}</p>
                              <p className="text-xs text-ink-500">{assignedDH.contact_name}</p>
                            </div>
                          )}

                          {/* Evidence notes if available */}
                          {req.evidence_notes && (
                            <div className="pt-2">
                              <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Evidence</p>
                              <p className="text-xs text-ink-600 italic">{req.evidence_notes}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 4: DUTYHOLDER REGISTER ── */}
      <div className="border-t border-surface-200/60 pt-10 mt-10">
        <h2 className="text-lg sm:text-xl font-display font-bold text-ink-900">Dutyholder Register</h2>
        <p className="text-sm text-ink-400 mt-1">Building Safety Act roles and competence records</p>

        {dutyholders.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No dutyholders assigned to this project yet." />
          </div>
        ) : (
          <div className="mt-8 card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200/60">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Role
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Organisation
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Contact Name
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Appointed
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Compliance
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dutyholders.map((dh, idx) => (
                    <tr
                      key={dh.id}
                      className={cn(
                        'stripe-row bg-white',
                        idx !== dutyholders.length - 1 && 'border-b border-surface-200/60'
                      )}
                    >
                      <td className="px-5 py-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-ink-600 bg-surface-100">
                          {dutyholderRoleLabel(dh.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink-700">{dh.organisation_name}</td>
                      <td className="px-5 py-4 text-ink-700">{dh.contact_name}</td>
                      <td className="px-5 py-4 text-ink-500">{formatDate(dh.appointed_date)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          label={dh.compliance_status.replace(/_/g, ' ')}
                          colorClass={complianceStatusColor(dh.compliance_status)}
                        />
                      </td>
                      <td className="px-5 py-4 text-ink-500 max-w-sm">
                        {dh.notes ? (
                          <span className="truncate inline-block" title={dh.notes}>
                            {dh.notes}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 5: BRPD GATEWAYS ── */}
      <div className="border-t border-surface-200/60 pt-10 mt-10">
        <h2 className="text-lg sm:text-xl font-display font-bold text-ink-900">BRPD Gateways</h2>
        <p className="text-sm text-ink-400 mt-1">Building Safety Act Stage 3, 4, and 5 submission milestones</p>

        {gateways.length === 0 ? (
          <div className="mt-8">
            <EmptyState message="No BRPD gateways configured for this project yet. Gateways are required under the Building Safety Act for higher-risk building work." />
          </div>
        ) : (
          <div className="mt-8">
            {/* Gateway Timeline */}
            <div className="flex gap-4 items-start mb-8">
              {[1, 2, 3].map(gatewayNum => {
                const gateway = gateways.find(g => g.gateway_number === (gatewayNum as 1 | 2 | 3))
                const isActive = gateway !== undefined

                return (
                  <div key={gatewayNum} className="flex-1">
                    {/* Connecting line */}
                    {gatewayNum < 3 && (
                      <div className="absolute h-0.5 bg-surface-200 mt-5 ml-[calc(50%+8px)] w-[calc((100vw/3)-2rem)]" />
                    )}

                    {/* Gateway node */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mb-4 relative z-10',
                        isActive ? 'bg-brand-500 text-white' : 'bg-surface-200 text-ink-400'
                      )}
                    >
                      {gatewayNum}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Gateway Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map(gatewayNum => {
                const gateway = gateways.find(g => g.gateway_number === (gatewayNum as 1 | 2 | 3))

                if (!gateway) {
                  return (
                    <div key={gatewayNum} className="bg-surface-50 rounded-2xl border border-surface-200 p-5 text-center">
                      <p className="text-sm font-semibold text-ink-400">Gateway {gatewayNum}</p>
                      <p className="text-xs text-ink-300 mt-1">Not configured</p>
                    </div>
                  )
                }

                return (
                  <div
                    key={gateway.id}
                    className="card-premium p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Gateway {gateway.gateway_number}</p>
                        <h3 className="text-sm font-semibold text-ink-900 mt-1">{gateway.title}</h3>
                      </div>
                    </div>

                    <p className="text-xs text-ink-500 mb-4">{gateway.description}</p>

                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase font-semibold mb-0.5">Target Date</p>
                        <p className="text-sm text-ink-700">{formatDate(gateway.target_date)}</p>
                      </div>
                      {gateway.completed_date && (
                        <div>
                          <p className="text-[10px] text-ink-400 uppercase font-semibold mb-0.5">Completed</p>
                          <p className="text-sm text-emerald-700">{formatDate(gateway.completed_date)}</p>
                        </div>
                      )}
                    </div>

                    <StatusBadge
                      label={gateway.status.replace(/_/g, ' ')}
                      colorClass={gatewayStatusColor(gateway.status)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
