'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import {
  getFeeQuoteRecord,
  getFeeQuoteLineItems,
  getFeeQuoteSections,
  getUser,
  PROJECTS,
  getTermsLibrary,
  getExclusionsLibrary,
  getFeeQuoteTemplates,
} from '@/lib/mock-data'
import type {
  FeeQuoteRecord,
  FeeQuoteLineItem,
  FeeQuoteSection,
  QuoteSectionType,
} from '@/lib/types'
import { cn, formatDate, formatCurrency, feeQuoteStatusColor, feeQuoteStatusLabel, quoteSectionTypeLabel } from '@/lib/utils'

export default function EnhancedFeeQuoteBuilderPage() {
  const params = useParams()
  const quoteId = params.id as string

  // Load quote and related data
  const quote = getFeeQuoteRecord(quoteId)
  const lineItems = quote ? getFeeQuoteLineItems(quoteId) : []
  const sections = quote ? getFeeQuoteSections(quoteId) : []
  const preparedByUser = quote ? getUser(quote.prepared_by_user_id) : null
  const relatedProject = quote?.related_project_id ? PROJECTS.find(p => p.id === quote.related_project_id) : null
  const termsLibrary = getTermsLibrary()
  const exclusionsLibrary = getExclusionsLibrary()
  const templates = getFeeQuoteTemplates()

  // UI state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Error state
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
            <p className="text-slate-600 mb-6">The fee quote you're looking for doesn't exist or has been deleted.</p>
            <a
              href="/fee-quotes"
              className="inline-block bg-ink-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-ink-800 transition-colors"
            >
              Back to Fee Quotes
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Group line items by type for display
  const lineItemsByType = {
    stage: lineItems.filter(i => i.line_type === 'stage'),
    service: lineItems.filter(i => i.line_type === 'service'),
    consultant: lineItems.filter(i => i.line_type === 'consultant'),
    expense: lineItems.filter(i => i.line_type === 'expense'),
    optional: lineItems.filter(i => i.line_type === 'optional'),
  }

  // Calculate totals
  const subtotal = lineItems
    .filter(i => i.line_type !== 'discount')
    .reduce((sum, item) => sum + (item.optional_flag ? 0 : item.amount), 0)
  const discountItem = lineItems.find(i => i.line_type === 'discount')
  const discountAmount = discountItem?.amount || 0
  const total = quote.total_fee

  // Sections by type
  const sectionsByType: Record<QuoteSectionType, FeeQuoteSection | null> = {
    cover: sections.find(s => s.section_type === 'cover') || null,
    project_understanding: sections.find(s => s.section_type === 'project_understanding') || null,
    scope_of_service: sections.find(s => s.section_type === 'scope_of_service') || null,
    stage_breakdown: sections.find(s => s.section_type === 'stage_breakdown') || null,
    optional_extras: sections.find(s => s.section_type === 'optional_extras') || null,
    consultant_coordination: sections.find(s => s.section_type === 'consultant_coordination') || null,
    programme_assumptions: sections.find(s => s.section_type === 'programme_assumptions') || null,
    design_freeze_note: sections.find(s => s.section_type === 'design_freeze_note') || null,
    meetings_and_communication: sections.find(s => s.section_type === 'meetings_and_communication') || null,
    expenses_and_travel: sections.find(s => s.section_type === 'expenses_and_travel') || null,
    exclusions: sections.find(s => s.section_type === 'exclusions') || null,
    terms_and_conditions: sections.find(s => s.section_type === 'terms_and_conditions') || null,
    payment_terms: sections.find(s => s.section_type === 'payment_terms') || null,
    acceptance: sections.find(s => s.section_type === 'acceptance') || null,
  }

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

          <div className="mt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={quote.quote_title}
                  readOnly
                  className="text-2xl font-display font-bold text-ink-900 bg-transparent border-0 p-0 focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', feeQuoteStatusColor(quote.status))}>
                {feeQuoteStatusLabel(quote.status)}
              </span>
              <div className="text-sm text-slate-600">
                <span className="font-medium">{quote.client_name}</span>
                <span className="mx-2">•</span>
                <span className="font-mono text-xs">{quote.quote_reference}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-ink-900 text-white rounded-lg font-medium hover:bg-ink-800 transition-colors">
                Save Draft
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 text-ink-900 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                Preview
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 text-ink-900 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                Send Quote
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 text-ink-900 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Left Column — Builder */}
          <div className="col-span-2 space-y-6">
            {/* 1. Client Summary Card */}
            <div className="card-premium p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Client Summary</h2>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Client</p>
                    <p className="text-base font-medium text-ink-900">{quote.client_name}</p>
                  </div>
                  {relatedProject && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Related Project</p>
                      <a
                        href={`/projects/${relatedProject.id}`}
                        className="text-base font-medium text-brand-600 hover:underline"
                      >
                        {relatedProject.name}
                      </a>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Issue Date</p>
                      <p className="text-sm text-ink-900">{formatDate(quote.issue_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Valid Until</p>
                      <p className="text-sm text-ink-900">{formatDate(quote.valid_until)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Fee Basis</p>
                      <p className="text-sm text-ink-900">{quote.fee_basis}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Currency</p>
                      <p className="text-sm text-ink-900">{quote.currency}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 bg-surface-50 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Total Fee</p>
                  <p className="text-2xl font-bold font-display text-ink-900">{formatCurrency(quote.total_fee, quote.currency)}</p>
                </div>

                {quote.deposit_required_flag && quote.deposit_amount && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Deposit Required</p>
                    <p className="text-sm font-medium text-amber-900">{formatCurrency(quote.deposit_amount, quote.currency)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Sections Builder */}
            {sections.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-1">Quote Sections</h2>
                {sections.map((section, idx) => (
                  <div key={section.id} className="card-premium p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                          {quoteSectionTypeLabel(section.section_type)}
                        </p>
                        <input
                          type="text"
                          value={section.title}
                          readOnly
                          className="text-base font-medium text-ink-900 bg-transparent border-0 p-0 focus:outline-none w-full mb-3"
                        />
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button className="text-slate-400 hover:text-slate-600 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                          </svg>
                        </button>
                        <button className="text-red-400 hover:text-red-600 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={section.body_text}
                      readOnly
                      className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 font-normal leading-relaxed resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />

                    {section.image_url && (
                      <div className="mt-4">
                        <div className="bg-slate-100 rounded-lg border border-slate-200 h-40 flex items-center justify-center text-slate-400">
                          Image placeholder
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-600 hover:border-slate-300 hover:text-slate-700 transition-colors font-medium text-sm">
                  + Add Section
                </button>
              </div>
            )}

            {/* 3. Line Items Table */}
            {lineItems.length > 0 && (
              <div className="card-premium overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Fee Breakdown</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-surface-50">
                        <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-12">#</th>
                        <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Item</th>
                        <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-24">Stage</th>
                        <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-16">Qty</th>
                        <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-24">Rate</th>
                        <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-32">Amount</th>
                        <th className="px-6 py-3 text-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-16">Opt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={cn(
                            'stripe-row border-b border-slate-100 hover:bg-surface-50 transition-colors',
                            item.optional_flag && 'opacity-60'
                          )}
                        >
                          <td className="px-6 py-3 text-sm text-slate-400 font-medium">{idx + 1}</td>
                          <td className="px-6 py-3 text-sm text-ink-900 font-medium">
                            <div>{item.title}</div>
                            {item.description && <div className="text-[12px] text-slate-600 mt-0.5">{item.description}</div>}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-600">
                            {item.related_stage !== undefined ? `Stage ${item.related_stage}` : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-600 text-right">
                            {item.quantity || '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-600 text-right">
                            {item.rate ? formatCurrency(item.rate, quote.currency) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm font-semibold text-ink-900 text-right">
                            {formatCurrency(item.amount, quote.currency)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {item.optional_flag && (
                              <span className="text-blue-600">
                                <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Totals rows */}
                      <tr className="border-b border-slate-200 bg-surface-50">
                        <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-slate-600">
                          Subtotal
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-semibold text-ink-900">
                          {formatCurrency(subtotal, quote.currency)}
                        </td>
                        <td />
                      </tr>

                      {discountAmount !== 0 && (
                        <tr className="border-b border-slate-200 bg-surface-50">
                          <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-slate-600">
                            Discount
                          </td>
                          <td className="px-6 py-3 text-right text-sm font-semibold text-red-600">
                            -{formatCurrency(discountAmount, quote.currency)}
                          </td>
                          <td />
                        </tr>
                      )}

                      <tr className="bg-white">
                        <td colSpan={5} className="px-6 py-4 text-right text-base font-bold text-ink-900">
                          Total
                        </td>
                        <td className="px-6 py-4 text-right text-base font-bold text-ink-900">
                          {formatCurrency(total, quote.currency)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-200">
                  <button className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                    + Add Line Item
                  </button>
                </div>
              </div>
            )}

            {/* 4. Meetings & Travel Panel */}
            {(quote.meetings_included_count || quote.mileage_rate || quote.expense_allowance) && (
              <div className="card-premium p-6">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Meetings & Travel</h2>

                <div className="grid grid-cols-3 gap-6">
                  {quote.meetings_included_count !== undefined && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Meetings Included</p>
                      <p className="text-2xl font-bold font-display text-ink-900">{quote.meetings_included_count}</p>
                      <p className="text-[12px] text-slate-500 mt-1">meetings/reviews</p>
                    </div>
                  )}
                  {quote.mileage_rate !== undefined && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Mileage Rate</p>
                      <p className="text-base font-semibold text-ink-900">{quote.mileage_rate}</p>
                      <p className="text-[12px] text-slate-500 mt-1">per mile</p>
                    </div>
                  )}
                  {quote.expense_allowance !== undefined && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Expense Allowance</p>
                      <p className="text-base font-semibold text-ink-900">{formatCurrency(quote.expense_allowance, quote.currency)}</p>
                      <p className="text-[12px] text-slate-500 mt-1">budget</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Terms & Exclusions */}
            <div className="space-y-4">
              {/* Terms */}
              <div className="card-premium p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Terms & Conditions</h2>
                  <button className="text-[12px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
                    Load from Library
                  </button>
                </div>
                <textarea
                  value={quote.terms_text}
                  readOnly
                  className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 font-normal leading-relaxed resize-none min-h-[100px] focus:outline-none"
                />
              </div>

              {/* Exclusions */}
              <div className="card-premium p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Exclusions</h2>
                  <button className="text-[12px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
                    Load from Library
                  </button>
                </div>
                <textarea
                  value={quote.exclusions_text}
                  readOnly
                  className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 font-normal leading-relaxed resize-none min-h-[100px] focus:outline-none"
                />
              </div>

              {/* Assumptions */}
              <div className="card-premium p-6">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Assumptions</h2>
                <textarea
                  value={quote.assumptions_text}
                  readOnly
                  className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 font-normal leading-relaxed resize-none min-h-[100px] focus:outline-none"
                />
              </div>

              {/* Payment Schedule */}
              <div className="card-premium p-6">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Payment Schedule</h2>
                <textarea
                  value={quote.payment_schedule_text}
                  readOnly
                  className="w-full bg-surface-50 rounded-lg border border-slate-200 p-4 text-[13px] text-ink-900 font-normal leading-relaxed resize-none min-h-[100px] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column — Sidebar */}
          <div className="col-span-1 space-y-6">
            {/* Quote Status Card */}
            <div className="card-premium p-6">
              <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Quote Status</h2>

              <div className={cn('inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6', feeQuoteStatusColor(quote.status))}>
                {feeQuoteStatusLabel(quote.status)}
              </div>

              <div className="space-y-3 text-[13px]">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Created</p>
                  <p className="text-ink-900 font-medium">{formatDate(quote.created_at)}</p>
                </div>

                {quote.sent_at && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Sent</p>
                    <p className="text-ink-900 font-medium">{formatDate(quote.sent_at)}</p>
                  </div>
                )}

                {quote.last_viewed_at && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Last Viewed</p>
                    <p className="text-ink-900 font-medium">{formatDate(quote.last_viewed_at)}</p>
                  </div>
                )}

                {quote.accepted_at && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Accepted</p>
                    <p className="text-ink-900 font-medium">{formatDate(quote.accepted_at)}</p>
                  </div>
                )}

                {quote.declined_at && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Declined</p>
                    <p className="text-ink-900 font-medium">{formatDate(quote.declined_at)}</p>
                  </div>
                )}
              </div>

              {quote.viewed_count > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-slate-600 text-[13px]">
                    <span className="font-semibold text-ink-900">{quote.viewed_count}</span> views
                  </p>
                </div>
              )}
            </div>

            {/* Branding Preview Card */}
            <div className="card-premium p-6">
              <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Branding Customisation</h2>

              <div className="bg-surface-50 rounded-lg border border-slate-200 p-4 h-48 flex flex-col items-center justify-center text-slate-400 text-center">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-[12px]">Logo, colors, fonts</p>
              </div>
            </div>

            {/* Templates Card */}
            {templates.length > 0 && (
              <div className="card-premium p-6">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Templates</h2>

                <div className="space-y-2">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors text-left',
                        selectedTemplate === template.id
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'border-slate-200 text-ink-900 hover:bg-surface-50'
                      )}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Activity / Views */}
            {quote.viewed_count > 0 && (
              <div className="card-premium p-6">
                <h2 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-4">Activity</h2>

                <div className="text-[13px] text-slate-600">
                  <p className="mb-2">
                    This quote has been viewed <span className="font-semibold text-ink-900">{quote.viewed_count} times</span>.
                  </p>

                  {quote.last_viewed_at && (
                    <p>
                      Last viewed on <span className="font-semibold text-ink-900">{formatDate(quote.last_viewed_at)}</span>.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
