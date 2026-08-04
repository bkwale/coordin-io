/**
 * Validate that onboarding prerequisites are met.
 * Returns { valid, missing } where missing lists human-readable gaps.
 */
export function validateOnboardingCompletion(params: {
  totalPolicies: number
  acknowledgedPolicies: number
  totalTraining: number
  completedTraining: number
}): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  if (params.totalPolicies > 0 && params.acknowledgedPolicies < params.totalPolicies) {
    missing.push(
      `${params.totalPolicies - params.acknowledgedPolicies} of ${params.totalPolicies} mandatory policies not acknowledged`,
    )
  }

  if (params.totalTraining > 0 && params.completedTraining < params.totalTraining) {
    missing.push(
      `${params.totalTraining - params.completedTraining} of ${params.totalTraining} mandatory training items not completed`,
    )
  }

  return { valid: missing.length === 0, missing }
}
