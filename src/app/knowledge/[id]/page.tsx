'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { findTopicById } from '@/lib/knowledge-data'

export default function KnowledgeArticlePage() {
  const { id } = useParams<{ id: string }>()
  const article = useMemo(() => findTopicById(id), [id])

  if (!article) {
    return (
      <div className="space-y-6">
        <Link href="/knowledge" className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-600">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </Link>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">Article not found</p>
          <p className="text-[12px] text-ink-400 mt-2">This article may have been removed or the link may be incorrect.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/knowledge" className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-600">
        <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
      </Link>
      <div>
        <span className="text-[11px] font-medium text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full">
          {article.category}
        </span>
        <h1 className="text-[22px] font-semibold text-ink-900 mt-2">{article.title}</h1>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-6">
        <div className="prose prose-sm max-w-none text-ink-700 whitespace-pre-line">
          {article.content}
        </div>
      </div>
    </div>
  )
}
