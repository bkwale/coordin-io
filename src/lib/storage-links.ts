/**
 * File links. Uploaded files are stored privately; the database keeps a stable app link
 * (/api/files?b=bucket&p=path). Opening it checks the viewer and redirects to a signed URL
 * that lives for one hour — nothing long-lived ever leaves the server.
 */
import type { OrgPermission } from '@/generated/prisma/client'

export const FILE_BUCKETS = ['documents', 'receipts'] as const
export type FileBucket = (typeof FILE_BUCKETS)[number]
export const SIGNED_LINK_SECONDS = 60 * 60

export function fileLink(bucket: FileBucket, path: string): string {
  return `/api/files?b=${bucket}&p=${encodeURIComponent(path)}`
}

/** Bucket + path from a stored link: our own /api/files link, or a legacy Supabase signed URL (365-day links issued before Nov 2026). */
export function parseFileLink(url: string | null | undefined): { bucket: FileBucket; path: string } | null {
  if (!url) return null
  try {
    const u = new URL(url, 'https://app.local')
    if (u.pathname === '/api/files') {
      const b = u.searchParams.get('b'), p = u.searchParams.get('p')
      return b && p && (FILE_BUCKETS as readonly string[]).includes(b) ? { bucket: b as FileBucket, path: p } : null
    }
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/)
    if (m && (FILE_BUCKETS as readonly string[]).includes(m[1])) return { bucket: m[1] as FileBucket, path: decodeURIComponent(m[2]) }
  } catch { /* not a URL */ }
  return null
}

/**
 * Who may open a stored file. Paths always start with the organisation id
 * (HR documents: hr/<org>/<person>/…). HR documents are for HR/admins and the person themselves.
 */
export function canOpenFile(
  viewer: { id: string; organisationId: string; orgPermission: OrgPermission | string },
  bucket: FileBucket,
  path: string,
  canManageHR: (role: OrgPermission) => boolean,
): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false
  const parts = path.split('/')
  if (bucket === 'documents' && parts[0] === 'hr') {
    return parts[1] === viewer.organisationId && (parts[2] === viewer.id || canManageHR(viewer.orgPermission as OrgPermission))
  }
  return parts[0] === viewer.organisationId
}
