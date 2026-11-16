import { redirect } from 'next/navigation'

/**
 * Task pages live at /tasks/[id]. Notifications sent before 16 Nov 2026 linked to /projects/[id]/tasks/[taskId],
 * which did not exist; this sends those old links to the right place.
 */
export default async function TaskRedirect({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { taskId } = await params
  redirect(`/tasks/${encodeURIComponent(taskId)}`)
}
