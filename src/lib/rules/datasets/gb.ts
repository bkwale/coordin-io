/**
 * England — Building Regulations, planning, CDM 2015, Building Safety Act and BNG rule set v1.0
 * Source: docs/coordin-gb-regulatory-dataset-v1.md (7 Nov 2026). Scope: ENGLAND ONLY — Wales, Scotland and
 * Northern Ireland have their own regimes and are not covered.
 *
 * Confidence: high = statute or Approved Document text checked; medium = current position from guidance or
 * thresholds that depend on local facts; low = a prompt to check, not a determination.
 * Rules are predicates over ProjectParameters. No I/O. No model. Unknown answers keep the cautious route.
 */
import type { ProjectParameters as P, Rule, RuleSet } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────
const isHouse = (p: P) => p.buildingType === 'detached_house' || p.buildingType === 'semi_detached' || p.buildingType === 'terraced'
const isDetached = (p: P) => p.buildingType === 'detached_house'
const isFlats = (p: P) => p.buildingType === 'apartment_block'
const isNonRes = (p: P) => p.buildingType === 'non_residential'
const isNew = (p: P) => p.workType === 'new_build'
const isExt = (p: P) => p.workType === 'extension'
const isBuild = (p: P) => p.workType === 'new_build' || p.workType === 'extension' || p.workType === 'reconstruction'
const isCoU = (p: P) => p.workType === 'change_of_use'
const isDemolition = (p: P) => p.workType === 'demolition'
const area = (p: P) => p.grossFloorArea ?? 0
const h = (p: P) => p.height ?? 0
const st = (p: P) => p.storeys ?? 1
/** New homes created by the project. */
/** Houses: a scheme of several houses carries its unit count in `apartments` (shown as "Dwellings" for England). */
const dwellings = (p: P) => (isFlats(p) ? p.apartments ?? 2 : isHouse(p) && (isNew(p) || isCoU(p)) ? Math.max(1, p.apartments ?? 1) : 0)
const newDwelling = (p: P) => (isNew(p) || isCoU(p)) && dwellings(p) >= 1
const residential = (p: P) => isHouse(p) || isFlats(p)
const designated = (p: P) => Boolean(p.conservationArea || p.protectedArea)

// ── planning route ───────────────────────────────────────────────────────────
/** Householder rear extension within Class A limits (GPDO 2015 Sch.2 Pt 1). */
const pdLimit = (p: P) => (isDetached(p) ? 4 : 3)
const largerLimit = (p: P) => (isDetached(p) ? 8 : 6)
const houseExt = (p: P) => isHouse(p) && isExt(p)
const depth = (p: P) => p.extensionDepth
/** Permitted-development limits are about the extension, not the house: use its own height/storeys when given. */
const extH = (p: P) => p.extensionHeight ?? h(p)
const extSt = (p: P) => p.extensionStoreys ?? st(p)
const pdRear = (p: P) =>
  houseExt(p) && !p.article4 && depth(p) !== undefined && extH(p) <= 4 && extSt(p) <= 1 && (depth(p) as number) <= pdLimit(p)
const pdTwoStorey = (p: P) =>
  houseExt(p) && !p.article4 && !designated(p) && extSt(p) === 2 && depth(p) !== undefined && (depth(p) as number) <= 3
const isPD = (p: P) => pdRear(p) || pdTwoStorey(p)
const largerHomeExt = (p: P) =>
  houseExt(p) && !p.article4 && !designated(p) && extSt(p) <= 1 && extH(p) <= 4 && depth(p) !== undefined &&
  (depth(p) as number) > pdLimit(p) && (depth(p) as number) <= largerLimit(p)
const householderApp = (p: P) => houseExt(p) && !isPD(p) && !largerHomeExt(p)
const fullPlanning = (p: P) => (isNew(p) || isCoU(p) || isBuild(p)) && !houseExt(p)
const needsPlanningPermission = (p: P) => householderApp(p) || fullPlanning(p)
const isMajor = (p: P) =>
  fullPlanning(p) && (dwellings(p) >= 10 || (residential(p) && (p.siteAreaHa ?? 0) >= 0.5) || area(p) >= 1000 || (p.siteAreaHa ?? 0) >= 1)

// ── building safety ──────────────────────────────────────────────────────────
/** Higher-risk building: ≥ 18 m or ≥ 7 storeys with ≥ 2 residential units (BSA 2022 s.120D; HRB (Descriptions) Regs 2023). */
const tall = (p: P) => h(p) >= 18 || st(p) >= 7
const isHRB = (p: P) => (isBuild(p) || isCoU(p)) && tall(p) && dwellings(p) >= 2
const relevantGateway1 = (p: P) => needsPlanningPermission(p) && tall(p) && dwellings(p) >= 2

// ── building regulations ─────────────────────────────────────────────────────
const brApplies = (p: P) => isBuild(p) || isCoU(p)
const buildingNoticeBarred = (p: P) => isHRB(p) || isNonRes(p) || isFlats(p)

