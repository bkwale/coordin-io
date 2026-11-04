# Coordin AI — Product Spec v1

**Date:** 4 November 2026
**Author:** Wale Koleosho
**Entity:** Tech Sanctum OÜ
**Status:** Spec — supersedes the "AI Teammate" chat concept. Companion to `coordin-eic-vision.md` and `coordin-ee-regulatory-dataset-v1.md`.

---

## 1. The shift

AI stops being a sidebar tab. It becomes the front door and the configuration layer.

| Before | After |
|---|---|
| "AI Teammate" — a chat box next to the product | AI configures the practice, configures each project, and works inside the modules |
| Practice sets up Coordin over 2–3 weeks | Paste your website. Coordin configures itself. Confirm in 10 minutes |
| Architect defines a project by filling forms | Architect pastes the brief and the planning conditions. Coordin builds the project |
| Regulatory engine tells you what applies | Regulatory engine takes what the senior architect knows out of their head and into the studio's workflow |

**Core principle (unchanged from EIC vision):** Coordin is an organiser, not an advisor. AI reads, extracts, routes, configures and drafts. It does not make compliance judgements. Every AI action is logged, every AI output is marked as AI-generated, and nothing leaves the practice without human sign-off.

---

## 2. Three AI surfaces

### Surface A — Practice Setup (the embedded-finance pattern)

**Input:** website URL, or Estonian company registry code, or both.
**Output:** a configured Coordin workspace, pending confirmation.

Pipeline:

1. **Fetch** — crawl the practice website (home, about, projects, team, contact). If a registry code is given, pull the public record from Äriregister and the practice's projects from Ehitisregister.
2. **Extract** — one structured LLM call producing a `PracticeProfile`:
   - jurisdiction(s) and municipalities they work in
   - project types and mix (public / residential / commercial / heritage / masterplan / interiors / installations)
   - scale (team size, named partners, chartered status, EAL membership)
   - procurement pattern (competitions, state tenders, private clients)
   - languages
   - likely accounting software (Merit Aktiva, Directo, Xero) and file storage (SharePoint, Drive)
3. **Map** — `PracticeProfile` → Coordin configuration:
   - feature flags on/off (`OrganisationFeature` — already built)
   - compliance framework (Ehitusseadustik / CTE / BRPD)
   - stage convention (Estonian project stages vs RIBA)
   - approval routes (partner sign-off on fee quotes, timesheet approvers)
   - document numbering template
   - integration suggestions
   - a pre-populated project list from Ehitisregister (Estonia only)
4. **Confirm** — one screen: "Here's what we found. Here's what we've switched on. Correct anything." Five follow-up questions max for what a website can't tell us (who approves what, billing cadence, timesheet granularity).
5. **Apply** — write the configuration. Audit event: `ai.practice_configured` with the full profile and every setting changed.

Why this is stronger than the fintech version: their blocks are infrastructure that still needs integrating. Ours are modules already built behind feature flags. The AI doesn't scope the delivery — it *is* the delivery.

### Surface B — Project Setup

**Input:** project brief (text or PDF), municipality planning conditions (*projekteerimistingimused* PDF), or answers to the 18-parameter questionnaire. Any combination.
**Output:** a configured project, pending confirmation.

Pipeline:

1. **Extract** — brief and planning conditions → the 18 questionnaire parameters (building type, storeys, gross area, use class, site constraints, heritage status, etc.). Confidence per parameter. Anything below threshold is asked, not guessed.
2. **Match** — deterministic rules engine (already specced) → applicable Ehitusseadustik obligations, 40+ branches, 8 disciplines. No AI in this step. Rules are versioned and auditable.
3. **Extract conditions** — every bespoke planning condition from the municipality PDF becomes a tracked checklist item with source reference (page, paragraph).
4. **Configure** — stages and gates, milestones with deadlines derived from the permit process, document register template, required consultants (fire, structural, energy, heritage), approval routes for this project.
5. **Confirm** — show the parsed project profile. Architect corrects. Then generate.
6. **Apply** — audit event: `ai.project_configured` with parameters, rule version, and every item generated.

Who this is for: not the architect who doesn't know the rules. The practice where the senior architect *is* the compliance system. Their knowledge becomes the studio's workflow. Juniors run it, seniors review it, nothing gets missed when a rule changes, and there is a record.

### Surface C — AI inside the modules

Ordered by distance from what's built. Each one is a bounded pipeline with its own audit event and "AI-drafted" marker.

**Tier 1 — reads what the practice already has**

| Feature | What it does | Builds on |
|---|---|---|
| Planning conditions extraction | Municipality PDF → tracked checklist with source references | Surface B, Compliance module |
| Drawing register intelligence | Reads title blocks on upload, fills the register, flags revision mismatches and missing stamps | Drawing Register, FileUpload |
| Info In triage | Classifies incoming email and documents, links to project, extracts actions and RFIs | Outlook integration, Info In, Tasks |
| Meeting minutes → actions | Design review notes → owned, dated actions | Design Review, Tasks |
| Document classification and auto-filing | Uploads routed to the correct register with the correct revision | Documents, Drawing Register |

