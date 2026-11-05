import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: {} }))

/**
 * S4.1 QA: AI setup and EHR writes must not ride on withProjectAccess alone — view_all org roles
 * (HR, FINANCE, LEGAL, COMMERCIAL) get membership=null there, which skips minProjectRole.
 * Every write handler must call assertProjectWrite before doing anything else.
 */
const ROUTES: Array<[string, string[]]> = [
  ['src/app/api/projects/[id]/setup/extract/route.ts', ['POST']],
  ['src/app/api/projects/[id]/setup/confirm/route.ts', ['POST']],
  ['src/app/api/projects/[id]/ehr/route.ts', ['POST', 'DELETE']],
]

describe('project write guards on AI setup + EHR routes', () => {
  for (const [file, methods] of ROUTES) {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    for (const m of methods) {
      it(`${m} ${file.replace('src/app', '')} checks assertProjectWrite first`, () => {
        const start = src.indexOf(`export const ${m} =`)
        expect(start).toBeGreaterThan(-1)
        const body = src.slice(start, start + 600)
        const firstAwait = body.indexOf('await ')
        expect(body.slice(firstAwait, firstAwait + 40)).toMatch(/^await assertProjectWrite\(/)
        expect(body).toMatch(/'PROJECT_LEAD'/)
      })
    }
  }

  it('assertProjectWrite is the delivery guard (HR with no membership is refused)', async () => {
    const mod = await import('@/lib/project-write-access')
    const delivery = await import('@/lib/delivery/access')
    expect(mod.assertProjectWrite).toBe(delivery.assertDeliveryWrite)
  })
})
