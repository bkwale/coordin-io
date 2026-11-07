/**
 * Rules engine — shared types. Deterministic. No LLM anywhere in this module.
 * Jurisdiction datasets plug in as RuleSets; the engine is the same for all.
 */

export type Jurisdiction = 'EE' | 'GB' | 'PL' | 'ES'

/** The questionnaire answers for one project. Jurisdiction-neutral where possible; EE-specific fields are optional. */
export interface ProjectParameters {
  jurisdiction: Jurisdiction
  buildingType: 'detached_house' | 'apartment_block' | 'semi_detached' | 'terraced' | 'non_residential' | 'other'
  workType: 'new_build' | 'extension' | 'reconstruction' | 'change_of_use' | 'demolition'
  grossFloorArea: number        // m² — gross floor area of the new building / extension
  height: number                // m — building height from ground
  storeys: number
  apartments?: number           // dwelling units (apartment blocks)
  parkingSpaces?: number
  heatedArea?: number           // m² — for energy-calculation method
  enclosedNetArea?: number      // m² — for energy exemption
  timberStructure?: boolean
  heritage?: boolean            // listed / monument / protected building
  protectedArea?: boolean       // nature protection or heritage conservation area
  detailedPlanExists?: boolean  // detailplaneering in force
  detailedPlanAgeYears?: number
  nearMajorRoad?: boolean       // facade sound
  districtHeatingAvailable?: boolean
  urbanArea?: boolean           // municipal water/sewage mandatory
  seasonalUseOnly?: boolean     // < 4 months/year
  temporary?: boolean           // ≤ 2 years
  placeOfWorship?: boolean
  county?: string               // for radon zones (EE: Harju, Tallinn…)

  // ── England (GB) — all optional; unknown answers keep the conservative route ──
  conservationArea?: boolean    // Article 2(3) land: conservation area
  article4?: boolean            // Article 4 direction removes permitted development rights
  extensionDepth?: number       // m — how far a rear extension projects beyond the original rear wall
  floodZone?: 1 | 2 | 3         // Environment Agency flood zone
  siteAreaHa?: number           // hectares inside the red line
  priorityHabitat?: boolean     // site contains priority habitat (BNG small-site exemption lost)
  domesticClient?: boolean      // CDM: client is a householder doing work on their own home
  contractors?: number          // CDM / Part 2A: more than one contractor → principal designer + principal contractor
  constructionDays?: number     // CDM: working days on site
  peakWorkers?: number          // CDM: most people on site at the same time
  boundaryWork?: boolean        // Party Wall etc. Act 1996: work on/near a boundary or party wall
  cilChargingArea?: boolean     // council charges Community Infrastructure Levy
  radonAffectedArea?: boolean   // UKradon map: basic or full protection area
}

export interface Rule {
  id: string                    // stable, e.g. 'EE.PERMIT.BUILDING_PERMIT'
  jurisdiction: Jurisdiction
  discipline: 'permit' | 'design' | 'fire' | 'energy' | 'sound' | 'accessibility' | 'infrastructure' | 'planning' | 'supervision' | 'environment'
  title: string                 // English
  titleLocal?: string           // Estonian / Polish
  citation: string              // '§ 14 lg 3', 'Interior Min. reg. 17 § 6'
  source: string                // 'Ehitusseadustik', 'EVS 842:2003', …
  confidence: 'high' | 'medium' | 'low'
  /** Deterministic predicate. Pure. */
  applies: (p: ProjectParameters) => boolean
  /** Short rationale shown to the architect, e.g. 'Gross floor area > 60 m²'. */
  because?: (p: ProjectParameters) => string | undefined
  requirement?: string          // the obligation text (what to do / what value)
}

export interface RuleSet {
  jurisdiction: Jurisdiction
  version: string               // 'EE-1.0'
  effectiveFrom: string         // ISO date
  sourceUrl?: string
  rules: Rule[]
}

export interface ChecklistItem {
  ruleId: string
  discipline: Rule['discipline']
  title: string
  titleLocal?: string
  citation: string
  source: string
  requirement?: string
  because?: string
  confidence: Rule['confidence']
  ruleSetVersion: string
}
