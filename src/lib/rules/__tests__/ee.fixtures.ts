/**
 * Sprint 0.5 — Rules-engine fixtures for Estonia (Ehitusseadustik), written BEFORE the engine.
 * Source: docs/coordin-ee-regulatory-dataset-v1.md (30 Oct 2026). Each fixture names the rule IDs that must
 * appear and the ones that must not. Confidence mirrors the dataset; Laila reviews these in Sprint 2.
 *
 * Rule ID convention: EE.<DISCIPLINE>.<NAME>
 */
import type { ProjectParameters } from '../types'

export interface Fixture {
  name: string
  params: ProjectParameters
  expect: string[]      // rule IDs that MUST be in the checklist
  absent?: string[]     // rule IDs that MUST NOT be
  note?: string
}

const house = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'EE', buildingType: 'detached_house', workType: 'new_build',
  grossFloorArea: 160, height: 7.5, storeys: 2, heatedArea: 150, enclosedNetArea: 150,
  detailedPlanExists: false, urbanArea: false, ...over,
})
const block = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'EE', buildingType: 'apartment_block', workType: 'new_build',
  grossFloorArea: 1800, height: 14, storeys: 4, apartments: 20, parkingSpaces: 22, heatedArea: 1600, enclosedNetArea: 1600,
  detailedPlanExists: true, detailedPlanAgeYears: 2, urbanArea: true, districtHeatingAvailable: true, ...over,
})

