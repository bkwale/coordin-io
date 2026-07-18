'use client'

import { useEffect, useState } from 'react'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: unknown
  ip_address: string | null
  created_at: string
  actor_name: string | null
  actor_email: string | null
  org_name: string
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 50

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/audit?limit=${limit}&offset=${offset}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || [])
        setTotal(data.total || 0)
      })
      .finally(() => setLoading(false))
  }, [offset])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <span className="text-sm text-slate-400">{total} total events</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-slate-200 rounded w-full mb-4" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No audit events yet</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                    Time
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                    Action
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                    Entity
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                    Actor
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                    Organisation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {event.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {event.entity_type}:{event.entity_id.slice(0, 8)}…
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {event.actor_name || event.actor_email || 'System'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{event.org_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-400">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
