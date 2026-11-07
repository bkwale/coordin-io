/**
 * File links. Uploaded files are stored privately; the database keeps a stable app link
 * (/api/files?b=bucket&p=path). Opening it checks the viewer and redirects to a signed URL
 * that lives for one hour — nothing long-lived ever leaves the server.
 */
import type { OrgPermission } from '@/generated/prisma/client'

export const FILE_BUCKETS = ['documents', 'receipts'] as const
export type FileBucket = (typeof FILE_BUCKETS)[number]
export const SIGNED_LINK_SECONDS = 60 * 60
const SAFE_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/

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
  // Only the characters our upload routes ever write. Rejects %-encoding (storage URLs are not re-encoded,
  // so %2e%2e would collapse to ..), backslashes, empty segments and . / .. segments.
  if (!SAFE_PATH.test(path)) return false
  const parts = path.split('/')
  if (parts.some((seg) => seg === '.' || seg === '..')) return false
  if (bucket === 'documents' && parts[0] === 'hr') {
    return parts[1] === viewer.organisationId && (parts[2] === viewer.id || canManageHR(viewer.orgPermission as OrgPermission))
  }
  return parts[0] === viewer.organisationId
}

/**
 * Second check, needing the database: what the viewer could see in the app itself.
 *  - project documents (<org>/<projectId>/…): project members, or roles that see every project
 *  - receipts (<org>/<profileId>/…): the claimant, or people who approve expenses
 * Returns the projectId to check membership for, or null when no lookup is needed.
 */
export function fileScope(bucket: FileBucket, path: string): { kind: 'project'; projectId: string } | { kind: 'receipt'; ownerId: string } | { kind: 'none' } {
  const parts = path.split('/')
  if (bucket === 'receipts') return { kind: 'receipt', ownerId: parts[1] ?? '' }
  if (bucket === 'documents' && parts[0] !== 'hr' && parts.length >= 3) return { kind: 'project', projectId: parts[1] }
  return { kind: 'none' }
}
