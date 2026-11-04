# Coordin AI — Development Work Plan

**Date:** 4 November 2026
**Owner:** Wale Koleosho
**Input:** `coordin-ai-spec-v1.md` + Purple Team review (4 Nov)
**Target:** EAL AI working group demo — week of 7 December 2026. Eurostars Call 12 opens 17 December.

---

## Answer first

**5 sprints. 4 weeks of build plus a 3-day discovery sprint. Demo-ready by 4 December.**

| Sprint | Dates | Outcome |
|---|---|---|
| 0 — Discovery | Wed 4 – Fri 6 Nov | Prompts proven by hand. Unknowns resolved. No code. |
| 1 — Foundation + Practice Setup | Mon 9 – Fri 13 Nov | Paste a URL → confirmed workspace. The 40-second moment. |
| 2 — Rules Engine | Mon 16 – Fri 20 Nov | 18 parameters → deterministic checklist. Validated by Laila. |
| 3 — Project Setup from documents | Mon 23 – Fri 27 Nov | Brief + planning conditions PDF → configured project. Laila onboarded. |
| 4 — Hardening + Demo | Mon 30 Nov – Fri 4 Dec | SLOs met. Regression suite green. Demo rehearsed. |
| Demo | w/c 7 Dec | EAL working group |
| Post-demo | 7 – 18 Dec | Feedback fixes. Eurostars application starts 17 Dec with demo evidence. |

**Out of scope before March:** Tier 2 (re-check, regulatory monitor, overrun warning) and Tier 3 (drafting). Tier 1 in-module features (drawing register, Info In, minutes) start January, after the Eurostars draft is in.

**Vercel stays.** Pro gives 300s default / 800s max per function. `maxDuration = 300` on `/api/ai/*`. Background-job pattern is for UX (close the tab, come back), not for timeouts.

---

## Sprint 0 — Discovery (Wed 4 – Fri 6 Nov)

No product code. Everything here de-risks sprints 1–3. Karpathy's rule: data before architecture.

| # | Task | Done when | Owner note |
|---|---|---|---|
| 0.1 | Run the practice-setup prompt by hand against all 14 outreach firms + Laila's site + salto.ee + koko.ee | 17 `PracticeProfile` JSON outputs saved to `/private/ai-samples/practice/` | Half a day. This is the regression suite. |
| 0.2 | Calibrate confidence threshold against those 17 | A number with a reason, not 0.8 because it sounds right | Look at where the model was wrong and what confidence it reported |
| 0.3 | ~~Probe Ehitisregister~~ **DONE 4 Nov** — public API: search by owner/buildingName, detail by EHR code; no designer search, no permits/docs without ID-card login | Partial go — see 3.3 | `private/ai-samples/ehr-probe-2026-11-04.md` |
| 0.4 | Ask Laila (and Ülar when he replies) for 5–10 real *projekteerimistingimused* PDFs from different municipalities | PDFs in `/private/ai-samples/planning-conditions/` | Needed before sprint 3 estimate is real |
| 0.5 | Write the 40+ rules-engine test cases: parameters in → expected checklist out, from the Ehitusseadustik dataset | `tests/rules/*.test.ts` fixtures, no engine yet | Crispin: tests before engine. Send to Laila for review in sprint 2 |
| 0.6 | Decide model + fallback | Mistral primary (EU-hosted), Claude fallback, both keys in Vercel env | Already on the list. Just confirm and move on |

**Sprint 0 exit:** 17 profile samples, a calibrated threshold, Ehitisregister go/no-go, test fixtures written, PDFs requested.

---

## Sprint 1 — AI Foundation + Practice Setup (Mon 9 – Fri 13 Nov)

Fowler: build the pipeline once, practice setup is its first client. Fadell: the confirmation moment is the product.

### Schema
| Model | Fields |
|---|---|
| `AIRun` | id, organisationId, projectId?, surface (enum), status (queued/running/awaiting_confirmation/applied/failed), model, promptVersion, inputHash, inputSummary, output (JSON), confidence, citations (JSON), error?, createdBy, confirmedBy?, confirmedAt?, appliedAt?, createdAt |
| `PracticeProfile` | organisationId, version, data (JSON — typed), sourceRunId, createdAt |
| `AIGenerated` flag | boolean + `aiRunId` on Task, ChecklistItem, Document (migration only — used from sprint 2) |

