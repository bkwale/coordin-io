/**
 * Annual-leave default for a newly created employee record, by the firm's country.
 * Returns nothing to add for firms on the standard 25 days (so their records are created exactly as before),
 * and the country figure where it differs (Estonia: 28 calendar days).
 */
import { leaveRules } from './region'

export async function leaveDefaultForNewEmployee(organisationId: string): Promise<{ annualLeaveAllocation?: number }> {
  try {
    const { firmDefaults } = await import('./region-server')
    const days = leaveRules((await firmDefaults(organisationId)).country).annualDays
    return days === 25 ? {} : { annualLeaveAllocation: days }
  } catch {
    return {}
  }
}
