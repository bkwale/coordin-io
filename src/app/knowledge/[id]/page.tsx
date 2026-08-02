'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'

interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category: string
  updatedAt: string
}

export default function KnowledgeArticlePage() {
  const { id } = useParams<{ id: string }>()
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/knowledge/${id}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Article not found')
          } else {
            setError('Failed to load article')
          }
          return
        }
        const data = await res.json()
        setArticle(data.data?.article || data.article || null)
      } catch {
        setError('Unable to load article')
      } finally {
        setLoading(false)
      }
    }
    fetchArticle()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="space-y-6">
        <Link href="/knowledge" className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-600">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </Link>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">{error || 'Article not found'}</p>
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
        <p className="text-[12px] text-ink-400 mt-1">
          Last updated {new Date(article.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-6">
        <div className="prose prose-sm max-w-none text-ink-700" dangerouslySetInnerHTML={{ __html: article.content }} />
      </div>
    </div>
  )
}
