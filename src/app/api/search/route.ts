import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { modulesPrisma } from '@/lib/prisma-modules'

/**
 * GET /api/search — Global search across all record types.
 *
 * Query params:
 *   q     - search query (required, min 2 chars)
 *   type  - filter to a specific record type (optional)
 *   limit - max results per category (default 5, max 20)
 *
 * Returns categorized results with deep links. All results are
 * permission-filtered to the user's organisation.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const isAdmin = hasOrgPermission(profile.orgPermission, 'ADMIN')
  const url = new URL(request.url)

  const query = url.searchParams.get('q')?.trim() || ''
  const typeFilter = url.searchParams.get('type')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5') || 5, 20)

  if (query.length < 2) {
    return success({ results: [], total: 0, query })
  }

  // Sanitize query for ILIKE — escape % and _
  const safeQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_')
  const ilike = `%${safeQuery}%`

  // Project visibility filter for non-admins
  const projectFilter = isAdmin
    ? { organisationId: orgId }
    : {
        organisationId: orgId,
        memberships: { some: { profileId: profile.id, removedAt: null } },
      }

  const results: Array<{
    type: string
    id: string
    title: string
    description: string | null
    projectId: string | null
    projectName: string | null
    status: string | null
    link: string
    updatedAt: string
  }> = []

  const shouldSearch = (type: string) => !typeFilter || typeFilter === type

  // ── 1. Projects ────────────────────────────────────────
  if (shouldSearch('project')) {
    const projects = await modulesPrisma.project.findMany({
      where: {
        ...projectFilter,
        OR: [
          { name: { contains: safeQuery, mode: 'insensitive' } },
          { code: { contains: safeQuery, mode: 'insensitive' } },
          { description: { contains: safeQuery, mode: 'insensitive' } },
          { clientBrand: { contains: safeQuery, mode: 'insensitive' } },
          { location: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, name: true, code: true, description: true,
        status: true, stage: true, updatedAt: true,
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const p of projects) {
      results.push({
        type: 'project',
        id: p.id,
        title: p.code ? `${p.code} - ${p.name}` : p.name,
        description: p.description?.slice(0, 120) || `${p.stage} | ${p.status}`,
        projectId: p.id,
        projectName: p.name,
        status: p.status,
        link: `/projects/${p.id}`,
        updatedAt: p.updatedAt.toISOString(),
      })
    }
  }

  // ── 2. People ──────────────────────────────────────────
  if (shouldSearch('person')) {
    const people = await modulesPrisma.profile.findMany({
      where: {
        organisationId: orgId,
        status: { not: 'DEACTIVATED' },
        OR: [
          { fullName: { contains: safeQuery, mode: 'insensitive' } },
          { email: { contains: safeQuery, mode: 'insensitive' } },
          { jobTitle: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, fullName: true, email: true, jobTitle: true,
        status: true, updatedAt: true,
      },
      take: limit,
      orderBy: { fullName: 'asc' },
    })

    for (const p of people) {
      results.push({
        type: 'person',
        id: p.id,
        title: p.fullName,
        description: [p.jobTitle, p.email].filter(Boolean).join(' | '),
        projectId: null,
        projectName: null,
        status: p.status,
        link: `/staffing?person=${p.id}`,
        updatedAt: p.updatedAt.toISOString(),
      })
    }
  }

  // ── 3. Tasks ───────────────────────────────────────────
  if (shouldSearch('task')) {
    const tasks = await modulesPrisma.task.findMany({
      where: {
        project: projectFilter,
        OR: [
          { title: { contains: safeQuery, mode: 'insensitive' } },
          { description: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, title: true, description: true, status: true,
        projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const t of tasks) {
      results.push({
        type: 'task',
        id: t.id,
        title: t.title,
        description: t.description?.slice(0, 120) || null,
        projectId: t.projectId,
        projectName: t.project.name,
        status: t.status,
        link: `/tasks/${t.id}`,
        updatedAt: t.updatedAt.toISOString(),
      })
    }
  }

  // ── 4. Documents ───────────────────────────────────────
  if (shouldSearch('document')) {
    const docs = await modulesPrisma.document.findMany({
      where: {
        project: projectFilter,
        OR: [
          { title: { contains: safeQuery, mode: 'insensitive' } },
          { documentCode: { contains: safeQuery, mode: 'insensitive' } },
          { discipline: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, title: true, documentCode: true, status: true,
        documentType: true, discipline: true, projectId: true,
        updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const d of docs) {
      results.push({
        type: 'document',
        id: d.id,
        title: d.documentCode ? `${d.documentCode} - ${d.title}` : d.title,
        description: [d.documentType, d.discipline].filter(Boolean).join(' | '),
        projectId: d.projectId,
        projectName: d.project.name,
        status: d.status,
        link: `/projects/${d.projectId}/documents`,
        updatedAt: d.updatedAt.toISOString(),
      })
    }
  }

  // ── 5. Drawings ────────────────────────────────────────
  if (shouldSearch('drawing')) {
    const drawings = await modulesPrisma.drawing.findMany({
      where: {
        project: projectFilter,
        OR: [
          { title: { contains: safeQuery, mode: 'insensitive' } },
          { drawingNumber: { contains: safeQuery, mode: 'insensitive' } },
          { discipline: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, title: true, drawingNumber: true, discipline: true,
        projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const d of drawings) {
      results.push({
        type: 'drawing',
        id: d.id,
        title: `${d.drawingNumber} - ${d.title}`,
        description: d.discipline || null,
        projectId: d.projectId,
        projectName: d.project.name,
        status: null,
        link: `/projects/${d.projectId}/drawing-issues`,
        updatedAt: d.updatedAt.toISOString(),
      })
    }
  }

  // ── 6. Design Reviews ─────────────────────────────────
  if (shouldSearch('design_review')) {
    const reviews = await modulesPrisma.designReview.findMany({
      where: {
        project: projectFilter,
        OR: [
          { title: { contains: safeQuery, mode: 'insensitive' } },
          { reviewNumber: { contains: safeQuery, mode: 'insensitive' } },
          { summary: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, title: true, reviewNumber: true, status: true,
        projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const r of reviews) {
      results.push({
        type: 'design_review',
        id: r.id,
        title: `${r.reviewNumber} - ${r.title}`,
        description: null,
        projectId: r.projectId,
        projectName: r.project.name,
        status: r.status,
        link: `/projects/${r.projectId}/registers`,
        updatedAt: r.updatedAt.toISOString(),
      })
    }
  }

  // ── 7. Compliance ──────────────────────────────────────
  if (shouldSearch('compliance')) {
    const registers = await modulesPrisma.complianceRegister.findMany({
      where: {
        project: projectFilter,
        OR: [
          { name: { contains: safeQuery, mode: 'insensitive' } },
          { description: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, name: true, description: true, registerType: true,
        overallStatus: true, projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const c of registers) {
      results.push({
        type: 'compliance',
        id: c.id,
        title: c.name,
        description: c.registerType || c.description?.slice(0, 120) || null,
        projectId: c.projectId,
        projectName: c.project.name,
        status: c.overallStatus,
        link: `/projects/${c.projectId}/registers`,
        updatedAt: c.updatedAt.toISOString(),
      })
    }
  }

  // ── 8. Planning ────────────────────────────────────────
  if (shouldSearch('planning')) {
    const apps = await modulesPrisma.planningApplication.findMany({
      where: {
        project: projectFilter,
        OR: [
          { description: { contains: safeQuery, mode: 'insensitive' } },
          { reference: { contains: safeQuery, mode: 'insensitive' } },
          { authority: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, reference: true, description: true, authority: true,
        status: true, projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const p of apps) {
      results.push({
        type: 'planning',
        id: p.id,
        title: p.reference ? `${p.reference} - ${p.description.slice(0, 60)}` : p.description.slice(0, 80),
        description: p.authority,
        projectId: p.projectId,
        projectName: p.project.name,
        status: p.status,
        link: `/projects/${p.projectId}/planning`,
        updatedAt: p.updatedAt.toISOString(),
      })
    }
  }

  // ── 9. Observations ────────────────────────────────────
  if (shouldSearch('observation')) {
    const obs = await modulesPrisma.siteObservation.findMany({
      where: {
        project: projectFilter,
        OR: [
          { description: { contains: safeQuery, mode: 'insensitive' } },
          { observationNumber: { contains: safeQuery, mode: 'insensitive' } },
          { category: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, observationNumber: true, description: true, status: true,
        category: true, projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const o of obs) {
      results.push({
        type: 'observation',
        id: o.id,
        title: `${o.observationNumber} - ${o.description.slice(0, 60)}`,
        description: o.category || null,
        projectId: o.projectId,
        projectName: o.project.name,
        status: o.status,
        link: `/projects/${o.projectId}/observations`,
        updatedAt: o.updatedAt.toISOString(),
      })
    }
  }

  // ── 10. Snags ──────────────────────────────────────────
  if (shouldSearch('snag')) {
    const snags = await modulesPrisma.snag.findMany({
      where: {
        project: projectFilter,
        OR: [
          { description: { contains: safeQuery, mode: 'insensitive' } },
          { snagNumber: { contains: safeQuery, mode: 'insensitive' } },
          { element: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, snagNumber: true, description: true, status: true,
        category: true, projectId: true, updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const s of snags) {
      results.push({
        type: 'snag',
        id: s.id,
        title: `${s.snagNumber} - ${s.description.slice(0, 60)}`,
        description: s.category || null,
        projectId: s.projectId,
        projectName: s.project.name,
        status: s.status,
        link: `/projects/${s.projectId}/snags`,
        updatedAt: s.updatedAt.toISOString(),
      })
    }
  }

  // ── 11. Service Requests ───────────────────────────────
  if (shouldSearch('service_request')) {
    const requests = await modulesPrisma.serviceRequest.findMany({
      where: {
        organisationId: orgId,
        OR: [
          { title: { contains: safeQuery, mode: 'insensitive' } },
          { description: { contains: safeQuery, mode: 'insensitive' } },
          { requestNumber: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, title: true, description: true, requestNumber: true,
        status: true, requestType: true, projectId: true,
        updatedAt: true,
        project: { select: { name: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    for (const r of requests) {
      results.push({
        type: 'service_request',
        id: r.id,
        title: r.requestNumber ? `${r.requestNumber} - ${r.title}` : r.title,
        description: r.description?.slice(0, 120) || r.requestType,
        projectId: r.projectId,
        projectName: r.project?.name || null,
        status: r.status,
        link: `/service-requests`,
        updatedAt: r.updatedAt.toISOString(),
      })
    }
  }

  // ── 12. Knowledge Base ─────────────────────────────────
  // Knowledge articles are not project-scoped, so no project filter needed
  // They don't have org scope in schema, so we skip if no knowledge model exists
  // For now, knowledge is a page-level feature without a DB model

  // ── 13. Leave Requests ─────────────────────────────────
  if (shouldSearch('leave')) {
    const leaves = await modulesPrisma.leaveRequest.findMany({
      where: {
        profile: { organisationId: orgId },
        OR: [
          { reason: { contains: safeQuery, mode: 'insensitive' } },
          { leaveType: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, leaveType: true, reason: true, status: true,
        startDate: true, endDate: true, days: true,
        profile: { select: { fullName: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    for (const l of leaves) {
      const startStr = l.startDate.toISOString().split('T')[0]
      const endStr = l.endDate.toISOString().split('T')[0]
      results.push({
        type: 'leave',
        id: l.id,
        title: `${l.profile.fullName} - ${l.leaveType} Leave`,
        description: `${startStr} to ${endStr} (${l.days} days)${l.reason ? ' | ' + l.reason.slice(0, 60) : ''}`,
        projectId: null,
        projectName: null,
        status: l.status,
        link: `/leave`,
        updatedAt: l.startDate.toISOString(),
      })
    }
  }

  // ── Sort all results by relevance (exact > starts with > contains) ──
  const lowerQuery = query.toLowerCase()
  results.sort((a, b) => {
    const aTitle = a.title.toLowerCase()
    const bTitle = b.title.toLowerCase()
    const aExact = aTitle === lowerQuery ? 0 : aTitle.startsWith(lowerQuery) ? 1 : 2
    const bExact = bTitle === lowerQuery ? 0 : bTitle.startsWith(lowerQuery) ? 1 : 2
    if (aExact !== bExact) return aExact - bExact
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return success({
    results,
    total: results.length,
    query,
  })
})
