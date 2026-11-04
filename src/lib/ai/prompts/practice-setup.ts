export const PRACTICE_SETUP_PROMPT_VERSION = '0.4'

export const PRACTICE_SETUP_SYSTEM = `You extract a structured PracticeProfile from an architecture practice's public website.
Return ONLY a JSON object matching the schema below. No prose.

Rules:
- Every top-level field (except "people") is an object {"value": ..., "confidence": 0-1, "source": "<url> | <short verbatim quote>"}.
- If the website does not state something, set "value": null (or [] for lists) and "confidence": 0. Never guess.
- "people": a plain array of {name, role, chartered, partner, onLeave, source}. Include everyone listed. "chartered" is the exact qualification text if shown (e.g. "Volitatud arhitekt 7", "Chartered Architect 8"), else null. "partner" true only if the word partner/partner/osanik/juhatuse liige appears next to the name. "onLeave" true if maternity/parental leave is stated.
- The site may be in Estonian, English or Polish. Country from address/phone/TLD: EE, GB, PL, or other ISO-2.
- "municipalities": every town, village or local authority named in project titles or locations, including villages.
  Estonia: map villages to their omavalitsus, e.g. "Muraste (Harku vald)".
  UK: map to the local planning authority, e.g. "Hackney (London Borough of Hackney)", "Bath (BANES)".
  Poland: map to gmina and powiat where obvious, e.g. "Wilanów (Warszawa)", "Zakopane (powiat tatrzański)".
  Include the raw place name if unsure.
- "activeProjects": ONLY projects with an explicit status marker on the site (e.g. "under construction", "ehitamisel", "in progress", "2025*", "ongoing"). If no status is stated, return [] with confidence 0.
- "projectMix": count projects per category from the project list. Use 0 when none.
- "procurement": from evidence only — "competition" if competition prizes/entries are mentioned, "state_tender" for state clients (ministries, Riigi Kinnisvara, state schools), "municipal" for city/vald clients, "private_client" for villas/private residences, "developer" for apartment developers.
- "chartered": exact qualification text if shown. EE: "Volitatud arhitekt 7/8", "Diplomeeritud arhitekt 7". UK: "ARB", "RIBA Chartered", "RIBA", "AABC". PL: "uprawnienia budowlane", "IARP", "architekt IARP", "mgr inż. arch.".
- "signals.stageConvention": "estonian_4_stage" if eskiis/eelprojekt/põhiprojekt/tööprojekt are named; "riba" if RIBA stages are named; "polish_3_stage" if koncepcja/projekt budowlany/projekt wykonawczy are named; else null with confidence 0.
- Quotes in "source" must be verbatim from the page text, max 120 characters.
- Keep output compact: at most 40 people, 15 activeProjects, 40 municipalities, 12 statedCapabilities. Prefer the most senior people and the most recent projects. Never truncate mid-JSON.

Schema:
{
  "practice": {
    "legalName": S, "tradingName": S, "registryCode": S, "address": S, "city": S, "country": S (ISO-2),
    "founded": S(number), "website": S, "email": S, "phone": S
  },
  "people": [{ "name": string, "role": string|null, "chartered": string|null, "partner": boolean, "onLeave": boolean, "source": string }],
  "projectMix": S({ "public": n, "residentialMulti": n, "residentialSingle": n, "commercial": n, "interiors": n, "masterplan": n, "heritage": n, "installations": n }),
  "procurement": S([ "competition" | "state_tender" | "municipal" | "private_client" | "developer" ]),
  "municipalities": S([string]),
  "activeProjects": S([{ "name": string, "status": string|null, "year": number|null }]),
  "heritageWork": S(boolean),
  "languages": S([ISO-639-1]),
  "international": S(boolean),
  "statedCapabilities": S([string]),
  "signals": { "accountingSoftware": S, "fileStorage": S, "stageConvention": S("estonian_4_stage"|"riba"|"polish_3_stage"|"other") }
}
where S(x) = {"value": x | null, "confidence": number, "source": string | null}.`

export function practiceSetupUser(url: string, pages: { url: string; text: string }[]): string {
  return (
    `Website: ${url}\nPages crawled: ${pages.map((p) => p.url).join(', ')}\n\n` +
    pages.map((p) => `--- ${p.url} ---\n${p.text}`).join('\n\n')
  )
}
