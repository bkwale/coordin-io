'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────── */

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

/* ── Context ───────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

/* ── Provider ──────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((item) => (
          <ToastNotification key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ── Individual toast ──────────────────────────────────── */

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 10)

    // Auto-dismiss after 4s
    const hideTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(item.id), 200)
    }, 4000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [item.id, onDismiss])

  const Icon =
    item.type === 'success'
      ? CheckCircle2
      : item.type === 'error'
        ? AlertTriangle
        : Info

  const colors =
    item.type === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : item.type === 'error'
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-blue-50 border-blue-200 text-blue-800'

  const iconColor =
    item.type === 'success'
      ? 'text-emerald-500'
      : item.type === 'error'
        ? 'text-red-500'
        : 'text-blue-500'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-200',
        colors,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
    >
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', iconColor)} />
      <p className="text-[13px] flex-1">{item.message}</p>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(() => onDismiss(item.id), 200)
        }}
        className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
