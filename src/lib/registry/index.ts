import { cached } from '@/lib/cache'
import { searchAriregister, getAriregisterCompany } from './ee'
import { searchCompaniesHouse, getCompaniesHouseCompany } from './gb'
import type { CompanyFacts, CompanySearchHit } from './types'
export * from './types'

export type RegistryJurisdiction = 'EE' | 'GB'
export const REGISTRY_LABEL: Record<RegistryJurisdiction, string> = { EE: 'Äriregister', GB: 'Companies House' }

export function isRegistryConfigured(j: RegistryJurisdiction): boolean {
  return j === 'EE' ? true : !!process.env.COMPANIES_HOUSE_API_KEY
}

export async function searchCompany(j: RegistryJurisdiction, q: string): Promise<CompanySearchHit[]> {
  const key = `registry:search:${j}:${q.toLowerCase().trim()}`
  return cached(key, () => (j === 'EE' ? searchAriregister(q) : searchCompaniesHouse(q)), 60 * 60)
}

export async function lookupCompany(j: RegistryJurisdiction, code: string): Promise<CompanyFacts | null> {
  const key = `registry:company:${j}:${code.toUpperCase().trim()}`
  return cached(key, () => (j === 'EE' ? getAriregisterCompany(code) : getCompaniesHouseCompany(code)), 24 * 60 * 60)
}
