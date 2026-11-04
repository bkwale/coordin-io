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
  jurisdiction: 'EE' | 'GB' | 'PL' | 'ES' | 'OTHER'
  complianceFramework: 'ehitusseadustik' | 'brpd' | 'prawo_budowlane' | 'cte' | null
  complianceLabel: string | null
  stageConvention: 'estonian_4_stage' | 'riba' | 'polish_3_stage' | null
  stageLabel: string | null
  currency: 'EUR' | 'GBP' | 'PLN' | null
  authorityTerm: string
  modules: ModuleDecision[]
  municipalityProfiles: string[]
  integrations: { key: string; label: string; reason: string }[]
  followUpQuestions: { id: string; question: string; options: string[] }[]
  warnings: string[]
}

const v = <T,>(f: { value: T | null } | undefined | null): T | null => (f ? f.value : null)

const STAGE_LABEL: Record<string, string> = {
  estonian_4_stage: 'Estonian 4-stage convention (eskiis → eelprojekt → põhiprojekt → tööprojekt)',
  riba: 'RIBA Plan of Work stages 0–7',
  polish_3_stage: 'Polish convention (koncepcja → projekt budowlany → projekt wykonawczy)',
  other: 'Stage tracking (convention to confirm)',
}

interface JurisdictionConfig {
  name: string
  framework: PracticeMapping['complianceFramework']
  frameworkLabel: string | null
  stage: PracticeMapping['stageConvention']
  currency: PracticeMapping['currency']
  authorityTerm: string
  cpdBody: string
  invoicingReason: string
  integrations: PracticeMapping['integrations']
  accountingOptions: string[]
  placeOptions: string[]
  registryQuestion: PracticeMapping['followUpQuestions'][number] | null
}

const JURIS: Record<PracticeMapping['jurisdiction'], JurisdictionConfig> = {
  EE: {
    name: 'Estonian', framework: 'ehitusseadustik', frameworkLabel: 'Ehitusseadustik', stage: 'estonian_4_stage', currency: 'EUR',
    authorityTerm: 'municipalities', cpdBody: 'EAL', invoicingReason: 'e-arve ready — Estonian e-invoicing',
    integrations: [{ key: 'merit_aktiva', label: 'Merit Aktiva', reason: 'Estonian SME default accounting' }, { key: 'ehitisregister', label: 'Ehitisregister', reason: 'Import project history by registry code' }],
    accountingOptions: ['Merit Aktiva', 'Directo', 'Xero', 'Other'], placeOptions: ['Tallinn', 'Tartu', 'Pärnu', 'Across Estonia'],
    registryQuestion: { id: 'ehr_import', question: 'Import your project history from Ehitisregister? (needs your registry code)', options: ['Yes', 'Not now'] },
  },
  GB: {
    name: 'UK', framework: 'brpd', frameworkLabel: 'Building Regulations + Building Safety Act', stage: 'riba', currency: 'GBP',
    authorityTerm: 'local planning authorities', cpdBody: 'RIBA/ARB', invoicingReason: 'Inbound + outbound invoicing, VAT-ready',
    integrations: [{ key: 'xero', label: 'Xero', reason: 'UK practice default accounting' }, { key: 'planning_portal', label: 'Planning Portal', reason: 'Application tracking' }],
    accountingOptions: ['Xero', 'QuickBooks', 'Sage', 'Other'], placeOptions: ['London', 'South East', 'Midlands', 'Across the UK'],
    registryQuestion: { id: 'companies_house', question: 'Pull company details from Companies House? (needs your company number)', options: ['Yes', 'Not now'] },
  },
  PL: {
    name: 'Polish', framework: 'prawo_budowlane', frameworkLabel: 'Prawo budowlane + warunki techniczne', stage: 'polish_3_stage', currency: 'PLN',
    authorityTerm: 'gminy', cpdBody: 'IARP', invoicingReason: 'KSeF structured e-invoicing — mandatory in Poland',
    integrations: [{ key: 'ksef', label: 'KSeF', reason: 'National e-invoicing system' }, { key: 'fakturownia', label: 'Fakturownia / wFirma', reason: 'Polish SME invoicing' }],
    accountingOptions: ['Fakturownia', 'wFirma', 'Comarch Optima', 'Other'], placeOptions: ['Warszawa', 'Kraków', 'Wrocław', 'Across Poland'],
    registryQuestion: { id: 'krs_import', question: 'Pull company details from KRS / CEIDG? (needs your NIP)', options: ['Yes', 'Not now'] },
  },
  ES: {
    name: 'Spanish', framework: 'cte', frameworkLabel: 'Código Técnico de la Edificación', stage: null, currency: 'EUR',
    authorityTerm: 'municipios', cpdBody: 'COAM/COAC', invoicingReason: 'Inbound + outbound invoicing',
    integrations: [], accountingOptions: ['Holded', 'Sage', 'Other'], placeOptions: ['Madrid', 'Barcelona', 'Valencia', 'Across Spain'], registryQuestion: null,
  },
  OTHER: {
    name: 'this', framework: null, frameworkLabel: null, stage: null, currency: null,
    authorityTerm: 'local authorities', cpdBody: 'professional body', invoicingReason: 'Inbound + outbound invoicing',
    integrations: [], accountingOptions: ['Xero', 'QuickBooks', 'Other'], placeOptions: ['Capital', 'Regional', 'Nationwide'], registryQuestion: null,
  },
}

