'use client'

import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetRow, WidgetDivider } from './WidgetCard'

interface KnowledgeTopic {
  title: string
  category: string
}

const TOPICS: KnowledgeTopic[] = [
  { title: 'RIBA Plan of Work Stages', category: 'Standards' },
  { title: 'Building Regulations Overview', category: 'Regulations' },
  { title: 'CDM Regulations Summary', category: 'Regulations' },
  { title: 'BIM Level 2 Requirements', category: 'Standards' },
  { title: 'JCT Contract Types Overview', category: 'Contracts' },
]

const CATEGORY_COLORS: Record<string, string> = {
  'Standards': 'bg-violet-50 text-violet-600',
  'Regulations': 'bg-red-50 text-red-600',
  'Contracts': 'bg-cyan-50 text-cyan-600',
  'Process': 'bg-amber-50 text-amber-600',
  'Custom': 'bg-emerald-50 text-emerald-600',
}

export function NewsWidget() {
  return (
    <WidgetCard
      title="Knowledge Base"
      icon={<BookOpen className="w-4 h-4" />}
    >
      <div className="space-y-0">
        {TOPICS.map((topic, i) => (
          <div key={topic.title}>
            {i > 0 && <WidgetDivider />}
            <WidgetRow href="/knowledge">
              <span className="text-[13px] text-ink-700 font-medium truncate">
                {topic.title}
              </span>
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                CATEGORY_COLORS[topic.category] || 'bg-surface-100 text-ink-500'
              )}>
                {topic.category}
              </span>
            </WidgetRow>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}
