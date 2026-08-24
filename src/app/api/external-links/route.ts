import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, requireEnum, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

const LINK_TYPES = ['SHAREPOINT_FOLDER', 'SHAREPOINT_DOCUMENT', 'EXTERNAL_URL'] as const

const VALID_ENTITY_TYPES = [
  'project', 'task', 'expense', 'document', 'leave_request',
  'service_request', 'asset', 'drawing', 'compliance_item',
  'planning_application', 'fee_quote', 'milestone',
] as const

/**
 * GET /api/external-links — List external links for an entity.
 *
 * Query params:
 *   entityType: required — e.g. "project", "task", "expense"
 *   entityId: required — the ID of the linked entity
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const entityType = url.searchParams.get('entityType')
  const entityId = url.searchParams.get('entityId')

  if (!entityType || !entityId) {
    throw new ValidationError('entityType and entityId are required')
  }

  const links = await prisma.externalLink.findMany({
    where: {
      organisationId: profile.organisationId,
      entityType,
      entityId,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ links })
})

/**
 * POST /api/external-links — Create an external link.
 *
 * Body: { entityType, entityId, linkType, url, label }
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const entityType = requireEnum(body.entityType, 'Entity type', VALID_ENTITY_TYPES)
  const entityId = requireString(body.entityId, 'Entity ID', 100)
  const linkType = requireEnum(body.linkType, 'Link type', LINK_TYPES)
  const url = requireString(body.url, 'URL', 2000)
  const label = optionalString(body.label, 'Label', 200) ?? url

  // Validate URL format
  try {
    new URL(url)
  } catch {
    throw new ValidationError('Invalid URL format')
  }

  const link = await prisma.externalLink.create({
    data: {
      organisationId: profile.organisationId,
      entityType,
      entityId,
      linkType,
      url,
      label,
      createdById: profile.id,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ link }, 201)
})
