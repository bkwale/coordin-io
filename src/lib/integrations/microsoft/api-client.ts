/**
 * Microsoft Graph API client — thin REST adapter over raw fetch.
 *
 * All calls go through `graphFetch()` which handles:
 *  - Bearer token injection (auto-refresh via getValidAccessToken)
 *  - JSON parsing and error extraction
 *  - OData query parameter support ($top, $filter, $orderby, $select)
 *
 * No heavy SDK dependency — just typed fetch wrappers.
 */

import { getValidAccessToken } from './oauth'
import type {
  MsEvent,
  MsMessage,
  MsDriveItem,
  MsSite,
  MsGraphResponse,
  MsDateTimeZone,
} from './types'

const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/* ── Core Fetch ────────────────────────────────────────── */

interface GraphFetchOptions {
  connectionId: string
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string>
  /** Raw content type for file uploads */
  contentType?: string
  /** Raw body bytes for file uploads */
  rawBody?: Buffer | ArrayBuffer
}

export class MsGraphApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public graphCode?: string,
    public graphMessage?: string,
  ) {
    super(message)
    this.name = 'MsGraphApiError'
  }
}

/**
 * Core fetch wrapper — injects auth, handles errors and OData responses.
 */
async function graphFetch<T>(opts: GraphFetchOptions): Promise<T> {
  const accessToken = await getValidAccessToken(opts.connectionId)

  let url = `${MS_GRAPH_BASE}${opts.path}`
  if (opts.params) {
    const qs = new URLSearchParams(opts.params)
    url += `?${qs.toString()}`
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  }

  const fetchOpts: RequestInit = {
    method: opts.method || 'GET',
    headers,
  }

  if (opts.rawBody) {
    headers['Content-Type'] = opts.contentType || 'application/octet-stream'
    fetchOpts.body = opts.rawBody as BodyInit
  } else if (opts.body) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(opts.body)
  }

  const res = await fetch(url, fetchOpts)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let graphCode = ''
    let graphMessage = text
    try {
      const parsed = JSON.parse(text)
      graphCode = parsed.error?.code || ''
      graphMessage = parsed.error?.message || text
    } catch {
      // use raw text
    }
    throw new MsGraphApiError(
      `Microsoft Graph API error ${res.status} on ${opts.method || 'GET'} ${opts.path}`,
      res.status,
      graphCode,
      graphMessage,
    )
  }

  // 204 No Content (e.g. DELETE)
  if (res.status === 204) return {} as T

  return res.json() as Promise<T>
}

/* ── Calendar Events ──────────────────────────────────── */

/**
 * List calendar events. Defaults to the user's primary calendar.
 */
export async function listEvents(
  connectionId: string,
  opts?: {
    top?: number
    filter?: string
    orderBy?: string
    select?: string
    startDateTime?: string  // ISO 8601 — for calendarView
    endDateTime?: string
  },
): Promise<MsEvent[]> {
  const params: Record<string, string> = {}
  if (opts?.top) params['$top'] = String(opts.top)
  if (opts?.filter) params['$filter'] = opts.filter
  if (opts?.orderBy) params['$orderby'] = opts.orderBy
  if (opts?.select) params['$select'] = opts.select

  // Use calendarView for date-range queries (includes recurring event instances)
  const useDateRange = opts?.startDateTime && opts?.endDateTime
  if (useDateRange) {
    params.startDateTime = opts.startDateTime!
    params.endDateTime = opts.endDateTime!
  }

  const path = useDateRange ? '/me/calendarView' : '/me/events'

  const data = await graphFetch<MsGraphResponse<MsEvent>>({
    connectionId,
    path,
    params: Object.keys(params).length ? params : undefined,
  })

  return data.value || []
}

export async function getEvent(
  connectionId: string,
  eventId: string,
): Promise<MsEvent | null> {
  try {
    return await graphFetch<MsEvent>({
      connectionId,
      path: `/me/events/${eventId}`,
    })
  } catch (err) {
    if (err instanceof MsGraphApiError && err.statusCode === 404) return null
    throw err
  }
}

export async function createEvent(
  connectionId: string,
  event: Partial<MsEvent>,
): Promise<MsEvent> {
  return graphFetch<MsEvent>({
    connectionId,
    path: '/me/events',
    method: 'POST',
    body: event,
  })
}

export async function updateEvent(
  connectionId: string,
  eventId: string,
  event: Partial<MsEvent>,
): Promise<MsEvent> {
  return graphFetch<MsEvent>({
    connectionId,
    path: `/me/events/${eventId}`,
    method: 'PATCH',
    body: event,
  })
}

export async function deleteEvent(
  connectionId: string,
  eventId: string,
): Promise<void> {
  await graphFetch<Record<string, never>>({
    connectionId,
    path: `/me/events/${eventId}`,
    method: 'DELETE',
  })
}

/* ── Mail (read-only) ─────────────────────────────────── */

/**
 * List messages from the user's mailbox. Read-only — Coordin has Mail.Read scope.
 */
export async function listMessages(
  connectionId: string,
  opts?: {
    top?: number
    filter?: string
    orderBy?: string
    select?: string
    folderId?: string  // e.g. 'inbox', 'sentitems', or folder ID
  },
): Promise<MsMessage[]> {
  const params: Record<string, string> = {}
  if (opts?.top) params['$top'] = String(opts.top)
  if (opts?.filter) params['$filter'] = opts.filter
  if (opts?.orderBy) params['$orderby'] = opts.orderBy || 'receivedDateTime desc'
  if (opts?.select) params['$select'] = opts.select

  const folder = opts?.folderId ? `/mailFolders/${opts.folderId}` : ''

  const data = await graphFetch<MsGraphResponse<MsMessage>>({
    connectionId,
    path: `/me${folder}/messages`,
    params: Object.keys(params).length ? params : undefined,
  })

  return data.value || []
}

export async function getMessage(
  connectionId: string,
  messageId: string,
): Promise<MsMessage | null> {
  try {
    return await graphFetch<MsMessage>({
      connectionId,
      path: `/me/messages/${messageId}`,
    })
  } catch (err) {
    if (err instanceof MsGraphApiError && err.statusCode === 404) return null
    throw err
  }
}

/* ── SharePoint Sites ─────────────────────────────────── */

/**
 * Search SharePoint sites accessible to the connected user.
 */
export async function listSites(
  connectionId: string,
  searchQuery?: string,
): Promise<MsSite[]> {
  const params: Record<string, string> = {}
  if (searchQuery) params.search = searchQuery

  const data = await graphFetch<MsGraphResponse<MsSite>>({
    connectionId,
    path: '/sites',
    params: Object.keys(params).length ? params : undefined,
  })

  return data.value || []
}

export async function getSite(
  connectionId: string,
  siteId: string,
): Promise<MsSite | null> {
  try {
    return await graphFetch<MsSite>({
      connectionId,
      path: `/sites/${siteId}`,
    })
  } catch (err) {
    if (err instanceof MsGraphApiError && err.statusCode === 404) return null
    throw err
  }
}

/* ── OneDrive / SharePoint Document Libraries ─────────── */

/**
 * List items in a drive folder. Pass folderId='root' for the root folder.
 */
export async function listDriveItems(
  connectionId: string,
  driveId: string,
  folderId?: string,
): Promise<MsDriveItem[]> {
  const folder = folderId && folderId !== 'root'
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/drives/${driveId}/root/children`

  const data = await graphFetch<MsGraphResponse<MsDriveItem>>({
    connectionId,
    path: folder,
  })

  return data.value || []
}

export async function getDriveItem(
  connectionId: string,
  driveId: string,
  itemId: string,
): Promise<MsDriveItem | null> {
  try {
    return await graphFetch<MsDriveItem>({
      connectionId,
      path: `/drives/${driveId}/items/${itemId}`,
    })
  } catch (err) {
    if (err instanceof MsGraphApiError && err.statusCode === 404) return null
    throw err
  }
}

/**
 * Upload a file (≤ 4 MB) via simple PUT. For larger files,
 * use createUploadSession (not yet implemented).
 */
export async function uploadFile(
  connectionId: string,
  driveId: string,
  parentId: string,
  fileName: string,
  content: Buffer | ArrayBuffer,
  contentType?: string,
): Promise<MsDriveItem> {
  // Simple upload: PUT /drives/{driveId}/items/{parentId}:/{fileName}:/content
  return graphFetch<MsDriveItem>({
    connectionId,
    path: `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(fileName)}:/content`,
    method: 'PUT',
    rawBody: content,
    contentType: contentType || 'application/octet-stream',
  })
}

/**
 * Create a folder inside a drive.
 */
export async function createFolder(
  connectionId: string,
  driveId: string,
  parentId: string,
  folderName: string,
): Promise<MsDriveItem> {
  const parent = parentId === 'root'
    ? `/drives/${driveId}/root/children`
    : `/drives/${driveId}/items/${parentId}/children`

  return graphFetch<MsDriveItem>({
    connectionId,
    path: parent,
    method: 'POST',
    body: {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    },
  })
}

/* ── Mapping Helpers ──────────────────────────────────── */

/**
 * Map a Coordin milestone to a Microsoft calendar event payload.
 */
export function mapMilestoneToEvent(milestone: {
  title: string
  description?: string | null
  dueDate: Date
  projectName?: string
  isAllDay?: boolean
  timezone?: string
}): Partial<MsEvent> {
  const tz = milestone.timezone || 'Europe/London'
  const dateStr = milestone.dueDate.toISOString()

  const start: MsDateTimeZone = milestone.isAllDay !== false
    ? { dateTime: dateStr.split('T')[0] + 'T00:00:00.0000000', timeZone: tz }
    : { dateTime: dateStr, timeZone: tz }

  // All-day milestones span the full day
  const end: MsDateTimeZone = milestone.isAllDay !== false
    ? { dateTime: dateStr.split('T')[0] + 'T23:59:59.0000000', timeZone: tz }
    : { dateTime: new Date(milestone.dueDate.getTime() + 3600_000).toISOString(), timeZone: tz }

  const subject = milestone.projectName
    ? `[${milestone.projectName}] ${milestone.title}`
    : milestone.title

  return {
    subject,
    body: milestone.description
      ? { contentType: 'text', content: milestone.description }
      : undefined,
    start,
    end,
    isAllDay: milestone.isAllDay !== false,
    showAs: 'busy',
    importance: 'high',
  }
}

/**
 * Map a Coordin document to metadata suitable for naming / describing
 * a SharePoint/OneDrive upload.
 */
export function mapDocumentToDriveItemMeta(document: {
  title: string
  revision?: string | null
  projectName?: string
  description?: string | null
}): { fileName: string; description: string } {
  // Build a filesystem-safe filename
  const safeName = document.title.replace(/[<>:"/\\|?*]/g, '_')
  const revision = document.revision ? `_v${document.revision}` : ''
  const prefix = document.projectName
    ? `${document.projectName.replace(/[<>:"/\\|?*]/g, '_')}_`
    : ''

  return {
    fileName: `${prefix}${safeName}${revision}`,
    description: [
      document.description,
      document.revision ? `Revision: ${document.revision}` : null,
      document.projectName ? `Project: ${document.projectName}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  }
}
