import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useParams: () => ({ id: 'p' }) }))
vi.mock('next/link', () => ({ default: (p: any) => p.children }))
vi.mock('@/hooks/use-org-features', () => ({ useOrgFeatures: () => ({ features: [], loading: false }) }))

const { tabMatchesRoute } = await import('@/app/projects/[id]/layout')

const OVERVIEW = ['', '/health', '/brief', '/resources']
const COMPLIANCE = ['/regulatory', '/brpd', '/brpd/changelog', '/building-regs', '/design-risks']

describe('project tab matching (regression: Overview matched every route)', () => {
  it('Overview matches only its own routes', () => {
    expect(tabMatchesRoute(OVERVIEW, '')).toBe(true)
    expect(tabMatchesRoute(OVERVIEW, '/health')).toBe(true)
    expect(tabMatchesRoute(OVERVIEW, '/regulatory')).toBe(false)
    expect(tabMatchesRoute(OVERVIEW, '/tasks/123')).toBe(false)
  })
  it('Compliance matches regulatory and nested routes', () => {
    expect(tabMatchesRoute(COMPLIANCE, '/regulatory')).toBe(true)
    expect(tabMatchesRoute(COMPLIANCE, '/brpd/changelog')).toBe(true)
    expect(tabMatchesRoute(COMPLIANCE, '/building-regs/abc')).toBe(true)
    expect(tabMatchesRoute(COMPLIANCE, '/tasks')).toBe(false)
  })
  it('does not prefix-match partial segment names', () => {
    expect(tabMatchesRoute(['/brpd'], '/brpd-extra')).toBe(false)
  })
})