**Tier 2 — watches and warns**

| Feature | What it does | Builds on |
|---|---|---|
| Design-change re-check | Project parameter changes (floor added, use class changed) re-run the rules engine; flags new obligations and invalidated assumptions | Surface B, project state model |
| Regulatory change monitor | Watches Riigi Teataja for Ehitusseadustik amendments and municipal condition changes; flags affected live projects | Rules engine versioning |
| Fee overrun early warning | Timesheet burn vs stage plan; predicts overrun 4 weeks out | Timesheets, Resource Plan, Stage Gates |
| Scope creep detection | Logged work vs fee quote line items | Timesheets, Fee Quotes |
| Change order impact | Variation → which checklist items, milestones and costs are affected | Rules engine, Commercial, Milestones |

**Tier 3 — drafts for review (advisory boundary — governance first)**

| Feature | What it does | Governance requirement |
|---|---|---|
| Fee proposal draft | From brief + past quotes + similar projects | "Draft" watermark, partner approval route mandatory |
| Compliance statement draft | From project data in the municipality's expected format | Architect signs; diff against previous version stored |
| Client status narrative | Weekly summary from project health, for the architect to edit and send | Never auto-sends |
| Tender return comparison | Parses returns, normalises into side-by-side | Extraction only, no recommendation |
| Planning narrative drafting | Design & access statements and equivalents | Do not ship without PI insurance review |

**What stays out:** approval likelihood scoring and regulatory interpretation. Different liability class. Separate product or never.

---

## 3. Worked example — Salto Architects (salto.ee)

Input: `https://salto.ee`. No registry code. No follow-up questions answered yet.

### What the AI extracts

| Field | Value | Source |
|---|---|---|
| Practice | Salto arhitektid OÜ, Kalasadama 4, Tallinn | footer |
| Founded / partners | 2004; Maarja Kask, Ralf Lõoke, Ragnar Põllukivi | about |
| Team | 10 architects + 1 3D designer; 6 chartered (levels 7–8); EAL members | people |
| Project mix | Public buildings dominant (12 state high schools, theatres, museums, terminals); apartment buildings (8+); private villas (10+); installations and exhibitions | projects list |
| Procurement | Competition-led (100+ competition prizes); state and municipal clients (Riigi Kinnisvara, city governments); private residential | about, project titles |
| Municipalities | Tallinn, Tartu, Narva, Viljandi, Pärnu, Rakvere, Paide, Rapla, Saku, Otepää, Antsla, Aseri, Kiili, Muraste, Haabneeme, Sõmeru | project list — **16 omavalitsused** |
| Active projects | Regati housing Pirita (stage 1), Saku Elementary School, Tallinn City Theatre — all under construction 2025 | "built objects" list |
| Heritage work | Yes — multiple "Best Building in Historic Environment" awards | awards |
| Languages | Estonian, English | site |
| International | Paris, Venice, Russia installations | projects |

### What Coordin switches on

| Module | On/Off | Why |
|---|---|---|
| Projects, Tasks, Milestones, Stage Gates | On | Core |
| Compliance — Ehitusseadustik framework | On | Estonian practice |
| Planning conditions tracking | On, **16 municipality profiles pre-loaded** | They work across more municipalities than almost any Estonian practice |
| Heritage compliance (Muinsuskaitseamet conditions) | On | Award history shows repeat heritage work |
| Tender / competition module | On | Competition-led practice |
| Fee Quotes | On | Private residential clients |
| Drawing Register, Documents, Transmittals | On | Core |
| Site Observations, Snags | On | 3 projects under construction |
| Resource Planning, Timesheets | On | 11-person team, multiple concurrent public projects |
| Leave, Staffing, Onboarding | On, light config | 11 people; one on maternity leave — leave module needed |
| Commercial — Budgets, Variations, Valuations | On | Public-sector projects run on valuations |
| Expenses | On | Travel across 16 municipalities |
| Invoicing | On — suggest Merit Aktiva integration | Estonian SME default |
| CPD / Competence | On | 6 chartered architects, EAL CPD requirements |
| Knowledge Base | On, seeded with Ehitusseadustik summaries | — |
| BRPD (UK Building Safety Act) | Off | No UK work |
| RIBA stage convention | Off — Estonian stages (eskiis, eelprojekt, põhiprojekt, tööprojekt) | — |
| Multi-currency | Off | EUR only |
| Payroll export (NGN) | Off | — |

### Five follow-up questions the website can't answer

1. Who signs off fee quotes — any partner, or a specific one?
2. Timesheets weekly or daily? Who approves?
3. Accounting: Merit Aktiva, Directo, or something else?
4. Files: SharePoint, Google Drive, or local server?
5. Do you want the Ehitisregister project history imported? (Needs registry code.)

### Time to configured workspace

Website fetch + extraction: ~40 seconds. Confirmation screen: 5–10 minutes of the architect's time. Versus the current path: 2–3 weeks of setup calls and manual configuration.

This is the demo for the EAL working group. Each architect in the room pastes their own URL.

---

