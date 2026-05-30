import { WidgetCard, WidgetDivider } from './WidgetCard'
import { getNewsItems, getPinnedNews } from '@/lib/mock-data'
import { newsCategoryColor, newsCategoryLabel, cn } from '@/lib/utils'
import { Newspaper, Pin } from 'lucide-react'

export function NewsWidget() {
  const news = getNewsItems()
  const pinned = getPinnedNews()

  return (
    <WidgetCard
      title="News & Regulations"
      icon={<Newspaper className="w-4 h-4" />}
    >
      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="mb-3">
          {pinned.map(item => (
            <div key={item.id} className="px-3 py-2.5 rounded-lg bg-accent-50/50 border border-accent-100 mb-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Pin className="w-3 h-3 text-accent-500" />
                <span className={cn('status-pill text-[8px]', newsCategoryColor(item.category))}>{newsCategoryLabel(item.category)}</span>
              </div>
              <p className="text-[11px] font-medium text-ink-800 leading-tight">{item.title}</p>
              <p className="text-[10px] text-ink-400 mt-1">{item.source} · {new Date(item.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
            </div>
          ))}
        </div>
      )}

      {/* All news */}
      <div className="space-y-0.5">
        {news.filter(n => !n.pinned).slice(0, 5).map(item => (
          <div key={item.id} className="py-2 px-2 -mx-2 rounded-lg hover:bg-surface-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn('status-pill text-[8px]', newsCategoryColor(item.category))}>{newsCategoryLabel(item.category)}</span>
              <span className="text-[9px] text-ink-300">{item.source}</span>
            </div>
            <p className="text-[11px] text-ink-700 leading-tight">{item.title}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}
