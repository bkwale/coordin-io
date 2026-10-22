'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, AlertCircle,
  ArrowLeft, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useProfile } from '@/lib/hooks/useProfile'

interface Reply {
  id: string
  message: string
  isStaff: boolean
  author: { id: string; fullName: string; email: string }
  createdAt: string
}

interface TicketDetail {
  id: string
  ref: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: string
  page: string | null
  screenshotUrl: string | null
  submitter: { id: string; fullName: string; email: string }
  replies: Reply[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-600' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-50 text-amber-600' },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-600' },
  CLOSED: { label: 'Closed', color: 'bg-surface-200 text-ink-400' },
}

const PRIORITY_DOT = {
  LOW: 'bg-emerald-500', MEDIUM: 'bg-amber-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Bug', FEATURE_REQUEST: 'Feature Request', QUESTION: 'Question',
  ACCESS_ISSUE: 'Access Issue', OTHER: 'Other',
}

export default function TicketDetailPage() {
  const params = useParams()
  const { toast } = useToast()
  const { profile } = useProfile()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const isAdmin = profile?.orgPermission === 'ADMIN' || profile?.orgPermission === 'OWNER'

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/support-tickets/${params.id}`)
      if (!res.ok) throw new Error('Ticket not found')
      const data = await res.json()
      setTicket(data.data?.ticket || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { fetchTicket() }, [fetchTicket])

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/support-tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() }),
      })
      if (!res.ok) throw new Error('Failed to send reply')
      setReplyText('')
      toast('Reply sent', 'success')
      await fetchTicket()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }, [replyText, sending, params.id, toast, fetchTicket])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (updatingStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/support-tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      toast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success')
      await fetchTicket()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }, [updatingStatus, params.id, toast, fetchTicket])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 text-accent-500 animate-spin" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-[13px] text-ink-400">{error || 'Ticket not found'}</p>
        <Link href="/support-tickets" className="text-[12px] text-accent-600 hover:underline">Back to tickets</Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[ticket.status]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back link */}
      <Link href="/support-tickets" className="flex items-center gap-1.5 text-[12px] text-ink-400 hover:text-accent-600 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        {isAdmin ? 'Back to Support Tickets' : 'Back to My Tickets'}
      </Link>

      {/* Ticket header */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] text-ink-300 font-mono">{ticket.ref}</span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', statusCfg.color)}>
            {statusCfg.label}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-ink-300">
            <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[ticket.priority])} />
            {ticket.priority}
          </span>
          <span className="text-[10px] text-ink-400 px-2 py-0.5 rounded bg-surface-100">
            {CATEGORY_LABELS[ticket.category] || ticket.category}
          </span>
        </div>
        <h1 className="text-[20px] font-semibold text-ink-900">{ticket.title}</h1>
        <p className="text-[12px] text-ink-400 mt-1">
          Submitted by {ticket.submitter.fullName} on {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {ticket.page && <> &middot; Page: <code className="text-ink-300 text-[11px]">{ticket.page}</code></>}
        </p>
      </div>

      {/* Admin status controls */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-surface-200">
          <span className="text-[11px] text-ink-400 mr-2">Status:</span>
          {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={ticket.status === s || updatingStatus}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                ticket.status === s
                  ? 'bg-accent-50 border-accent-200 text-accent-700 cursor-default'
                  : 'bg-white border-surface-200 text-ink-400 hover:text-ink-700 hover:border-surface-300',
                updatingStatus && 'opacity-50 cursor-wait'
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      <div className="p-5 rounded-xl bg-white border border-surface-200">
        <p className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        {ticket.screenshotUrl && (
          <div className="mt-4 rounded-lg overflow-hidden border border-surface-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.screenshotUrl} alt="Screenshot" className="max-w-full max-h-64 object-contain bg-surface-50" />
          </div>
        )}
      </div>

      {/* Replies */}
      {ticket.replies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[12px] font-medium text-ink-400 uppercase tracking-wider">Replies</h3>
          {ticket.replies.map(reply => (
            <div
              key={reply.id}
              className={cn(
                'p-4 rounded-xl border',
                reply.isStaff
                  ? 'bg-accent-50 border-accent-100'
                  : 'bg-white border-surface-200'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-medium text-ink-700">{reply.author.fullName}</span>
                {reply.isStaff && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-600 font-medium">STAFF</span>
                )}
                <span className="text-[11px] text-ink-300">
                  {new Date(reply.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
                  {new Date(reply.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[13px] text-ink-500 whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form — only if ticket is not closed */}
      {ticket.status !== 'CLOSED' && (
        <div className="p-4 rounded-xl bg-white border border-surface-200">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg bg-surface-50 border border-surface-200 px-3.5 py-2.5 text-[13px] text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-1 focus:ring-accent-400 transition-colors resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all',
                !replyText.trim() || sending
                  ? 'bg-surface-200 text-ink-300 cursor-not-allowed'
                  : 'bg-accent-500 text-white hover:bg-accent-600 shadow-card'
              )}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Resolved info */}
      {ticket.resolvedAt && (
        <p className="text-[11px] text-ink-300 text-center">
          Resolved on {new Date(ticket.resolvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
