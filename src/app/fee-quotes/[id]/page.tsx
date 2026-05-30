'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getFeeQuoteRecord, getFeeQuoteLineItems, getProject, getOpportunity, getQuoteProjectLink, PROJECTS } from '@/lib/mock-data'
import { RIBA_STAGES } from '@/lib/types'
import { cn, formatDate, formatCurrency, feeQuoteStatusColor, feeQuoteStatusLabel } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { StatusBadge } from '@/components/StatusBadge'

export default function FeeQuoteDetailPage() {
  const params = useParams()
  const quoteId = params.id as string

  const quote = getFeeQuoteRecord(quoteId)
  const lineItems = getFeeQuoteLineItems(quoteId)
  const relatedProject = quote?.related_project_id ? getProject(quote.related_project_id) : null
  const relatedOpportunity = quote?.related_opportunity_id ? getOpportunity(quote.related_opportunity_id) : null
  const quoteLink = getQuoteProjectLink(quoteId)
  const linkedProject = quoteLink?.project_id ? PROJECTS.find(p => p.id === quoteLink.project_id) : null

  if (!quote) {
    return (
      <div className="max-w-6xl">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Fee Quotes', href: '/fee-quotes' },
          { label: 'Not Found' },
        ]} />
        <div className="mt-16 text-center">
          <p className="text-[13px] text-ink-400">Fee quote not found.</p>
        </div>
      </div>
    )
  }

  const relatedName = relatedProject?.name || relatedOpportunity?.title || '—'
  const isExpired = quote.valid_until ? new Date(quote.valid_until) < new Date() : false
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-10">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Fee Quotes', href: '/fee-quotes' },
          { label: quote.quote_reference },
        ]} />
      </section>

      {/* ━━━ ACCEPTANCE WORKFLOW BANNER ━━━━━━━━━━━━━━━━━━━ */}
      {quote.status === 'accepted' && quoteLink?.project_creation_status === 'pending' && (
        <section className="mb-16">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
            <p className="text-[12px] text-blue-800">
              This quote has been accepted. Create a project to begin work.
            </p>
            <button className="bg-accent-600 text-white px-4 py-2 rounded-lg text-[12px] font-medium hover:bg-accent-700 transition-colors">
              Create Project
            </button>
          </div>
        </section>
      )}

      {/* ━━━ QUOTE HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[2rem] text-ink-900 mb-4">{quote.quote_reference}</h1>
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge
                label={feeQuoteStatusLabel(quote.status)}
                colorClass={feeQuoteStatusColor(quote.status)}
              />
              {isExpired && (
                <span className="text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-medium">
                  EXPIRED
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-600 mb-1">{relatedName}</p>
            <p className="text-[12px] text-ink-400">{quote.fee_basis}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-[2rem] text-ink-900">
              {formatCurrency(quote.total_fee)}
            </p>
            <p className="text-[11px] text-ink-400 mt-2">Total Fee</p>
          </div>
        </div>
      </section>

      {/* ━━━ EXPIRED BANNER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isExpired && quote.valid_until && (
        <section className="mb-16">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-[12px] text-red-800">
              This quote expired on {formatDate(quote.valid_until)}. Consider issuing a new quote if the client is still interested.
            </p>
          </div>
        </section>
      )}

      {/* ━━━ LINE ITEMS TABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-300 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Fee Breakdown</h2>

          <div className="card-premium overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2rem_1fr_2fr_3fr_1fr] gap-6 px-6 py-3 bg-surface-50 border-b border-surface-200">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">#</div>
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Stage</div>
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Title</div>
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Description</div>
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.1em] text-right">Amount</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-surface-100">
              {lineItems.map((item, index) => {
                let typeColor = 'bg-blue-100'
                let typeDotColor = 'bg-blue-500'

                if (item.line_type === 'service') {
                  typeColor = 'bg-green-100'
                  typeDotColor = 'bg-green-500'
                } else if (item.line_type === 'expense') {
                  typeColor = 'bg-amber-100'
                  typeDotColor = 'bg-amber-500'
                } else if (item.line_type === 'discount') {
                  typeColor = 'bg-red-100'
                  typeDotColor = 'bg-red-500'
                }

                const stageName = item.related_stage !== undefined ? RIBA_STAGES[item.related_stage] : '—'

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[2rem_1fr_2fr_3fr_1fr] gap-6 px-6 py-4 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', typeDotColor)} />
                    </div>
                    <div className="text-[12px] text-ink-600 font-mono">
                      {stageName}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-ink-900">{item.title}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-ink-500 line-clamp-2">{item.description || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-mono text-ink-900">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotal Row */}
            <div className="grid grid-cols-[2rem_1fr_2fr_3fr_1fr] gap-6 px-6 py-4 bg-surface-50 border-t border-surface-200 font-semibold">
              <div />
              <div />
              <div />
              <div className="text-[12px] text-ink-600">Subtotal</div>
              <div className="text-right">
                <p className="text-[13px] font-mono text-ink-900">
                  {formatCurrency(subtotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ TERMS & CONDITIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {quote.terms_text && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10 mt-10">
            <h3 className="text-[13px] font-semibold text-ink-900 uppercase tracking-[0.1em] mb-4">Terms & Conditions</h3>
            <div className="card-premium p-6">
              <div className="prose prose-sm max-w-none">
                <p className="text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap">
                  {quote.terms_text}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ━━━ EXCLUSIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {quote.exclusions_text && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10 mt-10">
            <h3 className="text-[13px] font-semibold text-ink-900 uppercase tracking-[0.1em] mb-4">Exclusions</h3>
            <div className="card-premium p-6">
              <ul className="space-y-2">
                {quote.exclusions_text.split('\n').filter(line => line.trim()).map((exclusion, i) => (
                  <li key={i} className="flex gap-3 text-[12px] text-ink-700">
                    <span className="text-ink-400 shrink-0">•</span>
                    <span>{exclusion.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ━━━ METADATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-20">
        <div className="border-t border-surface-200/60 pt-10 mt-10">
          <h3 className="text-[13px] font-semibold text-ink-900 uppercase tracking-[0.1em] mb-4">Quote Details</h3>
          <div className="grid grid-cols-3 gap-8 text-[12px]">
            {quote.issue_date && (
              <div>
                <p className="text-ink-400 mb-1">Issued Date</p>
                <p className="text-ink-700 font-mono">{formatDate(quote.issue_date)}</p>
              </div>
            )}
            {quote.valid_until && (
              <div>
                <p className="text-ink-400 mb-1">Valid Until</p>
                <p className="text-ink-700 font-mono">{formatDate(quote.valid_until)}</p>
              </div>
            )}
            {quote.prepared_by_user_id && (
              <div>
                <p className="text-ink-400 mb-1">Created By</p>
                <p className="text-ink-700">{quote.prepared_by_user_id}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ━━━ QUOTE-TO-PROJECT LINK ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-20">
        <div className="border-t border-surface-200/60 pt-10 mt-10">
          <h3 className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-4">Project Link</h3>

          {quoteLink?.project_creation_status === 'created' && linkedProject ? (
            <div className="card-premium !bg-emerald-50 !border-emerald-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-[11px] text-emerald-700 uppercase tracking-[0.08em] font-semibold mb-2">Linked to Project</p>
                  <Link href={`/projects/${linkedProject.id}`} className="text-[13px] font-medium text-emerald-900 hover:underline">
                    {linkedProject.name}
                  </Link>
                  {quoteLink.linked_at && (
                    <p className="text-[11px] text-emerald-700 mt-2">
                      Linked on {formatDate(quoteLink.linked_at)}
                    </p>
                  )}
                </div>
                {quoteLink.auto_created_flag && (
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-semibold whitespace-nowrap ml-4">
                    AUTO-CREATED
                  </span>
                )}
              </div>
            </div>
          ) : quoteLink?.project_creation_status === 'pending' && quote.status === 'accepted' ? (
            <div className="card-premium !bg-amber-50 !border-amber-200 p-6">
              <p className="text-[11px] text-amber-700 uppercase tracking-[0.08em] font-semibold mb-4">Quote Accepted — Ready to Create Project</p>
              <p className="text-[12px] text-amber-800 mb-4">This will create a new project pre-populated with the quote details.</p>
              <div className="flex gap-3">
                <button className="bg-accent-600 text-white px-4 py-2 rounded-lg text-[12px] font-medium hover:bg-accent-700 transition-colors">
                  Create Project from Quote
                </button>
                <button className="bg-white text-accent-600 border border-accent-300 px-4 py-2 rounded-lg text-[12px] font-medium hover:bg-accent-50 transition-colors">
                  Link to Existing Project
                </button>
              </div>
            </div>
          ) : quoteLink?.project_creation_status === 'skipped' || quote.status === 'declined' || quote.status === 'expired' ? (
            <div className="card-premium p-6">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">No project linked</p>
              <p className="text-[12px] text-ink-600">
                {quote.status === 'declined'
                  ? 'This quote was declined by the client.'
                  : quote.status === 'expired'
                  ? 'This quote expired.'
                  : '—'}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
