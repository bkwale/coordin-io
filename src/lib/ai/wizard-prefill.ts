/**
 * New-project wizard: turn a document reading into wizard fields. Only plain project facts move across
 * (name, address, authority, size, type). The regulatory answers and municipal conditions stay on the run
 * and are reviewed and confirmed on the project's Regulatory page — nothing compliance-related is accepted here.
 */
import type { ProjectSetupMapping } from './map-project'

export interface WizardFields {
  name?: string
  clientBrand?: string
  projectType?: string
  developmentType?: string
  siteAddress?: string
  siteCity?: string
  siteRegion?: string
  planningAuthority?: string
  grossFloorArea?: string
  numberOfFloors?: string
  numberOfUnits?: string
}

const WORK_TO_DEVELOPMENT: Record<string, string> = { new_build: 'NEW_BUILD', extension: 'EXTENSION', reconstruction: 'REFURBISHMENT', change_of_use: 'CONVERSION' }
const BUILDING_TO_TYPE: Record<string, string> = { detached_house: 'RESIDENTIAL', semi_detached: 'RESIDENTIAL', terraced: 'RESIDENTIAL', apartment_block: 'RESIDENTIAL', non_residential: 'OTHER', other: 'OTHER' }

/** Prefills the architect would see pre-ticked: confident values only, never limits. */
function valueOf(m: ProjectSetupMapping, key: string): unknown {
  const p = m.prefills.find((x) => x.key === key && x.kind === 'value' && x.preAccept)
  return p ? p.value : undefined
}

function cityFrom(address: string | null | undefined): string | undefined {
  if (!address) return undefined
  // "Narva mnt 5, Kesklinna linnaosa, Tallinn" / "12 Clifton Mews, Bristol BS8 1AA" → last part without a postcode
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return undefined
  const last = parts[parts.length - 1].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, '').replace(/\b\d{5}\b/, '').trim()
  return last && !/maakond|county|vald$/i.test(last) ? last : undefined
}

export function wizardPrefill(m: ProjectSetupMapping): WizardFields {
  const out: WizardFields = {}
  const d = m.document
  const address = d.address ?? undefined
  const name = d.projectName ?? (address ? address.split(',')[0] : undefined)
  if (name) out.name = name.slice(0, 200)
  if (d.client) out.clientBrand = d.client.slice(0, 200)
  if (address) { out.siteAddress = address.slice(0, 1000); const city = cityFrom(address); if (city) out.siteCity = city }
  if (d.issuer) out.planningAuthority = d.issuer.slice(0, 300)
  const county = valueOf(m, 'county'); if (typeof county === 'string') out.siteRegion = county
  const work = valueOf(m, 'workType'); if (typeof work === 'string' && WORK_TO_DEVELOPMENT[work]) out.developmentType = WORK_TO_DEVELOPMENT[work]
  const bt = valueOf(m, 'buildingType'); if (typeof bt === 'string' && BUILDING_TO_TYPE[bt]) out.projectType = BUILDING_TO_TYPE[bt]
  const num = (k: string) => { const v = valueOf(m, k); return typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(v) : undefined }
  const gfa = num('grossFloorArea'); if (gfa) out.grossFloorArea = gfa
  const storeys = num('storeys'); if (storeys) out.numberOfFloors = storeys
  const units = num('apartments'); if (units) out.numberOfUnits = units
  return out
}

/** One line per fact found, for the wizard's "here's what we read" summary. */
export function readingSummary(m: ProjectSetupMapping): { facts: string[]; conditions: number; limits: number } {
  const f = wizardPrefill(m)
  const facts = [
    f.name && `Project: ${f.name}`,
    f.siteAddress && `Site: ${f.siteAddress}`,
    f.planningAuthority && `Authority: ${f.planningAuthority}`,
    m.document.number && `${m.kind === 'decision_notice' ? 'Application' : m.kind === 'planning_conditions' ? 'PT nr' : 'Reference'} ${m.document.number}`,
    f.numberOfFloors && `${f.numberOfFloors} storeys`,
    f.grossFloorArea && `${f.grossFloorArea} m² gross floor area`,
    f.numberOfUnits && `${f.numberOfUnits} homes`,
  ].filter((x): x is string => !!x)
  const limits = [m.bounds.maxHeightM, m.bounds.maxStoreys, m.bounds.maxFootprint, m.bounds.minSetbackM].filter((x) => x != null).length
  return { facts, conditions: m.conditions.length, limits }
}
