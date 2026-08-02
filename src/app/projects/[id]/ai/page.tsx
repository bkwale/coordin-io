'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Brain, Shield, FileText, CalendarClock, Ruler,
  ClipboardCheck, Sparkles, Send, Lock, Zap,
  BarChart3, Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── AI Feature Cards ──────────────────────────────────── */

interface AIFeature {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const AI_FEATURES: AIFeature[] = [
  {
    id: 'risk-analysis',
    title: 'Risk Analysis',
    description: 'Automatically scan project data to identify emerging risks, flag overdue items, and predict potential delays based on historical patterns.',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    id: 'document-summary',
    title: 'Document Summary',
    description: 'Generate concise summaries of lengthy specifications, reports, and meeting minutes. Extract key decisions and action items automatically.',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'schedule-optimisation',
    title: 'Schedule Optimisation',
    description: 'Analyse task dependencies and resource allocation to suggest optimal sequencing. Identify critical path bottlenecks and propose re-scheduling.',
    icon: <CalendarClock className="w-5 h-5" />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    id: 'design-review',
    title: 'Design Review Support',
    description: 'Cross-reference drawings against specifications and building regulations. Flag potential clashes, missing details, and compliance gaps.',
    icon: <Ruler className="w-5 h-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'compliance-check',
    title: 'Compliance Check',
    description: 'Verify project documentation against CDM, Building Safety Act, Part L, and BRPD requirements. Generate compliance gap reports with recommended actions.',
    icon: <ClipboardCheck className="w-5 h-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    id: 'cost-forecasting',
    title: 'Cost Forecasting',
    description: 'Predict final account outcomes based on current spend trajectory, approved variations, and historical project data. Early warning on budget overruns.',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    id: 'lessons-learned',
    title: 'Lessons Learned',
    description: 'Surface relevant lessons from past projects when similar issues arise. Build an institutional knowledge base that improves with every project.',
    icon: <Lightbulb className="w-5 h-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'smart-notifications',
    title: 'Smart Notifications',
    description: 'Prioritise and consolidate notifications based on urgency and your role. Reduce noise while ensuring critical items get immediate attention.',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
]

/* ── Page Component ────────────────────────────────────── */

export default function AIPage() {
  const params = useParams()
  const projectId = params.id as string
  const [query, setQuery] = useState('')

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200'
          )}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[18px] font-bold text-ink-900">AI Assistant</h1>
            <p className="text-[12px] text-ink-400 mt-0.5">
              Intelligent project insights powered by machine learning
            </p>
          </div>
          <span className={cn(
            'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider',
            'bg-gradient-to-r from-violet-50 to-indigo-50 text-violet-700 border border-violet-200'
          )}>
            <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
            Coming in Phase 2
          </span>
        </div>

        {/* ── Overview Banner ─────────────────────────────── */}
        <div className={cn(
          'bg-white rounded-2xl border border-surface-200 shadow-card p-5',
          'bg-gradient-to-br from-white via-white to-violet-50/30'
        )}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-ink-900">AI features are under development</h2>
              <p className="text-[11px] text-ink-400 mt-1 leading-relaxed max-w-2xl">
                The AI Assistant will integrate directly with your project data to provide intelligent
                analysis, automated compliance checking, and predictive insights. All AI features will
                process data securely within your organisation&apos;s environment. No project data is
                shared externally.
              </p>
            </div>
          </div>
        </div>

        {/* ── Feature Cards Grid ──────────────────────────── */}
        <div>
          <h2 className="text-[13px] font-semibold text-ink-700 mb-3">Planned Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AI_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className={cn(
                  'bg-white rounded-2xl border border-surface-200 shadow-card p-4',
                  'hover:border-surface-300 transition-all group'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    feature.bgColor, feature.color,
                    'group-hover:scale-105 transition-transform'
                  )}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-ink-900">{feature.title}</h3>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-surface-100 text-ink-300">
                        Phase 2
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-1 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat Input Preview ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-4">
          <label className="text-[11px] font-medium text-ink-500 mb-2 block">
            Ask about this project
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. What are the top risks on this project?"
                disabled
                className={cn(
                  'w-full px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50',
                  'text-[12px] text-ink-300 placeholder:text-ink-200',
                  'cursor-not-allowed'
                )}
              />
            </div>
            <button
              disabled
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-surface-100 text-ink-300 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-ink-300 mt-2">
            Natural language queries will be available when AI features launch.
          </p>
        </div>

        {/* ── Roadmap Timeline ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-4">
          <h2 className="text-[13px] font-semibold text-ink-700 mb-3">Development Roadmap</h2>
          <div className="space-y-3">
            {[
              { phase: 'Phase 1', label: 'Core Platform', status: 'complete' as const, desc: 'Project management, documents, commercial, compliance' },
              { phase: 'Phase 2', label: 'AI Integration', status: 'in-progress' as const, desc: 'Risk analysis, document summaries, compliance checking' },
              { phase: 'Phase 3', label: 'Predictive Analytics', status: 'planned' as const, desc: 'Cost forecasting, schedule optimisation, smart notifications' },
            ].map((item) => (
              <div key={item.phase} className="flex items-start gap-3">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                  item.status === 'complete' ? 'bg-emerald-500' :
                  item.status === 'in-progress' ? 'bg-amber-500 animate-pulse' :
                  'bg-surface-300'
                )} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-ink-900">{item.phase}</span>
                    <span className="text-[11px] text-ink-500">{item.label}</span>
                    {item.status === 'complete' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600">LIVE</span>
                    )}
                    {item.status === 'in-progress' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">IN PROGRESS</span>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
