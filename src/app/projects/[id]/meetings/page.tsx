'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getProjectMeetings, getMeetingActions, getUser } from '@/lib/mock-data'
import { Meeting } from '@/lib/types'
import { cn, meetingTypeLabel, meetingTypeColor, actionStatusColor, formatDate } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'

export default function ProjectMeetingsPage() {
  const params = useParams()
  const project = PROJECTS.find(p => p.id === params.id)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)

  if (!project) {
    return <div className="p-8 text-center text-slate-400">Project not found.</div>
  }

  const meetings = getProjectMeetings(project.id)
    .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())

  const upcomingMeetings = meetings.filter(m => new Date(m.meeting_date) >= new Date())
  const pastMeetings = meetings.filter(m => new Date(m.meeting_date) < new Date())

  const allActions = meetings.flatMap(m => getMeetingActions(m.id))
  const openActions = allActions.filter(a => a.status === 'open')
  const overdueActions = allActions.filter(a => a.status === 'overdue')

  const activeMeeting = selectedMeeting ? meetings.find(m => m.id === selectedMeeting) : null
  const activeMeetingActions = activeMeeting ? getMeetingActions(activeMeeting.id) : []

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">Meetings & Actions</h1>
        <p className="text-sm text-slate-500 mt-1">{project.name} — {project.client}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard value={meetings.length} label="Total Meetings" />
        <SummaryCard value={upcomingMeetings.length} label="Upcoming" textColor="text-brand-600" />
        <SummaryCard value={openActions.length} label="Open Actions" textColor="text-blue-600" />
        <SummaryCard value={overdueActions.length} label="Overdue Actions" textColor="text-red-600" />
      </div>

      {/* Two-column layout: Meeting List + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Meeting List */}
        <div className="lg:col-span-2 space-y-4">
          {upcomingMeetings.length > 0 && (
            <div>
              <h2 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-2">Upcoming</h2>
              <div className="space-y-2">
                {upcomingMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isSelected={selectedMeeting === meeting.id}
                    actionCount={getMeetingActions(meeting.id).length}
                    onClick={() => setSelectedMeeting(meeting.id === selectedMeeting ? null : meeting.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {pastMeetings.length > 0 && (
            <div>
              <h2 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-2">Past Meetings</h2>
              <div className="space-y-2">
                {pastMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isSelected={selectedMeeting === meeting.id}
                    actionCount={getMeetingActions(meeting.id).length}
                    onClick={() => setSelectedMeeting(meeting.id === selectedMeeting ? null : meeting.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3">
          {activeMeeting ? (
            <div className="card-premium p-5 sticky top-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', meetingTypeColor(activeMeeting.meeting_type))}>
                  {meetingTypeLabel(activeMeeting.meeting_type)}
                </span>
                <span className="text-xs text-slate-400">{formatDate(activeMeeting.meeting_date)}</span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-1">{activeMeeting.title}</h2>

              <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                <span>{activeMeeting.location}</span>
                {getUser(activeMeeting.organiser_user_id) && (
                  <span>Organised by <span className="text-slate-600">{getUser(activeMeeting.organiser_user_id)?.name}</span></span>
                )}
              </div>

              {activeMeeting.notes && (
                <div className="p-3 bg-slate-50 rounded-lg mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                  <p className="text-xs text-slate-700">{activeMeeting.notes}</p>
                </div>
              )}

              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-3">
                Actions ({activeMeetingActions.length})
              </h3>

              {activeMeetingActions.length === 0 ? (
                <p className="text-xs text-slate-400">No actions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {activeMeetingActions.map(action => {
                    const assignee = getUser(action.assigned_to_user_id)
                    return (
                      <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                          action.status === 'done' ? 'bg-emerald-500' :
                          action.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800">{action.action_description}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {assignee && <span className="text-[11px] text-slate-400">{assignee.name}</span>}
                            <span className="text-[11px] text-slate-400">Due: {formatDate(action.due_date)}</span>
                            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase', actionStatusColor(action.status))}>
                              {action.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="card-premium p-8 text-center lg:sticky lg:top-6">
              <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">Select a meeting to view details and actions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MeetingCard({ meeting, isSelected, actionCount, onClick }: {
  meeting: Meeting
  isSelected: boolean
  actionCount: number
  onClick: () => void
}) {
  const organiser = getUser(meeting.organiser_user_id)
  const isUpcoming = new Date(meeting.meeting_date) >= new Date()

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all',
        isSelected
          ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', meetingTypeColor(meeting.meeting_type))}>
          {meetingTypeLabel(meeting.meeting_type)}
        </span>
        {isUpcoming && (
          <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">UPCOMING</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 truncate">{meeting.title}</h3>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
        <span>{formatDate(meeting.meeting_date)}</span>
        <span>{meeting.location}</span>
        {actionCount > 0 && (
          <span className="text-brand-600 font-medium">{actionCount} action{actionCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </button>
  )
}
