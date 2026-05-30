'use client'

import { useState } from 'react'
import { getPortalInvites, getPortalSharedItems, getUser, PROJECTS } from '@/lib/mock-data'
import { PortalInvite, PortalSharedItem } from '@/lib/types'
import { cn, formatDate, portalAccessLabel, portalAccessColor, portalItemTypeIcon, timeAgo } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { TabBar } from '@/components/TabBar'

// ── Helper: Get project name from ID ────────────────────────
function getProjectName(projectId: string): string {
  const project = PROJECTS.find(p => p.id === projectId)
  return project?.name || `Project ${projectId}`
}

// ── Component: KPI Cards ────────────────────────────────────
function KPICards() {
  const invites = getPortalInvites()
  const sharedItems = getPortalSharedItems()
  const acceptedCount = invites.filter(i => i.accepted).length
  const pendingCount = invites.filter(i => !i.accepted).length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Invites */}
      <div className="card-premium p-4">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-[0.05em]">Total Invites</p>
        <p className="text-2xl font-bold text-ink-900 mt-2">{invites.length}</p>
      </div>

      {/* Accepted */}
      <div className="card-premium p-4">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-[0.05em]">Accepted</p>
        <p className="text-2xl font-bold text-emerald-700 mt-2">{acceptedCount}</p>
      </div>

      {/* Pending */}
      <div className="card-premium p-4">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-[0.05em]">Pending</p>
        <p className="text-2xl font-bold text-amber-700 mt-2">{pendingCount}</p>
      </div>

      {/* Shared Items */}
      <div className="card-premium p-4">
        <p className="text-xs font-medium text-ink-400 uppercase tracking-[0.05em]">Shared Items</p>
        <p className="text-2xl font-bold text-ink-900 mt-2">{sharedItems.length}</p>
      </div>
    </div>
  )
}

// ── Component: People Tab Content ──────────────────────────
function PeopleTabContent() {
  const invites = getPortalInvites()

  // Group invites by project
  const byProject = invites.reduce((acc, invite) => {
    if (!acc[invite.project_id]) {
      acc[invite.project_id] = []
    }
    acc[invite.project_id].push(invite)
    return acc
  }, {} as Record<string, PortalInvite[]>)

  return (
    <div className="space-y-6">
      {/* Invite button */}
      <div className="flex justify-end">
        <button className="px-4 py-2 text-sm font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 transition-colors">
          Invite
        </button>
      </div>

      {/* Grouped by project */}
      {Object.entries(byProject).map(([projectId, projectInvites]) => (
        <div key={projectId}>
          <h3 className="font-medium text-sm text-ink-900 mb-3">{getProjectName(projectId)}</h3>
          <div className="space-y-2">
            {projectInvites.map(invite => {
              const invitedByUser = getUser(invite.invited_by_user_id)

              return (
                <div
                  key={invite.id}
                  className="card-premium p-4 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-ink-900">{invite.name}</p>
                      <span
                        className={cn(
                          'inline-block text-xs px-2 py-0.5 rounded-md font-medium',
                          portalAccessColor(invite.access_level)
                        )}
                      >
                        {portalAccessLabel(invite.access_level)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-400">
                      {invite.organisation} • {invite.role}
                    </p>
                    <p className="text-xs text-ink-400 mt-1">{invite.email}</p>
                  </div>

                  <div className="ml-4 text-right shrink-0">
                    <div className="flex items-center gap-1 mb-1">
                      {invite.accepted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <span className="text-emerald-500">✓</span>
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <span className="text-amber-500">⏱</span>
                          Pending
                        </span>
                      )}
                    </div>
                    {invite.last_accessed_at && (
                      <p className="text-xs text-ink-400">
                        Last: {timeAgo(invite.last_accessed_at)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Component: Shared Items Tab Content ────────────────────
function SharedItemsTabContent() {
  const sharedItems = getPortalSharedItems()

  // Group items by project
  const byProject = sharedItems.reduce((acc, item) => {
    if (!acc[item.project_id]) {
      acc[item.project_id] = []
    }
    acc[item.project_id].push(item)
    return acc
  }, {} as Record<string, PortalSharedItem[]>)

  return (
    <div className="space-y-6">
      {Object.entries(byProject).map(([projectId, projectItems]) => (
        <div key={projectId}>
          <h3 className="font-medium text-sm text-ink-900 mb-3">{getProjectName(projectId)}</h3>
          <div className="space-y-2">
            {projectItems.map(item => {
              const sharedByUser = getUser(item.shared_by_user_id)

              return (
                <div
                  key={item.id}
                  className="card-premium p-4 flex items-start gap-4"
                >
                  <div className="text-xl shrink-0">
                    {portalItemTypeIcon(item.item_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 gap-x-3 mb-1">
                      <p className="text-sm font-medium text-ink-900">{item.title}</p>
                      {item.requires_sign_off && (
                        item.signed_off_by ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                            <span>✓</span>
                            Signed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium">
                            <span>⏱</span>
                            Awaiting Sign-off
                          </span>
                        )
                      )}
                    </div>

                    <p className="text-xs text-ink-400">
                      Shared by {sharedByUser?.name || 'Unknown'} • {formatDate(item.shared_at)}
                    </p>

                    {item.signed_off_by && item.signed_off_at && (
                      <p className="text-xs text-ink-400 mt-1">
                        Signed by {item.signed_off_by} on {formatDate(item.signed_off_at)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CollaborationPortalPage() {
  const [activeTab, setActiveTab] = useState('people')

  const invites = getPortalInvites()
  const sharedItems = getPortalSharedItems()

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <Breadcrumb
          items={[
            { label: 'Portal' },
          ]}
        />

        <div className="mt-8 mb-8">
          <h1 className="font-display text-3xl text-ink-900 mb-2">Collaboration Portal</h1>
          <p className="text-sm text-ink-400">
            Manage external access for clients and consultants
          </p>
        </div>
      </section>

      {/* ━━━ KPI CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <KPICards />

      {/* ━━━ TAB NAVIGATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="mb-8">
        <TabBar
          tabs={[
            { key: 'people', label: 'People', count: invites.length },
            { key: 'items', label: 'Shared Items', count: sharedItems.length },
          ]}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      </section>

      {/* ━━━ TAB CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        {activeTab === 'people' && <PeopleTabContent />}
        {activeTab === 'items' && <SharedItemsTabContent />}
      </section>
    </div>
  )
}
