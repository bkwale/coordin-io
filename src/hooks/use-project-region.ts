'use client'

import { useEffect, useState } from 'react'
import { countryCode, type CountryCode, type CurrencyCode } from '@/lib/region'

export interface ProjectRegion {
  loaded: boolean
  /** The project's country (its jurisdiction or site), else the firm's. Null when neither is known. */
  country: CountryCode | null
  /** Currency for new records on this project: the project's, else the firm's. */
  currency: CurrencyCode | null
  projectType: string | null
  jurisdiction: string | null
  /** The firm's own country, whatever the project's. */
  firmCountry: CountryCode | null
}

const EMPTY: ProjectRegion = { loaded: false, country: null, currency: null, projectType: null, jurisdiction: null, firmCountry: null }

/** One place for project pages to learn the project's country, currency and type. */
export function useProjectRegion(projectId: string | undefined): ProjectRegion {
  const [state, setState] = useState<ProjectRegion>(EMPTY)
  useEffect(() => {
    if (!projectId) return
    let live = true
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/org/region', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([p, o]) => {
      if (!live) return
      const project = p?.data?.project
      const firm = o?.data
      const cur = project?.currency ?? firm?.currency ?? null
      setState({
        loaded: true,
        country: countryCode(project?.jurisdiction) ?? countryCode(project?.siteCountry) ?? (firm?.country as CountryCode | null) ?? null,
        currency: cur === 'EUR' || cur === 'GBP' || cur === 'NGN' || cur === 'USD' ? cur : null,
        projectType: project?.projectType ?? null,
        jurisdiction: project?.jurisdiction ?? null,
        firmCountry: (firm?.country as CountryCode | null) ?? null,
      })
    })
    return () => { live = false }
  }, [projectId])
  return state
}
