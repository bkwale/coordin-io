# Coordin — England regulatory dataset v1 (GB-ENG-1.0)

Status: researched 7 Nov 2026. Scope: **England only**. Wales, Scotland and Northern Ireland are separate regimes and are not covered.
Code: `src/lib/rules/datasets/gb.ts` · Tests: `src/lib/rules/__tests__/gb.fixtures.ts`

Confidence: **high** means checked against statute or Approved Document text. **medium** means current position from guidance, or a threshold that depends on local facts. **low** means a prompt to check, not a determination.

## What changed recently (and is reflected in the rules)

| Change | In force | Source |
|---|---|---|
| BNG: new exemption for sites ≤ 0.2 ha with no onsite priority habitat; temporary development ≤ 5 years exempt; **self-build exemption removed**; non-major hierarchy relaxed | Applications made on/after **6 Aug 2026** | SI 2026/790 (checked on legislation.gov.uk) |
| AD B: second staircase in new residential buildings **over 18 m** | **30 Sep 2026**; earlier edition applies if application made before and work sufficiently progressed by 30 Mar 2028 | AD B 2026 amendment booklet |
| Building Safety Regulator becomes a standalone body (Gateway 1 consultee, Gateway 2/3 BCA for HRBs) | 27 Jan 2026 | BSR establishment regs 2026 |
| Future Homes Standard (Part L/F 2026, Home Energy Model) | Applies from **24 Mar 2027**; transitional: work commenced by 24 Mar 2028 can use 2021 Part L (per dwelling). HRBs: 24 Sep 2027 | Building Regulations etc. (Amendment) (England) Regs 2026 |
| M4(2) as mandatory minimum | **Not yet in force** — still optional, set by planning condition | Government statement; AD M 2015/16 |
| Householder Class A limits | Unchanged (3 m / 4 m; larger home extension 6 m / 8 m via prior approval) | GPDO 2015 Sch.2 Pt 1 |

## Rule families

1. **Planning route.** The options are permitted development (Class A, with conservation-area and Article 4 limits), larger home extension prior approval, householder application, full application, or demolition prior approval. Other items in this family:
   - Major development (≥ 10 dwellings, ≥ 0.5 ha residential, ≥ 1,000 m², or ≥ 1 ha)
   - Design & Access Statement and heritage statement
   - Listed building consent and conservation area demolition
   - Flood risk assessment and sequential test
   - CIL
   - The 3-year commencement rule and pre-commencement conditions
2. **Fire at planning stage.** A fire statement and Planning Gateway One apply at ≥ 18 m or ≥ 7 storeys with ≥ 2 dwellings.
3. **BNG.** The 10% requirement, plus the 0.2 ha, temporary and householder exemptions, and the self-build removal.
4. **Building control route.**
   - Full plans vs building notice. A building notice is barred for HRBs, non-domestic buildings and blocks of flats.
   - Lapse after 3 years, with the 2023 definition of "commenced".
   - Notices, completion certificate and EPC.
5. **Higher-risk buildings (BSA 2022).** This covers:
   - The BSR as building control authority
   - Gateways 2 and 3
   - Registration, the golden thread, change control and mandatory occurrence reporting
6. **Dutyholders.**
   - Building Regs Part 2A competence; principal designer and principal contractor when there is more than one contractor, or for an HRB.
   - CDM 2015: client duties, domestic client duties, PD/PC, construction phase plan, H&S file.
   - F10 notification at > 30 working days with > 20 workers at once, or > 500 person-days.
   - Party Wall Act notices.
7. **Technical (Approved Documents).** By Part:
   - **A**: structure, plus disproportionate collapse at ≥ 5 storeys
   - **B**: sprinklers, wayfinding and secure information box above 11 m in flats; evacuation alert at ≥ 18 m; second staircase above 18 m; reg 7(2) ban on combustible external walls; reg 38 handover; Fire Safety Order
   - **C**: radon and site preparation
   - **E**: sound, with pre-completion testing
   - **F**: ventilation
   - **G**: water efficiency, 125 / 110 l
   - **H**: drainage
   - **K**: protection from falling
   - **L**: SAP now, HEM under the Future Homes Standard; extensions; SBEM for non-domestic
   - **M**: M4(1), plus a check of planning conditions for M4(2)/(3); Volume 2 for non-domestic
   - **O**: overheating
   - **P**: electrical
   - **Q**: security
   - **R**: gigabit broadband
   - **S**: EV charging

