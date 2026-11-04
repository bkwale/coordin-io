/**
 * Registry facts → PracticeProfile. Deterministic. Registry beats website: every overlaid field is
 * confidence 1.0 with source = the registry URL. Used both to enrich a website run and to build a
 * profile with no website at all (no model call).
 */
import type { CompanyFacts } from '@/lib/registry'
import type { PracticeProfile } from './schemas'

const src = (f: CompanyFacts) => ({ url: f.sourceUrl, quote: `${f.jurisdiction === 'EE' ? 'Äriregister' : 'Companies House'} ${f.registryCode}` })
const S = <T,>(value: T | null, f: CompanyFacts) => ({ value, confidence: value === null ? 0 : 1, source: value === null ? null : src(f) })

export function overlayRegistryFacts(profile: PracticeProfile, f: CompanyFacts): PracticeProfile {
  const founded = f.registeredAt ? parseInt(f.registeredAt.slice(0, 4), 10) : null
  const existingNames = new Set(profile.people.map((p) => p.name.toLowerCase()))
  const boardPeople = f.board
    .filter((n) => !existingNames.has(n.toLowerCase()))
    .map((name) => ({ name, role: f.jurisdiction === 'EE' ? 'Juhatuse liige' : 'Director', chartered: null, partner: true, onLeave: false, confidence: 1, source: src(f) }))
  const merged = profile.people.map((p) => (f.board.some((b) => b.toLowerCase() === p.name.toLowerCase()) ? { ...p, partner: true, confidence: 1, source: p.source ?? src(f) } : p))
  return {
    ...profile,
    practice: {
      ...profile.practice,
      legalName: S(f.legalName, f),
      registryCode: S(f.registryCode, f),
      address: f.address ? S(f.address, f) : profile.practice.address,
      city: f.city ? S(f.city, f) : profile.practice.city,
      country: S(f.jurisdiction, f),
      founded: founded ? S(founded, f) : profile.practice.founded,
      tradingName: profile.practice.tradingName.value ? profile.practice.tradingName : S(f.legalName.replace(/\s+(OÜ|AS|Ltd\.?|Limited|LLP)$/i, ''), f),
    },
    people: [...merged, ...boardPeople],
  }
}

/** A profile from registry facts alone — used when the practice has no usable website. */
export function profileFromRegistry(f: CompanyFacts): PracticeProfile {
  const empty = <T,>(value: T | null = null) => ({ value, confidence: 0, source: null })
  const base: PracticeProfile = {
    practice: {
      legalName: empty<string>(), tradingName: empty<string>(), registryCode: empty<string>(), address: empty<string>(), city: empty<string>(),
      country: empty<string>(), founded: empty<number>(), website: empty<string>(), email: empty<string>(), phone: empty<string>(),
    },
    people: [],
    projectMix: empty({ public: 0, residentialMulti: 0, residentialSingle: 0, commercial: 0, interiors: 0, masterplan: 0, heritage: 0, installations: 0 }),
    procurement: empty<string[]>([]), municipalities: empty<string[]>([]), activeProjects: empty([]),
    heritageWork: empty<boolean>(false), languages: empty<string[]>([f.jurisdiction === 'EE' ? 'et' : 'en']), international: empty<boolean>(false),
    statedCapabilities: empty<string[]>(f.isArchitecturePractice ? ['architecture'] : []),
    signals: {},
  }
  return overlayRegistryFacts(base, f)
}
