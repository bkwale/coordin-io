import { prisma } from '@/lib/prisma'
import { ValidationError } from '@/lib/errors'

/**
 * Projects anyone in the organisation can book time to. Not limited to project membership:
 * new joiners belong to no project yet, and an empty dropdown left their hours unassigned (Ayo, 7 Nov).
 */
export async function bookableProjects(organisationId: string) {
  return prisma.project.findMany({
    where: { organisationId, status: { not: 'ARCHIVED' } },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })
}

/** A timesheet entry may only point at a project in the same organisation. */
export async function assertBookableProject(organisationId: string, projectId: string | null | undefined): Promise<void> {
  if (!projectId) return
  const p = await prisma.project.findFirst({ where: { id: projectId, organisationId }, select: { id: true } })
  if (!p) throw new ValidationError('That project is not available for timesheets')
}
