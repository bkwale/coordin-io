import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { FILE_BUCKETS, SIGNED_LINK_SECONDS, canOpenFile, fileScope, type FileBucket } from '@/lib/storage-links'
import { canPerform } from '@/lib/role-permissions'
import { getProjectMembership } from '@/lib/permissions'
import type { OrgPermission } from '@/generated/prisma/client'
import { canManageHR } from '@/lib/staffing-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/files?b=<bucket>&p=<path> — open a stored file.
 * Checks the viewer may see it, then redirects to a signed URL valid for one hour.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const bucket = url.searchParams.get('b') ?? ''
  const path = url.searchParams.get('p') ?? ''
  if (!(FILE_BUCKETS as readonly string[]).includes(bucket) || !path) throw new ValidationError('Unknown file')
  if (!canOpenFile(profile, bucket as FileBucket, path, canManageHR)) throw new PermissionError('You do not have access to this file')
  const role = profile.orgPermission as OrgPermission
  const scope = fileScope(bucket as FileBucket, path)
  // Receipts: the claimant, anyone with firm-wide expense access, or the claimant's own line manager
  if (scope.kind === 'receipt' && scope.ownerId !== profile.id && !canPerform(role, 'expenses', 'view_all')) {
    const owner = canPerform(role, 'expenses', 'approve_direct_reports')
      ? await prisma.profile.findFirst({ where: { id: scope.ownerId, organisationId: profile.organisationId }, select: { managerId: true } })
      : null
    if (!owner || owner.managerId !== profile.id) throw new PermissionError('You do not have access to this file')
  }
  if (scope.kind === 'project' && !canPerform(role, 'projects', 'view_all')) {
    const m = await getProjectMembership(profile.id, scope.projectId)
    if (!m || m.removedAt !== null) throw new PermissionError('You do not have access to this file')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ValidationError('File storage is not configured')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_LINK_SECONDS)
  if (error || !data?.signedUrl) throw new NotFoundError('File not found')
  const res = NextResponse.redirect(data.signedUrl, 302)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
})
