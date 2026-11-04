/** One shape for every company registry. Facts, not inference. Never includes personal ID codes. */
export interface CompanyFacts {
  jurisdiction: 'EE' | 'GB'
  registryCode: string
  legalName: string
  historicalNames: string[]
  status: 'active' | 'dissolved' | 'liquidation' | 'other'
  statusRaw: string
  legalForm: string | null
  registeredAt: string | null     // ISO date
  address: string | null
  city: string | null
  postcode: string | null
  activity: { code: string; label: string; scheme: 'EMTAK' | 'SIC' } | null
  isArchitecturePractice: boolean // EMTAK 711x / SIC 7111x
  board: string[]                 // names only
  capital: string | null
  sourceUrl: string
  fetchedAt: string
}

export interface CompanySearchHit {
  jurisdiction: 'EE' | 'GB'
  registryCode: string
  name: string
  address: string | null
  status: string
}