### Backend
| # | Task |
|---|---|
| 1.1 | `src/lib/ai/pipeline.ts` — `runAI({surface, input, schema, prompt})` → creates `AIRun`, calls model, validates with Zod, stores output + confidence + citations, returns run id. One function, every surface uses it |
| 1.2 | `src/lib/ai/providers/` — Mistral + Claude adapters behind one interface. Fallback on 5xx/timeout. Per-org daily token budget (Hightower) |
| 1.3 | `src/lib/ai/crawl.ts` — fetch home/about/projects/team/contact, respect robots.txt, 24h cache in Upstash (already have Redis) |
| 1.4 | `POST /api/ai/practice-setup` — accepts URL (+ optional registry code), runs crawl → extract → returns run id. `maxDuration = 300`. Existing rate limiter applied to all `/api/ai/*` |
| 1.5 | `GET /api/ai/runs/[id]` — poll status + output |
| 1.6 | `POST /api/ai/runs/[id]/confirm` — accepts user overrides, maps `PracticeProfile` → `OrganisationFeature` flags + settings (deterministic, in `src/lib/ai/map-practice.ts`), applies in a transaction, writes `ai.practice_configured` audit event with full before/after |
| 1.7 | Failure path (Treynor Sloss): crawl fails or model down → run status `failed` with a human-readable reason → UI offers manual setup. No silent spinner |

### Frontend
| # | Task |
|---|---|
| 1.8 | `ConfirmationReview` component — renders `{field, value, confidence, source, userOverride}` rows. Source is a link. Low-confidence rows highlighted. Editable inline. Reused by every surface from here on (Abramov) |
| 1.9 | `/onboarding/practice` — paste URL → progress states (fetching → reading → mapping) → `ConfirmationReview` → 5 follow-up questions → "Switch on Coordin" button |
| 1.10 | Polish the moment (Fadell): partner names not "3 partners", project names not "12 projects", municipalities as a list. Feels like Coordin already knows them |

### Quality
| # | Task |
|---|---|
| 1.11 | Regression suite: the 17 sprint-0 samples as snapshot tests. Any prompt change re-runs all 17 and diffs (Crispin) |
| 1.12 | SLO instrumentation: log duration per stage; target 95% < 60s end-to-end. Dashboard in existing request-timing logs |
| 1.13 | Admin: AI on/off per org, model selection, budget — extend `/settings/admin` |

**Sprint 1 exit:** paste salto.ee in production → confirmed workspace in under 10 minutes. 17/17 regression snapshots stable. Audit event visible.

---

## Sprint 2 — Rules Engine (Mon 16 – Fri 20 Nov)

Deterministic. No LLM in the matching step. Already specced in `coordin-questionnaire-engine-spec-v1.md` and `coordin-ee-regulatory-dataset-v1.md`.

### Schema
| Model | Fields |
|---|---|
| `ProjectProfile` | projectId, version, parameters (JSON — the 18), sourceRunId?, createdBy, createdAt. **Versioned** — every change is a new row. This is what Tier 2 re-check needs later (Fowler) |
| `MunicipalityProfile` | code, name (et/en), county, planningConditionsTemplate?, contacts (JSON), notes. Seed the 79 |
| `RuleSet` | jurisdiction, version, effectiveFrom, source (Riigi Teataja URL), rules (JSON) |
| `ChecklistItem` additions | ruleId, ruleSetVersion, citation (§), aiRunId?, addedByArchitect (bool) |

### Backend
| # | Task |
|---|---|
| 2.1 | Encode the Ehitusseadustik dataset as `RuleSet` v1 — 40+ branches, 8 disciplines, bilingual labels |
| 2.2 | `src/lib/rules/engine.ts` — `match(parameters, ruleSet) → ChecklistItem[]` with citations. Pure function. |
| 2.3 | Make sprint-0 test fixtures pass. Every branch has a test |
| 2.4 | `POST /api/projects/[id]/profile` — save parameters as new `ProjectProfile` version, run engine, create checklist items with citations, write `ai.project_configured` audit event (even though no LLM ran — the record matters, Regulatory) |
| 2.5 | `POST /api/projects/[id]/checklist/add` — architect adds an item the engine missed, flagged `addedByArchitect`, logged. Suleyman's feedback loop |

### Frontend
| # | Task |
|---|---|
| 2.6 | 18-parameter questionnaire — branching per the spec, Estonian + English labels, progress indicator |
| 2.7 | Checklist renderer — grouped by discipline, each item shows § citation and rule-set version stamp, "Add missing item" always visible |
| 2.8 | Non-dismissible notice on every generated checklist: "Generated from Ehitusseadustik v[X] as of [date] and the municipal conditions you provided. This does not replace your professional judgement." (Suleyman — required before any live-project use) |

### Validation
| # | Task |
|---|---|
| 2.9 | Send the 40+ test cases to Laila for review. 30-minute call. Fix what she flags. This is the TRL 5 evidence — record the session notes |

**Sprint 2 exit:** questionnaire → checklist with citations in production. All branch tests green. Laila has reviewed the test cases.

---

## Sprint 3 — Project Setup from Documents (Mon 23 – Fri 27 Nov)

