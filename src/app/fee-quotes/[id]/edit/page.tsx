'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Breadcrumb } from '@/components/Breadcrumb'
import {
  getFeeQuoteRecord,
  getFeeQuoteLineItems,
  getFeeQuoteSections,
  getUser,
  PROJECTS,
} from '@/lib/mock-data'
import type { FeeQuoteLineItem } from '@/lib/types'
import {
  cn,
  formatDate,
  formatCurrency,
  feeQuoteStatusColor,
  feeQuoteStatusLabel,
  quoteTemplateTypeLabel,
  quoteTemplateTypeColor,
  quoteModeLabel,
  quoteLineTypeLabel,
} from '@/lib/utils'
import {
  FileText,
  Send,
  Download,
  Eye,
  Users,
  Briefcase,
  Layers,
  ListChecks,
  Sparkles,
  MessageSquare,
  Car,
  Snowflake,
  Ban,
  Scale,
  Check,
} from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'client', label: 'Client & Project', icon: Users },
  { key: 'appointment', label: 'Appointment Type', icon: Briefcase },
  { key: 'scope', label: 'Scope', icon: Layers },
  { key: 'stages', label: 'Stage Line Items', icon: ListChecks },
  { key: 'extras', label: 'Optional Extras', icon: Sparkles },
  { key: 'meetings', label: 'Meetings', icon: MessageSquare },
  { key: 'travel', label: 'Travel & Expenses', icon: Car },
  { key: 'freeze', label: 'Design Freeze', icon: Snowflake },
  { key: 'exclusions', label: 'Exclusions', icon: Ban },
  { key: 'terms', label: 'Terms & Conditions', icon: Scale },
  { key: 'preview', label: 'Preview & Send', icon: Eye },
] as const

type TabKey = typeof TABS[number]['key']

export default function FeeQuoteBuilderPage() {
  const params = useParams()
  const quoteId = params.id as string

  const quote = getFeeQuoteRecord(quoteId)
  const lineItems = quote ? getFeeQuoteLineItems(quoteId) : []
  const sections = quote ? getFeeQuoteSections(quoteId) : []
  const preparedByUser = quote ? getUser(quote.prepared_by_user_id) : null
  const relatedProject = quote?.related_project_id
    ? PROJECTS.find(p => p.id === quote.related_project_id)
    : null

  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  if (!quote) {
    return (
      <div className="min-h-screen bg-surface-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Fee Quotes', href: '/fee-quotes' },
              { label: 'Not Found' },
            ]}
          />
          <div className="mt-8 card-premium p-8 text-center">
            <h1 className="text-2xl font-display font-bold text-ink-900 mb-2">Quote Not Found</h1>
            <p className="text-slate-600 mb-6">The fee quote you are looking for does not exist or has been deleted.</p>
            <Link
              href="/fee-quotes"
              className="inline-block bg-ink-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-ink-800 transition-colors"
            >
              Back to Fee Quotes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Line items grouped
  const stageItems = lineItems.filter(i => i.line_type === 'stage_service')
  const optionalItems = lineItems.filter(i =>
    i.line_type === 'optional_service' ||
    i.line_type === 'cgi_render' ||
    i.line_type === 'interior_design' ||
    i.line_type === 'contract_admin'
  )

  return (
    <div className="min-h-screen bg-surface-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <Breadcrumb
            items={[
              { label: 'Fee Quotes', href: '/fee-quotes' },
              { label: quote.quote_reference },
              { label: 'Edit' },
            ]}
          />

          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink-900">{quote.quote_title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={cn('status-pill', feeQuoteStatusColor(quote.status))}>
                  {feeQuoteStatusLabel(quote.status)}
                </span>
                <span className={cn('status-pill', quoteTemplateTypeColor(quote.quote_template_type))}>
                  {quoteTemplateTypeLabel(quote.quote_template_type)}
                </span>
                <span className="text-[12px] text-ink-400 font-mono">{quote.quote_reference}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 bg-ink-900 text-white rounded-lg font-medium text-[13px] hover:bg-ink-800 transition-colors">
                Save Draft
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 text-ink-900 rounded-lg font-medium text-[13px] hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Preview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-accent-500 text-accent-600'
                      : 'border-transparent text-ink-400 hover:text-ink-600'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab quote={quote} preparedByUser={preparedByUser} relatedProject={relatedProject} lineItems={lineItems} />
        )}
        {activeTab === 'client' && (
          <ClientTab quote={quote} relatedProject={relatedProject} />
        )}
        {activeTab === 'appointment' && (
          <AppointmentTab quote={quote} />
        )}
        {activeTab === 'scope' && (
          <ScopeTab quote={quote} />
        )}
        {activeTab === 'stages' && (
          <StageLineItemsTab items={stageItems} currency={quote.currency} />
        )}
        {activeTab === 'extras' && (
          <OptionalExtrasTab items={optionalItems} currency={quote.currency} />
        )}
        {activeTab === 'meetings' && (
          <MeetingsTab quote={quote} />
        )}
        {activeTab === 'travel' && (
          <TravelTab quote={quote} />
        )}
        {activeTab === 'freeze' && (
          <DesignFreezeTab quote={quote} />
        )}
        {activeTab === 'exclusions' && (
          <ExclusionsTab quote={quote} />
        )}
        {activeTab === 'terms' && (
          <TermsTab quote={quote} />
        )}
        {activeTab === 'preview' && (
          <PreviewTab quote={quote} lineItems={lineItems} sections={sections} relatedProject={relatedProject} />
        )}
      </div>
    </div>
  )
}

