'use client'

import { useState } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { TabBar } from '@/components/TabBar'
import { getProjectNumberTemplates, getQuoteNumberTemplates, getDrawingIssueTemplates } from '@/lib/mock-data'
import { cn, numberingPreview } from '@/lib/utils'
import type { ProjectNumberTemplate, QuoteNumberTemplate, DrawingIssueTemplate } from '@/lib/types'

const tabs = [
  { key: 'projects', label: 'Project Numbers' },
  { key: 'quotes', label: 'Quote Numbers' },
  { key: 'drawings', label: 'Drawing Issues' },
]

const FORMAT_REFERENCE = [
  { code: '{YEAR}', example: '2026', description: 'Full year' },
  { code: '{YY}', example: '26', description: 'Short year (last 2 digits)' },
  { code: '{SEQ:N}', example: '001', description: 'Sequential number padded to N digits' },
  { code: '{PROJECT}', example: 'MA-2026-001', description: 'Project reference' },
  { code: '{OFFICE}', example: 'LON', description: 'Office code' },
]

export default function NumberingTemplatesPage() {
  const [activeTab, setActiveTab] = useState('projects')
  const projectTemplates = getProjectNumberTemplates()
  const quoteTemplates = getQuoteNumberTemplates()
  const drawingTemplates = getDrawingIssueTemplates()

  return (
    <div className="min-h-screen bg-surface-50 animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Breadcrumb items={[{ label: 'Settings' }, { label: 'Numbering & Templates' }]} />
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] text-ink-900 mt-4 mb-1">Numbering & Templates</h1>
          <p className="text-slate-600">
            Configure automatic numbering for projects, quotes and drawing issues
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <TabBar tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Project Numbers Tab */}
        {activeTab === 'projects' && (
          <ProjectNumbersTab templates={projectTemplates} />
        )}

        {/* Quote Numbers Tab */}
        {activeTab === 'quotes' && (
          <QuoteNumbersTab templates={quoteTemplates} />
        )}

        {/* Drawing Issues Tab */}
        {activeTab === 'drawings' && (
          <DrawingIssuesTab templates={drawingTemplates} />
        )}

        {/* Format Reference Card - Shown at bottom of all tabs */}
        <FormatReferenceCard />
      </div>
    </div>
  )
}

function ProjectNumbersTab({ templates }: { templates: ProjectNumberTemplate[] }) {
  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Project Number Templates</h2>
          <p className="text-sm text-slate-600 mt-1">Manage automatic numbering for new projects</p>
        </div>
        <button
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm',
            'bg-slate-900 text-white hover:bg-slate-800',
            'transition-colors'
          )}
        >
          Add Template
        </button>
      </div>

      {/* Template Cards */}
      <div className="space-y-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            name={template.template_name}
            scope={getProjectScope(template)}
            format={template.format_string}
            preview={numberingPreview(template.format_string)}
            isActive={template.active_flag}
          />
        ))}
      </div>
    </div>
  )
}

function QuoteNumbersTab({ templates }: { templates: QuoteNumberTemplate[] }) {
  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Quote Number Templates</h2>
          <p className="text-sm text-slate-600 mt-1">Manage automatic numbering for quotes</p>
        </div>
        <button
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm',
            'bg-slate-900 text-white hover:bg-slate-800',
            'transition-colors'
          )}
        >
          Add Template
        </button>
      </div>

      {/* Template Cards */}
      <div className="space-y-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            name={template.template_name}
            scope="All quotation types"
            format={template.format_string}
            preview={numberingPreview(template.format_string)}
            isActive={template.active_flag}
          />
        ))}
      </div>
    </div>
  )
}

function DrawingIssuesTab({ templates }: { templates: DrawingIssueTemplate[] }) {
  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Drawing Issue Templates</h2>
          <p className="text-sm text-slate-600 mt-1">Manage automatic numbering for drawing issues and revisions</p>
        </div>
        <button
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm',
            'bg-slate-900 text-white hover:bg-slate-800',
            'transition-colors'
          )}
        >
          Add Template
        </button>
      </div>

      {/* Template Cards */}
      <div className="space-y-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            name={`${template.issue_type} Issues`}
            scope={template.issue_type}
            format={template.format_string}
            preview={numberingPreview(template.format_string)}
            isActive={template.active_flag}
          />
        ))}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  name: string
  scope: string
  format: string
  preview: string
  isActive: boolean
}

function TemplateCard({ name, scope, format, preview, isActive }: TemplateCardProps) {
  return (
    <div className="card-premium p-5">
      {/* Top row: Name and Active Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-600 mt-1">{scope}</p>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-3',
            isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          )}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Format String */}
      <div className="mb-3">
        <label className="text-xs font-medium text-slate-600 block mb-1.5">Format String</label>
        <div className="font-mono text-[13px] bg-slate-100 px-3 py-1.5 rounded text-slate-900">
          {format}
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-600 block mb-1.5">Live Preview</label>
        <div className="text-base font-medium text-slate-900">
          {preview}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <button className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
          Edit
        </button>
        <button className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors">
          Delete
        </button>
      </div>
    </div>
  )
}

function FormatReferenceCard() {
  return (
    <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
      <h3 className="font-display text-lg text-blue-900 mb-4">Format String Reference</h3>
      <p className="text-sm text-blue-800 mb-6">
        Use these placeholders in your format strings to generate automatic numbering:
      </p>

      <div className="grid grid-cols-2 gap-6">
        {FORMAT_REFERENCE.map((item) => (
          <div key={item.code}>
            <div className="flex items-baseline gap-2 mb-2">
              <code className="font-mono font-semibold text-blue-900 text-sm bg-blue-100 px-2 py-1 rounded">
                {item.code}
              </code>
              <span className="text-xs text-blue-700">→ {item.example}</span>
            </div>
            <p className="text-sm text-blue-800">{item.description}</p>
          </div>
        ))}
      </div>

      {/* Example section */}
      <div className="mt-6 pt-6 border-t border-blue-200">
        <h4 className="font-medium text-blue-900 mb-3 text-sm">Common Examples</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <code className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded block mb-1">
              MA-{'{YEAR}-{SEQ:3}'}
            </code>
            <span className="text-blue-800">e.g. MA-2026-001</span>
          </div>
          <div>
            <code className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded block mb-1">
              {'{PROJECT}-PL-{SEQ:2}'}
            </code>
            <span className="text-blue-800">e.g. MA-2026-001-PL-01</span>
          </div>
          <div>
            <code className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded block mb-1">
              MA-Q-{'{YEAR}-{SEQ:3}'}
            </code>
            <span className="text-blue-800">e.g. MA-Q-2026-001</span>
          </div>
          <div>
            <code className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded block mb-1">
              {'{OFFICE}-{YY}-{SEQ:4}'}
            </code>
            <span className="text-blue-800">e.g. LON-26-0042</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getProjectScope(template: ProjectNumberTemplate): string {
  if (template.project_type && template.office_id) {
    return `${template.project_type.charAt(0).toUpperCase() + template.project_type.slice(1)} • ${template.office_id.toUpperCase()}`
  }
  if (template.project_type) {
    return template.project_type.charAt(0).toUpperCase() + template.project_type.slice(1)
  }
  if (template.office_id) {
    return template.office_id.toUpperCase()
  }
  return 'All project types & offices'
}
