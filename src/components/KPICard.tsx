import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string | number
  sublabel?: string
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  icon?: React.ReactNode
}

const accentMap = {
  blue: {
    bg: 'bg-accent-50',
    border: 'border-accent-100',
    icon: 'bg-accent-100 text-accent-600',
    value: 'text-ink-900',
    dot: 'bg-accent-500',
  },
  green: {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-100',
    icon: 'bg-emerald-100 text-emerald-600',
    value: 'text-ink-900',
    dot: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50/50',
    border: 'border-amber-100',
    icon: 'bg-amber-100 text-amber-600',
    value: 'text-ink-900',
    dot: 'bg-amber-500',
  },
  red: {
    bg: 'bg-red-50/50',
    border: 'border-red-100',
    icon: 'bg-red-100 text-red-600',
    value: 'text-ink-900',
    dot: 'bg-red-500',
  },
  slate: {
    bg: 'bg-white',
    border: 'border-surface-200',
    icon: 'bg-surface-100 text-ink-400',
    value: 'text-ink-900',
    dot: 'bg-ink-300',
  },
}

export function KPICard({ label, value, sublabel, accent = 'slate', icon }: KPICardProps) {
  const a = accentMap[accent]

  return (
    <div className={cn(
      'card-static p-5 relative overflow-hidden group cursor-default',
    )}>
      {/* Subtle accent gradient overlay */}
      <div className={cn(
        'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
        accent === 'blue' && 'bg-gradient-to-br from-accent-50/50 to-transparent',
        accent === 'green' && 'bg-gradient-to-br from-emerald-50/50 to-transparent',
        accent === 'amber' && 'bg-gradient-to-br from-amber-50/50 to-transparent',
        accent === 'red' && 'bg-gradient-to-br from-red-50/50 to-transparent',
      )} />

      <div className="relative">
        {/* Header row: icon + label */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em]">
            {label}
          </p>
          {icon ? (
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', a.icon)}>
              {icon}
            </div>
          ) : (
            <span className={cn('w-2.5 h-2.5 rounded-full', a.dot)} />
          )}
        </div>

        {/* Value */}
        <p className={cn(
          'text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums',
          a.value
        )}>
          {value}
        </p>

        {sublabel && (
          <p className="text-[11px] text-ink-400 mt-2">{sublabel}</p>
        )}
      </div>
    </div>
  )
}
