import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { createNotifications, NOTIFICATION_EVENTS } from '@/lib/notifications'
import {
  requireString, optionalString, optionalEnum, parseBody,
} from '@/lib/validation'

const HEALTH_STATUSES = ['GREEN', 'AMBER', 'RED', 'GREY'] as const
const HEALTH_CATEGORIES = ['SCHEDULE', 'BUDGET', 'QUALITY', 'SAFETY', 'RISK', 'OVERALL'] as const

/* ── Derived health helpers ──────────────────────────────────── */

async function computeDerivedHealth(projectId: string) {
  // Schedule health — based on overdue tasks ratio
  const now = new Date()
  const allTasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, status: true, dueDate: true },
  })

  const totalTasks = allTasks.length
  const overdueTasks = allTasks.filter(
    t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED',
  ).length

  let scheduleHealth: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
  let scheduleReason = 'No tasks created yet'
  if (totalTasks > 0) {
    const overdueRatio = overdueTasks / totalTasks
    if (overdueRatio > 0.25) {
      scheduleHealth = 'RED'
      scheduleReason = `${overdueTasks} of ${totalTasks} tasks overdue (${Math.round(overdueRatio * 100)}%)`
    } else if (overdueRatio > 0.1) {
      scheduleHealth = 'AMBER'
      scheduleReason = `${overdueTasks} of ${totalTasks} tasks overdue (${Math.round(overdueRatio * 100)}%)`
    } else if (overdueTasks > 0) {
      scheduleHealth = 'AMBER'
      scheduleReason = `${overdueTasks} of ${totalTasks} tasks overdue`
    } else {
      scheduleReason = `All ${totalTasks} tasks on track`
    }
  }

  // Budget health — based on commercial spend vs budget
  let budgetHealth: 'GREEN' | 'AMBER' | 'RED' | 'GREY' = 'GREY'
  let budgetReason = 'Budget tracking not configured'
  try {
    const budget = await modulesPrisma.budget.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (budget) {
      const totalBudget = (budget.totalBudget as number) || 0
      const actualSpend = (budget.actualSpend as number) || 0
      if (totalBudget > 0) {
        const ratio = actualSpend / totalBudget
        if (ratio > 1.1) {
          budgetHealth = 'RED'
          budgetReason = `Spend at ${Math.round(ratio * 100)}% of budget`
        } else if (ratio > 0.9) {
          budgetHealth = 'AMBER'
          budgetReason = `Spend at ${Math.round(ratio * 100)}% of budget`
        } else {
          budgetHealth = 'GREEN'
          budgetReason = `Spend at ${Math.round(ratio * 100)}% of budget`
        }
      }
    }
  } catch {
    // Commercial data unavailable — keep GREY
  }

  // Quality health — based on open snags/observations ratio
  let qualityHealth: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
  let qualityReason = 'No quality issues recorded'
  try {
    const totalSnags = await modulesPrisma.snag.count({ where: { projectId } })
    const openSnags = await modulesPrisma.snag.count({
      where: { projectId, status: { in: ['OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED'] } },
    })
    const totalObs = await modulesPrisma.siteObservation.count({ where: { projectId } })
    const openObs = await modulesPrisma.siteObservation.count({
      where: { projectId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    })
    const totalIssues = totalSnags + totalObs
    const openIssues = openSnags + openObs
    if (totalIssues > 0) {
      const openRatio = openIssues / totalIssues
      if (openRatio > 0.5) {
        qualityHealth = 'RED'
        qualityReason = `${openIssues} of ${totalIssues} quality issues still open (${Math.round(openRatio * 100)}%)`
      } else if (openRatio > 0.25) {
        qualityHealth = 'AMBER'
        qualityReason = `${openIssues} of ${totalIssues} quality issues open (${Math.round(openRatio * 100)}%)`
      } else {
        qualityReason = `${openIssues} open issues of ${totalIssues} total`
      }
    }
  } catch {
    // Quality data unavailable
  }

  // Compute derived overall from components
  const componentStatuses = [scheduleHealth, budgetHealth, qualityHealth]
  let derivedOverall: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
  if (componentStatuses.includes('RED')) derivedOverall = 'RED'
  else if (componentStatuses.some(s => s === 'AMBER')) derivedOverall = 'AMBER'

  return {
    schedule: { health: scheduleHealth, reason: scheduleReason },
    budget: { health: budgetHealth, reason: budgetReason },
    quality: { health: qualityHealth, reason: qualityReason },
    derivedOverall,
  }
}

/* ── GET /api/projects/[id]/health ──────────────────────────── */

