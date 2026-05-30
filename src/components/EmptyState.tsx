import Link from 'next/link'

interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
  actionLabel?: string
  actionHref?: string
}

const defaultIcon = (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.25" />
  </svg>
)

export function EmptyState({ message, icon, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-ink-300 mb-3">
        {icon || defaultIcon}
      </div>
      <p className="text-[11px] text-ink-400">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-[11px] font-medium text-accent-500 hover:text-accent-600 mt-2"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
