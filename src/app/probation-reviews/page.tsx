'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { SkeletonRow } from '@/components/Skeleton'
import { WORKFLOW_LABELS, type WorkflowStatus } from '@/lib/staffing/probation-workflow'

type Row = {
  id: string; reviewType: string; scheduledDate: string; workflowStatus: WorkflowStatus; completedDate: string | null
  profile: { id: string; fullName: string; jobTitle: string | null }
}
const STYLE: Record<string, string> = {
  SCHEDULED: 'bg-gray-100 text-gray-700', DRAFT: 'bg-blue-100 text-blue-800', SUBMITTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-red-100 text-red-800', FINALISED: 'bg-green-100 text-green-800',
}

/** Probation reviews I need to act on: line managers see their team, HR sees everything open. */
export default function ProbationReviewsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [done, setDone] = useState<Row[]>([])

  useEffect(() => {
    fetch('/api/staffing/probation?pending=true')
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed to load'); return j })
      .then((j) => setRows(j.data?.reviews ?? []))
      .catch((e) => setError(e.message))
    fetch('/api/staffing/probation?workflow=FINALISED')
      .then((r) => r.json()).then((j) => setDone(j.data?.reviews ?? [])).catch(() => {})
  }, [])

  const now = new Date()
  const order: Record<string, number> = { RETURNED: 0, SUBMITTED: 1, DRAFT: 2, SCHEDULED: 3 }
  const sorted = (rows ?? []).slice().sort((a, b) => (order[a.workflowStatus] ?? 9) - (order[b.workflowStatus] ?? 9) || +new Date(a.scheduledDate) - +new Date(b.scheduledDate))

  const list = (items: Row[]) => (
    <div className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
      {items.map((r) => {
        const overdue = r.workflowStatus !== 'FINALISED' && r.workflowStatus !== 'SUBMITTED' && new Date(r.scheduledDate) < now
        return (
          <Link key={r.id} href={`/probation-reviews/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-25">
            <div>
              <div className="text-[13px] font-medium text-ink-900">{r.profile.fullName} — {r.reviewType}</div>
              <div className="text-[12px] text-ink-400">{r.profile.jobTitle ?? 'Role not set'} · Due {new Date(r.scheduledDate).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2">
              {overdue && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">OVERDUE</span>}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STYLE[r.workflowStatus] ?? STYLE.SCHEDULED}`}>{WORKFLOW_LABELS[r.workflowStatus] ?? r.workflowStatus}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Probation Reviews</h1>
        <p className="text-[13px] text-ink-400 mt-1">Reviews for your team that need assessing, and anything awaiting an HR decision.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-[13px] text-red-800">{error}</div>}
      {!rows && !error && <div className="space-y-2"><SkeletonRow className="h-14" /><SkeletonRow className="h-14" /></div>}
      {rows && rows.length === 0 && (
        <div className="bg-white border border-ink-200 rounded-xl p-10 text-center text-[13px] text-ink-400">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />No open probation reviews for you.
        </div>
      )}
      {rows && rows.length > 0 && list(sorted)}
      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="text-[12px] text-ink-500 hover:text-ink-700">{showDone ? 'Hide' : 'Show'} finalised reviews ({done.length})</button>
          {showDone && <div className="mt-2">{list(done)}</div>}
        </div>
      )}
    </div>
  )
}