export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  // Fetch all health records for this project, most recent first
  const records = await modulesPrisma.projectHealthRecord.findMany({
    where: { projectId, category: 'OVERALL' },
    orderBy: { calculatedAt: 'desc' },
    take: 50,
  })

  // Parse component ratings from sourceRecords JSON
  const history = records.map((r: Record<string, unknown>) => {
    let components: Record<string, string> = {}
    try {
      components = r.sourceRecords ? JSON.parse(r.sourceRecords as string) : {}
    } catch { /* ignore parse errors */ }

    return {
      id: r.id,
      projectId: r.projectId,
      overallHealth: r.rating,
      scheduleHealth: components.scheduleHealth || 'GREY',
      budgetHealth: components.budgetHealth || 'GREY',
      qualityHealth: components.qualityHealth || 'GREY',
      safetyHealth: components.safetyHealth || 'GREY',
      riskHealth: components.riskHealth || 'GREY',
      narrative: r.reason || null,
      mitigationPlan: r.recommendedAction || null,
      reportedById: r.overrideById || r.responsibleId || null,
      reportDate: r.calculatedAt,
      isOverride: r.isOverride,
    }
  })

  // Get reporter names for the history
  const reporterIds = [...new Set(history.map((h: Record<string, unknown>) => h.reportedById).filter(Boolean))] as string[]
  let reporterMap: Record<string, string> = {}
  if (reporterIds.length > 0) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, fullName: true },
    })
    reporterMap = Object.fromEntries(profiles.map(p => [p.id, p.fullName]))
  }

  const historyWithNames = history.map((h: Record<string, unknown>) => ({
    ...h,
    reportedByName: h.reportedById ? (reporterMap[h.reportedById as string] || 'Unknown') : null,
  }))

  const latest = historyWithNames.length > 0 ? historyWithNames[0] : null

  // Compute derived health from real data
  const derived = await computeDerivedHealth(projectId)

  // Write-back on read: persist derived overall health if it differs from stored value
  const currentProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { healthStatus: true },
  })
  if (currentProject && currentProject.healthStatus !== derived.derivedOverall) {
    await prisma.project.update({
      where: { id: projectId },
      data: { healthStatus: derived.derivedOverall as 'GREEN' | 'AMBER' | 'RED' },
    })
  }

  return success({
    latest,
    history: historyWithNames,
    derived,
  })
})

/* ── POST /api/projects/[id]/health ─────────────────────────── */

export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const overallHealth = requireString(body.overallHealth, 'Overall health')
  if (!HEALTH_STATUSES.includes(overallHealth as typeof HEALTH_STATUSES[number])) {
    throw new Error('Overall health must be GREEN, AMBER, RED, or GREY')
  }

  const scheduleHealth = optionalEnum(body.scheduleHealth, 'Schedule health', HEALTH_STATUSES) || 'GREY'
  const budgetHealth = optionalEnum(body.budgetHealth, 'Budget health', HEALTH_STATUSES) || 'GREY'
  const qualityHealth = optionalEnum(body.qualityHealth, 'Quality health', HEALTH_STATUSES) || 'GREY'
  const safetyHealth = optionalEnum(body.safetyHealth, 'Safety health', HEALTH_STATUSES) || 'GREY'
  const riskHealth = optionalEnum(body.riskHealth, 'Risk health', HEALTH_STATUSES) || 'GREY'
  const narrative = optionalString(body.narrative, 'Narrative', 5000)
  const mitigationPlan = optionalString(body.mitigationPlan, 'Mitigation plan', 5000)

  // Store component ratings as JSON in sourceRecords
  const sourceRecords = JSON.stringify({
    scheduleHealth,
    budgetHealth,
    qualityHealth,
    safetyHealth,
    riskHealth,
  })

  const now = new Date()

  const record = await modulesPrisma.projectHealthRecord.create({
    data: {
      projectId,
      category: 'OVERALL',
      rating: overallHealth,
      reason: narrative,
      recommendedAction: mitigationPlan,
      sourceRecords,
      responsibleId: profile.id,
      isOverride: true,
      overrideById: profile.id,
      calculatedAt: now,
    },
  })

  // Update project-level healthStatus field
  await prisma.project.update({
    where: { id: projectId },
    data: { healthStatus: overallHealth as 'GREEN' | 'AMBER' | 'RED' },
  })

  // If health changed to RED, notify project team
  if (overallHealth === 'RED') {
    const memberships = await prisma.projectMembership.findMany({
      where: { projectId, removedAt: null },
      select: { profileId: true },
    })

    const recipients = memberships
      .filter(m => m.profileId !== profile.id)
      .map(m => ({ profileId: m.profileId }))

    if (recipients.length > 0) {
      await createNotifications(recipients, {
        type: NOTIFICATION_EVENTS.PROJECT_HEALTH_CHANGED,
        title: 'Project health changed to RED',
        body: narrative || 'A project health assessment has been recorded as RED — immediate attention required.',
        linkUrl: `/projects/${projectId}/health`,
      })
    }
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'ProjectHealthRecord',
    entityId: record.id,
    metadata: { overallHealth, scheduleHealth, budgetHealth, qualityHealth, safetyHealth, riskHealth },
  })

  return success({
    record: {
      id: record.id,
      projectId: record.projectId,
      overallHealth: record.rating,
      scheduleHealth,
      budgetHealth,
      qualityHealth,
      safetyHealth,
      riskHealth,
      narrative: record.reason,
      mitigationPlan: record.recommendedAction,
      reportedById: record.overrideById,
      reportDate: record.calculatedAt,
    },
  }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })
