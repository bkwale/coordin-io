import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { modulesPrisma } from '@/lib/prisma-modules'
import { PermissionError } from '@/lib/errors'
import { parseBody, requireString } from '@/lib/validation'
import { recordAuditEvent } from '@/lib/audit'

/** The 8 canonical brief sections */
const BRIEF_SECTION_KEYS = [
  'client_requirements',
  'site_information',
  'design_intent',
  'budget',
  'programme',
  'sustainability',
  'operator_requirements',
  'planning_context',
] as const

/**
 * GET /api/projects/[id]/brief — Fetch all brief sections for a project.
 *
 * Returns the 8 canonical sections, creating empty rows for any that
 * don't exist yet (lazy-init pattern).
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const existing = await modulesPrisma.projectBriefSection.findMany({
    where: { projectId },
    orderBy: { sectionKey: 'asc' },
  })

  // Build a map for fast lookup
  const byKey: Record<string, (typeof existing)[number]> = {}
  for (const s of existing) {
    byKey[s.sectionKey] = s
  }

  // Return all 8 sections, filling in empty defaults for any missing
  const sections = BRIEF_SECTION_KEYS.map((key) => {
    if (byKey[key]) {
      return {
        sectionKey: key,
        content: byKey[key].content,
        status: byKey[key].status,
        approvedBy: byKey[key].approvedBy ?? '',
        lastUpdated: byKey[key].lastUpdated?.toISOString() ?? null,
      }
    }
    return {
      sectionKey: key,
      content: '',
      status: 'not_started',
      approvedBy: '',
      lastUpdated: null,
    }
  })

  return success({ sections })
})

/**
 * PUT /api/projects/[id]/brief — Upsert a single brief section.
 *
 * Body: { sectionKey, content, status, approvedBy? }
 * MANAGER+ only.
 */
export const PUT = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  if (profile.orgPermission === 'MEMBER') {
    throw new PermissionError('Only managers and above can edit the project brief')
  }

  const body = await parseBody(request)
  const sectionKey = requireString(body, 'sectionKey')
  const content = requireString(body, 'content')
  const status = requireString(body, 'status')
  const approvedBy = typeof body.approvedBy === 'string' ? body.approvedBy : null

  // Validate section key
  if (!(BRIEF_SECTION_KEYS as readonly string[]).includes(sectionKey)) {
    throw new Error(`Invalid section key: ${sectionKey}`)
  }

  // Validate status
  const validStatuses = ['not_started', 'draft', 'complete', 'approved']
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  // Upsert by projectId + sectionKey
  const existing = await modulesPrisma.projectBriefSection.findFirst({
    where: { projectId, sectionKey },
  })

  let section
  if (existing) {
    section = await modulesPrisma.projectBriefSection.update({
      where: { id: existing.id },
      data: { content, status, approvedBy, lastUpdated: new Date() },
    })
  } else {
    section = await modulesPrisma.projectBriefSection.create({
      data: { projectId, sectionKey, content, status, approvedBy, lastUpdated: new Date() },
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'project.brief_updated',
    entityType: 'project',
    entityId: projectId,
    metadata: { sectionKey, status },
  })

  return success({
    section: {
      sectionKey: section.sectionKey,
      content: section.content,
      status: section.status,
      approvedBy: section.approvedBy ?? '',
      lastUpdated: section.lastUpdated?.toISOString() ?? null,
    },
  })
})