/* ── Tab Components ──────────────────────────────────────────── */

function OverviewTab({ quote, preparedByUser, relatedProject, lineItems }: { quote: any; preparedByUser: any; relatedProject: any; lineItems: FeeQuoteLineItem[] }) {
  return (
    <div className="space-y-6">
      {/* Total Fee Hero */}
      <div className="card-static p-8 text-center">
        <p className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Total Fee</p>
        <p className="text-4xl font-bold font-display text-ink-900">{formatCurrency(quote.total_fee, quote.currency)}</p>
        <p className="text-[13px] text-ink-400 mt-2">{quote.fee_basis} &middot; {quote.currency}</p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-static p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Quote Details</h3>
          <FieldRow label="Reference" value={quote.quote_reference} />
          <FieldRow label="Status" value={feeQuoteStatusLabel(quote.status)} />
          <FieldRow label="Mode" value={quoteModeLabel(quote.quote_mode)} />
          <FieldRow label="Template" value={quoteTemplateTypeLabel(quote.quote_template_type)} />
          <FieldRow label="Client" value={quote.client_name} />
          {relatedProject && <FieldRow label="Project" value={relatedProject.name} />}
        </div>

        <div className="card-static p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Timeline</h3>
          <FieldRow label="Issue Date" value={formatDate(quote.issue_date)} />
          <FieldRow label="Valid Until" value={formatDate(quote.valid_until)} />
          <FieldRow label="Created" value={formatDate(quote.created_at)} />
          {quote.sent_at && <FieldRow label="Sent" value={formatDate(quote.sent_at)} />}
          {quote.accepted_at && <FieldRow label="Accepted" value={formatDate(quote.accepted_at)} />}
          {preparedByUser && <FieldRow label="Prepared By" value={preparedByUser.name} />}
        </div>
      </div>

      {/* Line Items Summary */}
      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Fee Summary</h3>
        <div className="space-y-2">
          {lineItems.filter(i => !i.optional_flag).map(item => (
            <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-[13px] text-ink-700">{item.title}</span>
              <span className="text-[13px] font-semibold text-ink-900">{formatCurrency(item.amount, quote.currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t border-slate-300">
            <span className="text-[14px] font-bold text-ink-900">Total</span>
            <span className="text-[14px] font-bold text-ink-900">{formatCurrency(quote.total_fee, quote.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClientTab({ quote, relatedProject }: { quote: any; relatedProject: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Client Information</h3>
        <FieldRow label="Client Name" value={quote.client_name} />
        <FieldRow label="Contact" value={quote.client_contact || 'Not specified'} />
        <FieldRow label="Quote Mode" value={quoteModeLabel(quote.quote_mode)} />
      </div>

      {relatedProject && (
        <div className="card-static p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Linked Project</h3>
          <FieldRow label="Project Name" value={relatedProject.name} />
          <FieldRow label="Client" value={relatedProject.client} />
          <FieldRow label="Status" value={relatedProject.status} />
          <FieldRow label="Current Stage" value={`RIBA Stage ${relatedProject.current_stage}`} />
          {relatedProject.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Description</p>
              <p className="text-[13px] text-ink-700">{relatedProject.description}</p>
            </div>
          )}
        </div>
      )}

      {quote.quote_mode === 'standalone' && (
        <div className="card-static p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Standalone Quote Details</h3>
          <FieldRow label="Quote Title" value={quote.quote_title} />
          <p className="text-[12px] text-ink-400 italic">This is a standalone quote not linked to an existing project.</p>
        </div>
      )}
    </div>
  )
}

function AppointmentTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Template Type</h3>
        <div className="flex items-center gap-3">
          <span className={cn('status-pill', quoteTemplateTypeColor(quote.quote_template_type))}>
            {quoteTemplateTypeLabel(quote.quote_template_type)}
          </span>
        </div>
      </div>

      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Role Flags</h3>
        <FlagRow label="BRPD Role" value={quote.brpd_role_flag} />
        <FlagRow label="CDM PD Role" value={quote.cdm_pd_role_flag} />
        <FlagRow label="Consultant Coordination" value={quote.consultant_coordination_flag} />
        <FlagRow label="CGI Renders Included" value={quote.cgi_render_flag} />
      </div>

      {(quote.dutyholder_coordination_note || quote.design_risk_coordination_note) && (
        <div className="card-static p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Coordination Notes</h3>
          {quote.dutyholder_coordination_note && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Dutyholder Coordination</p>
              <p className="text-[13px] text-ink-700">{quote.dutyholder_coordination_note}</p>
            </div>
          )}
          {quote.design_risk_coordination_note && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Design Risk Coordination</p>
              <p className="text-[13px] text-ink-700">{quote.design_risk_coordination_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScopeTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Project Understanding</h3>
        <textarea
          value={quote.project_summary || 'No project summary provided.'}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>

      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Scope Summary</h3>
        <textarea
          value={quote.scope_summary || 'No scope summary provided.'}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>
    </div>
  )
}

function StageLineItemsTab({ items, currency }: { items: FeeQuoteLineItem[]; currency: string }) {
  return (
    <div className="space-y-6">
      <div className="card-static overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Stage Services</h3>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-ink-400">No stage line items added yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-surface-50">
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">#</th>
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Title</th>
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Stage</th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Qty</th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Rate</th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Amount</th>
                  <th className="px-6 py-3 text-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Optional</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="stripe-row border-b border-slate-100 hover:bg-surface-50 transition-colors">
                    <td className="px-6 py-3 text-[13px] text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <p className="text-[13px] font-medium text-ink-900">{item.title}</p>
                      {item.description && <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-slate-600">
                      {item.related_stage !== undefined ? `Stage ${item.related_stage}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-slate-600 text-right">{item.quantity || '—'}</td>
                    <td className="px-6 py-3 text-[13px] text-slate-600 text-right">
                      {item.rate ? formatCurrency(item.rate, currency) : '—'}
                    </td>
                    <td className="px-6 py-3 text-[13px] font-semibold text-ink-900 text-right">
                      {formatCurrency(item.amount, currency)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {item.optional_flag && <Check className="w-4 h-4 text-blue-500 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200">
          <button className="text-[13px] font-medium text-accent-600 hover:text-accent-700 transition-colors">
            + Add Stage Line Item
          </button>
        </div>
      </div>
    </div>
  )
}

function OptionalExtrasTab({ items, currency }: { items: FeeQuoteLineItem[]; currency: string }) {
  return (
    <div className="space-y-6">
      <div className="card-static overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Optional Extras &amp; Additional Services</h3>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-ink-400">No optional extras added yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-surface-50">
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">#</th>
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Title</th>
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Type</th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="stripe-row border-b border-slate-100 hover:bg-surface-50 transition-colors">
                    <td className="px-6 py-3 text-[13px] text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <p className="text-[13px] font-medium text-ink-900">{item.title}</p>
                      {item.description && <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-slate-600">{quoteLineTypeLabel(item.line_type)}</td>
                    <td className="px-6 py-3 text-[13px] font-semibold text-ink-900 text-right">
                      {formatCurrency(item.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200">
          <button className="text-[13px] font-medium text-accent-600 hover:text-accent-700 transition-colors">
            + Add Optional Extra
          </button>
        </div>
      </div>
    </div>
  )
}

function MeetingsTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Meetings &amp; Communication</h3>
        <FieldRow label="Meetings Included" value={quote.meetings_included_count?.toString() || 'Not specified'} />
        <FieldRow label="Meeting Type Notes" value={quote.meeting_type_notes || 'Not specified'} />
      </div>

      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Who Attends</h3>
        <p className="text-[13px] text-ink-700">
          {quote.meeting_type_notes || 'Standard client and consultant review meetings. Specific attendees to be confirmed per meeting.'}
        </p>
      </div>
    </div>
  )
}

function TravelTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Travel &amp; Expenses</h3>
        <FieldRow label="Mileage Rate" value={quote.mileage_rate ? `${quote.mileage_rate}p/mile` : 'Not specified'} />
        <FieldRow label="Travel Allowance" value={quote.travel_allowance ? formatCurrency(quote.travel_allowance, quote.currency) : 'Not specified'} />
        <FieldRow label="Travel Billing Rule" value={quote.travel_billing_rule || 'Not specified'} />
        <FieldRow label="Site Visit Assumptions" value={quote.site_visit_assumptions || 'Not specified'} />
      </div>

      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Expense Allowance</h3>
        <FieldRow label="Expense Allowance" value={quote.expense_allowance ? formatCurrency(quote.expense_allowance, quote.currency) : 'Not specified'} />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Reimbursable Expenses Note</p>
          <p className="text-[13px] text-ink-700">{quote.reimbursable_expenses_note || 'No notes specified.'}</p>
        </div>
      </div>
    </div>
  )
}

function DesignFreezeTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Design Freeze</h3>
        <FlagRow label="Design Freeze Clause Included" value={quote.design_freeze_flag} />
      </div>

      {quote.design_freeze_flag && (
        <div className="card-static p-6">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Design Freeze Wording</h3>
          <textarea
            value={quote.design_freeze_wording || 'Standard design freeze clause applies.'}
            readOnly
            className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[120px] focus:outline-none"
          />
        </div>
      )}

      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Variation Fee Note</h3>
        <p className="text-[13px] text-ink-700">{quote.variation_fee_note || 'No variation fee note specified.'}</p>
      </div>
    </div>
  )
}

function ExclusionsTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Exclusions</h3>
        <textarea
          value={quote.exclusions_text}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>

      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Assumptions</h3>
        <textarea
          value={quote.assumptions_text}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>
    </div>
  )
}

function TermsTab({ quote }: { quote: any }) {
  return (
    <div className="space-y-6">
      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Terms &amp; Conditions</h3>
        <textarea
          value={quote.terms_text}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>

      <div className="card-static p-6">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Payment Terms</h3>
        <textarea
          value={quote.payment_terms_text}
          readOnly
          className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 leading-relaxed resize-none min-h-[150px] focus:outline-none"
        />
      </div>

      <div className="card-static p-6 space-y-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Deposit</h3>
        <FlagRow label="Deposit Required" value={quote.deposit_required_flag} />
        {quote.deposit_required_flag && quote.deposit_amount && (
          <FieldRow label="Deposit Amount" value={formatCurrency(quote.deposit_amount, quote.currency)} />
        )}
      </div>

      {quote.acceptance_note && (
        <div className="card-static p-6">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Acceptance Note</h3>
          <p className="text-[13px] text-ink-700">{quote.acceptance_note}</p>
        </div>
      )}
    </div>
  )
}

function PreviewTab({ quote, lineItems, sections, relatedProject }: { quote: any; lineItems: FeeQuoteLineItem[]; sections: any[]; relatedProject: any }) {
  return (
    <div className="space-y-6">
      {/* Preview Card */}
      <div className="card-static p-8 border-2 border-slate-200">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">{quote.quote_title}</h2>
          <p className="text-[14px] text-ink-500">Prepared for {quote.client_name}</p>
          <p className="text-[12px] text-ink-400 mt-1">Ref: {quote.quote_reference} &middot; {formatDate(quote.issue_date)}</p>
        </div>

        {/* Summary */}
        <div className="bg-surface-50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Fee</p>
              <p className="text-xl font-bold font-display text-ink-900 mt-1">{formatCurrency(quote.total_fee, quote.currency)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Valid Until</p>
              <p className="text-[14px] font-semibold text-ink-900 mt-1">{formatDate(quote.valid_until)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Template</p>
              <p className="text-[14px] font-semibold text-ink-900 mt-1">{quoteTemplateTypeLabel(quote.quote_template_type)}</p>
            </div>
          </div>
        </div>

        {/* Sections Preview */}
        {sections.length > 0 && (
          <div className="space-y-4 mb-6">
            {sections.map(section => (
              <div key={section.id} className="border-b border-slate-100 pb-4 last:border-0">
                <h4 className="text-[13px] font-semibold text-ink-900 mb-1">{section.title}</h4>
                <p className="text-[12px] text-ink-600 line-clamp-3">{section.body_text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Line Items Preview */}
        {lineItems.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Fee Breakdown</h4>
            {lineItems.filter(i => !i.optional_flag).map(item => (
              <div key={item.id} className="flex justify-between py-1.5 text-[12px]">
                <span className="text-ink-700">{item.title}</span>
                <span className="font-semibold text-ink-900">{formatCurrency(item.amount, quote.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-2 border-t border-slate-300 text-[14px] font-bold">
              <span className="text-ink-900">Total</span>
              <span className="text-ink-900">{formatCurrency(quote.total_fee, quote.currency)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-6 py-3 bg-ink-900 text-white rounded-lg font-medium text-[14px] hover:bg-ink-800 transition-colors">
          <Send className="w-4 h-4" />
          Send Quote
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-ink-900 rounded-lg font-medium text-[14px] hover:bg-slate-50 transition-colors">
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>
    </div>
  )
}

/* ── Shared Helper Components ───────────────────────────────── */

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500 font-medium">{label}</span>
      <span className="text-[13px] text-ink-900 font-medium">{value}</span>
    </div>
  )
}

function FlagRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500 font-medium">{label}</span>
      <span className={cn(
        'status-pill text-[11px]',
        value ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  )
}
