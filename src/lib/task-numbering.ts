/**
 * Task numbering utilities.
 *
 * Generates two reference formats:
 *   - Project-wide:      {CODE}-{NNN}        e.g. CWA-003
 *   - Milestone-scoped:  {CODE}-M{NN}-T{NN}  e.g. GZP-M05-T03
 *
 * Both are computed from creation order (stable, deterministic).
 */

/**
 * Build a map of task ID → sequential 1-based position within the project.
 * Input must be ordered by (createdAt ASC, id ASC).
 */
export function buildProjectTaskNumberMap(
  taskIds: { id: string }[],
): Map<string, number> {
  return new Map(taskIds.map((t, i) => [t.id, i + 1]))
}

/**
 * Build a map of milestone ID → sequential 1-based position within the project.
 * Input must be ordered by (createdAt ASC, id ASC).
 */
export function buildMilestoneNumberMap(
  milestoneIds: { id: string }[],
): Map<string, number> {
  return new Map(milestoneIds.map((m, i) => [m.id, i + 1]))
}

/**
 * Build a map of task ID → sequential 1-based position within its milestone.
 * Input must be ordered by (createdAt ASC, id ASC) and only include tasks with milestoneId.
 */
export function buildMilestoneTaskPositionMap(
  tasks: { id: string; milestoneId: string | null }[],
): Map<string, number> {
  const byMilestone = new Map<string, string[]>()
  for (const t of tasks) {
    if (!t.milestoneId) continue
    const list = byMilestone.get(t.milestoneId) || []
    list.push(t.id)
    byMilestone.set(t.milestoneId, list)
  }

  const positionMap = new Map<string, number>()
  for (const taskIds of byMilestone.values()) {
    taskIds.forEach((id, idx) => {
      positionMap.set(id, idx + 1)
    })
  }
  return positionMap
}

/**
 * Format the project-wide task number.
 * e.g. "CWA-003"
 */
export function formatProjectTaskNumber(prefix: string, position: number): string {
  return `${prefix}-${String(position).padStart(3, '0')}`
}

/**
 * Format the milestone-scoped task reference.
 * e.g. "GZP-M05-T03"
 *
 * Returns null if the task has no milestone or milestone data is missing.
 */
export function formatMilestoneTaskNumber(
  prefix: string,
  milestonePosition: number | undefined,
  taskPositionInMilestone: number | undefined,
): string | null {
  if (milestonePosition === undefined || taskPositionInMilestone === undefined) return null
  return `${prefix}-M${String(milestonePosition).padStart(2, '0')}-T${String(taskPositionInMilestone).padStart(2, '0')}`
}