// ── BNG ──────────────────────────────────────────────────────────────────────
const bngExemptSmall = (p: P) => p.siteAreaHa !== undefined && p.siteAreaHa <= 0.2 && p.priorityHabitat !== true
const bngExemptTemporary = (p: P) => Boolean(p.temporary) && p.priorityHabitat !== true
const bngApplies = (p: P) => fullPlanning(p) && !bngExemptSmall(p) && !bngExemptTemporary(p)

// ── CDM ──────────────────────────────────────────────────────────────────────
const multiContractor = (p: P) => (p.contractors ?? 1) > 1
const notifiable = (p: P) =>
  ((p.constructionDays ?? 0) > 30 && (p.peakWorkers ?? 0) > 20) || (p.constructionDays ?? 0) * (p.peakWorkers ?? 0) > 500

// ── sources ──────────────────────────────────────────────────────────────────
const TCPA = 'Town and Country Planning Act 1990'
const GPDO = 'Town and Country Planning (General Permitted Development) (England) Order 2015'
const DMPO = 'Town and Country Planning (Development Management Procedure) (England) Order 2015'
const LBCA = 'Planning (Listed Buildings and Conservation Areas) Act 1990'
const BR = 'Building Regulations 2010 (as amended)'
const BSA = 'Building Safety Act 2022'
const HRBP = 'Building (Higher-Risk Buildings Procedures) (England) Regulations 2023'
const CDM = 'Construction (Design and Management) Regulations 2015'
const BNG = 'Environment Act 2021 Sch.14 / TCPA 1990 Sch.7A; Biodiversity Gain Requirements (Exemptions) Regs 2024 as amended by SI 2026/790'
const AD = (x: string) => `Approved Document ${x}`
const NPPF = 'National Planning Policy Framework'
const CIL = 'Community Infrastructure Levy Regulations 2010'
const PWA = 'Party Wall etc. Act 1996'
const RRO = 'Regulatory Reform (Fire Safety) Order 2005'

const g = (r: Omit<Rule, 'jurisdiction'>): Rule => ({ ...r, jurisdiction: 'GB' })

