import type { Jurisdiction, RuleSet } from './types'
import { EE_RULESET } from './datasets/ee'
import { GB_RULESET } from './datasets/gb'

export * from './types'
export { match, groupByDiscipline, diffChecklists } from './engine'

/** Registry of jurisdiction rule sets. UK and PL datasets slot in here. */
const RULESETS: Partial<Record<Jurisdiction, RuleSet>> = {
  EE: EE_RULESET,
  GB: GB_RULESET, // England only (v1)
}

export function getRuleSet(jurisdiction: Jurisdiction): RuleSet | null {
  return RULESETS[jurisdiction] ?? null
}

export const AVAILABLE_JURISDICTIONS = Object.keys(RULESETS) as Jurisdiction[]

export const DISCIPLINE_LABELS: Record<string, { en: string; et: string }> = {
  permit: { en: 'Permits & notices', et: 'Load ja teatised' },
  planning: { en: 'Planning', et: 'Planeering' },
  design: { en: 'Design documentation', et: 'Projekteerimine' },
  supervision: { en: 'Supervision', et: 'Järelevalve' },
  fire: { en: 'Fire safety', et: 'Tuleohutus' },
  energy: { en: 'Energy performance', et: 'Energiatõhusus' },
  sound: { en: 'Sound insulation', et: 'Heliisolatsioon' },
  accessibility: { en: 'Accessibility', et: 'Ligipääsetavus' },
  infrastructure: { en: 'Infrastructure & utilities', et: 'Taristu ja tehnovõrgud' },
  environment: { en: 'Environment', et: 'Keskkond' },
}
