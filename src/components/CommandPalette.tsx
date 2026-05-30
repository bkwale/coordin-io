'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FolderOpen, Users, Receipt, BarChart3, Settings, FileText, Sparkles } from 'lucide-react'
import { PROJECTS, USERS, FEE_QUOTE_RECORDS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface CommandItem {
  label: string
  sublabel?: string
  href: string
  icon: React.ReactNode
  category: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Build command items from data
  const items: CommandItem[] = [
    // Pages
    { label: 'Dashboard', sublabel: 'Executive overview', href: '/', icon: <BarChart3 className="w-4 h-4" />, category: 'Pages' },
    { label: 'Projects', sublabel: 'All projects', href: '/projects', icon: <FolderOpen className="w-4 h-4" />, category: 'Pages' },
    { label: 'Staffing & Leave', sublabel: 'Team management', href: '/staffing', icon: <Users className="w-4 h-4" />, category: 'Pages' },
    { label: 'Fee Quotes', sublabel: 'Quote pipeline', href: '/fee-quotes', icon: <Receipt className="w-4 h-4" />, category: 'Pages' },
    { label: 'Analytics', sublabel: 'Portfolio health', href: '/analytics/portfolio', icon: <BarChart3 className="w-4 h-4" />, category: 'Pages' },
    { label: 'Settings', sublabel: 'Admin controls', href: '/settings/admin', icon: <Settings className="w-4 h-4" />, category: 'Pages' },
    { label: 'AI Teammate', sublabel: 'Ask anything', href: '/ai', icon: <Sparkles className="w-4 h-4" />, category: 'Pages' },
    // Projects
    ...PROJECTS.map(p => ({
      label: p.name,
      sublabel: `${p.client} · Stage ${p.current_stage}`,
      href: `/projects/${p.id}`,
      icon: <FolderOpen className="w-4 h-4" />,
      category: 'Projects',
    })),
    // People
    ...USERS.map(u => ({
      label: u.name,
      sublabel: u.role.replace('_', ' '),
      href: '/staffing',
      icon: <Users className="w-4 h-4" />,
      category: 'People',
    })),
    // Quotes
    ...FEE_QUOTE_RECORDS.map(q => ({
      label: q.quote_reference,
      sublabel: `${q.quote_title} · ${q.status}`,
      href: `/fee-quotes/${q.id}`,
      icon: <FileText className="w-4 h-4" />,
      category: 'Quotes',
    })),
  ]

  const filtered = query === '' ? items.slice(0, 10) : items.filter(i =>
    i.label.toLowerCase().includes(query.toLowerCase()) ||
    (i.sublabel && i.sublabel.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 10)

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      router.push(filtered[selectedIndex].href)
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="card-premium overflow-hidden shadow-elevated">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200">
            <Search className="w-4 h-4 text-ink-300 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, people, quotes..."
              className="flex-1 text-[13px] text-ink-900 placeholder:text-ink-300 bg-transparent outline-none"
            />
            <kbd className="text-[10px] text-ink-300 border border-surface-200 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[320px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <p className="text-[12px] text-ink-400 text-center py-6">No results found</p>
            ) : (
              <>
                {/* Group by category */}
                {['Pages', 'Projects', 'People', 'Quotes'].map(cat => {
                  const catItems = filtered.filter(i => i.category === cat)
                  if (catItems.length === 0) return null
                  return (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-4 pt-2 pb-1">{cat}</p>
                      {catItems.map(item => {
                        const idx = filtered.indexOf(item)
                        return (
                          <button
                            key={`${item.href}-${item.label}`}
                            onClick={() => { router.push(item.href); setOpen(false) }}
                            className={cn(
                              'flex items-center gap-3 w-full px-4 py-2 text-left transition-colors',
                              idx === selectedIndex ? 'bg-accent-50 text-accent-600' : 'hover:bg-surface-50'
                            )}
                          >
                            <span className={cn('shrink-0', idx === selectedIndex ? 'text-accent-500' : 'text-ink-300')}>{item.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-medium text-ink-800 truncate">{item.label}</p>
                              {item.sublabel && <p className="text-[10px] text-ink-400 truncate">{item.sublabel}</p>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-100 bg-surface-50/50">
            <span className="text-[10px] text-ink-300">&uarr;&darr; navigate</span>
            <span className="text-[10px] text-ink-300">&crarr; open</span>
            <span className="text-[10px] text-ink-300">esc close</span>
          </div>
        </div>
      </div>
    </>
  )
}
