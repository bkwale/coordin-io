'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { WidgetCard, WidgetStat } from './WidgetCard'

export function StaffResourcingWidget() {
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch('/api/settings/team')
        if (res.status === 403) {
          setError('Staff data requires Manager access')
          return
        }
        if (!res.ok) throw new Error('Failed to load team data')
        const json = await res.json()
        setTotal(json.total ?? json.members?.length ?? 0)
        setActive(json.active ?? json.members?.filter((m: { status: string }) => m.status === 'ACTIVE')?.length ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchTeam()
  }, [])

  return (
    <WidgetCard
      title="Staff Resourcing"
      icon={<Users className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-ink-400">{error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <WidgetStat label="Active staff" value={active} color="text-emerald-600" />
          <WidgetStat label="Total staff" value={total} />
        </div>
      )}
    </WidgetCard>
  )
}
