# AI Sprint 3 — Project Setup from Documents: design for PT review

Status: **DRAFT — awaiting Purple Team planning review and Wale's go.** 4 Nov 2026.
Scope: work-plan items 3.1, 3.2, 3.3 + the Sprint 1 leftover (practice-setup confirm).

## What changes for the architect

Today: open a project → Compliance → answer 18 questions → cited checklist.
After: drop the municipality's *projekteerimistingimused* PDF (or paste the client brief) → the questionnaire is pre-filled with page-referenced values → confirm → checklist **plus** the municipality's own conditions, each citing the PT document number and page. Optionally link the Ehitisregister building record for authoritative address/area/storeys.

Rules that do not change: no LLM decides anything; it only fills a schema. Nothing is written until the architect confirms. Every value carries confidence + source page. Deterministic engine still produces the legal checklist.

## Evidence from Sprint 0 samples (10 PDFs, 4 municipalities)

- 9/10 are the national Ehitisregister template (§ 26 EhS, buildings): fixed field names (`Ehitise kõrgus (m)`, `Ehitisealune pind`, `Kasutamise otstarve … (11101)`, `Seotud ehitised` table with EHR code + address, `Haldusakti kehtivus … kuni DD.MM.YYYY`). Text layer present; 6 pages; ~8k chars.
- 1/10 (Viimsi, § 99 roads) is a numbered municipal letter. Same information, free layout. ~14k chars.
- None scanned. **OCR is out of scope for this sprint**; a PDF with < 300 chars of text fails with a clear message ("This PDF has no text layer — ask the municipality for the digital original").

## Architecture

### A. Practice-setup confirm (S1 leftover, ½ day)
`POST /api/ai/practice-setup/confirm { runId, overrides? }` → validates run is `AWAITING_CONFIRMATION` and belongs to caller's org → applies `OrganisationFeature` flags from the mapped decisions (plus overrides) → marks `PracticeProfile.status = CONFIRMED`, `AIRun.status = APPLIED` → audit `ai.practice_configured` with the full decision list. Gate: org `OWNER`/`ADMIN` (platform admin for the demo org). Demo page gets the "Switch on Coordin" button wired to it.

### B. Document extraction (3.1 + 3.2, 3.5 days)
```
POST /api/projects/[id]/setup/extract   (multipart: file | text, kind: brief | planning_conditions | auto)
  → store file as project Document (category PLANNING_CONDITIONS | BRIEF)      [existing upload path]
  → createRun(surface: 'project_setup', projectId, inputSummary: {documentId, kind, chars})
  → after(): runAI(
       ingest:  pdf → text (pdf-parse); cap 60k chars; strip control chars; reject < 300 chars as `no_text_layer`
       extract: Mistral → PlanningConditionsSchema | BriefSchema (Zod, every field Sourced<T> with page)
       map:     deterministic → { parameters: Partial<ProjectParameters> (with reasons), conditions: MunicipalCondition[] }
       status:  AWAITING_CONFIRMATION )
GET  /api/ai/runs/[id]                     (existing — polling)
POST /api/projects/[id]/setup/confirm { runId, parameters, acceptedConditionIds[] }
  → PROJECT_LEAD only
  → new ProjectProfile version with sourceRunId; runs engine (reuses regulatory POST logic, extracted to a service)
  → upserts municipality conditions as ComplianceItems { origin: MUNICIPALITY, citation: 'PT nr 2611802/03126 p.4', source: 'Viljandi Vallavalitsus', because: <condition text> }
  → AIRun.status = APPLIED; audit ai.project_configured { sourceRunId, documentId, accepted, rejected }
```

**Schema (migration):**
- `ComplianceItemOrigin { RULE, MUNICIPALITY, ARCHITECT }` on `ComplianceItem.origin` (default RULE; backfill `ARCHITECT` where `addedByArchitect`). The regulatory re-run's stale-item sweep must filter `origin = RULE` — today it keys on `addedByArchitect:false`, which would delete municipality items. **This is the one place Sprint 2 code changes.**
- `Project.ehrCode String?`, `Project.ehrSnapshot Json?`, `Project.ehrFetchedAt DateTime?`.
- `AIRunSurface` gains `project_setup` (if enum) — check.