export function mapPracticeProfile(p: PracticeProfile): PracticeMapping {
  const country = (v(p.practice.country) || '').toUpperCase()
  const host = (v(p.practice.website) || '').toLowerCase()
  const jurisdiction: PracticeMapping['jurisdiction'] =
    country === 'EE' || host.endsWith('.ee') ? 'EE'
    : country === 'GB' || country === 'UK' || host.endsWith('.uk') ? 'GB'
    : country === 'PL' || host.endsWith('.pl') ? 'PL'
    : country === 'ES' ? 'ES' : 'OTHER'
  const J = JURIS[jurisdiction]

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
  const stage = (v(p.signals?.stageConvention) as PracticeMapping['stageConvention']) ?? J.stage

  const modules: ModuleDecision[] = []
  const on = (key: string, label: string, reason: string, evidence?: string) => modules.push({ key, label, on: true, reason, evidence })
  const off = (key: string, label: string, reason: string) => modules.push({ key, label, on: false, reason })

  // Core — always
  on('projects', FEATURE_REGISTRY.projects.label, 'Core — every practice')
  on('documents', FEATURE_REGISTRY.documents.label, 'Core — drawing register and transmittals')
  on('approvals', FEATURE_REGISTRY.approvals.label, 'Core — sign-off routing')

  // Compliance
  const framework = J.framework
  if (framework) on('compliance', FEATURE_REGISTRY.compliance.label, `${J.frameworkLabel} — ${J.name} practice`, munis.length ? `${munis.length} ${J.authorityTerm} from project list` : undefined)
  else off('compliance', FEATURE_REGISTRY.compliance.label, 'Jurisdiction not identified — ask')
  if (jurisdiction === 'GB') on('brpd', 'BRPD gateways (Building Safety Act)', 'UK practice — higher-risk building duties apply')
  if (jurisdiction === 'PL') on('ksef', 'KSeF e-invoicing', 'Mandatory structured e-invoicing in Poland')

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
    on('riba_tracking', 'Stage tracking & resource plan', STAGE_LABEL[stage ?? 'other'])
  } else {
    off('staffing', FEATURE_REGISTRY.staffing.label, `${teamSize || 'Small'}-person studio — HR module not needed yet`)
    off('timesheets', FEATURE_REGISTRY.timesheets.label, 'Small studio — ask')
    on('riba_tracking', 'Stage tracking & resource plan', 'Stage tracking still useful for a small studio')
  }
  if (chartered > 0) on('cpd', 'CPD & competence', `${chartered} chartered architect${chartered > 1 ? 's' : ''} — ${J.cpdBody} CPD requirements`)
  else off('cpd', 'CPD & competence', 'No chartered status shown — ask')

  // Finance
  on('invoicing', FEATURE_REGISTRY.invoicing.label, J.invoicingReason)
  if (munis.length >= 5) on('expenses', 'Expenses', `Travel across ${munis.length} ${J.authorityTerm}`)
  else off('expenses', 'Expenses', 'Few locations — ask')

  // Off by jurisdiction
  if (jurisdiction !== 'GB') off('brpd', 'BRPD (UK Building Safety Act)', 'No UK work')
  if (jurisdiction !== 'PL') off('ksef', 'KSeF e-invoicing', 'Poland only')
  if (J.currency) off('multi_currency', 'Multi-currency', `${J.currency} only`)

  const integrations: PracticeMapping['integrations'] = [...J.integrations, { key: 'microsoft365', label: 'Microsoft 365', reason: 'Outlook + SharePoint' }]

  const followUpQuestions: PracticeMapping['followUpQuestions'] = [
    { id: 'fee_approver', question: partners.length ? `Who signs off fee quotes — any partner, or ${partners[0]} only?` : 'Who signs off fee quotes?', options: partners.length ? ['Any partner', `${partners[0]} only`, 'Partners + finance'] : ['Owner', 'Owner + finance'] },
    { id: 'timesheet_cadence', question: 'Timesheets weekly or daily, and who approves?', options: ['Weekly, partner approves', 'Daily, project lead approves', 'We don’t do timesheets'] },
    { id: 'accounting', question: 'Which accounting software?', options: J.accountingOptions },
    { id: 'files', question: 'Where do project files live?', options: ['SharePoint / OneDrive', 'Google Drive', 'Local server', 'Dropbox'] },
  ]
  if (J.registryQuestion) followUpQuestions.push(J.registryQuestion)
  if (!munis.length) followUpQuestions.unshift({ id: 'municipalities', question: `Which ${J.authorityTerm} do you work in most?`, options: J.placeOptions })
  if (!active.length) followUpQuestions.unshift({ id: 'active', question: 'Any projects on site right now?', options: ['Yes, 1–2', 'Yes, 3+', 'None at the moment'] })

  const warnings: string[] = []
  if (!v(p.practice.legalName)) warnings.push('Legal name not found on site')
  if (!teamSize) warnings.push('No team page found — people list empty')
  if (munis.length === 0 && jurisdiction !== 'OTHER') warnings.push(`No locations in project titles — ${J.authorityTerm} unknown`)
  if (jurisdiction === 'OTHER') warnings.push('Country not identified — compliance framework to confirm')

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
    complianceLabel: J.frameworkLabel,
    stageConvention: stage,
    stageLabel: STAGE_LABEL[stage ?? 'other'],
    currency: J.currency,
    authorityTerm: J.authorityTerm,
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