const rules: Rule[] = [
  // ── PLANNING ROUTE ─────────────────────────────────────────────────────────
  g({ id: 'GB.PLANNING.PERMITTED_DEVELOPMENT', discipline: 'planning', title: 'Permitted development — no planning application needed', citation: 'GPDO Sch.2 Pt 1 Class A', source: GPDO, confidence: 'medium',
    applies: isPD, because: (p) => `${st(p)}-storey rear extension ${depth(p)} m deep (limit ${pdTwoStorey(p) ? 3 : pdLimit(p)} m)${p.conservationArea ? ', conservation area' : ''}`,
    requirement: 'Stay within every Class A limit (height ≤ 4 m single storey, eaves, materials, ≤ 50% of curtilage; two-storey: ≥ 7 m to rear boundary). Consider a Lawful Development Certificate for certainty.' }),
  g({ id: 'GB.PLANNING.LAWFUL_DEVELOPMENT_CERT', discipline: 'planning', title: 'Lawful Development Certificate (recommended)', citation: 'TCPA 1990 s.192', source: TCPA, confidence: 'medium',
    applies: (p) => isPD(p) || largerHomeExt(p), requirement: 'Apply to the council for a certificate confirming the works are lawful — lenders and buyers often ask for it.' }),
  g({ id: 'GB.PLANNING.LARGER_HOME_EXTENSION_PRIOR_APPROVAL', discipline: 'planning', title: 'Prior approval — larger home extension', citation: 'GPDO Sch.2 Pt 1 Class A, para A.4', source: GPDO, confidence: 'high',
    applies: largerHomeExt, because: (p) => `Single-storey rear extension ${depth(p)} m deep (${pdLimit(p)}–${largerLimit(p)} m)`,
    requirement: 'Notify the council; neighbours get 21 days to object. Do not start until prior approval is given or 42 days pass without a decision.' }),
  g({ id: 'GB.PLANNING.HOUSEHOLDER_APPLICATION', discipline: 'planning', title: 'Householder planning application', citation: 'TCPA 1990 s.57; DMPO art.2', source: TCPA, confidence: 'high',
    applies: householderApp,
    because: (p) => p.article4 ? 'Article 4 direction removes permitted development rights' : depth(p) === undefined ? 'Extension depth not given — assuming an application is needed' : designated(p) && st(p) >= 2 ? 'Two-storey rear extensions are not permitted development in a conservation area or other designated land' : `Extension ${depth(p)} m deep, ${st(p)} storey(s), ${h(p)} m high — outside permitted development`,
    requirement: 'Apply to the local planning authority; target decision 8 weeks.' }),
  g({ id: 'GB.PLANNING.FULL_APPLICATION', discipline: 'planning', title: 'Full planning permission', citation: 'TCPA 1990 s.57', source: TCPA, confidence: 'high',
    applies: fullPlanning, requirement: 'Apply with plans, design and access statement where required, and supporting reports. Outline permission is an alternative for new buildings.' }),
  g({ id: 'GB.PLANNING.CHANGE_OF_USE_PD_CHECK', discipline: 'planning', title: 'Check whether a permitted-development change of use applies (Class MA / Q / G)', citation: 'GPDO Sch.2 Pt 3', source: GPDO, confidence: 'low',
    applies: isCoU, requirement: 'Some changes of use need only prior approval. Check the Part 3 class that fits before applying for full permission.' }),
  g({ id: 'GB.PLANNING.MAJOR_DEVELOPMENT', discipline: 'planning', title: 'Major development — 13-week determination, wider consultation', citation: 'DMPO art.2 (definition); art.34', source: DMPO, confidence: 'high',
    applies: isMajor, because: (p) => dwellings(p) >= 10 ? `${dwellings(p)} dwellings ≥ 10` : area(p) >= 1000 ? `${area(p)} m² ≥ 1,000 m²` : `Site ${p.siteAreaHa} ha`,
    requirement: 'Expect a 13-week target, statutory consultees, affordable housing and S106 obligations under local policy.' }),
  g({ id: 'GB.PLANNING.DETERMINATION_8_WEEKS', discipline: 'planning', title: 'Planning decision target: 8 weeks', citation: 'DMPO art.34', source: DMPO, confidence: 'high',
    applies: (p) => needsPlanningPermission(p) && !isMajor(p) }),
  g({ id: 'GB.PLANNING.COMMENCE_WITHIN_3_YEARS', discipline: 'planning', title: 'Start work within 3 years of permission', citation: 'TCPA 1990 s.91', source: TCPA, confidence: 'high',
    applies: needsPlanningPermission, requirement: 'Permission lapses if development has not begun within 3 years (unless the decision says otherwise).' }),
  g({ id: 'GB.PLANNING.PRE_COMMENCEMENT_CONDITIONS', discipline: 'planning', title: 'Discharge pre-commencement conditions before starting', citation: 'TCPA 1990 s.100ZA', source: TCPA, confidence: 'high',
    applies: fullPlanning, requirement: 'Get written approval of every condition worded "prior to commencement" — starting without it can make the whole development unlawful.' }),
  g({ id: 'GB.PLANNING.DESIGN_ACCESS_STATEMENT', discipline: 'planning', title: 'Design and Access Statement', citation: 'DMPO art.9', source: DMPO, confidence: 'high',
    applies: (p) => isMajor(p) || Boolean(p.heritage) || (Boolean(p.conservationArea) && fullPlanning(p) && (dwellings(p) >= 1 || area(p) >= 100)),
    because: (p) => isMajor(p) ? 'Major development' : p.heritage ? 'Listed building' : 'Conservation area: one or more dwellings or ≥ 100 m²' }),
  g({ id: 'GB.PLANNING.LISTED_BUILDING_CONSENT', discipline: 'planning', title: 'Listed building consent', citation: 'LBCA 1990 s.7–9', source: LBCA, confidence: 'high',
    applies: (p) => Boolean(p.heritage) && (isBuild(p) || isDemolition(p) || isCoU(p)),
    requirement: 'Any work affecting the character of a listed building (inside or out) needs consent — works without it are a criminal offence.' }),
  g({ id: 'GB.PLANNING.HERITAGE_STATEMENT', discipline: 'planning', title: 'Heritage statement', citation: 'NPPF para 207', source: NPPF, confidence: 'high',
    applies: (p) => (Boolean(p.heritage) && (isBuild(p) || isDemolition(p) || isCoU(p))) || (Boolean(p.conservationArea) && (needsPlanningPermission(p) || isDemolition(p))),
    because: (p) => p.heritage ? 'Listed building — needed with the listed building consent application' : 'Conservation area' }),
  g({ id: 'GB.PLANNING.CONSERVATION_AREA_DEMOLITION', discipline: 'planning', title: 'Planning permission for demolition in a conservation area', citation: 'TCPA 1990 s.74(1B); LBCA 1990 s.74', source: LBCA, confidence: 'high',
    applies: (p) => isDemolition(p) && Boolean(p.conservationArea), requirement: 'Relevant demolition (buildings over 115 m³) in a conservation area needs planning permission.' }),
  g({ id: 'GB.PLANNING.DEMOLITION_PRIOR_APPROVAL', discipline: 'planning', title: 'Prior approval for demolition', citation: 'GPDO Sch.2 Pt 11 Class B', source: GPDO, confidence: 'medium',
    applies: (p) => isDemolition(p) && !p.conservationArea && !p.heritage, requirement: 'Apply to the council for prior approval of the method of demolition and restoration; post a site notice.' }),
  g({ id: 'GB.PLANNING.ARTICLE_4', discipline: 'planning', title: 'Article 4 direction — permitted development rights removed', citation: 'GPDO art.4', source: GPDO, confidence: 'high',
    applies: (p) => Boolean(p.article4) && (isBuild(p) || isCoU(p)) }),
  g({ id: 'GB.PLANNING.FLOOD_RISK_ASSESSMENT', discipline: 'planning', title: 'Site-specific flood risk assessment', citation: 'NPPF paras 170–182; DMPO Sch.4', source: NPPF, confidence: 'high',
    applies: (p) => needsPlanningPermission(p) && ((p.floodZone ?? 1) >= 2 || (p.siteAreaHa ?? 0) >= 1), because: (p) => (p.floodZone ?? 1) >= 2 ? `Flood Zone ${p.floodZone}` : `Site ${p.siteAreaHa} ha ≥ 1 ha in Flood Zone 1` }),
  g({ id: 'GB.PLANNING.SEQUENTIAL_TEST', discipline: 'planning', title: 'Flood sequential test', citation: 'NPPF paras 173–175', source: NPPF, confidence: 'medium',
    applies: (p) => fullPlanning(p) && (p.floodZone ?? 1) >= 2 && !isExt(p) && !isCoU(p), requirement: 'Show there are no reasonably available sites at lower flood risk (not needed for minor development or change of use).' }),
  g({ id: 'GB.PLANNING.CIL', discipline: 'planning', title: 'Community Infrastructure Levy — assume liability, claim exemptions before starting', citation: 'CIL Regs 2010 reg.42, 54A–54D', source: CIL, confidence: 'medium',
    applies: (p) => p.cilChargingArea !== false && (isBuild(p) || isCoU(p)) && (newDwelling(p) || area(p) >= 100),
    because: (p) => newDwelling(p) ? 'Creates a new dwelling' : `${area(p)} m² new floorspace ≥ 100 m²`,
    requirement: 'If the council charges CIL: submit the Assumption of Liability and any self-build or extension exemption claim BEFORE commencement, then the Commencement Notice — missing these loses the exemption.' }),

  // ── FIRE AT PLANNING STAGE (Gateway 1) ─────────────────────────────────────
  g({ id: 'GB.PLANNING.FIRE_STATEMENT_GATEWAY_1', discipline: 'planning', title: 'Fire statement with the planning application (Planning Gateway One)', citation: 'DMPO art.9A; Sch.4 (BSR statutory consultee)', source: DMPO, confidence: 'high',
    applies: relevantGateway1, because: (p) => `${h(p)} m / ${st(p)} storeys with ${dwellings(p)} dwellings`,
    requirement: 'Submit a fire statement on the government form; the Building Safety Regulator is consulted.' }),

  // ── BNG ────────────────────────────────────────────────────────────────────
  g({ id: 'GB.ENV.BNG_10_PERCENT', discipline: 'environment', title: 'Biodiversity net gain — 10% uplift and biodiversity gain plan', citation: 'TCPA 1990 Sch.7A para 13', source: BNG, confidence: 'high',
    applies: bngApplies,
    because: (p) => p.siteAreaHa === undefined ? 'Site area not given — exempt only if ≤ 0.2 ha with no priority habitat' : p.priorityHabitat ? 'Site has priority habitat — small-site exemption lost' : `Site ${p.siteAreaHa} ha > 0.2 ha`,
    requirement: 'Baseline habitat survey with the statutory metric; biodiversity gain plan approved before commencement; secure gains for 30 years.' }),
  g({ id: 'GB.ENV.BNG_EXEMPT_SMALL_SITE', discipline: 'environment', title: 'BNG exempt — site ≤ 0.2 ha with no priority habitat', citation: 'Exemptions Regs 2024 reg.7A (from 6 Aug 2026)', source: BNG, confidence: 'high',
    applies: (p) => fullPlanning(p) && bngExemptSmall(p), requirement: 'Applies to applications made on or after 6 August 2026. State the exemption on the application form.' }),
  g({ id: 'GB.ENV.BNG_EXEMPT_HOUSEHOLDER', discipline: 'environment', title: 'BNG does not apply — householder development', citation: 'Exemptions Regs 2024 reg.5', source: BNG, confidence: 'high',
    applies: householderApp }),
  g({ id: 'GB.ENV.BNG_SELF_BUILD_EXEMPTION_REMOVED', discipline: 'environment', title: 'Self-build BNG exemption no longer available', citation: 'SI 2026/790 reg.3(b)', source: BNG, confidence: 'high',
    applies: (p) => bngApplies(p) && isHouse(p) && isNew(p) && Boolean(p.domesticClient), requirement: 'For applications from 6 Aug 2026 the self-build exemption is gone — rely on the 0.2 ha exemption or deliver net gain.' }),
  g({ id: 'GB.ENV.RADON', discipline: 'environment', title: 'Radon protection', citation: 'AD C, section 2; BR 211', source: AD('C'), confidence: 'medium',
    applies: (p) => brApplies(p) && Boolean(p.radonAffectedArea), requirement: 'Basic or full radon protection depending on the UKradon map result for the site.' }),
  g({ id: 'GB.ENV.CONTAMINATION', discipline: 'environment', title: 'Site preparation and contaminants', citation: 'Building Regs Sch.1 Part C', source: AD('C'), confidence: 'medium',
    applies: (p) => isNew(p) }),

  // ── BUILDING CONTROL ROUTE ─────────────────────────────────────────────────
  g({ id: 'GB.PERMIT.BUILDING_REGS_APPROVAL', discipline: 'permit', title: 'Building regulations approval required', citation: 'BR 2010 reg.12', source: BR, confidence: 'high',
    applies: brApplies, requirement: 'Use the local authority or a registered building control approver (RBCA); for higher-risk buildings the Building Safety Regulator is the only building control authority.' }),
  g({ id: 'GB.PERMIT.FULL_PLANS_OR_NOTICE', discipline: 'permit', title: 'Full plans application or building notice', citation: 'BR 2010 reg.12(2A)', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && !buildingNoticeBarred(p) }),
  g({ id: 'GB.PERMIT.FULL_PLANS_REQUIRED', discipline: 'permit', title: 'Full plans application required — building notice not allowed', citation: 'BR 2010 reg.12(4A)', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && buildingNoticeBarred(p), because: (p) => isHRB(p) ? 'Higher-risk building' : 'Building covered by the Fire Safety Order (non-domestic or common parts of flats)' }),
  g({ id: 'GB.PERMIT.APPROVAL_LAPSES_3_YEARS', discipline: 'permit', title: 'Building control approval lapses if work has not commenced within 3 years', citation: 'BR 2010 reg.13A; Building Act 1984 s.32', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && !isHRB(p), requirement: 'For new buildings "commenced" means foundations and the lowest floor structure are complete (2023 definition).' }),
  g({ id: 'GB.PERMIT.COMMENCEMENT_NOTICE', discipline: 'permit', title: 'Notify building control of commencement and stages', citation: 'BR 2010 reg.16', source: BR, confidence: 'medium',
    applies: (p) => brApplies(p) && !isHRB(p), requirement: 'Give at least 2 days\' notice before starting and notify at the stages the building control body specifies.' }),
  g({ id: 'GB.PERMIT.COMPLETION_CERTIFICATE', discipline: 'permit', title: 'Completion certificate before occupation', citation: 'BR 2010 reg.17', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && !isHRB(p) }),
  g({ id: 'GB.PERMIT.EPC', discipline: 'permit', title: 'Energy Performance Certificate on completion', citation: 'Energy Performance of Buildings (England and Wales) Regs 2012', source: 'EPB Regulations 2012', confidence: 'high',
    applies: (p) => isNew(p) || isCoU(p) }),

  // ── HIGHER-RISK BUILDINGS (Building Safety Act) ────────────────────────────
  g({ id: 'GB.SUPERVISION.HRB_HOSPITAL_CARE_HOME_CHECK', discipline: 'supervision', title: 'Check: is this a hospital or care home? Tall ones are higher-risk during design and construction', citation: 'HRB (Descriptions and Supplementary Provisions) Regs 2023 reg.2', source: BSA, confidence: 'low',
    applies: (p) => isNonRes(p) && (isBuild(p) || isCoU(p)) && tall(p), because: (p) => `${h(p)} m / ${st(p)} storeys`,
    requirement: 'Hospitals and care homes ≥ 18 m or ≥ 7 storeys follow the higher-risk regime (BSR as building control, Gateways 2 and 3) during design and construction, but are not registered for occupation. Confirm the use.' }),
  g({ id: 'GB.SUPERVISION.HRB_BSR_BCA', discipline: 'supervision', title: 'Higher-risk building — Building Safety Regulator is the building control authority', citation: 'BSA 2022 s.120D; Building Act 1984 s.91ZA', source: BSA, confidence: 'high',
    applies: isHRB, because: (p) => `${h(p)} m / ${st(p)} storeys with ${dwellings(p)} residential units` }),
  g({ id: 'GB.SUPERVISION.GATEWAY_2', discipline: 'supervision', title: 'Gateway 2 — building control approval from the BSR before any work starts', citation: 'HRB Procedures Regs 2023 regs 3–12', source: HRBP, confidence: 'high',
    applies: isHRB, requirement: 'Full application with competence declaration, fire and emergency file, construction control plan, change control plan and mandatory occurrence reporting plan. 12-week statutory period; plan for longer.' }),
  g({ id: 'GB.SUPERVISION.GATEWAY_3', discipline: 'supervision', title: 'Gateway 3 — completion certificate from the BSR before occupation', citation: 'HRB Procedures Regs 2023 regs 41–47', source: HRBP, confidence: 'high',
    applies: isHRB, requirement: 'Submit the golden thread information and dutyholder compliance declarations. The building cannot be occupied until the BSR issues the completion certificate.' }),
  g({ id: 'GB.SUPERVISION.HRB_REGISTRATION', discipline: 'supervision', title: 'Register the building with the BSR before occupation', citation: 'BSA 2022 s.77–79', source: BSA, confidence: 'high', applies: isHRB }),
  g({ id: 'GB.SUPERVISION.GOLDEN_THREAD', discipline: 'supervision', title: 'Golden thread of building information', citation: 'HRB Procedures Regs 2023 reg.31', source: HRBP, confidence: 'high', applies: isHRB }),
  g({ id: 'GB.SUPERVISION.CHANGE_CONTROL', discipline: 'supervision', title: 'Change control — major changes need BSR approval', citation: 'HRB Procedures Regs 2023 regs 16–20', source: HRBP, confidence: 'high', applies: isHRB }),
  g({ id: 'GB.SUPERVISION.MANDATORY_OCCURRENCE_REPORTING', discipline: 'supervision', title: 'Mandatory occurrence reporting to the BSR', citation: 'HRB Procedures Regs 2023 reg.38', source: HRBP, confidence: 'high', applies: isHRB }),

  // ── DUTYHOLDERS: Building Regulations Part 2A and CDM 2015 ─────────────────
  g({ id: 'GB.DESIGN.PART_2A_COMPETENCE', discipline: 'design', title: 'Dutyholder competence (designers and contractors)', citation: 'BR 2010 Part 2A regs 11F–11G', source: BR, confidence: 'high',
    applies: brApplies, requirement: 'The client must appoint designers and contractors with the skills, knowledge, experience and behaviours for the work.' }),
  g({ id: 'GB.DESIGN.PART_2A_PRINCIPAL_DESIGNER', discipline: 'design', title: 'Appoint a principal designer and principal contractor for building regulations', citation: 'BR 2010 reg.11D', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && (multiContractor(p) || isHRB(p)), because: (p) => isHRB(p) ? 'Higher-risk building' : `${p.contractors} contractors`,
    requirement: 'Appoint in writing before the construction phase; both sign compliance declarations at completion.' }),
  g({ id: 'GB.SUPERVISION.CDM_CLIENT_DUTIES', discipline: 'supervision', title: 'CDM client duties — arrangements, pre-construction information, welfare', citation: 'CDM 2015 regs 4, 8', source: CDM, confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p) || isDemolition(p)) && !p.domesticClient }),
  g({ id: 'GB.SUPERVISION.CDM_DOMESTIC_CLIENT', discipline: 'supervision', title: 'Domestic client — CDM client duties pass to the contractor or principal designer', citation: 'CDM 2015 reg.7', source: CDM, confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p) || isDemolition(p)) && Boolean(p.domesticClient),
    requirement: 'With one contractor the contractor takes the client duties; with more than one, the principal contractor does (or the principal designer, by written agreement).' }),
  g({ id: 'GB.SUPERVISION.CDM_PD_PC', discipline: 'supervision', title: 'CDM: appoint principal designer and principal contractor in writing', citation: 'CDM 2015 reg.5', source: CDM, confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p) || isDemolition(p)) && multiContractor(p), because: (p) => `${p.contractors} contractors` }),
  g({ id: 'GB.SUPERVISION.CDM_CONSTRUCTION_PHASE_PLAN', discipline: 'supervision', title: 'Construction phase plan before work starts', citation: 'CDM 2015 regs 12, 15', source: CDM, confidence: 'high',
    applies: (p) => isBuild(p) || isCoU(p) || isDemolition(p) }),
  g({ id: 'GB.SUPERVISION.CDM_HEALTH_SAFETY_FILE', discipline: 'supervision', title: 'Health and safety file handed to the client', citation: 'CDM 2015 reg.12(5)–(10)', source: CDM, confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p) || isDemolition(p)) && multiContractor(p) }),
  g({ id: 'GB.SUPERVISION.CDM_F10', discipline: 'supervision', title: 'Notify HSE (F10) — notifiable project', citation: 'CDM 2015 reg.6', source: CDM, confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p) || isDemolition(p)) && notifiable(p),
    because: (p) => `${p.constructionDays} working days × up to ${p.peakWorkers} workers`,
    requirement: 'Notify HSE before construction starts if work lasts more than 30 working days with more than 20 workers at once, or exceeds 500 person-days. Display the notice on site.' }),
  g({ id: 'GB.SUPERVISION.PARTY_WALL', discipline: 'supervision', title: 'Party wall notices', citation: 'Party Wall etc. Act 1996 ss.1, 3, 6', source: PWA, confidence: 'medium',
    applies: (p) => Boolean(p.boundaryWork) && (isBuild(p) || isDemolition(p)),
    requirement: 'Serve notice on adjoining owners: 2 months before party-structure work, 1 month before new walls on the line of junction or excavation within 3 m / 6 m.' }),

  // ── STRUCTURE ──────────────────────────────────────────────────────────────
  g({ id: 'GB.DESIGN.STRUCTURE_PART_A', discipline: 'design', title: 'Structural design (Part A)', citation: 'Building Regs Sch.1 Part A; AD A', source: AD('A'), confidence: 'high', applies: (p) => isBuild(p) }),
  g({ id: 'GB.DESIGN.DISPROPORTIONATE_COLLAPSE', discipline: 'design', title: 'Disproportionate collapse — consequence class assessment', citation: 'AD A, Section 5 (A3)', source: AD('A'), confidence: 'high',
    applies: (p) => isBuild(p) && (isFlats(p) || isNonRes(p)) && st(p) >= 5, because: (p) => `${st(p)} storeys — consequence class 2B or higher` }),

  // ── FIRE ───────────────────────────────────────────────────────────────────
  g({ id: 'GB.FIRE.PART_B', discipline: 'fire', title: 'Fire safety (Part B): escape, spread, structure, access', citation: 'Building Regs Sch.1 Part B; AD B', source: AD('B'), confidence: 'high', applies: (p) => brApplies(p) }),
  g({ id: 'GB.FIRE.SPRINKLERS_11M', discipline: 'fire', title: 'Sprinklers throughout — flats with a storey above 11 m', citation: 'AD B Vol 1, para 7.4', source: AD('B'), confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p)) && isFlats(p) && h(p) > 11, because: (p) => `${h(p)} m > 11 m` }),
  g({ id: 'GB.FIRE.WAYFINDING_11M', discipline: 'fire', title: 'Wayfinding signage for firefighters (flats > 11 m)', citation: 'AD B Vol 1, para 15.14', source: AD('B'), confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p)) && isFlats(p) && h(p) > 11 }),
  g({ id: 'GB.FIRE.SECURE_INFORMATION_BOX', discipline: 'fire', title: 'Secure information box (flats > 11 m)', citation: 'AD B Vol 1, para 15.15', source: AD('B'), confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p)) && isFlats(p) && h(p) > 11 }),
  g({ id: 'GB.FIRE.EVACUATION_ALERT', discipline: 'fire', title: 'Evacuation alert system (flats ≥ 18 m)', citation: 'AD B Vol 1, para 1.33; BS 8629', source: AD('B'), confidence: 'high',
    applies: (p) => (isBuild(p) || isCoU(p)) && isFlats(p) && h(p) >= 18 }),
  g({ id: 'GB.FIRE.SECOND_STAIRCASE_18M', discipline: 'fire', title: 'Second staircase — new residential buildings over 18 m', citation: 'AD B Vol 1 (2026 amendments, in force 30 Sep 2026)', source: AD('B'), confidence: 'high',
    applies: (p) => isNew(p) && residential(p) && h(p) > 18 && dwellings(p) >= 2, because: (p) => `${h(p)} m > 18 m`,
    requirement: 'Applies to work not covered by the transitional provision (application before 30 Sep 2026 and work sufficiently progressed by 30 Mar 2028).' }),
  g({ id: 'GB.FIRE.COMBUSTIBLE_EXTERNAL_WALLS', discipline: 'fire', title: 'Ban on combustible materials in external walls (relevant buildings ≥ 18 m)', citation: 'BR 2010 reg.7(2)', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && h(p) >= 18 && (residential(p) && dwellings(p) >= 1), requirement: 'External wall materials and specified attachments must be A2-s1,d0 or A1.' }),
  g({ id: 'GB.FIRE.REG_38_HANDOVER', discipline: 'fire', title: 'Fire safety information handed to the responsible person (reg. 38)', citation: 'BR 2010 reg.38', source: BR, confidence: 'high',
    applies: (p) => brApplies(p) && (isFlats(p) || isNonRes(p)) }),
  g({ id: 'GB.FIRE.FIRE_SAFETY_ORDER', discipline: 'fire', title: 'Fire Safety Order applies in use — responsible person and fire risk assessment', citation: 'RRO 2005 arts 3, 9', source: RRO, confidence: 'high',
    applies: (p) => (isNew(p) || isCoU(p)) && (isFlats(p) || isNonRes(p)) }),

  // ── ENERGY ─────────────────────────────────────────────────────────────────
  g({ id: 'GB.ENERGY.PART_L_NEW_DWELLING', discipline: 'energy', title: 'Part L energy calculation for new dwellings (SAP now; Home Energy Model under the Future Homes Standard)', citation: 'Building Regs Sch.1 Part L; reg.26', source: AD('L'), confidence: 'high',
    applies: newDwelling,
    requirement: 'Future Homes Standard applies to work started after 24 Mar 2028 or applications made after 24 Mar 2027 (HRBs: 24 Sep 2027). Earlier projects can use the 2021 Part L if work commences in time — per dwelling.' }),
  g({ id: 'GB.ENERGY.PART_L_EXTENSION', discipline: 'energy', title: 'Part L — U-values and controls for the extension', citation: 'AD L Vol 1, section 10', source: AD('L'), confidence: 'high',
    applies: (p) => isExt(p) }),
  g({ id: 'GB.ENERGY.PART_L_NON_DOMESTIC', discipline: 'energy', title: 'Part L — SBEM calculation (non-domestic)', citation: 'AD L Vol 2', source: AD('L'), confidence: 'high',
    applies: (p) => isNew(p) && isNonRes(p) }),
  g({ id: 'GB.ENERGY.PART_F_VENTILATION', discipline: 'energy', title: 'Ventilation (Part F) — design and commissioning', citation: 'Building Regs Sch.1 Part F; AD F', source: AD('F'), confidence: 'high',
    applies: (p) => isBuild(p) || isCoU(p) }),
  g({ id: 'GB.ENERGY.PART_O_OVERHEATING', discipline: 'energy', title: 'Overheating assessment (Part O)', citation: 'Building Regs Sch.1 Part O; AD O', source: AD('O'), confidence: 'high',
    applies: (p) => isNew(p) && residential(p), requirement: 'Simplified method or dynamic thermal modelling (CIBSE TM59).' }),

  // ── SOUND ──────────────────────────────────────────────────────────────────
  g({ id: 'GB.SOUND.PART_E', discipline: 'sound', title: 'Sound insulation (Part E)', citation: 'Building Regs Sch.1 Part E; AD E', source: AD('E'), confidence: 'high',
    applies: (p) => (isNew(p) || isCoU(p)) && residential(p) }),
  g({ id: 'GB.SOUND.PRE_COMPLETION_TESTING', discipline: 'sound', title: 'Pre-completion sound testing of separating walls and floors', citation: 'BR 2010 reg.41', source: BR, confidence: 'high',
    applies: (p) => (isNew(p) || isCoU(p)) && (isFlats(p) || p.buildingType === 'semi_detached' || p.buildingType === 'terraced') }),

  // ── ACCESSIBILITY ──────────────────────────────────────────────────────────
  g({ id: 'GB.ACCESS.M4_1', discipline: 'accessibility', title: 'Category M4(1) visitable dwellings (default)', citation: 'AD M Vol 1', source: AD('M'), confidence: 'high',
    applies: newDwelling, requirement: 'M4(2)/M4(3) apply only where a planning condition requires them — check the decision notice.' }),
  g({ id: 'GB.ACCESS.M4_2_3_CONDITION_CHECK', discipline: 'accessibility', title: 'Check planning conditions for M4(2) / M4(3) requirements', citation: 'BR 2010 reg.4(1A); AD M Vol 1', source: AD('M'), confidence: 'medium',
    applies: (p) => newDwelling(p) && fullPlanning(p) }),
  g({ id: 'GB.ACCESS.M_NON_DOMESTIC', discipline: 'accessibility', title: 'Access to and use of buildings (AD M Vol 2)', citation: 'AD M Vol 2', source: AD('M'), confidence: 'high',
    applies: (p) => (isNew(p) || isExt(p)) && isNonRes(p) }),
  g({ id: 'GB.ACCESS.PART_K', discipline: 'accessibility', title: 'Protection from falling, collision and impact (Part K)', citation: 'Building Regs Sch.1 Part K', source: AD('K'), confidence: 'high', applies: (p) => isBuild(p) }),

  // ── INFRASTRUCTURE / OTHER PARTS ───────────────────────────────────────────
  g({ id: 'GB.INFRA.EV_CHARGING_DWELLINGS', discipline: 'infrastructure', title: 'EV charge point for each new dwelling with a parking space (Part S)', citation: 'Building Regs Sch.1 Part S, S1', source: AD('S'), confidence: 'high',
    applies: (p) => newDwelling(p) && (p.parkingSpaces ?? 0) > 0, because: (p) => `${p.parkingSpaces} parking space(s)` }),
  g({ id: 'GB.INFRA.EV_CHARGING_NON_RES', discipline: 'infrastructure', title: 'EV charge point + cable routes for 1 in 5 spaces (non-residential, > 10 spaces)', citation: 'Building Regs Sch.1 Part S, S2', source: AD('S'), confidence: 'high',
    applies: (p) => isNew(p) && isNonRes(p) && (p.parkingSpaces ?? 0) > 10 }),
  g({ id: 'GB.INFRA.GIGABIT_BROADBAND', discipline: 'infrastructure', title: 'Gigabit-ready physical infrastructure (Part R)', citation: 'Building Regs Sch.1 Part R', source: AD('R'), confidence: 'high',
    applies: (p) => isNew(p) && residential(p) }),
  g({ id: 'GB.INFRA.WATER_EFFICIENCY', discipline: 'infrastructure', title: 'Water efficiency 125 l/person/day (110 if a planning condition requires)', citation: 'BR 2010 reg.36; AD G', source: AD('G'), confidence: 'high',
    applies: newDwelling }),
  g({ id: 'GB.INFRA.DRAINAGE_PART_H', discipline: 'infrastructure', title: 'Drainage and waste disposal (Part H)', citation: 'Building Regs Sch.1 Part H', source: AD('H'), confidence: 'high', applies: (p) => isNew(p) || isExt(p) }),
  g({ id: 'GB.INFRA.SECURITY_PART_Q', discipline: 'infrastructure', title: 'Security — doors and windows (Part Q)', citation: 'Building Regs Sch.1 Part Q', source: AD('Q'), confidence: 'high', applies: newDwelling }),
  g({ id: 'GB.INFRA.ELECTRICAL_PART_P', discipline: 'infrastructure', title: 'Electrical safety in dwellings (Part P) — certified by a registered installer', citation: 'Building Regs Sch.1 Part P', source: AD('P'), confidence: 'high',
    applies: (p) => residential(p) && (isBuild(p) || isCoU(p)) }),
]

export const GB_RULESET: RuleSet = {
  jurisdiction: 'GB',
  version: 'GB-ENG-1.0',
  effectiveFrom: '2026-11-07',
  sourceUrl: 'https://www.gov.uk/government/collections/approved-documents',
  rules,
}

/** Exposed for tests and the questionnaire: the planning route the engine chose. */
export const gbPlanningRoute = (p: P): 'permitted_development' | 'larger_home_extension' | 'householder' | 'full' | 'demolition' | 'none' =>
  isPD(p) ? 'permitted_development' : largerHomeExt(p) ? 'larger_home_extension' : householderApp(p) ? 'householder' : fullPlanning(p) ? 'full' : isDemolition(p) ? 'demolition' : 'none'
export const gbIsHigherRisk = isHRB
