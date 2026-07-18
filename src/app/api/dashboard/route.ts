import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import type { TaskStatus } from '@/generated/prisma/client'

/**
 * GET /api/dashboard — Aggregated "what do I need today" view.
 *
 * Returns profile summary, projects with task counts, urgent tasks,
 * and weekly stats — all in a single response so the client makes
 * one call post-login.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const isAdmin = hasOrgPermission(profile.orgPermission, 'ADMIN')
  const now = new Date()

  // ── Start of current week (Monday 00:00:00 UTC) ──────────
  const startOfWeek = new Date(now)
  const day = startOfWeek.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1 // distance back to Monday
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff)
  startOfWeek.setUTCHours(0, 0, 0, 0)

  // ── 1. Projects the user can see ─────────────────────────
  const projects = await prisma.project.findMany({
    where: isAdmin
      ? { organisationId: orgId }
      : {
          organisationId: orgId,
          memberships: {
            some: {
              profileId: profile.id,
              removedAt: null,
            },
          },
        },
    include: {
      tasks: {
        select: {
          id: true,
          ownerId: true,
          reviewerId: true,
          status: true,
          dueDate: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const NON_OVERDUE_STATUSES: TaskStatus[] = ['COMPLETED']

  const projectSummaries = projects.map((project) => {
    const myTaskCount = project.tasks.filter(
      (t) => t.ownerId === profile.id,
    ).length

    const overdueTaskCount = project.tasks.filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate < now &&
        !NON_OVERDUE_STATUSES.includes(t.status),
    ).length

    const inReviewTaskCount = project.tasks.filter(
      (t) =>
        t.status === 'READY_FOR_REVIEW' && t.reviewerId === profile.id,
    ).length

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      stage: project.stage,
      healthStatus: project.healthStatus,
      myTaskCount,
      overdueTaskCount,
      inReviewTaskCount,
    }
  })

  // ── 2. Urgent tasks ──────────────────────────────────────
  //    Overdue OR due today OR high/critical priority,
  //    only tasks owned by this user, ordered by dueDate ASC.
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setUTCHours(23, 59, 59, 999)

  const urgentTasks = await prisma.task.findMany({
    where: {
      ownerId: profile.id,
      status: { notIn: ['COMPLETED'] },
      OR: [
        // Overdue: dueDate < now
        { dueDate: { lt: now } },
        // Due today
        { dueDate: { gte: todayStart, lte: todayEnd } },
        // High or critical priority
        { priority: { in: ['HIGH', 'CRITICAL'] } },
      ],
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: [
      { dueDate: { sort: 'asc', nulls: 'last' } },
    ],
  })

  const urgentTaskList = urgentTasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectId: t.project.id,
    projectName: t.project.name,
    projectCode: t.project.code,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    estimatedHours: t.estimatedHours,
  }))

  // ── 3. Stats ─────────────────────────────────────────────
  const [totalTasks, overdueTasks, inReviewTasks, completedThisWeek] =
    await Promise.all([
      // Total tasks assigned to user (non-completed)
      prisma.task.count({
        where: {
          ownerId: profile.id,
          status: { notIn: ['COMPLETED'] },
        },
      }),
      // Overdue tasks
      prisma.task.count({
        where: {
          ownerId: profile.id,
          status: { notIn: ['COMPLETED'] },
          dueDate: { lt: now },
        },
      }),
      // Tasks in review where user is the reviewer
      prisma.task.count({
        where: {
          reviewerId: profile.id,
          status: 'READY_FOR_REVIEW',
        },
      }),
      // Completed this week (by owner)
      prisma.task.count({
        where: {
          ownerId: profile.id,
          status: 'COMPLETED',
          completedAt: { gte: startOfWeek },
        },
      }),
    ])

  // ── Assemble response ────────────────────────────────────
  return success({
    profile: {
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      status: profile.status,
      organisationName: profile.organisation.name,
    },
    projects: projectSummaries,
    urgentTasks: urgentTaskList,
    stats: {
      totalTasks,
      overdueTasks,
      inReviewTasks,
      completedThisWeek,
    },
  })
})
