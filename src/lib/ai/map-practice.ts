/**
 * Deterministic mapping: PracticeProfile → Coordin configuration.
 * No LLM here. Every decision carries a human-readable reason so the UI
 * can show "why" next to each module.
 */
import { FEATURE_REGISTRY, type FeatureKey } from '@/lib/feature-flags'
import type { PracticeProfile } from './schemas'

export interface ModuleDecision {
  key: FeatureKey | string
  label: string
  on: boolean
  reason: string
  evidence?: string
}

export interface PracticeMapping {
  headline: {
    name: string
    city: string | null
    country: string | null
    founded: number | null
    teamSize: number
    partners: string[]
    chartered: number
  }
  jurisdiction: 'EE' | 'GB' | 'ES' | 'OTHER'
  complianceFramework: 'ehitusseadustik' | 'brpd' | 'cte' | null
  stageConvention: 'estonian_4_stage' | 'riba' | null
  modules: ModuleDecision[]
  municipalityProfiles: string[]
  integrations: { key: string; label: string; reason: string }[]
  followUpQuestions: { id: string; question: string; options: string[] }[]
  warnings: string[]
}

const v = <T,>(f: { value: T | null } | undefined | null): T | null => (f ? f.value : null)

export function mapPracticeProfile(p: PracticeProfile): PracticeMapping {
  const country = (v(p.practice.country) || '').toUpperCase()
  const jurisdiction: PracticeMapping['jurisdiction'] = country === 'EE' ? 'EE' : country === 'GB' || country === 'UK' ? 'GB' : country === 'ES' ? 'ES' : 'OTHER'

  const people = p.people || []
  const partners = people.filter((x) => x.partner).map((x) => x.name)
  const chartered = people.filter((x) => x.chartered).length
  const teamSize = people.length
  const mix = v(p.projectMix) || { public: 0, residentialMulti: 0, residentialSingle: 0, commercial: 0, interiors: 0, masterplan: 0, heritage: 0, installations: 0 }
  const procurement = v(p.procurement) || []
  const munis = v(p.municipalities) || []
  const active = v(p.activeProjects) || []
  const heritage = Boolean(v(p.heritageWork)) || mix.heritage > 0
  const caps = (v(p.statedCapabilities) || []).map((s) => s.toLowerCase())
  const stage = (v(p.signals?.stageConvention) as PracticeMapping['stageConvention']) ?? (jurisdiction === 'EE' ? 'estonian_4_stage' : jurisdiction === 'GB' ? 'riba' : null)

  const modules: ModuleDecision[] = []
  const on = (key: string, label: string, reason: string, evidence?: string) => modules.push({ key, label, on: true, reason, evidence })
  const off = (key: string, label: string, reason: string) => modules.push({ key, label, on: false, reason })

  // Core — always
  on('projects', FEATURE_REGISTRY.projects.label, 'Core — every practice')
  on('documents', FEATURE_REGISTRY.documents.label, 'Core — drawing register and transmittals')
  on('approvals', FEATURE_REGISTRY.approvals.label, 'Core — sign-off routing')

  // Compliance
  const framework: PracticeMapping['complianceFramework'] = jurisdiction === 'EE' ? 'ehitusseadustik' : jurisdiction === 'GB' ? 'brpd' : jurisdiction === 'ES' ? 'cte' : null
  if (framework) on('compliance', FEATURE_REGISTRY.compliance.label, framework === 'ehitusseadustik' ? 'Ehitusseadustik framework — Estonian practice' : framework === 'brpd' ? 'BRPD / Building Safety Act — UK practice' : 'CTE framework — Spanish practice', munis.length ? `${munis.length} municipalities from project list` : undefined)
  else off('compliance', FEATURE_REGISTRY.compliance.label, 'Jurisdiction not identified — ask')

  if (heritage) on('heritage_conditions', 'Heritage conditions', 'Historic-environment work found', p.heritageWork?.source ? String(typeof p.heritageWork.source === 'string' ? p.heritageWork.source : p.heritageWork.source?.quote) : undefined)
  else off('heritage_conditions', 'Heritage conditions', 'No heritage work stated')

  // Procurement-driven
  if (procurement.includes('competition') || caps.some((c) => /konkurs|competition/.test(c))) on('tenders', 'Tenders & competitions', 'Competition-led practice')
  else off('tenders', 'Tenders & competitions', 'No competitions stated')

  if (procurement.includes('private_client') || mix.residentialSingle > 0) on('commercial', FEATURE_REGISTRY.commercial.label, 'Private clients — fee quotes needed', mix.residentialSingle ? `${mix.residentialSingle} private residences` : undefined)
  else off('commercial', FEATURE_REGISTRY.commercial.label, 'No private-client work stated — ask')

  if (procurement.includes('state_tender') || procurement.includes('municipal') || mix.public > 0) on('valuations', 'Valuations & variations', 'Public-sector projects run on valuations', mix.public ? `${mix.public} public buildings` : undefined)
  else off('valuations', 'Valuations & variations', 'No public-sector work stated')

  // Site
  if (active.length > 0) on('site', 'Site observations & snags', `${active.length} project${active.length > 1 ? 's' : ''} under construction`, active.map((a) => a.name).slice(0, 3).join(', '))
  else off('site', 'Site observations & snags', 'No projects marked under construction — ask')

  // People
  if (teamSize >= 3) {
    on('staffing', FEATURE_REGISTRY.staffing.label, `${teamSize}-person team`, people.some((x) => x.onLeave) ? 'one person on leave — leave module needed' : undefined)
    on('timesheets', FEATURE_REGISTRY.timesheets.label, 'Multiple concurrent projects')
    on('riba_tracking', 'Stage tracking & resource plan', stage === 'riba' ? 'RIBA stages' : 'Estonian 4-stage convention (eskiis → tööprojekt)')
  } else {
    off('staffing', FEATURE_REGISTRY.staffing.label, `${teamSize || 'Small'}-person studio — HR module not needed yet`)
    off('timesheets', FEATURE_REGISTRY.timesheets.label, 'Small studio — ask')
    on('riba_tracking', 'Stage tracking & resource plan', 'Stage tracking still useful for a small studio')
  }
  if (chartered > 0) on('cpd', 'CPD & competence', `${chartered} chartered architect${chartered > 1 ? 's' : ''} — EAL CPD requirements`)
  else off('cpd', 'CPD & competence', 'No chartered status shown — ask')

  // Finance
  on('invoicing', FEATURE_REGISTRY.invoicing.label, jurisdiction === 'EE' ? 'e-arve ready — Estonian e-invoicing' : 'Inbound + outbound invoicing')
  if (munis.length >= 5) on('expenses', 'Expenses', `Travel across ${munis.length} municipalities`)
  else off('expenses', 'Expenses', 'Few locations — ask')

  // Off by jurisdiction
  if (jurisdiction !== 'GB') off('brpd', 'BRPD (UK Building Safety Act)', 'No UK work')
  if (jurisdiction === 'EE') off('multi_currency', 'Multi-currency', 'EUR only')

  const integrations: PracticeMapping['integrations'] = []
  if (jurisdiction === 'EE') integrations.push({ key: 'merit_aktiva', label: 'Merit Aktiva', reason: 'Estonian SME default accounting' })
  if (jurisdiction === 'GB') integrations.push({ key: 'xero', label: 'Xero', reason: 'UK practice default' })
  integrations.push({ key: 'microsoft365', label: 'Microsoft 365', reason: 'Outlook + SharePoint' })
  if (jurisdiction === 'EE') integrations.push({ key: 'ehitisregister', label: 'Ehitisregister', reason: 'Import project history by registry code' })

  const followUpQuestions: PracticeMapping['followUpQuestions'] = [
    { id: 'fee_approver', question: partners.length ? `Who signs off fee quotes — any partner, or ${partners[0]} only?` : 'Who signs off fee quotes?', options: partners.length ? ['Any partner', `${partners[0]} only`, 'Partners + finance'] : ['Owner', 'Owner + finance'] },
    { id: 'timesheet_cadence', question: 'Timesheets weekly or daily, and who approves?', options: ['Weekly, partner approves', 'Daily, project lead approves', 'We don’t do timesheets'] },
    { id: 'accounting', question: 'Which accounting software?', options: jurisdiction === 'EE' ? ['Merit Aktiva', 'Directo', 'Xero', 'Other'] : ['Xero', 'QuickBooks', 'Sage', 'Other'] },
    { id: 'files', question: 'Where do project files live?', options: ['SharePoint / OneDrive', 'Google Drive', 'Local server', 'Dropbox'] },
  ]
  if (jurisdiction === 'EE') followUpQuestions.push({ id: 'ehr_import', question: 'Import your project history from Ehitisregister? (needs your registry code)', options: ['Yes', 'Not now'] })
  if (!munis.length) followUpQuestions.unshift({ id: 'municipalities', question: 'Which municipalities do you work in most?', options: ['Tallinn', 'Tartu', 'Pärnu', 'Across Estonia'] })
  if (!active.length) followUpQuestions.unshift({ id: 'active', question: 'Any projects on site right now?', options: ['Yes, 1–2', 'Yes, 3+', 'None at the moment'] })

  const warnings: string[] = []
  if (!v(p.practice.legalName)) warnings.push('Legal name not found on site')
  if (!teamSize) warnings.push('No team page found — people list empty')
  if (munis.length === 0 && jurisdiction === 'EE') warnings.push('No locations in project titles — municipalities unknown')

  return {
    headline: {
      name: v(p.practice.tradingName) || v(p.practice.legalName) || 'Unknown practice',
      city: v(p.practice.city),
      country: v(p.practice.country),
      founded: v(p.practice.founded) ?? null,
      teamSize,
      partners,
      chartered,
    },
    jurisdiction,
    complianceFramework: framework,
    stageConvention: stage,
    modules,
    municipalityProfiles: munis,
    integrations,
    followUpQuestions: followUpQuestions.slice(0, 5),
    warnings,
  }
}

/** Aggregate confidence: mean of top-level sourced fields. */
export function practiceConfidence(p: PracticeProfile): number {
  const fields = [
    p.practice.legalName, p.practice.city, p.practice.country, p.projectMix, p.procurement,
    p.municipalities, p.activeProjects, p.heritageWork, p.languages,
  ].filter(Boolean) as { confidence: number }[]
  if (!fields.length) return 0
  return Math.round((fields.reduce((a, f) => a + (f.confidence ?? 0), 0) / fields.length) * 100) / 100
}
