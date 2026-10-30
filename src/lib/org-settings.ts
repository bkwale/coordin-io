import { prisma } from '@/lib/prisma'

export interface OrgSettings {
  defaultProbationMonths?: number
  // Future org settings go here
}

/**
 * Get typed org settings from the JSON blob.
 */
export async function getOrgSettings(organisationId: string): Promise<OrgSettings> {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { settings: true },
  })
  if (!org?.settings || typeof org.settings !== 'object') return {}
  return org.settings as OrgSettings
}

/**
 * Update org settings (merge, not replace).
 */
export async function updateOrgSettings(
  organisationId: string,
  updates: Partial<OrgSettings>,
): Promise<OrgSettings> {
  const current = await getOrgSettings(organisationId)
  const merged = { ...current, ...updates }
  await prisma.organisation.update({
    where: { id: organisationId },
    data: { settings: merged },
  })
  return merged
}

/**
 * Get effective probation length for an employee.
 * Priority: employee override > org default > system default (3 months).
 */
export async function getEffectiveProbationMonths(
  profileProbationLength: number | null | undefined,
  organisationId: string,
): Promise<number> {
  if (profileProbationLength != null && profileProbationLength > 0) {
    return profileProbationLength
  }
  const settings = await getOrgSettings(organisationId)
  return settings.defaultProbationMonths ?? 3
}
