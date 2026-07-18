'use client'

import { useState } from 'react'
import {
  BookOpen, Search, Plus, ChevronDown, ChevronUp,
  Tag, X, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

/* ── Types ────────────────────────────────────────────────── */

type TopicCategory = 'Standards' | 'Contracts' | 'Regulations' | 'Process' | 'Custom'

interface KnowledgeTopic {
  id: string
  title: string
  category: TopicCategory
  content: string
  tags: string[]
}

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

/* ── Default content ──────────────────────────────────────── */

const DEFAULT_TOPICS: KnowledgeTopic[] = [
  {
    id: 'riba-plan-of-work',
    title: 'RIBA Plan of Work Stages',
    category: 'Standards',
    content: `The RIBA Plan of Work is the definitive UK model for the building design and construction process. It organises the process of briefing, designing, constructing, and operating building projects into eight stages (0–7), providing a shared framework for all project participants.

Stage 0 (Strategic Definition) establishes the need for the project and validates the Business Case. Stage 1 (Preparation & Briefing) develops the Project Brief and undertakes Feasibility Studies. Stage 2 (Concept Design) prepares the Concept Design including outline proposals for structural design, building services, and preliminary Cost Information. Stage 3 (Spatial Coordination) prepares the Spatial Coordination design and updated Cost Information.

Stage 4 (Technical Design) prepares the Technical Design in accordance with the Design Responsibility Matrix. Stage 5 (Manufacturing & Construction) covers offsite manufacturing and onsite construction in accordance with the Construction Programme. Stage 6 (Handover) covers handover of the building and conclusion of the Building Contract. Stage 7 (Use) covers the ongoing use of the building and post-occupancy evaluation.`,
    tags: ['RIBA', 'Plan of Work', 'design stages', 'project stages', 'Stage 0-7'],
  },
  {
    id: 'building-regulations',
    title: 'Building Regulations Overview',
    category: 'Regulations',
    content: `The Building Regulations 2010 (as amended) set minimum standards for the design, construction, and alteration of buildings in England and Wales. They ensure the health, safety, welfare, convenience, and energy efficiency of building occupants and others who may be affected by buildings or matters connected with buildings.

Compliance is demonstrated through Approved Documents (Parts A–S), each covering specific aspects: Part A (Structure), Part B (Fire Safety), Part C (Site Preparation & Resistance to Contaminants and Moisture), Part D (Toxic Substances), Part E (Resistance to Sound), Part F (Ventilation), Part G (Sanitation, Hot Water Safety & Water Efficiency), Part H (Drainage & Waste Disposal), Part J (Heat Producing Appliances), Part K (Protection from Falling), Part L (Conservation of Fuel & Power), Part M (Access to & Use of Buildings), Part O (Overheating), Part R (Electronic Communications), and Part S (Infrastructure for Charging Electric Vehicles).

Submission can be made via Full Plans application, Building Notice, or Initial Notice (through an Approved Inspector). The Building Safety Act 2022 introduced significant changes including the role of the Building Safety Regulator for higher-risk buildings.`,
    tags: ['Building Regulations', 'Approved Documents', 'compliance', 'Part A-S', 'Building Safety Act'],
  },
  {
    id: 'cdm-regulations',
    title: 'CDM Regulations Summary',
    category: 'Regulations',
    content: `The Construction (Design and Management) Regulations 2015 (CDM 2015) are the main set of regulations for managing the health, safety, and welfare of construction projects in Great Britain. They apply to all construction work and aim to ensure that health and safety issues are properly considered during a project’s development.

CDM 2015 defines key duty holders: the Client (who commissions the work), the Principal Designer (who plans, manages, monitors, and coordinates health and safety in the pre-construction phase), the Principal Contractor (who plans, manages, monitors, and coordinates health and safety in the construction phase), Designers (who prepare or modify designs), and Contractors (who carry out or manage construction work). For domestic clients, their duties normally pass to the contractor or principal contractor.

The regulations require the production of key documents including the Pre-Construction Information (PCI), the Construction Phase Plan (CPP), and the Health & Safety File. The Principal Designer must ensure designers comply with their duties, coordinate design work, and prepare the Health & Safety File. All designers must eliminate, reduce, or control foreseeable risks through design decisions.`,
    tags: ['CDM 2015', 'health and safety', 'Principal Designer', 'Principal Contractor', 'construction safety'],
  },
  {
    id: 'bim-level-2',
    title: 'BIM Level 2 Requirements',
    category: 'Standards',
    content: `BIM Level 2 (now referred to as the UK BIM Framework aligned to ISO 19650) requires all members of a project team to use 3D BIM models in a collaborative but not necessarily fully integrated manner. Each discipline creates its own 3D model, and these are combined into a federated model for coordination and clash detection purposes.

The key standards underpinning the UK BIM Framework include ISO 19650 Parts 1 & 2 (Organisation and digitisation of information about buildings and civil engineering works), BS EN ISO 19650-3 (Operational phase), PAS 1192-5 (Security-minded approach), and BS EN ISO 19650-5. The framework requires an Exchange Information Requirements (EIR) document from the client, a BIM Execution Plan (BEP) from the supply chain, and a Common Data Environment (CDE) for information management.

Compliance with the UK BIM Framework is mandatory for centrally procured UK government projects. It emphasises the use of a Common Data Environment with clear status codes (Work in Progress, Shared, Published, Archived) and defined information exchanges at key project stages. Level of Information Need (formerly LOD/LOI) defines the detail required at each stage.`,
    tags: ['BIM', 'ISO 19650', 'Level 2', 'Common Data Environment', 'digital construction'],
  },
  {
    id: 'jct-contracts',
    title: 'JCT Contract Types Overview',
    category: 'Contracts',
    content: `The Joint Contracts Tribunal (JCT) publishes a suite of standard form building contracts widely used in the UK construction industry. The main contract families cover different procurement routes, project sizes, and complexity levels, providing a balanced allocation of risk between parties.

The Standard Building Contract (SBC) is the most comprehensive form, suitable for large or complex projects where detailed contract provisions are needed. It comes in three variants: With Quantities (SBC/Q), Without Quantities (SBC/XQ), and With Approximate Quantities (SBC/AQ). The Intermediate Building Contract (IC) suits medium-value projects of reasonable complexity. The Minor Works Building Contract (MW) is designed for straightforward, smaller-value projects. The Design and Build Contract (DB) is used where the contractor takes on design responsibility.

Other forms include the Management Building Contract (MC), Construction Management Contract (CM), and the Pre-Construction Services Agreement (PCSA). JCT also publishes sub-contract forms, framework agreements, and homeowner contracts. Each suite is periodically updated, with JCT 2024 being the latest edition, incorporating changes reflecting current legislation, case law, and industry practice.`,
    tags: ['JCT', 'contracts', 'SBC', 'Minor Works', 'Design and Build', 'procurement'],
  },
  {
    id: 'nec-contracts',
    title: 'NEC Contract Suite',
    category: 'Contracts',
    content: `The NEC (New Engineering Contract) suite, now in its fourth edition (NEC4), is a family of contracts that facilitates the implementation of sound project management principles and practices. NEC contracts are endorsed by the UK Government and widely used internationally, valued for their clarity, flexibility, and emphasis on collaborative working.

NEC4 contracts use plain language and a modular structure with main Option clauses (A–F) defining the pricing mechanism: Option A (Priced contract with activity schedule), Option B (Priced contract with bill of quantities), Option C (Target contract with activity schedule), Option D (Target contract with bill of quantities), Option E (Cost reimbursable contract), and Option F (Management contract). Secondary Option clauses (X and Y) allow further customisation.

Key features of NEC contracts include the Early Warning mechanism (requiring parties to notify each other of potential problems), Compensation Events (a structured approach to managing changes), and the requirement for a project programme. The suite includes the Engineering and Construction Contract (ECC), Professional Service Contract (PSC), Term Service Contract (TSC), Supply Contract (SC), and Framework Contract (FC). NEC4 introduced Alliance Contract (ALC) for integrated team working.`,
    tags: ['NEC', 'NEC4', 'ECC', 'compensation events', 'early warning', 'collaborative contracts'],
  },
  {
    id: 'health-safety-construction',
    title: 'Health & Safety on Construction Sites',
    category: 'Regulations',
    content: `Health and safety management on construction sites in the UK is governed by a comprehensive regulatory framework headed by the Health and Safety at Work etc. Act 1974 (HSWA) and supplemented by numerous specific regulations. The construction sector historically has one of the highest rates of fatal and major injuries, making robust H&S management essential.

Key regulations beyond CDM 2015 include the Management of Health and Safety at Work Regulations 1999 (risk assessments), Work at Height Regulations 2005, Control of Substances Hazardous to Health Regulations 2002 (COSHH), Lifting Operations and Lifting Equipment Regulations 1998 (LOLER), Provision and Use of Work Equipment Regulations 1998 (PUWER), and the Personal Protective Equipment at Work Regulations 1992. The Construction Phase Plan must address site-specific risks.

Common site hazards include working at height (the largest cause of fatalities), moving vehicles and plant, collapse of excavations, falling materials, exposure to hazardous substances (including asbestos), noise, manual handling, and electrical risks. Designers have a duty under CDM 2015 to design out risks where reasonably practicable, and to provide information about remaining risks through the Design Risk Register.`,
    tags: ['health and safety', 'HSWA', 'COSHH', 'work at height', 'PPE', 'site safety'],
  },
  {
    id: 'fire-safety-compliance',
    title: 'Fire Safety Compliance',
    category: 'Regulations',
    content: `Fire safety in buildings is regulated through multiple legislative instruments in England and Wales, primarily the Building Regulations 2010 (Approved Document B — Fire Safety) for new construction and material alterations, and the Regulatory Reform (Fire Safety) Order 2005 (FSO) for occupied buildings. Following the Grenfell Tower tragedy in 2017, significant reforms have been introduced through the Fire Safety Act 2021 and the Building Safety Act 2022.

Approved Document B covers five key areas: B1 (Means of Warning and Escape), B2 (Internal Fire Spread — Linings), B3 (Internal Fire Spread — Structure), B4 (External Fire Spread), and B5 (Access and Facilities for the Fire Service). Design considerations include compartmentation strategy, fire resistance periods, means of escape distances, fire detection and alarm systems, emergency lighting, sprinkler systems, smoke ventilation, and external wall construction including cladding materials.

For higher-risk buildings (those over 18 metres or 7 storeys), the Building Safety Act 2022 introduced the Gateway process: Gateway 1 (Planning), Gateway 2 (Before Construction Begins), and Gateway 3 (Before Occupation). The Building Safety Regulator (BSR) must approve the building control process at each gateway. A Fire and Emergency File must be maintained and updated throughout the building’s life.`,
    tags: ['fire safety', 'Approved Document B', 'Building Safety Act', 'Grenfell', 'compartmentation', 'Gateway process'],
  },
  {
    id: 'sustainability-breeam',
    title: 'Sustainability & BREEAM Ratings',
    category: 'Standards',
    content: `BREEAM (Building Research Establishment Environmental Assessment Method) is the world’s leading sustainability assessment method for masterplanning projects, infrastructure, and buildings. Established in 1990, it sets the standard for best practice in sustainable building design, construction, and operation, influencing planning policy and building regulations across the UK and internationally.

BREEAM assesses buildings across ten categories: Management, Health & Wellbeing, Energy, Transport, Water, Materials, Waste, Land Use & Ecology, Pollution, and Innovation. Each category contains individual assessment issues with credits available. The overall score determines the rating: Pass (30%+), Good (45%+), Very Good (55%+), Excellent (70%+), and Outstanding (85%+). BREEAM New Construction is the most common scheme; other schemes include BREEAM Refurbishment & Fit-Out, BREEAM In-Use, and BREEAM Communities.

Beyond BREEAM, architects and designers should be aware of other sustainability frameworks including LEED, Passivhaus, WELL Building Standard, and the RIBA 2030 Climate Challenge. Part L of the Building Regulations (Conservation of Fuel & Power) sets minimum energy performance requirements, and the Future Homes Standard (expected 2025) will mandate significantly higher energy efficiency standards for new dwellings.`,
    tags: ['BREEAM', 'sustainability', 'green building', 'energy efficiency', 'Part L', 'RIBA 2030'],
  },
  {
    id: 'planning-permission',
    title: 'Planning Permission Process',
    category: 'Process',
    content: `The planning permission process in England is governed by the Town and Country Planning Act 1990 and administered by Local Planning Authorities (LPAs). Most forms of development — defined as building operations, engineering operations, material change of use, or mining operations — require planning permission unless they fall within Permitted Development rights.

The main application types are: Full Planning Permission (detailed proposals), Outline Planning Permission (establishes the principle of development with Reserved Matters to follow), Reserved Matters (details following outline consent covering access, appearance, landscaping, layout, and scale), Listed Building Consent (for works affecting listed buildings), Conservation Area Consent, and Advertisement Consent. Pre-application advice from the LPA is strongly recommended for significant proposals.

The determination period is 8 weeks for minor applications and 13 weeks for major applications (or 16 weeks if requiring Environmental Impact Assessment). The planning process includes validation, consultation (neighbours, parish councils, statutory consultees), case officer assessment against the Local Plan and the National Planning Policy Framework (NPPF), and decision by delegated authority or planning committee. Decisions can be appealed to the Planning Inspectorate. Section 106 agreements and the Community Infrastructure Levy (CIL) may apply to larger developments.`,
    tags: ['planning permission', 'NPPF', 'Local Plan', 'Listed Building', 'Section 106', 'development control'],
  },
]

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