export const EE_FIXTURES: Fixture[] = [
  // ── Permit tier (§ 35–45 + Lisa 1) — HIGH ───────────────────────────────────
  { name: 'tiny shed <20 m², ≤5 m — no permit, no notice', params: house({ grossFloorArea: 18, height: 3.2, storeys: 1, heatedArea: 0 }), expect: ['EE.PERMIT.NONE'], absent: ['EE.PERMIT.NOTICE', 'EE.PERMIT.BUILDING_PERMIT', 'EE.DESIGN.QUALIFIED_DESIGNER'] },
  { name: 'exactly 20 m² — building notice', params: house({ grossFloorArea: 20, height: 4, storeys: 1 }), expect: ['EE.PERMIT.NOTICE', 'EE.PERMIT.NOTICE_VALIDITY_4Y', 'EE.PERMIT.NOTICE_10_DAYS'], absent: ['EE.PERMIT.NONE', 'EE.PERMIT.BUILDING_PERMIT'] },
  { name: '45 m² garden house ≤5 m — building notice', params: house({ grossFloorArea: 45, height: 4.5, storeys: 1 }), expect: ['EE.PERMIT.NOTICE'], absent: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: '60 m² exactly, ≤5 m — still notice', params: house({ grossFloorArea: 60, height: 5, storeys: 1 }), expect: ['EE.PERMIT.NOTICE'], absent: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: '61 m² — building permit', params: house({ grossFloorArea: 61, height: 4.5, storeys: 1 }), expect: ['EE.PERMIT.BUILDING_PERMIT', 'EE.PERMIT.DECISION_30_DAYS', 'EE.PERMIT.VALIDITY_5Y'], absent: ['EE.PERMIT.NOTICE'] },
  { name: '40 m² but 5.5 m tall — height trips permit', params: house({ grossFloorArea: 40, height: 5.5, storeys: 1 }), expect: ['EE.PERMIT.BUILDING_PERMIT'], absent: ['EE.PERMIT.NOTICE'] },
  { name: '50 m² but 3 storeys — storeys trip permit', params: house({ grossFloorArea: 50, height: 4.9, storeys: 3 }), expect: ['EE.PERMIT.BUILDING_PERMIT'], absent: ['EE.PERMIT.NOTICE'] },
  { name: 'typical 160 m² house — building permit', params: house(), expect: ['EE.PERMIT.BUILDING_PERMIT', 'EE.PERMIT.EHR_SUBMISSION', 'EE.PERMIT.COMMENCEMENT_NOTICE_3_DAYS', 'EE.PERMIT.USE_NOTICE'] },
  { name: 'apartment block — building permit always', params: block(), expect: ['EE.PERMIT.BUILDING_PERMIT', 'EE.PERMIT.USE_PERMIT'], absent: ['EE.PERMIT.NOTICE', 'EE.PERMIT.USE_NOTICE'], note: '2026 amendment: notice of use replaces use permit for private/semi-detached only' },
  { name: 'house — notice of use (2026) not use permit', params: house(), expect: ['EE.PERMIT.USE_NOTICE'], absent: ['EE.PERMIT.USE_PERMIT'] },

  // ── Design & supervision (§ 14, § 19, § 24) — HIGH ──────────────────────────
  { name: 'house >60 m² — qualified designer + structural design', params: house(), expect: ['EE.DESIGN.QUALIFIED_DESIGNER', 'EE.DESIGN.STRUCTURAL', 'EE.DESIGN.COMPETENT_PERSON_CERT'] },
  { name: 'notice-tier house — no structural design required', params: house({ grossFloorArea: 45, height: 4, storeys: 1 }), absent: ['EE.DESIGN.STRUCTURAL', 'EE.DESIGN.QUALIFIED_DESIGNER'], expect: ['EE.PERMIT.NOTICE'] },
  { name: 'block — architect AND structural engineer, geotech mandatory', params: block(), expect: ['EE.DESIGN.QUALIFIED_DESIGNER', 'EE.DESIGN.STRUCTURAL_ENGINEER', 'EE.DESIGN.GEOTECHNICAL_MANDATORY'] },
  { name: 'house — geotech recommended, not mandatory', params: house(), expect: ['EE.DESIGN.GEOTECHNICAL_RECOMMENDED'], absent: ['EE.DESIGN.GEOTECHNICAL_MANDATORY'] },
  { name: 'block >3 storeys — authority may require expert review', params: block({ storeys: 4 }), expect: ['EE.DESIGN.EXPERT_REVIEW_POSSIBLE'] },
  { name: 'block 3 storeys — expert review not flagged by storeys', params: block({ storeys: 3, height: 10.5, apartments: 12 }), absent: ['EE.DESIGN.EXPERT_REVIEW_POSSIBLE'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'house — owner may self-supervise', params: house(), expect: ['EE.SUPERVISION.OWNER_APPOINTED'], absent: ['EE.SUPERVISION.LICENSED_MANDATORY'] },
  { name: 'block — licensed supervisor mandatory', params: block(), expect: ['EE.SUPERVISION.LICENSED_MANDATORY'], absent: ['EE.SUPERVISION.OWNER_APPOINTED'] },

  // ── Fire (Interior Min. reg. 17, EVS 812-7, Fire Safety Act § 11) — HIGH ─────
  { name: 'house 2 storeys — TP3, single compartment, 1 exit, smoke alarms', params: house(), expect: ['EE.FIRE.CLASS_TP3', 'EE.FIRE.SINGLE_COMPARTMENT', 'EE.FIRE.ONE_EXIT', 'EE.FIRE.SMOKE_ALARMS', 'EE.FIRE.BRIGADE_ACCESS_50M'], absent: ['EE.FIRE.CLASS_TP2', 'EE.FIRE.EMERGENCY_LIGHTING', 'EE.FIRE.TWO_ESCAPE_ROUTES'] },
  { name: 'block 4 storeys — TP2, per-apartment compartments, 2 routes, 25 m travel', params: block(), expect: ['EE.FIRE.CLASS_TP2', 'EE.FIRE.APARTMENT_COMPARTMENTS', 'EE.FIRE.TWO_ESCAPE_ROUTES', 'EE.FIRE.TRAVEL_25M', 'EE.FIRE.EMERGENCY_LIGHTING', 'EE.FIRE.SMOKE_ALARMS_COMMON', 'EE.FIRE.EVACUATION_PLAN'], absent: ['EE.FIRE.CLASS_TP3', 'EE.FIRE.CLASS_TP1'] },
  { name: 'block 9 storeys — TP1', params: block({ storeys: 9, height: 30, apartments: 50 }), expect: ['EE.FIRE.CLASS_TP1'], absent: ['EE.FIRE.CLASS_TP2'] },
  { name: 'block >3 storeys — addressable fire detection may be required', params: block({ storeys: 4 }), expect: ['EE.FIRE.ADDRESSABLE_DETECTION_POSSIBLE'] },
  { name: 'block 3 storeys — no addressable-detection flag', params: block({ storeys: 3, height: 10.5 }), absent: ['EE.FIRE.ADDRESSABLE_DETECTION_POSSIBLE'], expect: ['EE.FIRE.CLASS_TP2'] },
  { name: 'block >4 storeys — fire truck access road + dry riser', params: block({ storeys: 5, height: 17 }), expect: ['EE.FIRE.TRUCK_ACCESS_TURNING', 'EE.FIRE.DRY_RISER'] },
  { name: 'block 4 storeys — no dry riser', params: block({ storeys: 4 }), absent: ['EE.FIRE.DRY_RISER'], expect: ['EE.FIRE.CLASS_TP2'] },
  { name: 'timber block 5 storeys — allowed, automated firefighting 5–8', params: block({ storeys: 5, height: 16, timberStructure: true }), expect: ['EE.FIRE.TIMBER_ALLOWED_TO_8', 'EE.FIRE.TIMBER_AUTOMATED_5_TO_8'] },
  { name: 'timber block 4 storeys — allowed, no automated requirement', params: block({ storeys: 4, timberStructure: true }), expect: ['EE.FIRE.TIMBER_ALLOWED_TO_8'], absent: ['EE.FIRE.TIMBER_AUTOMATED_5_TO_8'] },
  { name: 'timber block 9 storeys — not allowed under TP2 timber rule', params: block({ storeys: 9, height: 30, timberStructure: true }), expect: ['EE.FIRE.TIMBER_OVER_8_NOT_PERMITTED'], absent: ['EE.FIRE.TIMBER_ALLOWED_TO_8'] },
  { name: 'house — no sprinklers', params: house(), absent: ['EE.FIRE.SPRINKLERS'], expect: ['EE.FIRE.CLASS_TP3'] },

  // ── Energy (Gov. reg. 58, § 62–69) — HIGH/MEDIUM ────────────────────────────
  { name: 'house — nZEB ≤50 kWh/m²/y (MEDIUM — 50 vs 120 unresolved)', params: house(), expect: ['EE.ENERGY.NZEB', 'EE.ENERGY.TARGET_HOUSE_50', 'EE.ENERGY.EPC_AT_PERMIT_AND_USE', 'EE.ENERGY.RENEWABLE_ONSITE'] },
  { name: 'block — nZEB ≤100 kWh/m²/y, dynamic simulation, MVHR mandatory', params: block(), expect: ['EE.ENERGY.NZEB', 'EE.ENERGY.TARGET_BLOCK_100', 'EE.ENERGY.DYNAMIC_SIMULATION', 'EE.ENERGY.MVHR_MANDATORY', 'EE.ENERGY.AIRTIGHT_N50_1_5'] },
  { name: 'house heated <220 m² — simplified calculation', params: house({ heatedArea: 150 }), expect: ['EE.ENERGY.SIMPLIFIED_CALC'], absent: ['EE.ENERGY.DYNAMIC_SIMULATION'] },
  { name: 'large house heated 260 m² — dynamic simulation', params: house({ grossFloorArea: 290, heatedArea: 260 }), expect: ['EE.ENERGY.DYNAMIC_SIMULATION'], absent: ['EE.ENERGY.SIMPLIFIED_CALC'] },
  { name: 'enclosed net area ≤50 m² — energy exempt', params: house({ grossFloorArea: 62, enclosedNetArea: 48, heatedArea: 48 }), expect: ['EE.ENERGY.EXEMPT_SMALL'], absent: ['EE.ENERGY.NZEB'] },
  { name: 'summer house <4 months/year — energy exempt', params: house({ seasonalUseOnly: true }), expect: ['EE.ENERGY.EXEMPT_SEASONAL'], absent: ['EE.ENERGY.NZEB'] },
  { name: 'temporary building ≤2 years — energy exempt', params: house({ temporary: true }), expect: ['EE.ENERGY.EXEMPT_TEMPORARY'], absent: ['EE.ENERGY.NZEB'] },
  { name: 'heritage house — energy exemption where appearance affected', params: house({ heritage: true }), expect: ['EE.ENERGY.EXEMPT_HERITAGE_CONDITIONAL'] },
  { name: 'block 22 parking spaces — EV cabling every space', params: block({ parkingSpaces: 22 }), expect: ['EE.INFRA.EV_CABLING_EACH_SPACE'] },
  { name: 'block 10 parking spaces — no EV requirement', params: block({ parkingSpaces: 10 }), absent: ['EE.INFRA.EV_CABLING_EACH_SPACE'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'block 11 parking spaces — EV requirement starts', params: block({ parkingSpaces: 11 }), expect: ['EE.INFRA.EV_CABLING_EACH_SPACE'] },
  { name: 'house — heating seasonal efficiency ≥80%, room control', params: house(), expect: ['EE.ENERGY.HEATING_EFFICIENCY_80', 'EE.ENERGY.ROOM_TEMP_CONTROL'] },

  // ── Sound (EVS 842:2003) — MEDIUM, standard edition to verify ────────────────
  { name: 'block — airborne ≥55 dB, impact ≤53 dB, stairwell ≥52, technical ≥60', params: block(), expect: ['EE.SOUND.AIRBORNE_55', 'EE.SOUND.IMPACT_53', 'EE.SOUND.STAIRWELL_52', 'EE.SOUND.TECHNICAL_ROOM_60'] },
  { name: 'house — no inter-dwelling sound rules', params: house(), absent: ['EE.SOUND.AIRBORNE_55', 'EE.SOUND.IMPACT_53'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'house near major road — facade sound', params: house({ nearMajorRoad: true }), expect: ['EE.SOUND.FACADE'] },
  { name: 'block near major road — facade sound', params: block({ nearMajorRoad: true }), expect: ['EE.SOUND.FACADE'] },

  // ── Accessibility (§ 11 + 2026 amendment, effective 01.01.2027) — MEDIUM ─────
  { name: 'block 5 storeys — lift mandatory (>4, from 2027)', params: block({ storeys: 5, height: 17 }), expect: ['EE.ACCESS.LIFT_OVER_4_STOREYS', 'EE.ACCESS.STEP_FREE_COMMON', 'EE.ACCESS.ADAPTABLE_1_IN_10', 'EE.ACCESS.PARKING'] },
  { name: 'block 4 storeys — no lift mandate', params: block({ storeys: 4 }), absent: ['EE.ACCESS.LIFT_OVER_4_STOREYS'], expect: ['EE.ACCESS.STEP_FREE_COMMON'] },
  { name: 'block 20 apartments — 2 adaptable', params: block({ apartments: 20 }), expect: ['EE.ACCESS.ADAPTABLE_1_IN_10'] },
  { name: 'house — no accessibility requirements', params: house(), absent: ['EE.ACCESS.STEP_FREE_COMMON', 'EE.ACCESS.LIFT_OVER_4_STOREYS', 'EE.ACCESS.ADAPTABLE_1_IN_10'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },

  // ── Infrastructure (§ 61¹–61¹¹, local) — HIGH ───────────────────────────────
  { name: 'block — high-speed network access point (2+ apartments)', params: block(), expect: ['EE.INFRA.HIGH_SPEED_ACCESS_POINT', 'EE.INFRA.WASTE_ROOM'] },
  { name: 'house — exempt from high-speed network', params: house(), absent: ['EE.INFRA.HIGH_SPEED_ACCESS_POINT', 'EE.INFRA.WASTE_ROOM'], expect: ['EE.INFRA.KERBSIDE_WASTE'] },
  { name: 'district heating available — connection mandatory (house)', params: house({ districtHeatingAvailable: true }), expect: ['EE.INFRA.DISTRICT_HEATING_CONNECT'] },
  { name: 'no district heating — no connection rule', params: house({ districtHeatingAvailable: false }), absent: ['EE.INFRA.DISTRICT_HEATING_CONNECT'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'urban block — municipal water/sewage mandatory', params: block({ urbanArea: true }), expect: ['EE.INFRA.MUNICIPAL_WATER_SEWAGE'] },
  { name: 'rural house — private water/sewage allowed', params: house({ urbanArea: false }), expect: ['EE.INFRA.PRIVATE_WATER_SEWAGE_ALLOWED'], absent: ['EE.INFRA.MUNICIPAL_WATER_SEWAGE'] },

  // ── Planning (§ 26–34, Planning Act, EIA Act) — HIGH ────────────────────────
  { name: 'no detailed plan — design conditions (projekteerimistingimused)', params: house({ detailedPlanExists: false }), expect: ['EE.PLANNING.DESIGN_CONDITIONS'], absent: ['EE.PLANNING.DETAILED_PLAN_COMPLIANCE'] },
  { name: 'detailed plan in force, 2 years old — comply with plan', params: block({ detailedPlanExists: true, detailedPlanAgeYears: 2 }), expect: ['EE.PLANNING.DETAILED_PLAN_COMPLIANCE'], absent: ['EE.PLANNING.DESIGN_CONDITIONS', 'EE.PLANNING.DESIGN_SPEC_PLAN_OVER_5Y'] },
  { name: 'detailed plan 6 years old — design specification needed', params: block({ detailedPlanExists: true, detailedPlanAgeYears: 6 }), expect: ['EE.PLANNING.DESIGN_SPEC_PLAN_OVER_5Y'] },
  { name: 'block — detailed plan typically required', params: block({ detailedPlanExists: false }), expect: ['EE.PLANNING.DETAILED_PLAN_TYPICALLY_REQUIRED', 'EE.PLANNING.DESIGN_CONDITIONS'] },
  { name: 'protected area — EIA screening', params: house({ protectedArea: true }), expect: ['EE.ENV.EIA_SCREENING'] },
  { name: 'block 4 storeys, not protected — screening, full EIA unlikely', params: block(), expect: ['EE.ENV.EIA_SCREENING'], absent: ['EE.ENV.FULL_EIA_LIKELY'] },
  { name: 'heritage building — Muinsuskaitseamet conditions', params: house({ heritage: true }), expect: ['EE.PLANNING.HERITAGE_CONDITIONS'] },
  { name: 'Tallinn / Harju — radon (LOW confidence, specifics TBD)', params: house({ county: 'Harju' }), expect: ['EE.ENV.RADON_RISK_AREA'] },
  { name: 'Viljandi — no radon flag', params: house({ county: 'Viljandi' }), absent: ['EE.ENV.RADON_RISK_AREA'], expect: ['EE.PERMIT.BUILDING_PERMIT'] },

  // ── Work type edge cases ─────────────────────────────────────────────────────
  { name: 'extension 30 m² ≤5 m to a house — building notice', params: house({ workType: 'extension', grossFloorArea: 30, height: 4, storeys: 1 }), expect: ['EE.PERMIT.NOTICE'], absent: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'extension 80 m² — building permit', params: house({ workType: 'extension', grossFloorArea: 80, height: 4, storeys: 1 }), expect: ['EE.PERMIT.BUILDING_PERMIT'] },
  { name: 'demolition — demolition permit/notice path, no energy rules', params: house({ workType: 'demolition' }), expect: ['EE.PERMIT.DEMOLITION'], absent: ['EE.ENERGY.NZEB', 'EE.FIRE.CLASS_TP3'] },
]

/** Every rule ID referenced by the fixtures — the engine must define each of these. */
export const EE_RULE_IDS = Array.from(new Set(EE_FIXTURES.flatMap((f) => [...f.expect, ...(f.absent ?? [])]))).sort()
