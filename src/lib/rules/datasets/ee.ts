/**
 * Estonia — Ehitusseadustik rule set v1.0
 * Source: docs/coordin-ee-regulatory-dataset-v1.md (30 Oct 2026). Confidence per rule mirrors that document.
 * Bilingual: `title` English, `titleLocal` Estonian. Citations are the obligation's legal basis.
 *
 * Scope v1: new-build / extension of detached houses and 3–5 storey apartment blocks (+ edge tiers).
 * Rules are predicates over ProjectParameters. No I/O. No model.
 */
import type { ProjectParameters as P, Rule, RuleSet } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────
const isHouse = (p: P) => p.buildingType === 'detached_house' || p.buildingType === 'semi_detached' || p.buildingType === 'terraced'
const isBlock = (p: P) => p.buildingType === 'apartment_block'
const isBuild = (p: P) => p.workType === 'new_build' || p.workType === 'extension' || p.workType === 'reconstruction'
const isDemolition = (p: P) => p.workType === 'demolition'
const area = (p: P) => p.grossFloorArea ?? 0
const h = (p: P) => p.height ?? 0
const st = (p: P) => p.storeys ?? 1

// Permit tier — EhS Lisa 1 (amended 01.08.2026)
const tierNone = (p: P) => isBuild(p) && area(p) < 20 && h(p) <= 5 && st(p) <= 2
const tierNotice = (p: P) => isBuild(p) && area(p) >= 20 && area(p) <= 60 && h(p) <= 5 && st(p) <= 2
const tierPermit = (p: P) => isBuild(p) && (area(p) > 60 || h(p) > 5 || st(p) > 2)

// Energy exemptions — § 62 (2)
const energyExempt = (p: P) => Boolean(p.temporary || p.seasonalUseOnly || p.placeOfWorship || (p.enclosedNetArea != null && p.enclosedNetArea <= 50))
const energyApplies = (p: P) => isBuild(p) && !energyExempt(p)

const RADON_COUNTIES = ['harju', 'tallinn', 'lääne-viru', 'laane-viru', 'ida-viru']

// ── rules ────────────────────────────────────────────────────────────────────
const EhS = 'Ehitusseadustik'
const REG17 = 'Siseministri määrus nr 17 (30.03.2017) — Ehitisele esitatavad tuleohutusnõuded'
const REG58 = 'Vabariigi Valitsuse määrus nr 58 (30.08.2012) — Energiatõhususe miinimumnõuded'
const EVS842 = 'EVS 842:2003 — Ehitiste heliisolatsiooninõuded'
const EVS812 = 'EVS 812-7:2018 — Ehitiste tuleohutus. Osa 7'

