'use client'

import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetRow, WidgetDivider } from './WidgetCard'

type RAGStatus = 'GREEN' | 'AMBER' | 'RED'

interface ComplianceItem {
  name: string
  status: RAGStatus
  statusText: string
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  { name: 'Professional Indemnity Insurance', status: 'GREEN', statusText: 'Current' },
  { name: 'ARB Registration', status: 'GREEN', statusText: 'Valid' },
  { name: 'RIBA Chartered Status', status: 'GREEN', statusText: 'Active' },
  { name: 'CPD Hours (2024)', status: 'AMBER', statusText: 'Tracking' },
]

const DOT_COLORS: Record<RAGStatus, string> = {
  GREEN: 'bg-emerald-500',
  AMBER: 'bg-amber-500',
  RED: 'bg-red-500',
}

const TEXT_COLORS: Record<RAGStatus, string> = {
  GREEN: 'text-emerald-700',
  AMBER: 'text-amber-700',
  RED: 'text-red-700',
}

export function BRPDWidget() {
  return (
    <WidgetCard
      title="BRPD Compliance"
      icon={<Shield className="w-4 h-4" />}
    >
      <div className="space-y-0">
        {COMPLIANCE_ITEMS.map((item, i) => (
          <div key={item.name}>
            {i > 0 && <WidgetDivider />}
            <WidgetRow>
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_COLORS[item.status])} />
                <span className="text-[13px] text-ink-700 font-medium truncate">
                  {item.name}
                </span>
              </div>
              <span className={cn('text-[11px] font-medium shrink-0', TEXT_COLORS[item.status])}>
                {item.statusText}
              </span>
            </WidgetRow>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}
