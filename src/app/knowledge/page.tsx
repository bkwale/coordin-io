'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getKnowledgeArticles } from '@/lib/mock-data'
import { KnowledgeCategory } from '@/lib/types'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EmptyState } from '@/components/EmptyState'
import { cn, formatDate, knowledgeCategoryLabel, knowledgeCategoryColor } from '@/lib/utils'

const CATEGORIES: { id: KnowledgeCategory; label: string }[] = [
  { id: 'lessons_learned', label: 'Lessons Learned' },
  { id: 'office_procedure', label: 'Office Procedure' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'reference_note', label: 'Reference Note' },
  { id: 'fee_clause', label: 'Fee Clause' },
  { id: 'template', label: 'Template' },
  { id: 'guidance', label: 'Guidance' },
]

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all')

  const articles = getKnowledgeArticles()

  const filtered = articles.filter(a => {
    const matchesSearch = search === '' ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-8 max-w-6xl animate-fade-in">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Knowledge Base' }
      ]} />

      {/* Header */}
      <div>
        <h1 className="font-display text-[2rem] text-ink-900 mb-2">Knowledge Base</h1>
        <p className="text-ink-400">Templates, guidance, lessons learned and reference material</p>
      </div>

      {/* Search */}
      <div className="card-premium flex items-center gap-3 px-4 py-3">
        <svg className="w-4 h-4 text-ink-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search articles, tags, or topics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border',
            selectedCategory === 'all'
              ? 'bg-ink-900 text-white border-ink-900'
              : 'bg-surface-50 text-ink-500 border-surface-200 hover:border-ink-300'
          )}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border',
              selectedCategory === cat.id
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-surface-50 text-ink-500 border-surface-200 hover:border-ink-300'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Article Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(article => (
            <Link
              key={article.id}
              href={`/knowledge/${article.id}`}
              className="card-premium hover:shadow-card-hover transition-all p-5 group flex flex-col"
            >
              {/* Category Badge */}
              <div className="mb-3">
                <span className={cn(
                  'inline-block px-2 py-1 rounded text-[10px] font-medium',
                  knowledgeCategoryColor(article.category)
                )}>
                  {knowledgeCategoryLabel(article.category)}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-ink-900 text-[15px] mb-2 group-hover:text-accent-600 transition-colors leading-snug">
                {article.title}
              </h3>

              {/* Summary */}
              <p className="text-[13px] text-ink-500 mb-4 flex-1 line-clamp-2">
                {article.summary}
              </p>

              {/* Tags */}
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {article.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="bg-surface-100 text-ink-400 text-[10px] rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="text-ink-300 text-[10px]">+{article.tags.length - 3}</span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-[11px] text-ink-300 border-t border-surface-100 pt-3 mt-auto">
                <div className="flex items-center gap-3">
                  {article.related_stage !== undefined && (
                    <span className="text-ink-400">Stage {article.related_stage}</span>
                  )}
                  {article.related_sector && (
                    <span className="text-ink-400">{article.related_sector}</span>
                  )}
                </div>
                <span className="text-ink-300 font-mono">{formatDate(article.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message="No articles match your search. Try different keywords or filters." />
      )}
    </div>
  )
}
