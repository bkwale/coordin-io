/**
 * EHR record → questionnaire values the architect can apply. Register facts describe the building
 * as recorded (existing, or as planned in the procedure) — the architect decides whether they are the
 * design values. Nothing is applied without a click.
 */
import { buildingTypeFromUseCode } from '@/lib/ai/map-project'
import type { ProjectParameters } from '@/lib/rules'
import type { EhrBuilding } from './client'

export interface EhrValue { key: keyof ProjectParameters; value: unknown; label: string; attribution: string }

export function fetchedLabel(b: EhrBuilding): string {
  const d = new Date(b.fetchedAt)
  return `Ehitisregister, fetched ${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
}

export function ehrToValues(b: EhrBuilding): EhrValue[] {
  const att = fetchedLabel(b)
  const out: EhrValue[] = []
  const bt = buildingTypeFromUseCode(b.useCode, b.useLabel)
  if (bt) out.push({ key: 'buildingType', value: bt, label: `${b.useLabel ?? bt} (${b.useCode})`, attribution: att })
  if (b.storeysAbove != null) out.push({ key: 'storeys', value: Math.round(b.storeysAbove), label: `${b.storeysAbove} storeys above ground`, attribution: att })
  if (b.heightM != null) out.push({ key: 'height', value: b.heightM, label: `${b.heightM} m`, attribution: att })
  if (b.heatedAreaM2 != null) out.push({ key: 'heatedArea', value: b.heatedAreaM2, label: `${b.heatedAreaM2} m² heated`, attribution: att })
  if (b.enclosedNetAreaM2 != null) out.push({ key: 'enclosedNetArea', value: b.enclosedNetAreaM2, label: `${b.enclosedNetAreaM2} m² enclosed net`, attribution: att })
  if (b.county) out.push({ key: 'county', value: b.county, label: `${b.county} maakond`, attribution: att })
  if (b.heritage && b.heritage.length) out.push({ key: 'heritage', value: true, label: b.heritage.join('; '), attribution: att })
  return out
}
