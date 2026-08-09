/**
 * Compute effective project health from actual task, compliance, and snag data.
 *
 * Rules:
 * - No tasks AND no compliance items → GREY (insufficient data)
 * - >3 overdue OR >25% overdue → RED
 * - Any overdue tasks → AMBER at minimum
 * - Any compliance items NON_COMPLIANT or ACTION_REQUIRED → AMBER at minimum
 * - Open SAFETY_CRITICAL snags → RED; open MAJOR snags → AMBER at minimum
 * - Otherwise → stored healthStatus (or GREY if null)
 *
 * Uses worst-of-all-signals: each signal can only escalate, never de-escalate.
 */
export function computeEffectiveHealth(project: {
  healthStatus: string | null
  tasks: Array<{ status: string; dueDate: Date | null }>
  complianceItems?: Array<{ status: string }>
  snags?: Array<{ status: string; severity: string }>
}): string {
  const now = new Date()
  const NON_OVERDUE_STATUSES = ['COMPLETED', 'CANCELLED']

  const totalTaskCount = project.tasks.length
  const overdueTaskCount = project.tasks.filter(
    (t) =>
      t.dueDate !== null &&
      t.dueDate < now &&
      !NON_OVERDUE_STATUSES.includes(t.status),
  ).length

  const complianceItems = project.complianceItems ?? []
  const snags = project.snags ?? []

  // Insufficient data: no tasks AND no compliance items
  if (totalTaskCount === 0 && complianceItems.length === 0) return 'GREY'

  // Severity ordering for worst-of comparison
  const SEVERITY: Record<string, number> = { GREEN: 0, GREY: 1, AMBER: 2, RED: 3 }
  function worst(a: string, b: string): string {
    return (SEVERITY[a] ?? 0) >= (SEVERITY[b] ?? 0) ? a : b
  }

  // Start from stored status (or GREY if null)
  let health = project.healthStatus ?? 'GREY'

  // Task-based signals
  if (
    overdueTaskCount > 3 ||
    (totalTaskCount > 0 && overdueTaskCount / totalTaskCount > 0.25)
  ) {
    health = worst(health, 'RED')
  } else if (overdueTaskCount > 0) {
    health = worst(health, 'AMBER')
  }

  // Compliance signals
  const hasComplianceIssues = complianceItems.some(
    (c) => c.status === 'NON_COMPLIANT' || c.status === 'ACTION_REQUIRED',
  )
  if (hasComplianceIssues) {
    health = worst(health, 'AMBER')
  }

  // Snag signals: open critical/high severity
  const OPEN_SNAG_STATUSES = ['OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED']
  const hasSafetyCriticalSnags = snags.some(
    (s) => OPEN_SNAG_STATUSES.includes(s.status) && s.severity === 'SAFETY_CRITICAL',
  )
  const hasMajorSnags = snags.some(
    (s) => OPEN_SNAG_STATUSES.includes(s.status) && s.severity === 'MAJOR',
  )
  if (hasSafetyCriticalSnags) {
    health = worst(health, 'RED')
  } else if (hasMajorSnags) {
    health = worst(health, 'AMBER')
  }

  return health
}

/**
 * Check if ALL projects in a list have effective GREEN health.
 * Returns false for empty lists (no projects = not "all healthy").
 */
export function computeAllProjectsHealthy(
  projects: Array<{
    healthStatus: string | null
    tasks: Array<{ status: string; dueDate: Date | null }>
  }>,
): boolean {
  if (projects.length === 0) return false
  return projects.every((p) => computeEffectiveHealth(p) === 'GREEN')
}
