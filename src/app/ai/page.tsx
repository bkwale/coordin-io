'use client'

import Link from 'next/link'
import { FileText, FolderOpen } from 'lucide-react'
import { FeatureGate } from '@/components/FeatureGate'

/**
 * AI Reader — shown only when the organisation has the AI Reader module on (Settings → Modules).
 * Reading happens inside a project (Regulatory page) so every value is confirmed against its source.
 * A cross-project hub (awaiting confirmation / failed / applied) comes when more practices use the reader.
 */
export default function AIReaderPage() {
  return (
    <FeatureGate feature="ai_reader">
      <div className="max-w-2xl">
        <h1 className="text-[22px] font-semibold text-ink-900">AI Reader</h1>
        <p className="text-[13px] text-ink-400 mt-1">Turn planning documents into your project’s regulatory checklist. You confirm every value against the page it came from.</p>

        <div className="mt-6 rounded-xl border border-surface-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-ink-500" /></div>
            <div className="text-[13px] text-ink-600 leading-relaxed">
              <div className="font-medium text-ink-900 mb-1">What it reads</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Estonian planning conditions (projekteerimistingimused)</li>
                <li>English planning decision notices — conditions, deadlines, refusal reasons</li>
                <li>Client briefs</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-surface-200 bg-white p-5">
          <div className="font-medium text-[13px] text-ink-900 mb-1">How to use it</div>
          <ol className="list-decimal pl-4 text-[13px] text-ink-600 space-y-0.5">
            <li>Open a project and go to <b>Compliance → Regulatory</b>.</li>
            <li>Choose <b>Pre-fill from a document</b> and drop in the PDF.</li>
            <li>Check each value and condition, then press <b>Generate checklist</b>.</li>
          </ol>
          <Link href="/projects" className="inline-flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-accent-500 text-white text-[12px] font-medium">
            <FolderOpen className="w-4 h-4" /> Go to projects
          </Link>
        </div>
      </div>
    </FeatureGate>
  )
}