Estimates here depend on sprint-0 PDF sampling. Re-estimate Monday morning.

| # | Task | Estimate | Condition |
|---|---|---|---|
| 3.1 | Brief extraction — text/PDF → 18 parameters with confidence, via `runAI`. Pre-fills the questionnaire; architect confirms via `ConfirmationReview` | 1.5 days | — |
| 3.2 | Planning-conditions extraction — *projekteerimistingimused* PDF → condition list with page/paragraph source → checklist items flagged `source: municipality` | 2 days **if** PDFs are consistent; 4 days if not; cut to sprint 4 if wildly inconsistent | Depends on 0.4 |
| 3.3 | **EHR enrichment** (replaces registry-code import — probe 4 Nov: public API has no designer search) — project name or EHR code → authoritative building record (address, cadastral unit, use class, area, storeys, energy class, geometry) attached to the project; owner-name import for construction companies / municipalities | 2 days | Public endpoints verified: `buildingSearchPageable` (owner, buildingName), `buildingData?ehr_code` |
| 3.4 | Onboard Laila for real — her site through practice setup, one live project through project setup. Fix everything she hits | 1 day | Her time is a favour. Budget a thank-you |
| 3.5 | Demo org: Salto-style profile seeded so the demo doesn't depend on live crawl of someone else's site | 0.5 day | — |

**Sprint 3 exit:** paste a brief and a PT PDF → project with checklist and conditions, each item traceable to a source. Laila is a live user.

---

## Sprint 4 — Hardening + Demo (Mon 30 Nov – Fri 4 Dec)

| # | Task |
|---|---|
| 4.1 | Crispin pass — four quadrants: unit (engine, mappers), API contract (`/api/ai/*`), UI (confirmation flows), exploratory (break it like an architect would) |
| 4.2 | SLO check — 95% < 60s practice setup; zero silent failures; model-down path works |
| 4.3 | Load test the demo scenario: 10 URLs submitted within 60 seconds. Rate limiter + budget hold. Cache warms |
| 4.4 | Audit export includes AI runs with citations (Regulatory: "on what basis?") |
| 4.5 | Demo script written (6 steps from the spec). Rehearse with Laila as the audience. Time it — 20 minutes max |
| 4.6 | Update `coordin-ai-spec-v1.md` → v1.1 with what actually shipped; update BUILD-PROGRESS.md |
| 4.7 | Buffer — half the sprint is deliberately unallocated. Something from sprint 3 will slip |

**Sprint 4 exit:** demo rehearsed and timed. Regression suite green. Ready for the room.

---

## Demo week + post-demo (7 – 18 Dec)

- EAL demo. Record what they say — "would you trust this? where not?" is the Eurostars validation evidence.
- Fix the top 3 things the room flagged.
- 17 Dec: Eurostars Call 12 opens. Start the application. Partner conversation (UK practice or TalTech) should already be underway from late November.
- EIS innovation voucher application (Estonian-language) can go in parallel — TalTech as service provider for rules-engine validation.

---

## January onwards (not planned in detail)

Tier 1 in-module AI, one per week, each a new `runAI` client: drawing title-block extraction → Info In triage → minutes to actions. Then Tier 2 foundation (re-check on `ProjectProfile` change). Tier 3 after governance design.

---

## Working rules for these sprints

- **Mornings are build.** Nothing else on the calendar 8–12 until sprint 2 ships (Naval).
- **Every sprint ends with a push and a BUILD-PROGRESS.md update.** No sprint is done until it's documented.
- **Every prompt change re-runs the 17-sample regression.** No exceptions.
- **No LLM output into the database without Zod.** Pipeline enforces it.
- **No new extractor without `ConfirmationReview`.** If the architect can't see the source, it doesn't ship.
- **Scope cuts go to the spec, not the bin.** Tier 2/3 stay documented.

---

## Risks carried into the plan

| Risk | Sprint | Mitigation |
|---|---|---|
| PT PDFs inconsistent across municipalities | 3 | Sampled in sprint 0; 3.2 has a cut line |
| Ehitisregister has no usable API | 3 | Probed in sprint 0; 3.3 is conditional |
| Laila unavailable for validation | 2 | Ask this week; fallback is Ülar or a second EAL member |
| LLM vendor rate limit in the demo room | 4 | Rate limiter, budget, cache, load test in 4.3 |
| Sprint 3 slips | 4 | Half of sprint 4 is buffer |
| Solo founder context-switching | all | Mornings protected; one venture until sprint 2 |

---

## Smallest next step — today

Sprint 0, task 0.1. Open a notebook. Run the practice-setup prompt against salto.ee and Laila's site. Save both JSON outputs. If the Salto output names Maarja, Ralf and Ragnar and lists 16 municipalities, the 40-second moment is real and sprint 1 starts Monday.
