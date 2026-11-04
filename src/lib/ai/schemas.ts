import { z } from 'zod'

// ── Field wrapper: every extracted value carries confidence + source ──────────
export const Sourced = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.number().min(0).max(1),
    source: z
      .union([
        z.string(),
        z.object({ url: z.string().optional(), quote: z.string().optional() }),
      ])
      .nullable()
      .optional(),
  })

export type SourcedField<T> = { value: T | null; confidence: number; source?: string | { url?: string; quote?: string } | null }

// ── PracticeProfile — output of practice-setup extraction ────────────────────
export const PersonSchema = z.object({
  name: z.string(),
  role: z.string().nullable().optional(),
  chartered: z.string().nullable().optional(),
  partner: z.boolean().optional().default(false),
  onLeave: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(1).optional(),
  source: z.any().optional(),
})

export const PracticeProfileSchema = z.object({
  practice: z.object({
    legalName: Sourced(z.string()),
    tradingName: Sourced(z.string()),
    registryCode: Sourced(z.string()).optional(),
    address: Sourced(z.string()),
    city: Sourced(z.string()),
    country: Sourced(z.string()),
    founded: Sourced(z.number()).optional(),
    website: Sourced(z.string()),
    email: Sourced(z.string()).optional(),
    phone: Sourced(z.string()).optional(),
  }),
  people: z.array(PersonSchema).default([]),
  projectMix: Sourced(
    z.object({
      public: z.number().default(0),
      residentialMulti: z.number().default(0),
      residentialSingle: z.number().default(0),
      commercial: z.number().default(0),
      interiors: z.number().default(0),
      masterplan: z.number().default(0),
      heritage: z.number().default(0),
      installations: z.number().default(0),
    }),
  ),
  procurement: Sourced(z.array(z.string())),
  municipalities: Sourced(z.array(z.string())),
  activeProjects: Sourced(
    z.array(z.object({ name: z.string(), status: z.string().nullable().optional(), year: z.number().nullable().optional() })),
  ),
  heritageWork: Sourced(z.boolean()),
  languages: Sourced(z.array(z.string())),
  international: Sourced(z.boolean()),
  statedCapabilities: Sourced(z.array(z.string())),
  signals: z.object({
    accountingSoftware: Sourced(z.string()).optional(),
    fileStorage: Sourced(z.string()).optional(),
    stageConvention: Sourced(z.enum(['estonian_4_stage', 'riba', 'other'])).optional(),
  }),
})

export type PracticeProfile = z.infer<typeof PracticeProfileSchema>

// Mistral sometimes wraps nested arrays' items as Sourced; normalise lightly before parse.
export function normalisePracticeProfile(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, any>
  const unwrap = (x: any) => (x && typeof x === 'object' && 'value' in x && 'confidence' in x ? x.value : x)
  if (Array.isArray(r.people)) {
    r.people = r.people.map((p: any) => ({
      ...p,
      name: unwrap(p.name),
      role: unwrap(p.role),
      chartered: unwrap(p.chartered),
      partner: Boolean(unwrap(p.partner)),
      onLeave: Boolean(unwrap(p.onLeave)),
    }))
  }
  if (r.activeProjects?.value && Array.isArray(r.activeProjects.value)) {
    r.activeProjects.value = r.activeProjects.value.map((p: any) => ({
      name: unwrap(p.name),
      status: unwrap(p.status),
      year: unwrap(p.year),
    }))
  }
  if (r.projectMix?.value && typeof r.projectMix.value === 'object') {
    for (const k of Object.keys(r.projectMix.value)) r.projectMix.value[k] = Number(unwrap(r.projectMix.value[k]) ?? 0)
  }
  // If projectMix came back flat (no .value), wrap it
  if (r.projectMix && !('value' in r.projectMix)) {
    const flat: Record<string, number> = {}
    for (const k of Object.keys(r.projectMix)) flat[k] = Number(unwrap(r.projectMix[k]) ?? 0)
    r.projectMix = { value: flat, confidence: 0.6, source: null }
  }
  return r
}
