'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, Bug, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-emerald-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
]

const CATEGORIES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'ACCESS_ISSUE', label: 'Access Issue' },
  { value: 'OTHER', label: 'Other' },
]

type Status = 'idle' | 'sending' | 'success' | 'error'

export function ReportIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [category, setCategory] = useState('BUG')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [ticketRef, setTicketRef] = useState('')

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setCategory('BUG')
    setScreenshot(null)
    setScreenshotName('')
    setStatus('idle')
    setErrorMsg('')
    setTicketRef('')
  }, [])

  const handleClose = useCallback(() => {
    if (status === 'sending') return
    onClose()
    setTimeout(reset, 200)
  }, [onClose, reset, status])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Screenshot must be under 5 MB')
      return
    }
    setScreenshotName(file.name)
    const reader = new FileReader()
    reader.onload = () => setScreenshot(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          category,
          page: pathname,
          ...(screenshot ? { screenshot } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong')
      }
      const data = await res.json()
      setTicketRef(data.data?.ticketRef || '')
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send ticket')
      setStatus('error')
    }
  }, [title, description, priority, category, pathname, screenshot])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-ink-900 border border-white/[0.08] rounded-2xl shadow-elevated overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Bug className="w-5 h-5 text-accent-400" />
            <h2 className="text-[15px] font-semibold text-white">Report an Issue</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white/30 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-[14px] text-white/80">Ticket {ticketRef} submitted successfully.</p>
            <p className="text-[12px] text-white/40">Track it under My Tickets in the sidebar.</p>
            <button
              onClick={handleClose}
              className="mt-4 px-5 py-2 rounded-lg text-[12px] font-medium bg-white/[0.06] text-white/60 hover:bg-white/[0.10] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  maxLength={200}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent-400/50 focus:border-accent-400/50 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Description *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect to happen?"
                  rows={4}
                  maxLength={5000}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent-400/50 focus:border-accent-400/50 transition-colors resize-none"
                />
              </div>

              {/* Category + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-accent-400/50 transition-colors"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value} className="bg-ink-900">{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Priority</label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                          priority === p.value
                            ? 'bg-white/[0.08] border-white/[0.15] text-white'
                            : 'bg-transparent border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/[0.10]'
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', p.color)} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Screenshot */}
              <div>
                <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Screenshot (optional)</label>
                {screenshot ? (
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5">
                    <span className="text-[12px] text-white/60 truncate flex-1">{screenshotName}</span>
                    <button
                      onClick={() => { setScreenshot(null); setScreenshotName(''); if (fileRef.current) fileRef.current.value = '' }}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full bg-white/[0.04] border border-dashed border-white/[0.10] rounded-lg px-3.5 py-3 text-[12px] text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Click to attach a screenshot (max 5 MB)
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* Page context */}
              <p className="text-[11px] text-white/20">Current page: {pathname}</p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !description.trim() || status === 'sending'}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold transition-all',
                  !title.trim() || !description.trim() || status === 'sending'
                    ? 'bg-white/[0.06] text-white/20 cursor-not-allowed'
                    : 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm'
                )}
              >
                {status === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'sending' ? 'Sending…' : 'Submit Ticket'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
