import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { modulesPrisma } from '@/lib/prisma-modules'

/**
 * GET /api/analytics/portfolio — Aggregated portfolio health metrics.
 *
 * Returns per-project component health scores (programme, tasks, design,
 * planning, compliance, commercial, quality, staffing) plus portfolio
 * summary KPIs. All data is scoped to the user's organisation.
 *
 * Query params:
 *   stage    - filter by project stage
 *   status   - filter by project status (ACTIVE, PAUSED, etc.)
 *   office   - filter by office ID
 *   health   - filter by health status (GREEN, AMBER, RED)
 *   sector   - filter by project type
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const isAdmin = hasOrgPermission(profile.orgPermission, 'ADMIN')
  const url = new URL(request.url)
  const now = new Date()

  // ── Parse filters ──────────────────────────────────────
  const stageFilter = url.searchParams.get('stage')
  const statusFilter = url.searchParams.get('status') || 'ACTIVE'
  const officeFilter = url.searchParams.get('office')
  const healthFilter = url.searchParams.get('health')
  const sectorFilter = url.searchParams.get('sector')

  // ── Build project where clause ─────────────────────────
  const projectWhere: Record<string, unknown> = {
    organisationId: orgId,
  }

  if (!isAdmin) {
    projectWhere.memberships = {
      some: { profileId: profile.id, removedAt: null },
    }
  }

  if (statusFilter) projectWhere.status = statusFilter
  if (stageFilter) projectWhere.stage = stageFilter
  if (officeFilter) projectWhere.officeId = officeFilter
  if (healthFilter) projectWhere.healthStatus = healthFilter
  if (sectorFilter) projectWhere.projectType = sectorFilter

  // ── Fetch projects with related data ───────────────────
  const projects = await modulesPrisma.project.findMany({
    where: projectWhere,
    include: {
      office: { select: { id: true, name: true } },
      tasks: {
        select: {
          id: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
      },
      snags: {
        select: {
          id: true,
          status: true,
          severity: true,
        },
      },
      siteObservations: {
        select: {
          id: true,
          status: true,
          severity: true,
        },
      },
      designReviews: {
        select: {
          id: true,
          status: true,
        },
      },
      complianceRegisters: {
        select: {
          id: true,
          overallStatus: true,
        },
      },
      planningApplications: {
        select: {
          id: true,
          status: true,
          targetDecision: true,
        },
      },
      budgets: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
        },
      },
      invoices: {
        select: {
          id: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
        },
      },
      variations: {
        select: {
          id: true,
          status: true,
          amount: true,
        },
      },
      commercialRisks: {
        select: {
          id: true,
          status: true,
          amount: true,
          likelihood: true,
          impact: true,
        },
      },
      resourceAllocations: {
        select: {
          id: true,
          hoursAllocated: true,
        },
      },
      memberships: {
        where: { removedAt: null },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // ── Compute per-project health scores ──────────────────
  const projectHealthRows = projects.map((project: any) => {
    const tasks = project.tasks || []
    const snags = project.snags || []
    const observations = project.siteObservations || []
    const designReviews = project.designReviews || []
    const complianceRegisters = project.complianceRegisters || []
    const planningApps = project.planningApplications || []
    const budgets = project.budgets || []
    const invoices = project.invoices || []
    const variations = project.variations || []
    const risks = project.commercialRisks || []
    const allocations = project.resourceAllocations || []
    const members = project.memberships || []

    // ── 1. Programme / Milestones ────────────────────────
    let programmeScore: number | null = null
    if (project.targetCompletion) {
      const targetDate = new Date(project.targetCompletion)
      const daysToTarget = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToTarget < 0) programmeScore = 25
      else if (daysToTarget < 30) programmeScore = 50
      else if (daysToTarget < 90) programmeScore = 75
      else programmeScore = 100
    }

    // ── 2. Tasks / Approvals ─────────────────────────────
    let tasksScore: number | null = null
    if (tasks.length > 0) {
      const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length
      const overdue = tasks.filter((t: any) =>
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED'
      ).length
      const blocked = tasks.filter((t: any) => t.status === 'BLOCKED').length
      const total = tasks.length

      const completionRatio = completed / total
      const overdueRatio = overdue / total
      const blockedRatio = blocked / total

      tasksScore = Math.round(
        Math.max(0, Math.min(100,
          (completionRatio * 60) + ((1 - overdueRatio) * 25) + ((1 - blockedRatio) * 15)
        ) * 100) / 100
      )
      // Normalize to 0-100
      tasksScore = Math.round(tasksScore)
    }

    // ── 3. Design Review / Information Delivery ──────────
    let designScore: number | null = null
    if (designReviews.length > 0) {
      const completed = designReviews.filter((r: any) =>
        r.status === 'COMPLETED' || r.status === 'CLOSED'
      ).length
      const inProgress = designReviews.filter((r: any) =>
        r.status === 'IN_PROGRESS' || r.status === 'UNDER_REVIEW'
      ).length
      const total = designReviews.length
      designScore = Math.round(((completed * 100 + inProgress * 50) / total))
    }

    // ── 4. Planning ──────────────────────────────────────
    let planningScore: number | null = null
    if (planningApps.length > 0) {
      const approved = planningApps.filter((p: any) =>
        p.status === 'APPROVED' || p.status === 'CONDITIONS_DISCHARGE' || p.status === 'CLOSED'
      ).length
      const atRisk = planningApps.filter((p: any) =>
        p.targetDecision && new Date(p.targetDecision) < now &&
        !['APPROVED', 'CLOSED', 'REFUSED', 'WITHDRAWN'].includes(p.status)
      ).length
      const total = planningApps.length
      planningScore = Math.round(((approved * 100) / total) - (atRisk * 20))
      planningScore = Math.max(0, Math.min(100, planningScore))
    }

    // ── 5. Compliance ────────────────────────────────────
    let complianceScore: number | null = null
    if (complianceRegisters.length > 0) {
      const statusScores: Record<string, number> = {
        COMPLIANT: 100, CLOSED: 100,
        EVIDENCE_SUBMITTED: 80, UNDER_REVIEW: 70,
        IN_PROGRESS: 50, APPROVED_WITH_CONDITION: 60,
        NOT_STARTED: 20, ACTION_REQUIRED: 30,
        NON_COMPLIANT: 10, NOT_APPLICABLE: 100,
      }
      const total = complianceRegisters.length
      const sum = complianceRegisters.reduce((acc: number, r: any) =>
        acc + (statusScores[r.overallStatus] || 50), 0
      )
      complianceScore = Math.round(sum / total)
    }

    // ── 6. Commercial Performance ────────────────────────
    let commercialScore: number | null = null
    const approvedBudget = budgets
      .filter((b: any) => b.status === 'APPROVED')
      .reduce((sum: number, b: any) => sum + b.totalAmount, 0)

    if (approvedBudget > 0 || invoices.length > 0 || risks.length > 0) {
      let score = 75 // baseline

      // Invoice collection rate
      const totalInvoiced = invoices.reduce((sum: number, i: any) => sum + i.grossAmount, 0)
      const totalPaid = invoices.reduce((sum: number, i: any) => sum + (i.paidAmount || 0), 0)
      if (totalInvoiced > 0) {
        const collectionRate = totalPaid / totalInvoiced
        score = score + (collectionRate * 15) - 7.5
      }

      // Risk exposure penalty
      const openRisks = risks.filter((r: any) => r.status === 'OPEN' || r.status === 'ESCALATED')
      const highRisks = openRisks.filter((r: any) =>
        r.likelihood === 'HIGH' || r.likelihood === 'CRITICAL' ||
        r.impact === 'HIGH' || r.impact === 'CRITICAL'
      )
      score -= highRisks.length * 8
      score -= (openRisks.length - highRisks.length) * 3

      // Unapproved variations penalty
      const pendingVariations = variations.filter((v: any) =>
        v.status === 'SUBMITTED' || v.status === 'UNDER_REVIEW'
      )
      score -= pendingVariations.length * 2

      commercialScore = Math.max(0, Math.min(100, Math.round(score)))
    }

    // ── 7. Construction / Quality ────────────────────────
    let qualityScore: number | null = null
    if (snags.length > 0 || observations.length > 0) {
      const totalItems = snags.length + observations.length

      const closedSnags = snags.filter((s: any) => s.status === 'CLOSED').length
      const closedObs = observations.filter((o: any) =>
        o.status === 'CLOSED' || o.status === 'RESOLVED'
      ).length
      const closedItems = closedSnags + closedObs

      const criticalSnags = snags.filter((s: any) =>
        s.severity === 'SAFETY_CRITICAL' && s.status !== 'CLOSED'
      ).length
      const criticalObs = observations.filter((o: any) =>
        o.severity === 'CRITICAL' && o.status !== 'CLOSED' && o.status !== 'RESOLVED'
      ).length

      const closureRate = totalItems > 0 ? closedItems / totalItems : 1
      qualityScore = Math.round(closureRate * 80 + 20)
      qualityScore -= (criticalSnags + criticalObs) * 10
      qualityScore = Math.max(0, Math.min(100, qualityScore))
    }

    // ── 8. Staffing ──────────────────────────────────────
    let staffingScore: number | null = null
    if (members.length > 0) {
      // Base score from team size
      staffingScore = members.length >= 2 ? 80 : 50

      // Boost if allocations exist
      if (allocations.length > 0) {
        const totalHours = allocations.reduce((sum: number, a: any) => sum + a.hoursAllocated, 0)
        if (totalHours > 40) staffingScore = Math.min(100, staffingScore + 15)
        else if (totalHours > 16) staffingScore = Math.min(100, staffingScore + 10)
      }
    }

    // ── Composite health score ───────────────────────────
    const componentScores = [
      programmeScore, tasksScore, designScore, planningScore,
      complianceScore, commercialScore, qualityScore, staffingScore,
    ].filter((s): s is number => s !== null)

    const overallScore = componentScores.length > 0
      ? Math.round(componentScores.reduce((a, b) => a + b, 0) / componentScores.length)
      : null

    // RAG status from overall score
    const ragFromScore = (score: number | null): 'GREEN' | 'AMBER' | 'RED' | null => {
      if (score === null) return null
      if (score >= 70) return 'GREEN'
      if (score >= 45) return 'AMBER'
      return 'RED'
    }

    // Count stats
    const overdueTasks = tasks.filter((t: any) =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED'
    ).length
    const openSnags = snags.filter((s: any) => s.status !== 'CLOSED').length
    const openObservations = observations.filter((o: any) =>
      o.status !== 'CLOSED' && o.status !== 'RESOLVED'
    ).length

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      stage: project.stage,
      status: project.status,
      projectType: project.projectType,
      healthStatus: project.healthStatus,
      officeId: project.officeId,
      officeName: project.office?.name || null,
      startDate: project.startDate?.toISOString() || null,
      targetCompletion: project.targetCompletion?.toISOString() || null,

      // Component scores
      scores: {
        programme: programmeScore,
        tasks: tasksScore,
        design: designScore,
        planning: planningScore,
        compliance: complianceScore,
        commercial: commercialScore,
        quality: qualityScore,
        staffing: staffingScore,
        overall: overallScore,
      },

      // RAG per component
      rag: {
        programme: ragFromScore(programmeScore),
        tasks: ragFromScore(tasksScore),
        design: ragFromScore(designScore),
        planning: ragFromScore(planningScore),
        compliance: ragFromScore(complianceScore),
        commercial: ragFromScore(commercialScore),
        quality: ragFromScore(qualityScore),
        staffing: ragFromScore(staffingScore),
        overall: ragFromScore(overallScore),
      },

      // Quick stats
      stats: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t: any) => t.status === 'COMPLETED').length,
        overdueTasks,
        openSnags,
        openObservations,
        teamSize: members.length,
      },
    }
  })

  // ── Portfolio summary KPIs ─────────────────────────────
  const totalProjects = projectHealthRows.length
  const projectsAtRisk = projectHealthRows.filter(
    (p: any) => p.rag.overall === 'RED' || p.rag.overall === 'AMBER'
  ).length
  const scoredProjects = projectHealthRows.filter((p: any) => p.scores.overall !== null)
  const avgHealthScore = scoredProjects.length > 0
    ? Math.round(scoredProjects.reduce((sum: number, p: any) => sum + p.scores.overall, 0) / scoredProjects.length)
    : null
  const totalOverdueTasks = projectHealthRows.reduce(
    (sum: number, p: any) => sum + p.stats.overdueTasks, 0
  )
  const totalOpenSnags = projectHealthRows.reduce(
    (sum: number, p: any) => sum + p.stats.openSnags, 0
  )

  // Component averages across portfolio
  const componentKeys = ['programme', 'tasks', 'design', 'planning', 'compliance', 'commercial', 'quality', 'staffing'] as const
  const componentAverages: Record<string, number | null> = {}
  for (const key of componentKeys) {
    const scored = projectHealthRows.filter((p: any) => p.scores[key] !== null)
    componentAverages[key] = scored.length > 0
      ? Math.round(scored.reduce((sum: number, p: any) => sum + p.scores[key], 0) / scored.length)
      : null
  }

  // RAG distribution
  const ragDistribution = { GREEN: 0, AMBER: 0, RED: 0, UNSCORED: 0 }
  for (const p of projectHealthRows) {
    const rag = (p as any).rag.overall
    if (rag === 'GREEN') ragDistribution.GREEN++
    else if (rag === 'AMBER') ragDistribution.AMBER++
    else if (rag === 'RED') ragDistribution.RED++
    else ragDistribution.UNSCORED++
  }

  // ── Fetch filter options ───────────────────────────────
  const offices = await modulesPrisma.office.findMany({
    where: { organisationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return success({
    summary: {
      totalProjects,
      projectsAtRisk,
      avgHealthScore,
      totalOverdueTasks,
      totalOpenSnags,
      ragDistribution,
      componentAverages,
    },
    projects: projectHealthRows,
    filterOptions: {
      offices,
      stages: ['BRIEF', 'CONCEPT', 'SPATIAL_COORDINATION', 'WORKING_DRAWINGS', 'CONSTRUCTION', 'HANDOVER', 'OPERATIONS'],
      statuses: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
      healthStatuses: ['GREEN', 'AMBER', 'RED'],
      sectors: ['HOTEL', 'RESIDENTIAL', 'MIXED_USE', 'RESORT', 'REFURBISHMENT', 'OFFICE_FIT_OUT'],
    },
  })
})
