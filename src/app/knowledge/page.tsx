'use client'

import { useState } from 'react'
import {
  BookOpen, Search, Plus, ChevronDown, ChevronUp,
  Tag, X, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { DEFAULT_TOPICS, type TopicCategory, type KnowledgeTopic } from '@/lib/knowledge-data'

/* ── Category colours ─────────────────────────────────────── */

const CATEGORY_COLORS: Record<TopicCategory, { bg: string; text: string }> = {
  Standards:   { bg: 'bg-violet-50',  text: 'text-violet-600' },
  Contracts:   { bg: 'bg-cyan-50',    text: 'text-cyan-600' },
  Regulations: { bg: 'bg-red-50',     text: 'text-red-600' },
  Process:     { bg: 'bg-amber-50',   text: 'text-amber-600' },
  Custom:      { bg: 'bg-emerald-50', text: 'text-emerald-600' },
}

const CATEGORY_FILTERS: (TopicCategory | 'All')[] = [
  'All', 'Standards', 'Contracts', 'Regulations', 'Process', 'Custom',
]

/* Data imported from @/lib/knowledge-data */

/* ── Page ─────────────────────────────────────────────────── */

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory | 'All'>('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [topics, setTopics] = useState<KnowledgeTopic[]>(DEFAULT_TOPICS)

  // Add-topic form state
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState<TopicCategory>('Custom')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')

  /* ── Filter logic ──────────────────────────────────── */

  const searchLower = search.toLowerCase()
  const filtered = topics.filter((t) => {
    const matchesSearch =
      search === '' ||
      t.title.toLowerCase().includes(searchLower) ||
      t.content.toLowerCase().includes(searchLower) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  /* ── Expand / collapse ─────────────────────────────── */

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  /* ── Add topic ─────────────────────────────────────── */

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formContent.trim()) return

    const newTopic: KnowledgeTopic = {
      id: `custom-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      content: formContent.trim(),
      tags: formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    setTopics((prev) => [newTopic, ...prev])
    setShowForm(false)
    setFormTitle('')
    setFormCategory('Custom')
    setFormContent('')
    setFormTags('')
    setExpandedIds((prev) => new Set(prev).add(newTopic.id))
  }

  const cancelForm = () => {
    setShowForm(false)
    setFormTitle('')
    setFormCategory('Custom')
    setFormContent('')
    setFormTags('')
  }

  /* ── Category counts ───────────────────────────────── */

  const categoryCounts = topics.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Knowledge Base' },
        ]}
      />

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Knowledge Base</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {filtered.length} topic{filtered.length !== 1 ? 's' : ''}
            {search || selectedCategory !== 'All'
              ? ` (${topics.length} total)`
              : ''}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Topic
          </button>
        )}
      </div>

      {/* ── Add topic form ──────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleAddTopic}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New topic</h3>
            <button
              type="button"
              onClick={cancelForm}
              className="text-ink-400 hover:text-ink-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="kb-title"
                className="block text-[11px] font-medium text-ink-500 mb-1"
              >
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="kb-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Acoustic Design Standards"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={200}
                required
              />
            </div>
            <div>
              <label
                htmlFor="kb-category"
                className="block text-[11px] font-medium text-ink-500 mb-1"
              >
                Category
              </label>
              <select
                id="kb-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as TopicCategory)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                <option value="Standards">Standards</option>
                <option value="Contracts">Contracts</option>
                <option value="Regulations">Regulations</option>
                <option value="Process">Process</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="kb-content"
              className="block text-[11px] font-medium text-ink-500 mb-1"
            >
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              id="kb-content"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Write the topic content here..."
              rows={5}
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-y"
              required
            />
          </div>

          <div>
            <label
              htmlFor="kb-tags"
              className="block text-[11px] font-medium text-ink-500 mb-1"
            >
              Tags <span className="text-ink-300">(comma-separated)</span>
            </label>
            <input
              id="kb-tags"
              type="text"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="e.g. acoustics, Part E, sound insulation"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelForm}
              className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formTitle.trim() || !formContent.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                !formTitle.trim() || !formContent.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800'
              )}
            >
              Add topic
            </button>
          </div>
        </form>
      )}

      {/* ── Search ──────────────────────────────────── */}
      <div className="card-premium flex items-center gap-3 px-4 py-3">
        <Search className="w-4 h-4 text-ink-300 shrink-0" />
        <input
          type="text"
          placeholder="Search topics, content, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-ink-300 hover:text-ink-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Category filter chips ───────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORY_FILTERS.map((cat) => {
          const count =
            cat === 'All' ? topics.length : categoryCounts[cat] || 0
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                selectedCategory === cat
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
              )}
            >
              {cat}
              <span
                className={cn(
                  'ml-1',
                  selectedCategory === cat ? 'text-ink-300' : 'text-ink-400'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Topic cards ─────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <BookOpen className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">
            No topics found
          </p>
          <p className="text-[12px] text-ink-400 mt-1">
            {search || selectedCategory !== 'All'
              ? 'Try adjusting your search or clearing filters.'
              : 'Click "Add Topic" to create one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((topic) => {
            const isExpanded = expandedIds.has(topic.id)
            const colors = CATEGORY_COLORS[topic.category]

            return (
              <div
                key={topic.id}
                className="card-premium overflow-hidden"
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => toggleExpanded(topic.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left group"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      colors.bg
                    )}
                  >
                    <FileText className={cn('w-4 h-4', colors.text)} />
                  </div>

                  {/* Title + category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900 group-hover:text-accent-600 transition-colors truncate">
                      {topic.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full',
                          colors.bg,
                          colors.text
                        )}
                      >
                        {topic.category}
                      </span>
                      {topic.tags.length > 0 && (
                        <span className="text-[10px] text-ink-300 flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" />
                          {topic.tags.length} tag{topic.tags.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <div className="shrink-0 text-ink-300">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-ink-50 px-5 py-4 space-y-3">
                    {/* Content paragraphs */}
                    <div className="text-[13px] text-ink-600 leading-relaxed space-y-3">
                      {topic.content.split('\n\n').map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>

                    {/* Tags */}
                    {topic.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-ink-50">
                        {topic.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="bg-surface-100 text-ink-400 text-[10px] rounded-full px-2.5 py-0.5 flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
