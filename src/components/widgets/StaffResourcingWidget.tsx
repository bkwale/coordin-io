import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { USERS, getMissingTimesheetUsers, getUpcomingLeave, STAFF_CAPACITIES, getLeaveEntitlements } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

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
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
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
