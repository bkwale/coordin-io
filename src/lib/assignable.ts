import { prisma } from '@/lib/prisma'
import { ValidationError } from '@/lib/errors'

/**
 * People who have left (status DEACTIVATED) keep their history but can't be given new work.
 * Throws if any of the given profile ids is not a current member of the organisation.
 * Ids that are null/undefined are ignored (unassigning is always allowed).
 */
export async function assertAssignable(organisationId: string, ids: Array<string | null | undefined>): Promise<void> {
  const wanted = Array.from(new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0)))
  if (wanted.length === 0) return
  const found = await prisma.profile.findMany({
    where: { id: { in: wanted }, organisationId },
    select: { id: true, fullName: true, status: true },
  })
  const missing = wanted.filter((id) => !found.some((p) => p.id === id))
  if (missing.length) throw new ValidationError('That person is not in your organisation')
  const gone = found.filter((p) => p.status === 'DEACTIVATED')
  if (gone.length) throw new ValidationError(`${gone.map((p) => p.fullName).join(', ')} ${gone.length > 1 ? 'have' : 'has'} been deactivated and can't be assigned work`)
}