## Questionnaire inputs added for England

These are all optional; an unknown answer keeps the cautious route:
- `conservationArea`, `article4`, `extensionDepth`
- `floodZone`, `siteAreaHa`, `priorityHabitat`
- `domesticClient`, `contractors`, `constructionDays`, `peakWorkers`
- `boundaryWork`, `cilChargingArea`, `radonAffectedArea`

These existing fields are reused:
- `heritage` = listed building
- `protectedArea` = National Park, National Landscape (AONB) or World Heritage Site
- `temporary`, `parkingSpaces`, `apartments`, `height`, `storeys`

## Document reader: English planning decision notices

Upload a decision notice on the Regulatory page (England selected). The reader (prompt `dn-0.1`) extracts:
- reference, planning authority, decision date, outcome, application type, parent permission
- approved plans
- every numbered condition with its timing: time limit, approved plans, pre-commencement, pre-superstructure, pre-occupation, ongoing
- reasons for refusal

Deterministic checks run after the model:
- reference pinned to the "Application No" phrase
- timing read from the wording ("prior to commencement") when the model leaves it unclassified
- commencement deadline = decision date + years − 1 day; flagged if already passed
- M4(2)/M4(3), water targets (105/110 l), BNG and removed permitted-development rights raised as warnings
- every condition's wording checked against the document; unmatched ones left unticked

Tested on four public notices (Brent full, North Yorkshire householder, Copeland reserved matters, Camden refusal). Refusals produce reasons, not conditions. Reserved matters and discharge decisions warn that the parent permission's conditions still apply.

## Known limits (v1)

- Permitted development is checked for **rear extensions only**. Side extensions, roof extensions (Class B), outbuildings (Class E) and upward extensions (Class AA) fall back to "householder application" and should be confirmed by the architect.
- CIL liability depends on the council's charging schedule; the rule says "if your council charges CIL".
- Local plan policies (affordable housing, M4(2) percentages, parking standards) are out of scope. The checklist prompts a check of planning conditions.
- The higher-risk building test uses residential units only. Hospitals and care homes ≥ 18 m are also HRBs during design and construction, and should be added in v1.1.

## Sources

- [SI 2026/790 — Biodiversity Gain (Town and Country Planning) (Amendments and Transitional Provisions) (England) Regulations 2026](https://www.legislation.gov.uk/uksi/2026/790/made)
- [Defra blog — BNG amendments and transitional arrangements (14 Jul 2026)](https://defraenvironment.blog.gov.uk/2026/07/14/biodiversity-net-gain-amendments-and-transitional-arrangements-published/)
- [Planning Portal — changes to BNG exemptions 2026](https://blog.planningportal.co.uk/2026/07/24/changes-to-biodiversity-net-gain-exemptions-in-2026/)
- [gov.uk — Approved Document B updates](https://www.gov.uk/government/publications/amendments-to-approved-document-b-fire-safety-circular-and-letter/approved-document-b-fire-safety-new-updates-to-support-enhanced-fire-safety)
- [Forsters — second staircases from 30 Sep 2026](https://www.forsters.co.uk/news-and-views/second-staircases-mandatory-in-residential-buildings-over-18m-from-30-september-2026)
- [gov.uk — Planning Gateway One](https://gov.uk/guidance/building-safety-planning-gateway-one)
- [Elmhurst — MHCLG releases the Future Homes Standard](https://www.elmhurstenergy.co.uk/blog/2026/03/24/mhclg-release-the-future-homes-standard/)
- [legislation.gov.uk — Building Regulations 2010 Part 2A](https://www.legislation.gov.uk/uksi/2010/2214/part/2A)
- [Browne Jacobson — BSA gateway outlook 2026](https://www.brownejacobson.com/insights/2026-horizon-scanning-in-construction/england-gateway-regime-delays-and-solutions)
- [Haspod — CDM notifiable projects](https://www.haspod.com/blog/cdm/cdm-notifiable-projects-working-day-person-days-explained)
- [gov.uk — Community Infrastructure Levy guidance](https://www.gov.uk/guidance/community-infrastructure-levy)
- [PlanningGeek — Class A rear extension rules](https://www.planninggeek.co.uk/gpdo/house/extensions/rear-extensions/)