## 4. Architecture

```
┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│  Fetch /     │ →  │  Extract      │ →  │  Map         │ →  │  Confirm +   │
│  Ingest      │    │  (LLM, typed  │    │  (determin-  │    │  Apply       │
│              │    │   schema)     │    │   istic)     │    │  (audited)   │
└──────────────┘    └───────────────┘    └──────────────┘    └──────────────┘
  website crawl       PracticeProfile      FEATURE_REGISTRY     OrganisationFeature
  Äriregister         ProjectProfile       rules engine         Project + checklist
  Ehitisregister      ConditionList        municipality map     AuditEvent
  PDF (brief, PT)     ExtractedActions     stage conventions    "AI-generated" flags
  email (Graph)
```

**Rules:**
- LLM output is always a typed schema (Zod). Never free text into the database.
- Every extracted field carries `confidence` and `source` (URL, page, paragraph).
- Mapping is deterministic code. The LLM proposes a profile; code decides configuration. This keeps the rules engine auditable and the AI replaceable.
- Confirmation screen before every write. No silent configuration.
- One audit event per AI action with full input, output, model, version, and the human who confirmed.

**Model strategy:**
- Extraction and classification: Mistral (EU-hosted, already on the test list) as default; Claude as fallback for long-document extraction.
- Drafting (Tier 3): Claude.
- Document classification at scale: fine-tuned small model later; LLM now.
- All calls server-side via `/api/ai/*`. No client-side keys.

**New schema:**
- `AIRun` — id, organisationId, projectId?, surface (practice_setup | project_setup | extraction | draft), model, inputHash, output (JSON), confidence, confirmedBy, confirmedAt, appliedAt
- `PracticeProfile` — one per organisation, versioned
- `ProjectProfile` — the 18 parameters + extras, versioned (enables Tier 2 re-check)
- `MunicipalityProfile` — code, name, planning-conditions template, contacts, known quirks
- `AIGenerated` flag on Task, ChecklistItem, Document, FeeQuote, Comment

**Governance (fintech-grade):**
- Admin controls already exist (`/settings/admin`). Extend: per-surface on/off, model selection, data residency (EU-only), retention.
- "AI-drafted" badge on every generated artefact until a human edits or approves it.
- Export: full AI audit log as CSV alongside the existing audit export.

---

## 5. Build sequence

| Step | Scope | Effort | Unlocks |
|---|---|---|---|
| 1 | **Practice Setup from website** — crawl, extract `PracticeProfile`, map to feature flags, confirmation screen, apply + audit | 3–4 days | EAL demo; onboarding time to minutes; email to Ülar ("send me your URL") |
| 2 | **Project Setup from questionnaire** — 18 parameters → rules engine → checklist. Deterministic. Already specced | 5–7 days | TRL 5 evidence; Eurostars / EIC narrative |
| 3 | **Brief + planning conditions extraction** — PDF → parameters + condition list with sources, confidence, confirmation | 4–5 days | The daily-pain feature for senior architects |
| 4 | **Ehitisregister import** — registry code → project history | 2 days | Estonia-only moat; no competitor does this |
| 5 | **Tier 1 in-module AI** — drawing title blocks, Info In triage, minutes → actions | 2 days each | Visible AI across the product |
| 6 | **Project state + re-check** — versioned `ProjectProfile`, change events, re-run rules | 4–5 days | Tier 2 foundation |
| 7 | **Regulatory change monitor** — Riigi Teataja watcher, diff, impact flag | 3 days | "Nothing gets missed when rules change" |
| 8 | **Tier 3 drafts** — fee proposal, compliance statement, client narrative. Governance first | 2–3 days each after governance design | Revenue surfaces |

Steps 1–3 are the EAL demo and the grant evidence. ~3 weeks.

---

## 6. Demo plan — EAL AI working group

1. Open Coordin. Paste `salto.ee`. 40 seconds. Show the profile. Show the switched-on modules. Ask the room: "What did it get wrong?"
2. Ask one architect for their URL. Do it live.
3. Open a project. Paste a real *projekteerimistingimused* PDF (ask Ülar or Laila for one in advance). Show the checklist with source references.
4. Change one parameter — add a storey. Show what the rules engine flags.
5. Show the audit log. "Every AI action, who confirmed it, when."
6. Ask: "Would you trust this? Where would you not?"

That last question is the validation evidence for Eurostars and EIC.

---

## 7. Open questions

- Website crawling: respect robots.txt; cache; what if the site is Estonian-only? (Extraction handles it; test.)
- Ehitisregister API access terms — public read, but check rate limits and whether a company-level query is supported without authentication.
- Municipality planning-conditions formats — how consistent are they across the 79 omavalitsused? Sample 5 before building the extractor.
- Confidence threshold for "ask vs guess" — start at 0.8, tune with real documents.
- Which "AI-drafted" artefacts can be auto-cleared by edit, and which need explicit approval? Fee quotes and compliance statements: explicit. Tasks and checklist items: edit clears.
- Pricing: is AI setup included, or a paid tier? Lean: included — it's the acquisition engine, not the product.
