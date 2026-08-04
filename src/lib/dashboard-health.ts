/**
 * Compute effective project health from actual task data.
 *
 * Rules:
 * - No tasks → GREY (insufficient data)
 * - >3 overdue OR >25% overdue → RED
 * - Any overdue + stored health GREEN → AMBER (override the lie)
 * - Otherwise → stored healthStatus (or GREY if null)
 */
export function computeEffectiveHealth(project: {
  healthStatus: string | null
  tasks: Array<{ status: string; dueDate: Date | null }>
}): string {
  const now = new Date()
  const NON_OVERDUE_STATUSES = ['COMPLETED']

  const totalTaskCount = project.tasks.length
  const overdueTaskCount = project.tasks.filter(
    (t) =>
      t.dueDate !== null &&
      t.dueDate < now &&
      !NON_OVERDUE_STATUSES.includes(t.status),
  ).length

  if (totalTaskCount === 0) return 'GREY'
  if (
    overdueTaskCount > 3 ||
    (totalTaskCount > 0 && overdueTaskCount / totalTaskCount > 0.25)
  )
    return 'RED'
  if (overdueTaskCount > 0 && project.healthStatus === 'GREEN') return 'AMBER'
  return project.healthStatus ?? 'GREY'
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
