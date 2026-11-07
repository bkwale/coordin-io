/**
 * England (GB-ENG-1.0) fixtures. Each case names the rules that MUST appear and those that MUST NOT.
 * Source: docs/coordin-gb-regulatory-dataset-v1.md (7 Nov 2026). Rule ID convention: GB.<DISCIPLINE>.<NAME>
 */
import type { ProjectParameters } from '../types'
import type { Fixture } from './ee.fixtures'

const semiExt = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'GB', buildingType: 'semi_detached', workType: 'extension',
  grossFloorArea: 18, height: 3.5, storeys: 1, extensionDepth: 3, domesticClient: true, contractors: 1, ...over,
})
const detExt = (over: Partial<ProjectParameters> = {}): ProjectParameters => semiExt({ buildingType: 'detached_house', extensionDepth: 4, ...over })
const newHouse = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'GB', buildingType: 'detached_house', workType: 'new_build',
  grossFloorArea: 160, height: 8, storeys: 2, parkingSpaces: 2, siteAreaHa: 0.08, contractors: 3, constructionDays: 160, peakWorkers: 6, ...over,
})
const flats = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'GB', buildingType: 'apartment_block', workType: 'new_build',
  grossFloorArea: 2400, height: 15, storeys: 5, apartments: 24, parkingSpaces: 12, siteAreaHa: 0.4, contractors: 6, constructionDays: 300, peakWorkers: 40, ...over,
})
const tower = (over: Partial<ProjectParameters> = {}): ProjectParameters => flats({ height: 24, storeys: 8, apartments: 60, grossFloorArea: 5200, siteAreaHa: 0.3, ...over })
const office = (over: Partial<ProjectParameters> = {}): ProjectParameters => ({
  jurisdiction: 'GB', buildingType: 'non_residential', workType: 'new_build',
  grossFloorArea: 1500, height: 12, storeys: 3, parkingSpaces: 30, siteAreaHa: 0.6, contractors: 4, constructionDays: 220, peakWorkers: 30, ...over,
})

