import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import {
  calculateMilestoneStatus,
  buildMilestoneTaskSummary,
  type TaskStatusForCalc,
} from '@/lib/milestone-status'

/**
 * GET /api/projects/[id]/overview — Comprehensive project overview.
 *
 * Returns project details (including Batch 1 fields), team, milestones,
 * recent updates, task stats, document stats, and key metrics.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  // Run independent queries in parallel
  const [project, taskCounts, documentCounts, drawingCount, milestonesRaw, updates] = await Promise.all([
    // 1. Full project with team
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        office: { select: { id: true, name: true, city: true } },
        memberships: {
          where: { removedAt: null },
          include: {
            profile: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                jobTitle: true,
                orgPermission: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    }),

    // 2. Task counts by status
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),

    // 3. Document counts by type
    prisma.document.groupBy({
      by: ['documentType'],
      where: { projectId },
      _count: { _all: true },
    }),

    // 3b. Drawing count (included in total documents)
    prisma.drawing.count({
      where: { projectId },
    }),

    // 4. Milestones with linked tasks for calculated status
    prisma.projectMilestone.findMany({
      where: { projectId },
      include: {
        tasks: {
          where: { archivedAt: null },
          select: { status: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),

    // 5. Recent project updates — last 5
    prisma.projectUpdate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Overdue task count (separate query — needs dueDate filter)
  const overdueTasks = await prisma.task.count({
    where: {
      projectId,
      dueDate: { lt: new Date() },
      status: { notIn: ['COMPLETED'] },
      archivedAt: null,
    },
  })

  // ── Shape task stats ──────────────────────────────────
  const tasksByStatus = taskCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count.id
    return acc
  }, {})

  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0)
  const completedTasks = tasksByStatus['COMPLETED'] || 0

  // ── Shape document stats ──────────────────────────────
  const documentsByType = documentCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.documentType] = row._count._all
    return acc
  }, {})

  const totalDocuments = Object.values(documentsByType).reduce((a, b) => a + b, 0) + drawingCount

  // ── Milestone summary with calculated status ──────────
  const now = new Date()

  const milestones = milestonesRaw.map((m) => {
    const taskStatuses = m.tasks.map((t) => t.status as TaskStatusForCalc)
    const calcStatus = calculateMilestoneStatus({
      currentStatus: m.status,
      dueDate: m.dueDate,
      taskStatuses,
    })
    const taskSummary = buildMilestoneTaskSummary(taskStatuses)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tasks: _tasks, ...rest } = m
    return { ...rest, status: calcStatus, storedStatus: m.status, taskSummary }
  })

  const activeMilestones = milestones.filter(m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED')
  const nextMilestone = activeMilestones.find(m => m.dueDate >= now) || activeMilestones[0] || null

  // ── Days to target completion ─────────────────────────
  const daysToTarget = project.targetCompletion
    ? Math.ceil((new Date(project.targetCompletion).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return success({
    project,
    team: {
      count: project.memberships.length,
      members: project.memberships,
    },
    milestones: {
      total: milestones.length,
      active: activeMilestones.length,
      completed: milestones.filter(m => m.status === 'COMPLETED').length,
      next: nextMilestone,
      items: milestones,
    },
    recentUpdates: updates,
    taskStats: {
      total: totalTasks,
      completed: completedTasks,
      overdue: overdueTasks,
      byStatus: tasksByStatus,
    },
    documentStats: {
      total: totalDocuments,
      byType: documentsByType,
    },
    metrics: {
      daysToTarget,
      teamSize: project.memberships.length,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
  })
})
