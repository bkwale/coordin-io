import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { USERS, getMissingTimesheetUsers, getUpcomingLeave, STAFF_CAPACITIES, getLeaveEntitlements } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'

export function StaffResourcingWidget() {
  const missingTsUserIds = getMissingTimesheetUsers()
  const missingTsUsers = missingTsUserIds.map(id => USERS.find(u => u.id === id)).filter(Boolean)
  const upcomingLeave = getUpcomingLeave(14)
  const capacities = STAFF_CAPACITIES || []

  const overloaded = capacities.filter((c: { utilisation_percent: number }) => c.utilisation_percent > 100)
  const underutilised = capacities.filter((c: { utilisation_percent: number }) => c.utilisation_percent < 50)

  return (
    <WidgetCard
      title="Staff & Resourcing"
      icon={<Users className="w-4 h-4" />}
    >
      {/* Alerts */}
      {missingTsUsers.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-[11px] font-medium text-amber-700">
            {missingTsUsers.length} staff missing timesheets this week
          </p>
          <p className="text-[10px] text-amber-500 mt-0.5">
            {missingTsUsers.map(u => u!.name.split(' ')[0]).join(', ')}
          </p>
        </div>
      )}

      {overloaded.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
          <p className="text-[11px] font-medium text-red-700">
            {overloaded.length} staff overloaded (&gt;100% utilisation)
          </p>
        </div>
      )}

      {/* Upcoming Leave */}
      <div>
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Leave — Next 14 Days</p>
        {upcomingLeave.length === 0 ? (
          <p className="text-[11px] text-ink-300 italic">No upcoming leave</p>
        ) : (
          <div className="space-y-1.5">
            {upcomingLeave.slice(0, 5).map(leave => {
              const user = USERS.find(u => u.id === leave.user_id)
              return (
                <div key={leave.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center text-[9px] font-semibold text-accent-600">
                      {user?.name.charAt(0)}
                    </span>
                    <div>
                      <p className="text-[11px] font-medium text-ink-700">{user?.name}</p>
                      <p className="text-[9px] text-ink-400">{leave.start_date} — {leave.end_date}</p>
                    </div>
                  </div>
                  <span className={cn('status-pill text-[9px]', leave.leave_type === 'holiday' ? 'bg-blue-50 text-blue-600' : leave.leave_type === 'sick' ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600')}>
                    {leave.leave_type}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <WidgetDivider />

      <Link href="/staffing" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
        View staffing →
      </Link>
    </WidgetCard>
  )
}