**PlanningConditionsSchema (Zod, all `Sourced<T>` = {value, confidence, page})**
`documentNumber, issuedAt, issuer, validUntil, legalBasis ('EhS §26' | 'EhS §27' | 'EhS §99' | other), ehrCode, address, cadastralUnit, county, useCodes[{code, share}], limits{maxFootprintPct, maxHeightM, maxStoreys, minSetbackM, roofPitchNote}, conditions[{topic, text, page, mandatory}], utilities{water, sewage, electricity, heating}, surveysRequired[], heritage{applies, note}, environment{note}`

**Deterministic map → parameters (each with `because`)**
- use code `111xx` → detached/semi/terraced; `112xx` → apartment_block; else non_residential
- `legalBasis = §26` → `detailedPlanExists = false`; `§27` → true
- `maxStoreys`, `maxHeightM` → pre-fill storeys/height **as upper bounds** (shown as "≤ 6.5 m per PT"), not as the design values — the architect types the design value
- county from address → radon rule; heritage flag; `urbanArea` from sewage = "ühiskanalisatsioon"
- Everything else stays blank for the architect.

**UI** (Regulatory page): "Pre-fill from a document" drop zone above the questionnaire → progress (stages from AIRun) → **ConfirmationReview** panel: one row per extracted field (value · confidence badge · "p.4" link that opens the PDF at that page · accept/edit), then the list of municipality conditions with checkboxes (all on by default). Confirm → questionnaire filled, checklist generated, new group **"Municipal conditions — PT nr …"** at the top of the checklist. Low-confidence rows are not pre-accepted.

**Prompt-injection posture (Suleyman/Schneier):** PDF text is untrusted input. The prompt frames it as data; the only output is the Zod schema; nothing in the document can reach a tool, a URL, or another user. Text is capped and stripped. The model never sees other projects' data.

### C. EHR enrichment (3.3, 1.5 days)
`GET /api/ehr/search?q=` (server-side proxy to `buildingSearchPageable`, 10/min, results cached 1 h) and `POST /api/projects/[id]/ehr { ehrCode }` → `buildingData` → stored as snapshot on the project; pre-fills address/area/storeys with `source: 'ehr'`; PT PDFs that contain an EHR code auto-suggest the link. No login-gated endpoints. Attribution "Ehitisregister, fetched DD.MM.YYYY" on every value.

### D. Demo org + Laila (3.4, 3.5)
Seed a Salto-style practice profile and one project with the Viljandi PT so the demo never depends on a live crawl or upload. Laila runs her own site + one real project; we log everything she hits.

## Tests (Crispin's four quadrants)
- Unit: mapper (use code → type, § basis → plan flag, bounds not values), text ingest guards (cap, no-text-layer), schema normalisation.
- Fixtures: **two synthetic, anonymised PT texts in-repo** (national template + Viimsi letter) — the real PDFs stay in `/private` and never enter CI.
- API contract: extract (403 non-lead, 400 bad kind, no-text-layer path), confirm (writes profile with `sourceRunId`, municipality items get `origin: MUNICIPALITY`, regulatory re-run leaves them alone), practice confirm (flags applied, audit).
- Regression: Sprint 2 route tests extended for `origin`.
- Live: run the 10 private PDFs through the pipeline locally; record field-level accuracy in `private/ai-samples/pt-accuracy.md` (target ≥ 90 % on number/height/storeys/use code, 100 % on document number).

## Personal data (Regulatory bench)
PT PDFs name the applicant and signatory. They are stored as project documents under the practice's own org (existing RLS), used only to fill the schema, not retained in AI provider logs beyond Mistral's EU zero-retention terms (verify in Sprint 3 day 1). Audit records document id, not content.

## Not in this sprint
OCR for scanned PDFs; UK/PL document formats; designer-portfolio import from EHR (login-gated); automatic re-run when a dataset version changes (banner only).

## Estimate
A ½ d · B 3.5 d · C 1.5 d · D 1 d · tests inside each · buffer ½ d = **7 days** (plan said 5; the overrun is C + tests). Order: A → B → C → D.

## Decisions needed
1. `origin` enum migration (touches Sprint 2 sweep) vs. reuse `addedByArchitect` + `ruleId=null` heuristics. Recommend enum.
2. Pre-fill limits as upper bounds (architect types design value) vs. as values. Recommend bounds.
3. OCR out of scope. Recommend yes.