export const GB_FIXTURES: Fixture[] = [
  // ── Householder planning route (GPDO Class A) ──────────────────────────────
  { name: 'GB semi 3 m single-storey rear extension — permitted development', params: semiExt(), expect: ['GB.PLANNING.PERMITTED_DEVELOPMENT', 'GB.PLANNING.LAWFUL_DEVELOPMENT_CERT'], absent: ['GB.PLANNING.HOUSEHOLDER_APPLICATION', 'GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL', 'GB.PLANNING.FULL_APPLICATION'] },
  { name: 'GB detached 4 m rear extension — permitted development', params: detExt(), expect: ['GB.PLANNING.PERMITTED_DEVELOPMENT'], absent: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB semi 5 m rear extension — larger home extension prior approval', params: semiExt({ extensionDepth: 5 }), expect: ['GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL'], absent: ['GB.PLANNING.PERMITTED_DEVELOPMENT', 'GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB detached 8 m rear extension — still larger home extension', params: detExt({ extensionDepth: 8 }), expect: ['GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL'], absent: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB detached 8.5 m rear extension — householder application', params: detExt({ extensionDepth: 8.5 }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION', 'GB.PLANNING.DETERMINATION_8_WEEKS', 'GB.PLANNING.COMMENCE_WITHIN_3_YEARS'], absent: ['GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL', 'GB.PLANNING.PERMITTED_DEVELOPMENT'] },
  { name: 'GB terraced 6.5 m — beyond larger-extension limit', params: semiExt({ buildingType: 'terraced', extensionDepth: 6.5 }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'], absent: ['GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL'] },
  { name: 'GB 4.2 m tall single-storey extension — over 4 m height, householder', params: semiExt({ height: 4.2 }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'], absent: ['GB.PLANNING.PERMITTED_DEVELOPMENT'] },
  { name: 'GB extension depth unknown — cautious householder route', params: semiExt({ extensionDepth: undefined }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'], absent: ['GB.PLANNING.PERMITTED_DEVELOPMENT'] },
  { name: 'GB larger extension in conservation area — not available, householder', params: semiExt({ extensionDepth: 5, conservationArea: true }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION', 'GB.PLANNING.HERITAGE_STATEMENT'], absent: ['GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL'] },
  { name: 'GB 3 m single-storey in conservation area — still PD', params: semiExt({ conservationArea: true }), expect: ['GB.PLANNING.PERMITTED_DEVELOPMENT'], absent: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB two-storey 3 m extension — PD outside designated land', params: semiExt({ storeys: 2, height: 6 }), expect: ['GB.PLANNING.PERMITTED_DEVELOPMENT'], absent: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB two-storey extension in conservation area — householder', params: semiExt({ storeys: 2, height: 6, conservationArea: true }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'], absent: ['GB.PLANNING.PERMITTED_DEVELOPMENT'] },
  { name: 'GB two-storey extension in National Landscape — householder', params: semiExt({ storeys: 2, height: 6, protectedArea: true }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB Article 4 removes PD — householder', params: semiExt({ article4: true }), expect: ['GB.PLANNING.HOUSEHOLDER_APPLICATION', 'GB.PLANNING.ARTICLE_4'], absent: ['GB.PLANNING.PERMITTED_DEVELOPMENT'] },
  { name: 'GB listed house extension — listed building consent + heritage statement', params: semiExt({ heritage: true, extensionDepth: 5 }), expect: ['GB.PLANNING.LISTED_BUILDING_CONSENT', 'GB.PLANNING.DESIGN_ACCESS_STATEMENT', 'GB.PLANNING.HERITAGE_STATEMENT'] },

  // ── Full planning, major development, heritage ─────────────────────────────
  { name: 'GB new house — full planning, not major', params: newHouse(), expect: ['GB.PLANNING.FULL_APPLICATION', 'GB.PLANNING.DETERMINATION_8_WEEKS', 'GB.PLANNING.PRE_COMMENCEMENT_CONDITIONS'], absent: ['GB.PLANNING.MAJOR_DEVELOPMENT', 'GB.PLANNING.HOUSEHOLDER_APPLICATION'] },
  { name: 'GB 24 flats — major development', params: flats(), expect: ['GB.PLANNING.MAJOR_DEVELOPMENT', 'GB.PLANNING.DESIGN_ACCESS_STATEMENT'], absent: ['GB.PLANNING.DETERMINATION_8_WEEKS'] },
  { name: 'GB 9 flats on 0.3 ha — not major', params: flats({ apartments: 9, siteAreaHa: 0.3, grossFloorArea: 900 }), absent: ['GB.PLANNING.MAJOR_DEVELOPMENT'], expect: ['GB.PLANNING.DETERMINATION_8_WEEKS'] },
  { name: 'GB 9 flats on 0.5 ha — major by site area', params: flats({ apartments: 9, siteAreaHa: 0.5, grossFloorArea: 900 }), expect: ['GB.PLANNING.MAJOR_DEVELOPMENT'] },
  { name: 'GB 1,500 m² office — major by floorspace', params: office(), expect: ['GB.PLANNING.MAJOR_DEVELOPMENT', 'GB.PLANNING.FULL_APPLICATION'] },
  { name: 'GB new house in conservation area — D&A + heritage statement', params: newHouse({ conservationArea: true }), expect: ['GB.PLANNING.DESIGN_ACCESS_STATEMENT', 'GB.PLANNING.HERITAGE_STATEMENT'] },
  { name: 'GB new house outside conservation area — no D&A needed', params: newHouse(), expect: [], absent: ['GB.PLANNING.DESIGN_ACCESS_STATEMENT', 'GB.PLANNING.HERITAGE_STATEMENT'] },
  { name: 'GB demolition in conservation area — planning permission', params: newHouse({ workType: 'demolition', conservationArea: true }), expect: ['GB.PLANNING.CONSERVATION_AREA_DEMOLITION', 'GB.PLANNING.HERITAGE_STATEMENT'], absent: ['GB.PLANNING.DEMOLITION_PRIOR_APPROVAL'] },
  { name: 'GB demolition elsewhere — prior approval', params: newHouse({ workType: 'demolition' }), expect: ['GB.PLANNING.DEMOLITION_PRIOR_APPROVAL'], absent: ['GB.PLANNING.CONSERVATION_AREA_DEMOLITION', 'GB.PERMIT.BUILDING_REGS_APPROVAL'] },
  { name: 'GB change of use — check PD classes first', params: newHouse({ workType: 'change_of_use', buildingType: 'detached_house' }), expect: ['GB.PLANNING.CHANGE_OF_USE_PD_CHECK', 'GB.PLANNING.FULL_APPLICATION'] },

  // ── Flood, CIL ─────────────────────────────────────────────────────────────
  { name: 'GB new house in Flood Zone 3 — FRA + sequential test', params: newHouse({ floodZone: 3 }), expect: ['GB.PLANNING.FLOOD_RISK_ASSESSMENT', 'GB.PLANNING.SEQUENTIAL_TEST'] },
  { name: 'GB extension in Flood Zone 2 — FRA, no sequential test', params: semiExt({ floodZone: 2, extensionDepth: 7 }), expect: ['GB.PLANNING.FLOOD_RISK_ASSESSMENT'], absent: ['GB.PLANNING.SEQUENTIAL_TEST'] },
  { name: 'GB Flood Zone 1 small site — no FRA', params: newHouse({ floodZone: 1 }), expect: [], absent: ['GB.PLANNING.FLOOD_RISK_ASSESSMENT'] },
  { name: 'GB 1.2 ha site in Flood Zone 1 — FRA by size', params: office({ siteAreaHa: 1.2, floodZone: 1 }), expect: ['GB.PLANNING.FLOOD_RISK_ASSESSMENT'], absent: ['GB.PLANNING.SEQUENTIAL_TEST'] },
  { name: 'GB new dwelling — CIL', params: newHouse(), expect: ['GB.PLANNING.CIL'] },
  { name: 'GB council does not charge CIL — no CIL item', params: newHouse({ cilChargingArea: false }), expect: [], absent: ['GB.PLANNING.CIL'] },
  { name: 'GB 18 m² extension — no CIL', params: semiExt(), expect: [], absent: ['GB.PLANNING.CIL'] },

  // ── BNG ────────────────────────────────────────────────────────────────────
  { name: 'GB new house on 0.08 ha, no priority habitat — BNG exempt (0.2 ha)', params: newHouse(), expect: ['GB.ENV.BNG_EXEMPT_SMALL_SITE'], absent: ['GB.ENV.BNG_10_PERCENT'] },
  { name: 'GB small site with priority habitat — BNG applies', params: newHouse({ priorityHabitat: true }), expect: ['GB.ENV.BNG_10_PERCENT'], absent: ['GB.ENV.BNG_EXEMPT_SMALL_SITE'] },
  { name: 'GB 0.4 ha flats — BNG applies', params: flats(), expect: ['GB.ENV.BNG_10_PERCENT'], absent: ['GB.ENV.BNG_EXEMPT_SMALL_SITE'] },
  { name: 'GB exactly 0.2 ha — exempt', params: newHouse({ siteAreaHa: 0.2 }), expect: ['GB.ENV.BNG_EXEMPT_SMALL_SITE'], absent: ['GB.ENV.BNG_10_PERCENT'] },
  { name: 'GB site area unknown — BNG applies (cautious)', params: newHouse({ siteAreaHa: undefined }), expect: ['GB.ENV.BNG_10_PERCENT'] },
  { name: 'GB self-build on 0.3 ha — exemption removed, BNG applies', params: newHouse({ siteAreaHa: 0.3, domesticClient: true }), expect: ['GB.ENV.BNG_10_PERCENT', 'GB.ENV.BNG_SELF_BUILD_EXEMPTION_REMOVED'] },
  { name: 'GB temporary building ≤ 5 years — BNG exempt', params: office({ temporary: true }), expect: [], absent: ['GB.ENV.BNG_10_PERCENT'] },
  { name: 'GB householder application — BNG does not apply', params: semiExt({ extensionDepth: 9 }), expect: ['GB.ENV.BNG_EXEMPT_HOUSEHOLDER'], absent: ['GB.ENV.BNG_10_PERCENT'] },
  { name: 'GB permitted development — no BNG items at all', params: semiExt(), expect: [], absent: ['GB.ENV.BNG_10_PERCENT', 'GB.ENV.BNG_EXEMPT_HOUSEHOLDER', 'GB.ENV.BNG_EXEMPT_SMALL_SITE'] },

  // ── Building control route ─────────────────────────────────────────────────
  { name: 'GB extension — building regs approval, plans or notice', params: semiExt(), expect: ['GB.PERMIT.BUILDING_REGS_APPROVAL', 'GB.PERMIT.FULL_PLANS_OR_NOTICE', 'GB.PERMIT.APPROVAL_LAPSES_3_YEARS', 'GB.PERMIT.COMMENCEMENT_NOTICE', 'GB.PERMIT.COMPLETION_CERTIFICATE', 'GB.ACCESS.PART_K', 'GB.INFRA.DRAINAGE_PART_H', 'GB.INFRA.ELECTRICAL_PART_P'], absent: ['GB.ENV.CONTAMINATION', 'GB.PERMIT.FULL_PLANS_REQUIRED'], },
  { name: 'GB block of flats — building notice barred', params: flats(), expect: ['GB.PERMIT.FULL_PLANS_REQUIRED'], absent: ['GB.PERMIT.FULL_PLANS_OR_NOTICE'] },
  { name: 'GB office — building notice barred (Fire Safety Order)', params: office(), expect: ['GB.PERMIT.FULL_PLANS_REQUIRED', 'GB.FIRE.FIRE_SAFETY_ORDER', 'GB.FIRE.REG_38_HANDOVER'] },
  { name: 'GB new house — EPC on completion, site preparation', params: newHouse(), expect: ['GB.PERMIT.EPC', 'GB.ENV.CONTAMINATION'] },
  { name: 'GB office — no domestic electrical (Part P) item', params: office(), expect: [], absent: ['GB.INFRA.ELECTRICAL_PART_P'] },

  // ── Higher-risk buildings ──────────────────────────────────────────────────
  { name: 'GB 24 m / 8-storey flats — HRB: BSR, Gateways 2 & 3, registration', params: tower(), expect: ['GB.SUPERVISION.HRB_BSR_BCA', 'GB.SUPERVISION.GATEWAY_2', 'GB.SUPERVISION.GATEWAY_3', 'GB.SUPERVISION.HRB_REGISTRATION', 'GB.SUPERVISION.GOLDEN_THREAD', 'GB.SUPERVISION.CHANGE_CONTROL', 'GB.SUPERVISION.MANDATORY_OCCURRENCE_REPORTING', 'GB.PLANNING.FIRE_STATEMENT_GATEWAY_1'], absent: ['GB.PERMIT.COMPLETION_CERTIFICATE', 'GB.PERMIT.APPROVAL_LAPSES_3_YEARS'] },
  { name: 'GB 15 m flats — not HRB', params: flats(), expect: [], absent: ['GB.SUPERVISION.HRB_BSR_BCA', 'GB.SUPERVISION.GATEWAY_2', 'GB.PLANNING.FIRE_STATEMENT_GATEWAY_1'] },
  { name: 'GB 17 m but 7 storeys — HRB by storeys', params: flats({ height: 17, storeys: 7 }), expect: ['GB.SUPERVISION.GATEWAY_2', 'GB.PLANNING.FIRE_STATEMENT_GATEWAY_1'] },
  { name: 'GB exactly 18 m — HRB', params: flats({ height: 18, storeys: 6 }), expect: ['GB.SUPERVISION.HRB_BSR_BCA'] },
  { name: 'GB 20 m office — not HRB (no residential units)', params: office({ height: 20, storeys: 5 }), expect: [], absent: ['GB.SUPERVISION.HRB_BSR_BCA', 'GB.PLANNING.FIRE_STATEMENT_GATEWAY_1'] },
  { name: 'GB HRB — principal designer and contractor for building regs', params: tower({ contractors: 1 }), expect: ['GB.DESIGN.PART_2A_PRINCIPAL_DESIGNER'] },

  // ── Fire ───────────────────────────────────────────────────────────────────
  { name: 'GB 15 m flats — sprinklers, wayfinding, info box (> 11 m)', params: flats(), expect: ['GB.FIRE.SPRINKLERS_11M', 'GB.FIRE.WAYFINDING_11M', 'GB.FIRE.SECURE_INFORMATION_BOX'], absent: ['GB.FIRE.EVACUATION_ALERT', 'GB.FIRE.SECOND_STAIRCASE_18M'] },
  { name: 'GB 10 m flats — no 11 m measures', params: flats({ height: 10, storeys: 3, apartments: 9 }), expect: [], absent: ['GB.FIRE.SPRINKLERS_11M', 'GB.FIRE.WAYFINDING_11M'] },
  { name: 'GB 24 m tower — second staircase, evacuation alert, reg 7(2)', params: tower(), expect: ['GB.FIRE.SECOND_STAIRCASE_18M', 'GB.FIRE.EVACUATION_ALERT', 'GB.FIRE.COMBUSTIBLE_EXTERNAL_WALLS'] },
  { name: 'GB exactly 18 m — evacuation alert but no second staircase (over 18 m only)', params: flats({ height: 18, storeys: 6 }), expect: ['GB.FIRE.EVACUATION_ALERT', 'GB.FIRE.COMBUSTIBLE_EXTERNAL_WALLS'], absent: ['GB.FIRE.SECOND_STAIRCASE_18M'] },
  { name: 'GB new house — Part B only, no flat measures', params: newHouse(), expect: ['GB.FIRE.PART_B'], absent: ['GB.FIRE.SPRINKLERS_11M', 'GB.FIRE.FIRE_SAFETY_ORDER', 'GB.FIRE.REG_38_HANDOVER'] },

  // ── Dutyholders & CDM ──────────────────────────────────────────────────────
  { name: 'GB domestic client, one builder — domestic CDM duties, no PD/PC', params: semiExt(), expect: ['GB.SUPERVISION.CDM_DOMESTIC_CLIENT', 'GB.SUPERVISION.CDM_CONSTRUCTION_PHASE_PLAN', 'GB.DESIGN.PART_2A_COMPETENCE'], absent: ['GB.SUPERVISION.CDM_CLIENT_DUTIES', 'GB.SUPERVISION.CDM_PD_PC', 'GB.DESIGN.PART_2A_PRINCIPAL_DESIGNER'] },
  { name: 'GB new house, 3 contractors — PD + PC under CDM and Part 2A, H&S file', params: newHouse(), expect: ['GB.SUPERVISION.CDM_PD_PC', 'GB.DESIGN.PART_2A_PRINCIPAL_DESIGNER', 'GB.SUPERVISION.CDM_HEALTH_SAFETY_FILE', 'GB.SUPERVISION.CDM_CLIENT_DUTIES'] },
  { name: 'GB 160 days × 6 workers = 960 person-days — notifiable', params: newHouse(), expect: ['GB.SUPERVISION.CDM_F10'] },
  { name: 'GB 40 days × 10 workers = 400 person-days — not notifiable', params: newHouse({ constructionDays: 40, peakWorkers: 10 }), expect: [], absent: ['GB.SUPERVISION.CDM_F10'] },
  { name: 'GB 31 days × 21 workers — notifiable by duration and headcount', params: newHouse({ constructionDays: 31, peakWorkers: 21 }), expect: ['GB.SUPERVISION.CDM_F10'] },
  { name: 'GB boundary work — party wall notices', params: semiExt({ boundaryWork: true }), expect: ['GB.SUPERVISION.PARTY_WALL'] },
  { name: 'GB no boundary work — no party wall item', params: semiExt(), expect: [], absent: ['GB.SUPERVISION.PARTY_WALL'] },

  // ── Structure, energy, sound, access, infrastructure ───────────────────────
  { name: 'GB 5-storey flats — disproportionate collapse assessment', params: flats(), expect: ['GB.DESIGN.STRUCTURE_PART_A', 'GB.DESIGN.DISPROPORTIONATE_COLLAPSE'] },
  { name: 'GB 2-storey house — no disproportionate collapse item', params: newHouse(), expect: [], absent: ['GB.DESIGN.DISPROPORTIONATE_COLLAPSE'] },
  { name: 'GB new house — Part L (FHS dates), F, O, R, Q, G, M4(1), Part S', params: newHouse(), expect: ['GB.ENERGY.PART_L_NEW_DWELLING', 'GB.ENERGY.PART_F_VENTILATION', 'GB.ENERGY.PART_O_OVERHEATING', 'GB.INFRA.GIGABIT_BROADBAND', 'GB.INFRA.SECURITY_PART_Q', 'GB.INFRA.WATER_EFFICIENCY', 'GB.ACCESS.M4_1', 'GB.ACCESS.M4_2_3_CONDITION_CHECK', 'GB.INFRA.EV_CHARGING_DWELLINGS'] },
  { name: 'GB new house without parking — no Part S item', params: newHouse({ parkingSpaces: 0 }), expect: [], absent: ['GB.INFRA.EV_CHARGING_DWELLINGS'] },
  { name: 'GB extension — Part L extension rules, not new-dwelling rules', params: semiExt(), expect: ['GB.ENERGY.PART_L_EXTENSION'], absent: ['GB.ENERGY.PART_L_NEW_DWELLING', 'GB.ENERGY.PART_O_OVERHEATING', 'GB.ACCESS.M4_1', 'GB.PERMIT.EPC'] },
  { name: 'GB office — SBEM, AD M Vol 2, EV for > 10 spaces, no Part O', params: office(), expect: ['GB.ENERGY.PART_L_NON_DOMESTIC', 'GB.ACCESS.M_NON_DOMESTIC', 'GB.INFRA.EV_CHARGING_NON_RES'], absent: ['GB.ENERGY.PART_O_OVERHEATING', 'GB.INFRA.EV_CHARGING_DWELLINGS'] },
  { name: 'GB flats — pre-completion sound testing', params: flats(), expect: ['GB.SOUND.PART_E', 'GB.SOUND.PRE_COMPLETION_TESTING'] },
  { name: 'GB detached house — Part E but no separating-wall testing', params: newHouse(), expect: ['GB.SOUND.PART_E'], absent: ['GB.SOUND.PRE_COMPLETION_TESTING'] },
  { name: 'GB terraced new house — sound testing', params: newHouse({ buildingType: 'terraced' }), expect: ['GB.SOUND.PRE_COMPLETION_TESTING'] },
  { name: 'GB radon affected area — radon protection', params: newHouse({ radonAffectedArea: true }), expect: ['GB.ENV.RADON'] },
  { name: 'GB no radon flag — no radon item', params: newHouse(), expect: [], absent: ['GB.ENV.RADON'] },
]

export const GB_RULE_IDS = Array.from(new Set(GB_FIXTURES.flatMap((f) => [...f.expect, ...(f.absent ?? [])]))).sort()
