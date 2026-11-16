import { NextRequest } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success } from '@/lib/api-response'
import { ValidationError, PermissionError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { canPerform } from '@/lib/role-permissions'
import { parseBody, requireId, optionalId, optionalDate } from '@/lib/validation'
import { createTasksFromSummary, type TaskPick } from '@/lib/ai/summary-service'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { OrgPermission } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/documents/[documentId]/summary/tasks
 * body { runId, items: [{ index, ownerId?, dueDate? }] }
 * A person has ticked actions from a summary; those become tasks. The owner and date are what the person chose,
 * never what the AI read: the document's own wording is kept in the task description.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, authUserId }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_summaries'))) throw new ValidationError('Document summaries are not switched on for your practice.')
  if (!canPerform(profile.orgPermission as OrgPermission, 'documents', 'view_project')) throw new PermissionError('You do not have access to project documents')
  const m = new URL(request.url).pathname.match(/\/documents\/([^/]+)\/summary\/tasks/)
  if (!m?.[1] || !/^[a-z0-9]{10,40}$/i.test(m[1])) throw new ValidationError('Unknown document')
  const documentId = m[1]

  const body = await parseBody(request)
  const runId = requireId(body.runId, 'Summary')
  if (!Array.isArray(body.items)) throw new ValidationError('Choose at least one action.')
  const seen = new Set<number>()
  const picks: TaskPick[] = []
  for (const raw of body.items as unknown[]) {
    if (!raw || typeof raw !== 'object') throw new ValidationError('Choose at least one action.')
    const item = raw as Record<string, unknown>
    const index = Number(item.index)
    if (!Number.isInteger(index) || index < 0 || index > 200) throw new ValidationError('That action is not in this summary.')
    if (seen.has(index)) continue
    seen.add(index)
    picks.push({ index, ownerId: optionalId(item.ownerId, 'Owner') ?? null, dueDate: optionalDate(item.dueDate, 'Due date') ?? null })
  }

  const result = await createTasksFromSummary({ runId, projectId, documentId, organisationId: project.organisationId, profileId: profile.id, authUserId, picks })

  // Tell the people the tasks were given to (not the person who made them)
  for (const c of result.created) {
    const pick = picks.find((p) => p.index === c.index)
    if (pick?.ownerId && pick.ownerId !== profile.id) {
      await createNotification({ profileId: pick.ownerId, type: NOTIFICATION_EVENTS.TASK_ASSIGNED, title: `You were assigned a task: ${c.title}`, linkUrl: `/tasks/${c.taskId}` }).catch(() => {})
    }
  }
  return success({ created: result.created, skipped: result.skipped, tasks: result.made }, 201)
})
