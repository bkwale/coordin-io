import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId, canViewProject } from '@/lib/permissions'
import { AuthError, NotFoundError, PermissionError, formatAPIError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { OrgPermission } from '@/generated/prisma/client'

const DEMO_COOKIE = 'coordin_demo_start'
const DEMO_DURATION_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Context available inside a withDocumentAccess handler.
 */
export interface DocumentAccessContext {
  authUserId: string
  profile: NonNullable<Awaited<ReturnType<typeof getProfileByAuthId>>>
  document: { id: string; projectId: string; project: { id: string; organisationId: string } }
  documentId: string
}

type DocumentAccessHandler = (
  request: NextRequest,
  context: DocumentAccessContext,
) => Promise<NextResponse>

/**
 * Higher-order function for routes that operate on a document.
 * Extracts documentId from URL: /api/documents/[documentId]/...
 *
 * Verifies auth, profile, document existence, org boundary, and project membership.
 */
export function withDocumentAccess(handler: DocumentAccessHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 0. Demo mode — cookie-based 10-minute pass
      const demoCookie = request.cookies.get(DEMO_COOKIE)?.value
      if (demoCookie) {
        const demoStart = parseInt(demoCookie, 10)
        if (!isNaN(demoStart) && Date.now() - demoStart < DEMO_DURATION_MS) {
          const demoProfile = await prisma.profile.findFirst({
            where: {
              organisationId: 'demo_org_sterling_2026',
              orgPermission: { in: ['OWNER', 'ADMIN'] },
              status: 'ACTIVE',
            },
            include: {
              organisation: true,
              office: true,
              corporateRole: true,
              employeeProfile: true,
            },
          })

          if (demoProfile) {
            const demoUrl = new URL(request.url)
            const demoSegs = demoUrl.pathname.split('/')
            const demoDocIdx = demoSegs.indexOf('documents')
            const demoDocId = demoDocIdx >= 0 ? demoSegs[demoDocIdx + 1] : undefined

            if (!demoDocId) throw new NotFoundError('Document ID is required')

            const demoDoc = await prisma.document.findUnique({
              where: { id: demoDocId },
              include: { project: true },
            })

            if (!demoDoc || demoDoc.project.organisationId !== 'demo_org_sterling_2026') {
              throw new NotFoundError('Document not found')
            }

            return await handler(request, {
              authUserId: 'demo-user',
              profile: demoProfile as any,
              document: demoDoc,
              documentId: demoDocId,
            })
          }
        }
      }

      // 1. Verify Supabase session
      const supabase = await createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Authentication required — please sign in')
      }

      // 2. Look up profile
      const profile = await getProfileByAuthId(user.id)

      if (!profile) {
        throw new AuthError(
          'No profile found for this account. Please contact your administrator.',
          'AUTH_REQUIRED',
        )
      }

      // 3. Extract documentId from URL
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const docsIdx = segments.indexOf('documents')
      const documentId = docsIdx >= 0 ? segments[docsIdx + 1] : undefined

      if (!documentId) {
        throw new NotFoundError('Document ID is required')
      }

      // 4. Verify document exists and belongs to user's org
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { project: true },
      })

      if (!document || document.project.organisationId !== profile.organisationId) {
        throw new NotFoundError('Document not found')
      }

      // 5. Check project access (admins bypass)
      const canAccess = await canViewProject(
        profile.id,
        document.projectId,
        profile.orgPermission as OrgPermission,
      )
      if (!canAccess) {
        throw new PermissionError('You do not have access to this document')
      }

      // 6. Run the handler
      return await handler(request, {
        authUserId: user.id,
        profile,
        document,
        documentId,
      })
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}

/**
 * Context for routes operating on a document revision.
 */
export interface RevisionAccessContext {
  authUserId: string
  profile: NonNullable<Awaited<ReturnType<typeof getProfileByAuthId>>>
  revision: {
    id: string
    documentId: string
    revision: string
    authorId: string
    document: { id: string; projectId: string; project: { id: string; organisationId: string } }
  }
  revisionId: string
}

type RevisionAccessHandler = (
  request: NextRequest,
  context: RevisionAccessContext,
) => Promise<NextResponse>

/**
 * Higher-order function for routes operating on a document revision.
 * Extracts revisionId from URL: /api/document-revisions/[revisionId]/...
 */
export function withRevisionAccess(handler: RevisionAccessHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 0. Demo mode — cookie-based 10-minute pass
      const demoCookie = request.cookies.get(DEMO_COOKIE)?.value
      if (demoCookie) {
        const demoStart = parseInt(demoCookie, 10)
        if (!isNaN(demoStart) && Date.now() - demoStart < DEMO_DURATION_MS) {
          const demoProfile = await prisma.profile.findFirst({
            where: {
              organisationId: 'demo_org_sterling_2026',
              orgPermission: { in: ['OWNER', 'ADMIN'] },
              status: 'ACTIVE',
            },
            include: {
              organisation: true,
              office: true,
              corporateRole: true,
              employeeProfile: true,
            },
          })

          if (demoProfile) {
            const demoUrl = new URL(request.url)
            const demoSegs = demoUrl.pathname.split('/')
            const demoRevIdx = demoSegs.indexOf('document-revisions')
            const demoRevId = demoRevIdx >= 0 ? demoSegs[demoRevIdx + 1] : undefined

            if (!demoRevId) throw new NotFoundError('Revision ID is required')

            const demoRevision = await prisma.documentRevision.findUnique({
              where: { id: demoRevId },
              include: { document: { include: { project: true } } },
            })

            if (!demoRevision || demoRevision.document.project.organisationId !== 'demo_org_sterling_2026') {
              throw new NotFoundError('Document revision not found')
            }

            return await handler(request, {
              authUserId: 'demo-user',
              profile: demoProfile as any,
              revision: demoRevision as RevisionAccessContext['revision'],
              revisionId: demoRevId,
            })
          }
        }
      }

      const supabase = await createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Authentication required — please sign in')
      }

      const profile = await getProfileByAuthId(user.id)

      if (!profile) {
        throw new AuthError(
          'No profile found for this account. Please contact your administrator.',
          'AUTH_REQUIRED',
        )
      }

      // Extract revisionId from URL
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const revIdx = segments.indexOf('document-revisions')
      const revisionId = revIdx >= 0 ? segments[revIdx + 1] : undefined

      if (!revisionId) {
        throw new NotFoundError('Revision ID is required')
      }

      // Fetch revision with document and project
      const revision = await prisma.documentRevision.findUnique({
        where: { id: revisionId },
        include: {
          document: {
            include: { project: true },
          },
        },
      })

      if (!revision || revision.document.project.organisationId !== profile.organisationId) {
        throw new NotFoundError('Document revision not found')
      }

      const canAccess = await canViewProject(
        profile.id,
        revision.document.projectId,
        profile.orgPermission as OrgPermission,
      )
      if (!canAccess) {
        throw new PermissionError('You do not have access to this document')
      }

      return await handler(request, {
        authUserId: user.id,
        profile,
        revision: revision as RevisionAccessContext['revision'],
        revisionId,
      })
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}
