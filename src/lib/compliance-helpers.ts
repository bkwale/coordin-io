/**
 * Shared helper: recompute a compliance register's overallStatus from its items.
 * Call after any item CREATE, UPDATE, or DELETE.
 */
export async function recomputeRegisterStatus(
  prisma: { complianceItem: any; complianceRegister: any },
  registerId: string,
): Promise<string> {
  const allItems = await prisma.complianceItem.findMany({
    where: { registerId },
    select: { status: true },
  })

  let newStatus = 'NOT_STARTED'
  if (allItems.length > 0) {
    const statuses = allItems.map((i: { status: string }) => i.status)
    const resolvedStatuses = ['COMPLIANT', 'APPROVED_WITH_CONDITION', 'NOT_APPLICABLE', 'CLOSED']
    const allResolved = statuses.every((s: string) => resolvedStatuses.includes(s))
    const hasNonCompliant = statuses.some((s: string) => s === 'NON_COMPLIANT' || s === 'ACTION_REQUIRED')
    const hasInProgress = statuses.some((s: string) => s === 'IN_PROGRESS' || s === 'EVIDENCE_SUBMITTED' || s === 'UNDER_REVIEW')

    if (allResolved) {
      newStatus = 'COMPLIANT'
    } else if (hasNonCompliant) {
      newStatus = 'ACTION_REQUIRED'
    } else if (hasInProgress) {
      newStatus = 'IN_PROGRESS'
    }
    // else: all items NOT_STARTED → register stays NOT_STARTED
  }

  await prisma.complianceRegister.update({
    where: { id: registerId },
    data: { overallStatus: newStatus },
  })

  return newStatus
}