const rules: Rule[] = [
  // ── PERMIT ─────────────────────────────────────────────────────────────────
  { id: 'EE.PERMIT.NONE', jurisdiction: 'EE', discipline: 'permit', title: 'No permit or notice required', titleLocal: 'Ehitusluba ega ehitusteatist ei ole vaja', citation: 'Lisa 1', source: EhS, confidence: 'high',
    applies: tierNone, because: (p) => `Gross floor area ${area(p)} m² < 20 m² and height ${h(p)} m ≤ 5 m`, requirement: 'Building < 20 m² and ≤ 5 m: no building notice or permit (2026 amendment).' },
  { id: 'EE.PERMIT.NOTICE', jurisdiction: 'EE', discipline: 'permit', title: 'Building notice (ehitusteatis) required', titleLocal: 'Ehitusteatis', citation: '§ 35, Lisa 1', source: EhS, confidence: 'high',
    applies: tierNotice, because: (p) => `Gross floor area ${area(p)} m² (20–60 m²), height ${h(p)} m ≤ 5 m, ${st(p)} storey(s)`, requirement: 'Submit a building notice via Ehitisregister at least 10 days before work starts.' },
  { id: 'EE.PERMIT.NOTICE_10_DAYS', jurisdiction: 'EE', discipline: 'permit', title: 'Authority may impose conditions within 10 days of notice', titleLocal: 'Omavalitsus võib 10 päeva jooksul esitada nõudeid', citation: '§ 36', source: EhS, confidence: 'high',
    applies: tierNotice, requirement: 'Do not start work before the 10-day window has passed without objection.' },
  { id: 'EE.PERMIT.NOTICE_VALIDITY_4Y', jurisdiction: 'EE', discipline: 'permit', title: 'Building notice valid for 4 years', titleLocal: 'Ehitusteatis kehtib 4 aastat', citation: '§ 37 (2026 amendment)', source: EhS, confidence: 'medium',
    applies: tierNotice, requirement: 'Validity extended from 2 to 4 years (effective 01.08.2026).' },
  { id: 'EE.PERMIT.BUILDING_PERMIT', jurisdiction: 'EE', discipline: 'permit', title: 'Building permit (ehitusluba) required', titleLocal: 'Ehitusluba', citation: '§ 38, Lisa 1', source: EhS, confidence: 'high',
    applies: tierPermit, because: (p) => area(p) > 60 ? `Gross floor area ${area(p)} m² > 60 m²` : h(p) > 5 ? `Height ${h(p)} m > 5 m` : `${st(p)} storeys > 2`, requirement: 'Apply via Ehitisregister with design documentation by a qualified designer.' },
  { id: 'EE.PERMIT.DECISION_30_DAYS', jurisdiction: 'EE', discipline: 'permit', title: 'Permit decision within 30 days (60 if complex)', titleLocal: 'Ehitusloa otsus 30 päeva jooksul', citation: '§ 42', source: EhS, confidence: 'high',
    applies: tierPermit, requirement: 'Plan for a 30-day authority review; 60 days where expert review is needed.' },
  { id: 'EE.PERMIT.VALIDITY_5Y', jurisdiction: 'EE', discipline: 'permit', title: 'Building permit valid 5 years (7 if work started)', titleLocal: 'Ehitusluba kehtib 5 aastat', citation: '§ 45', source: EhS, confidence: 'high',
    applies: tierPermit },
  { id: 'EE.PERMIT.EHR_SUBMISSION', jurisdiction: 'EE', discipline: 'permit', title: 'Submit through the Building Register (Ehitisregister)', titleLocal: 'Esitamine ehitisregistri kaudu', citation: '§ 58–61', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) || tierNotice(p), requirement: 'All notices, permits and documents go through ehr.ee.' },
  { id: 'EE.PERMIT.COMMENCEMENT_NOTICE_3_DAYS', jurisdiction: 'EE', discipline: 'permit', title: 'Notice of commencement ≥ 3 days before work starts', titleLocal: 'Ehitamise alustamise teatis vähemalt 3 päeva enne', citation: '§ 43', source: EhS, confidence: 'high',
    applies: tierPermit },
  { id: 'EE.PERMIT.USE_NOTICE', jurisdiction: 'EE', discipline: 'permit', title: 'Notice of use (kasutusteatis) before habitation', titleLocal: 'Kasutusteatis', citation: '§ 47 (2026 amendment)', source: EhS, confidence: 'medium',
    applies: (p) => tierPermit(p) && isHouse(p), requirement: '2026 amendment: notice of use replaces the use permit for private and semi-detached houses.' },
  { id: 'EE.PERMIT.USE_PERMIT', jurisdiction: 'EE', discipline: 'permit', title: 'Use and occupancy permit (kasutusluba) before habitation', titleLocal: 'Kasutusluba', citation: '§ 47–57', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) && !isHouse(p), requirement: 'Issued within 30 days of application (§ 54).' },
  { id: 'EE.PERMIT.DEMOLITION', jurisdiction: 'EE', discipline: 'permit', title: 'Demolition notice / permit', titleLocal: 'Lammutamise teatis / luba', citation: '§ 35, § 38, Lisa 1', source: EhS, confidence: 'medium',
    applies: isDemolition, requirement: 'Demolition follows the same notice/permit tiers as construction (Lisa 1).' },

  // ── PLANNING ───────────────────────────────────────────────────────────────
  { id: 'EE.PLANNING.DESIGN_CONDITIONS', jurisdiction: 'EE', discipline: 'planning', title: 'Design conditions (projekteerimistingimused) required — no detailed plan', titleLocal: 'Projekteerimistingimused', citation: '§ 26–34', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && tierPermit(p) && !p.detailedPlanExists, requirement: 'Apply to the municipality for design conditions before the building permit; they set footprint, height, setbacks, architectural requirements.' },
  { id: 'EE.PLANNING.DETAILED_PLAN_COMPLIANCE', jurisdiction: 'EE', discipline: 'planning', title: 'Comply with the detailed spatial plan in force', titleLocal: 'Vastavus kehtivale detailplaneeringule', citation: 'Planeerimisseadus § 124–140', source: 'Planeerimisseadus', confidence: 'high',
    applies: (p) => isBuild(p) && p.detailedPlanExists === true && (p.detailedPlanAgeYears ?? 0) <= 5 },
  { id: 'EE.PLANNING.DESIGN_SPEC_PLAN_OVER_5Y', jurisdiction: 'EE', discipline: 'planning', title: 'Design specification needed — detailed plan older than 5 years', titleLocal: 'Projekteerimistingimused detailplaneeringu täpsustamiseks', citation: '§ 27', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && p.detailedPlanExists === true && (p.detailedPlanAgeYears ?? 0) > 5, because: (p) => `Plan is ${p.detailedPlanAgeYears} years old` },
  { id: 'EE.PLANNING.DETAILED_PLAN_TYPICALLY_REQUIRED', jurisdiction: 'EE', discipline: 'planning', title: 'Detailed plan typically required for apartment blocks', titleLocal: 'Detailplaneeringu koostamise kohustus', citation: 'Planeerimisseadus § 125', source: 'Planeerimisseadus', confidence: 'medium',
    applies: (p) => isBlock(p) && !p.detailedPlanExists, requirement: 'Municipality may allow design conditions instead (§ 125 lg 5) if the site is within existing built-up area.' },
  { id: 'EE.PLANNING.HERITAGE_CONDITIONS', jurisdiction: 'EE', discipline: 'planning', title: 'Heritage Board (Muinsuskaitseamet) conditions', titleLocal: 'Muinsuskaitse eritingimused', citation: 'Muinsuskaitseseadus § 52', source: 'Muinsuskaitseseadus', confidence: 'high',
    applies: (p) => Boolean(p.heritage) },

  // ── DESIGN ─────────────────────────────────────────────────────────────────
  { id: 'EE.DESIGN.QUALIFIED_DESIGNER', jurisdiction: 'EE', discipline: 'design', title: 'Design documentation by a qualified designer', titleLocal: 'Ehitusprojekti koostab pädev isik', citation: '§ 14', source: EhS, confidence: 'high',
    applies: tierPermit },
  { id: 'EE.DESIGN.STRUCTURAL', jurisdiction: 'EE', discipline: 'design', title: 'Structural design required', titleLocal: 'Konstruktsioonide projekt', citation: '§ 14', source: EhS, confidence: 'high',
    applies: tierPermit },
  { id: 'EE.DESIGN.STRUCTURAL_ENGINEER', jurisdiction: 'EE', discipline: 'design', title: 'Architect AND structural engineer required', titleLocal: 'Arhitekt ja ehituskonstruktor', citation: '§ 14', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) && isBlock(p) },
  { id: 'EE.DESIGN.GEOTECHNICAL_MANDATORY', jurisdiction: 'EE', discipline: 'design', title: 'Geotechnical survey mandatory', titleLocal: 'Ehitusgeoloogiline uuring kohustuslik', citation: '§ 14 lg 3', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) && isBlock(p) },
  { id: 'EE.DESIGN.GEOTECHNICAL_RECOMMENDED', jurisdiction: 'EE', discipline: 'design', title: 'Geotechnical survey recommended', titleLocal: 'Ehitusgeoloogiline uuring soovituslik', citation: '§ 14 lg 3', source: EhS, confidence: 'medium',
    applies: (p) => tierPermit(p) && isHouse(p) },
  { id: 'EE.DESIGN.EXPERT_REVIEW_POSSIBLE', jurisdiction: 'EE', discipline: 'design', title: 'Authority may require expert review (> 3 storeys)', titleLocal: 'Ehitusprojekti ekspertiis võib olla nõutav', citation: '§ 14 lg 3, § 42', source: EhS, confidence: 'medium',
    applies: (p) => tierPermit(p) && st(p) > 3, because: (p) => `${st(p)} storeys` },
  { id: 'EE.DESIGN.COMPETENT_PERSON_CERT', jurisdiction: 'EE', discipline: 'design', title: 'Competent person certificate for design and supervision', titleLocal: 'Pädevustunnistus', citation: '§ 24', source: EhS, confidence: 'high',
    applies: tierPermit },

  // ── SUPERVISION ────────────────────────────────────────────────────────────
  { id: 'EE.SUPERVISION.OWNER_APPOINTED', jurisdiction: 'EE', discipline: 'supervision', title: 'Owner-appointed supervisor (may self-supervise if competent)', titleLocal: 'Omanikujärelevalve', citation: '§ 19–20', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) && isHouse(p) },
  { id: 'EE.SUPERVISION.LICENSED_MANDATORY', jurisdiction: 'EE', discipline: 'supervision', title: 'Licensed construction supervisor mandatory', titleLocal: 'Pädev omanikujärelevalve kohustuslik', citation: '§ 19–20', source: EhS, confidence: 'high',
    applies: (p) => tierPermit(p) && isBlock(p) },

  // ── FIRE ───────────────────────────────────────────────────────────────────
  { id: 'EE.FIRE.CLASS_TP3', jurisdiction: 'EE', discipline: 'fire', title: 'Fire resistance class TP3 (tuld kartev)', titleLocal: 'Tulepüsivusklass TP3', citation: '§ 6', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isHouse(p) && st(p) <= 2, because: (p) => `${st(p)} storey residential` },
  { id: 'EE.FIRE.CLASS_TP2', jurisdiction: 'EE', discipline: 'fire', title: 'Fire resistance class TP2 (tuld takistav)', titleLocal: 'Tulepüsivusklass TP2', citation: '§ 6', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && (isBlock(p) || st(p) > 2) && st(p) <= 8, because: (p) => `${st(p)} storeys (3–8)` },
  { id: 'EE.FIRE.CLASS_TP1', jurisdiction: 'EE', discipline: 'fire', title: 'Fire resistance class TP1 (tulekindel)', titleLocal: 'Tulepüsivusklass TP1', citation: '§ 6', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && st(p) >= 9, because: (p) => `${st(p)} storeys ≥ 9` },
  { id: 'EE.FIRE.SINGLE_COMPARTMENT', jurisdiction: 'EE', discipline: 'fire', title: 'Whole house is one fire compartment', titleLocal: 'Hoone moodustab ühe tuletõkkesektsiooni', citation: '§ 10', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isHouse(p) },
  { id: 'EE.FIRE.APARTMENT_COMPARTMENTS', jurisdiction: 'EE', discipline: 'fire', title: 'Each apartment a separate fire compartment', titleLocal: 'Iga korter eraldi tuletõkkesektsioon', citation: '§ 10', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.ONE_EXIT', jurisdiction: 'EE', discipline: 'fire', title: 'One exit to the outside sufficient', titleLocal: 'Üks väljapääs', citation: '§ 23', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isHouse(p) },
  { id: 'EE.FIRE.TWO_ESCAPE_ROUTES', jurisdiction: 'EE', discipline: 'fire', title: 'Minimum 2 independent escape routes per floor', titleLocal: 'Vähemalt 2 sõltumatut evakuatsiooniteed korrusel', citation: '§ 23', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.TRAVEL_25M', jurisdiction: 'EE', discipline: 'fire', title: 'Max 25 m travel distance to escape route', titleLocal: 'Evakuatsioonitee pikkus kuni 25 m', citation: '§ 24', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.SMOKE_ALARMS', jurisdiction: 'EE', discipline: 'fire', title: 'Smoke alarms in every dwelling', titleLocal: 'Suitsuandur igas eluruumis', citation: 'Tuleohutuse seadus § 11', source: 'Tuleohutuse seadus', confidence: 'high',
    applies: (p) => isBuild(p) && (isHouse(p) || isBlock(p)) },
  { id: 'EE.FIRE.SMOKE_ALARMS_COMMON', jurisdiction: 'EE', discipline: 'fire', title: 'Smoke alarms in common areas', titleLocal: 'Suitsuandurid üldkasutatavates ruumides', citation: 'Tuleohutuse seadus § 11', source: 'Tuleohutuse seadus', confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.ADDRESSABLE_DETECTION_POSSIBLE', jurisdiction: 'EE', discipline: 'fire', title: 'Addressable fire detection may be required (> 3 storeys)', titleLocal: 'Adresseeritav tulekahjusignalisatsioon võib olla nõutav', citation: '§ 34', source: REG17, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) && st(p) > 3 },
  { id: 'EE.FIRE.SPRINKLERS', jurisdiction: 'EE', discipline: 'fire', title: 'Sprinkler system', titleLocal: 'Sprinklersüsteem', citation: '§ 35', source: REG17, confidence: 'medium',
    applies: (p) => isBuild(p) && !isHouse(p) && area(p) >= 1200 && st(p) > 8, requirement: 'Residential < 1,200 m² not required; 3–5 storey blocks depend on compartment size.' },
  { id: 'EE.FIRE.BRIGADE_ACCESS_50M', jurisdiction: 'EE', discipline: 'fire', title: 'Fire brigade access within 50 m', titleLocal: 'Päästemeeskonna juurdepääs 50 m', citation: '§ 40', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isHouse(p) },
  { id: 'EE.FIRE.TRUCK_ACCESS_TURNING', jurisdiction: 'EE', discipline: 'fire', title: 'Fire truck access road and turning area', titleLocal: 'Päästetehnika juurdepääsutee ja ümberpööramisala', citation: '§ 40', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) && st(p) > 4 },
  { id: 'EE.FIRE.DRY_RISER', jurisdiction: 'EE', discipline: 'fire', title: 'Dry riser connections (> 4 storeys)', titleLocal: 'Kuivtõusutoru', citation: '§ 41', source: REG17, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) && st(p) > 4 },
  { id: 'EE.FIRE.EMERGENCY_LIGHTING', jurisdiction: 'EE', discipline: 'fire', title: 'Emergency lighting in escape routes and common areas', titleLocal: 'Evakuatsioonivalgustus', citation: '§ 27', source: REG17, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.EVACUATION_PLAN', jurisdiction: 'EE', discipline: 'fire', title: 'Operational map / evacuation plan; rescue access', titleLocal: 'Operatiivkaart ja evakuatsiooniskeem', citation: 'Tuleohutuse seadus § 11', source: 'Tuleohutuse seadus', confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.FIRE.TIMBER_ALLOWED_TO_8', jurisdiction: 'EE', discipline: 'fire', title: 'Timber structure permitted up to 8 storeys (TP2)', titleLocal: 'Puitkonstruktsioon lubatud kuni 8 korrust', citation: 'EVS 812-7 § 5', source: EVS812, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.timberStructure) && st(p) <= 8 },
  { id: 'EE.FIRE.TIMBER_AUTOMATED_5_TO_8', jurisdiction: 'EE', discipline: 'fire', title: 'Automated firefighting required for timber 5–8 storeys', titleLocal: 'Automaatne kustutussüsteem puithoonel 5–8 korrust', citation: 'EVS 812-7 § 5', source: EVS812, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.timberStructure) && st(p) >= 5 && st(p) <= 8 },
  { id: 'EE.FIRE.TIMBER_OVER_8_NOT_PERMITTED', jurisdiction: 'EE', discipline: 'fire', title: 'Timber structure not permitted above 8 storeys under TP2', titleLocal: 'Puitkonstruktsioon üle 8 korruse ei ole lubatud', citation: 'EVS 812-7 § 5', source: EVS812, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.timberStructure) && st(p) > 8 },

  // ── ENERGY ─────────────────────────────────────────────────────────────────
  { id: 'EE.ENERGY.NZEB', jurisdiction: 'EE', discipline: 'energy', title: 'Nearly zero-energy building (nZEB) required', titleLocal: 'Liginullenergiahoone', citation: '§ 3', source: REG58, confidence: 'high',
    applies: energyApplies },
  { id: 'EE.ENERGY.TARGET_HOUSE_50', jurisdiction: 'EE', discipline: 'energy', title: 'Primary energy ≤ 50 kWh/m²/year (detached house)', titleLocal: 'Energiatõhususarv ≤ 50 kWh/(m²·a)', citation: '§ 4 (value to verify — some sources cite 120)', source: REG58, confidence: 'medium',
    applies: (p) => energyApplies(p) && isHouse(p) },
  { id: 'EE.ENERGY.TARGET_BLOCK_100', jurisdiction: 'EE', discipline: 'energy', title: 'Primary energy ≤ 100 kWh/m²/year (apartment block)', titleLocal: 'Energiatõhususarv ≤ 100 kWh/(m²·a)', citation: '§ 4', source: REG58, confidence: 'high',
    applies: (p) => energyApplies(p) && isBlock(p) },
  { id: 'EE.ENERGY.SIMPLIFIED_CALC', jurisdiction: 'EE', discipline: 'energy', title: 'Simplified energy calculation (heated area < 220 m²)', titleLocal: 'Lihtsustatud energiaarvutus', citation: '§ 6', source: REG58, confidence: 'medium',
    applies: (p) => energyApplies(p) && isHouse(p) && (p.heatedArea ?? area(p)) < 220, because: (p) => `Heated area ${p.heatedArea ?? area(p)} m² < 220 m²` },
  { id: 'EE.ENERGY.DYNAMIC_SIMULATION', jurisdiction: 'EE', discipline: 'energy', title: 'Dynamic energy simulation required', titleLocal: 'Dünaamiline energiasimulatsioon', citation: '§ 6', source: REG58, confidence: 'medium',
    applies: (p) => energyApplies(p) && (isBlock(p) || (p.heatedArea ?? area(p)) >= 220) },
  { id: 'EE.ENERGY.EPC_AT_PERMIT_AND_USE', jurisdiction: 'EE', discipline: 'energy', title: 'Energy performance certificate at permit and at use', titleLocal: 'Energiamärgis ehitusloa ja kasutusloa taotlemisel', citation: '§ 62–69⁴', source: EhS, confidence: 'high',
    applies: energyApplies },
  { id: 'EE.ENERGY.RENEWABLE_ONSITE', jurisdiction: 'EE', discipline: 'energy', title: 'On-site or nearby renewable energy contribution', titleLocal: 'Taastuvenergia kasutamine', citation: '§ 3', source: REG58, confidence: 'medium',
    applies: energyApplies },
  { id: 'EE.ENERGY.MVHR_MANDATORY', jurisdiction: 'EE', discipline: 'energy', title: 'Mechanical ventilation with heat recovery mandatory', titleLocal: 'Soojustagastusega mehaaniline ventilatsioon', citation: '§ 8', source: REG58, confidence: 'medium',
    applies: (p) => energyApplies(p) && isBlock(p) },
  { id: 'EE.ENERGY.AIRTIGHT_N50_1_5', jurisdiction: 'EE', discipline: 'energy', title: 'Airtightness n50 ≤ 1.5 h⁻¹ (multi-storey)', titleLocal: 'Õhulekkearv n50 ≤ 1,5', citation: 'indicative — verify in reg. 58', source: REG58, confidence: 'low',
    applies: (p) => energyApplies(p) && isBlock(p) },
  { id: 'EE.ENERGY.HEATING_EFFICIENCY_80', jurisdiction: 'EE', discipline: 'energy', title: 'Heating system seasonal efficiency ≥ 80%', titleLocal: 'Küttesüsteemi sesoonne kasutegur ≥ 80%', citation: '§ 69²', source: EhS, confidence: 'high',
    applies: energyApplies },
  { id: 'EE.ENERGY.ROOM_TEMP_CONTROL', jurisdiction: 'EE', discipline: 'energy', title: 'Self-regulating room temperature control', titleLocal: 'Ruumipõhine temperatuuri reguleerimine', citation: '§ 69²', source: EhS, confidence: 'high',
    applies: energyApplies },
  { id: 'EE.ENERGY.EXEMPT_SMALL', jurisdiction: 'EE', discipline: 'energy', title: 'Energy requirements exempt — enclosed net area ≤ 50 m²', titleLocal: 'Energiatõhususnõuded ei kohaldu (≤ 50 m²)', citation: '§ 62 lg 2', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && p.enclosedNetArea != null && p.enclosedNetArea <= 50 },
  { id: 'EE.ENERGY.EXEMPT_SEASONAL', jurisdiction: 'EE', discipline: 'energy', title: 'Energy requirements exempt — seasonal use < 4 months/year', titleLocal: 'Energiatõhususnõuded ei kohaldu (hooajaline kasutus)', citation: '§ 62 lg 2', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.seasonalUseOnly) },
  { id: 'EE.ENERGY.EXEMPT_TEMPORARY', jurisdiction: 'EE', discipline: 'energy', title: 'Energy requirements exempt — temporary building ≤ 2 years', titleLocal: 'Energiatõhususnõuded ei kohaldu (ajutine ehitis)', citation: '§ 62 lg 2', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.temporary) },
  { id: 'EE.ENERGY.EXEMPT_HERITAGE_CONDITIONAL', jurisdiction: 'EE', discipline: 'energy', title: 'Heritage exemption where compliance would alter appearance', titleLocal: 'Erand mälestisele, kui nõuded muudaksid välisilmet', citation: '§ 62 lg 2', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && Boolean(p.heritage) },

  // ── SOUND ──────────────────────────────────────────────────────────────────
  { id: 'EE.SOUND.AIRBORNE_55', jurisdiction: 'EE', discipline: 'sound', title: "Airborne sound insulation between apartments R'w ≥ 55 dB", titleLocal: 'Õhumüra isolatsioon korterite vahel ≥ 55 dB', citation: 'Table 1', source: EVS842, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.SOUND.IMPACT_53', jurisdiction: 'EE', discipline: 'sound', title: "Impact sound L'n,w ≤ 53 dB between apartments", titleLocal: 'Löögimüra ≤ 53 dB', citation: 'Table 2', source: EVS842, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.SOUND.STAIRWELL_52', jurisdiction: 'EE', discipline: 'sound', title: "Apartment to stairwell R'w ≥ 52 dB", titleLocal: 'Korter–trepikoda ≥ 52 dB', citation: 'Table 1', source: EVS842, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.SOUND.TECHNICAL_ROOM_60', jurisdiction: 'EE', discipline: 'sound', title: "Apartment to technical room R'w ≥ 60 dB", titleLocal: 'Korter–tehnoruum ≥ 60 dB', citation: 'Table 1', source: EVS842, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.SOUND.FACADE', jurisdiction: 'EE', discipline: 'sound', title: 'Facade sound insulation — near major road / airport', titleLocal: 'Välispiirde heliisolatsioon', citation: 'Table 4', source: EVS842, confidence: 'medium',
    applies: (p) => isBuild(p) && Boolean(p.nearMajorRoad) },

  // ── ACCESSIBILITY ──────────────────────────────────────────────────────────
  { id: 'EE.ACCESS.STEP_FREE_COMMON', jurisdiction: 'EE', discipline: 'accessibility', title: 'Step-free entrance, corridors and common areas', titleLocal: 'Ligipääsetav sissepääs ja üldkasutatavad ruumid', citation: '§ 11', source: EhS, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.ACCESS.LIFT_OVER_4_STOREYS', jurisdiction: 'EE', discipline: 'accessibility', title: 'Lift mandatory (> 4 storeys, from 01.01.2027)', titleLocal: 'Lift kohustuslik üle 4 korruse', citation: '§ 11 (2026 amendment — threshold to confirm)', source: EhS, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) && st(p) > 4 },
  { id: 'EE.ACCESS.ADAPTABLE_1_IN_10', jurisdiction: 'EE', discipline: 'accessibility', title: '1 in 10 apartments adaptable (from 01.01.2027)', titleLocal: 'Iga kümnes korter kohandatav', citation: '§ 11 (2026 amendment)', source: EhS, confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p), because: (p) => p.apartments ? `${p.apartments} apartments → ${Math.ceil(p.apartments / 10)} adaptable` : undefined },
  { id: 'EE.ACCESS.PARKING', jurisdiction: 'EE', discipline: 'accessibility', title: 'Accessible parking spaces', titleLocal: 'Liikumispuudega inimeste parkimiskohad', citation: '§ 11', source: EhS, confidence: 'low',
    applies: (p) => isBuild(p) && isBlock(p) },

  // ── INFRASTRUCTURE ─────────────────────────────────────────────────────────
  { id: 'EE.INFRA.EV_CABLING_EACH_SPACE', jurisdiction: 'EE', discipline: 'infrastructure', title: 'EV charging cabling for each parking space (> 10 spaces, residential)', titleLocal: 'Elektriauto laadimise kaabeldus igale parkimiskohale', citation: '§ 65¹', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && (p.parkingSpaces ?? 0) > 10, because: (p) => `${p.parkingSpaces} parking spaces > 10` },
  { id: 'EE.INFRA.HIGH_SPEED_ACCESS_POINT', jurisdiction: 'EE', discipline: 'infrastructure', title: 'High-speed network building access point (2+ apartments)', titleLocal: 'Kiire elektroonilise side võrgu juurdepääsupunkt', citation: '§ 61¹–61¹¹', source: EhS, confidence: 'high',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.INFRA.WASTE_ROOM', jurisdiction: 'EE', discipline: 'infrastructure', title: 'Dedicated waste room or enclosed waste area', titleLocal: 'Jäätmeruum või piiratud jäätmeala', citation: 'local planning', source: 'Kohalik omavalitsus', confidence: 'medium',
    applies: (p) => isBuild(p) && isBlock(p) },
  { id: 'EE.INFRA.KERBSIDE_WASTE', jurisdiction: 'EE', discipline: 'infrastructure', title: 'Kerb-side waste collection', titleLocal: 'Jäätmete kogumine kinnistu piiril', citation: 'local planning', source: 'Kohalik omavalitsus', confidence: 'medium',
    applies: (p) => isBuild(p) && isHouse(p) },
  { id: 'EE.INFRA.DISTRICT_HEATING_CONNECT', jurisdiction: 'EE', discipline: 'infrastructure', title: 'District heating connection mandatory where available', titleLocal: 'Kaugküttega liitumise kohustus', citation: 'Kaugkütteseadus § 5', source: 'Kaugkütteseadus / local planning', confidence: 'medium',
    applies: (p) => isBuild(p) && Boolean(p.districtHeatingAvailable) },
  { id: 'EE.INFRA.MUNICIPAL_WATER_SEWAGE', jurisdiction: 'EE', discipline: 'infrastructure', title: 'Municipal water and sewage connection mandatory (urban area)', titleLocal: 'Ühisveevärgi ja -kanalisatsiooniga liitumine', citation: 'ÜVVKS § 8', source: 'Ühisveevärgi ja -kanalisatsiooni seadus', confidence: 'medium',
    applies: (p) => isBuild(p) && Boolean(p.urbanArea) },
  { id: 'EE.INFRA.PRIVATE_WATER_SEWAGE_ALLOWED', jurisdiction: 'EE', discipline: 'infrastructure', title: 'Private water / local sewage solution allowed (rural)', titleLocal: 'Lokaalne vee- ja kanalisatsioonilahendus lubatud', citation: 'local planning', source: 'Kohalik omavalitsus', confidence: 'medium',
    applies: (p) => isBuild(p) && p.urbanArea === false },

  // ── ENVIRONMENT ────────────────────────────────────────────────────────────
  { id: 'EE.ENV.EIA_SCREENING', jurisdiction: 'EE', discipline: 'environment', title: 'Environmental impact screening', titleLocal: 'Keskkonnamõju eelhinnang', citation: 'KeHJS § 6', source: 'Keskkonnamõju hindamise ja keskkonnajuhtimissüsteemi seadus', confidence: 'medium',
    applies: (p) => isBuild(p) && (Boolean(p.protectedArea) || isBlock(p)) },
  { id: 'EE.ENV.FULL_EIA_LIKELY', jurisdiction: 'EE', discipline: 'environment', title: 'Full environmental impact assessment likely', titleLocal: 'Keskkonnamõju hindamine tõenäoline', citation: 'KeHJS § 6', source: 'Keskkonnamõju hindamise ja keskkonnajuhtimissüsteemi seadus', confidence: 'low',
    applies: (p) => isBuild(p) && isBlock(p) && st(p) >= 10 && Boolean(p.protectedArea) },
  { id: 'EE.ENV.RADON_RISK_AREA', jurisdiction: 'EE', discipline: 'environment', title: 'Radon risk area — radon-safe design measures', titleLocal: 'Radooniohtlik ala — radooniohutu projekteerimine', citation: 'EVS 840 (thresholds to confirm)', source: 'EVS 840', confidence: 'low',
    applies: (p) => isBuild(p) && RADON_COUNTIES.includes((p.county ?? '').toLowerCase()), because: (p) => `${p.county} county is a known radon risk area` },
]

export const EE_RULESET: RuleSet = {
  jurisdiction: 'EE',
  version: 'EE-1.0',
  effectiveFrom: '2026-08-01',
  sourceUrl: 'https://www.riigiteataja.ee/akt/ehitusseadustik',
  rules,
}
