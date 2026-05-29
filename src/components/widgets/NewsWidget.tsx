import { WidgetCard, WidgetDivider } from './WidgetCard'
import { getNewsItems, getPinnedNews } from '@/lib/mock-data'
import { newsCategoryColor, newsCategoryLabel, cn } from '@/lib/utils'

export function NewsWidget() {
  const news = getNewsItems()
  const pinned = getPinnedNews()

  return (
    <WidgetCard
      title="News & Regulations"
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>}
    >
      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="mb-3">
          {pinned.map(item => (
            <div key={item.id} className="px-3 py-2.5 rounded-lg bg-accent-50/50 border border-accent-100 mb-1.5">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-3 h-3 text-accent-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" /></svg>
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
