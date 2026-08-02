'use client'

interface TaskListProps {
  tasks: { id: string; title: string; status: string; stage?: string; owner_user_id?: string }[]
  currentStage?: string
  groupByStage?: boolean
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) return <p className="text-[13px] text-ink-400 py-4">No tasks</p>
  return (
    <div className="space-y-1">
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-50">
          <span className="text-[13px] text-ink-800">{t.title}</span>
          <span className="text-[11px] text-ink-400 ml-auto">{t.status}</span>
        </div>
      ))}
    </div>
  )
}
