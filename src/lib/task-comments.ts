import { canPerform } from '@/lib/role-permissions'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * Who may delete a comment on a task: the person who wrote it, or anyone who may edit the project's tasks
 * (the same people who may delete the task itself). Used by the API and by the screen, so the button and the rule agree.
 */
export function canDeleteComment(viewer: { id: string; orgPermission: OrgPermission | string }, comment: { authorId: string }): boolean {
  if (comment.authorId === viewer.id) return true
  return canPerform(viewer.orgPermission as OrgPermission, 'tasks', 'create_edit_project')
}
