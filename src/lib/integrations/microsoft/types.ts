/**
 * Microsoft Graph API type definitions.
 *
 * Single OAuth token covers Outlook, SharePoint, OneDrive, and Teams.
 * Based on Microsoft Graph API v1.0 — https://learn.microsoft.com/en-us/graph/api/overview
 */

/* ── OAuth ─────────────────────────────────────────────── */

export interface MsTokenSet {
  access_token: string
  refresh_token: string
  expires_in: number          // seconds until access_token expires (typically 3600)
  token_type: 'Bearer'
  scope: string               // space-separated scopes granted
  id_token?: string           // OpenID Connect ID token (JWT)
  ext_expires_in?: number     // extended lifetime for resilience
}

/* ── Tenant / Organisation ─────────────────────────────── */

export interface MsTenant {
  id: string                  // Azure AD directory object ID
  displayName: string         // e.g. "CWA Homes Ltd"
  tenantId: string            // Azure AD tenant GUID
  tenantType?: string         // e.g. "AAD"
}

/**
 * Minimal user profile from /me endpoint.
 */
export interface MsUserProfile {
  id: string
  displayName: string
  mail?: string
  userPrincipalName: string
  jobTitle?: string
  companyName?: string
}

/* ── Calendar / Events ─────────────────────────────────── */

export interface MsDateTimeZone {
  dateTime: string            // ISO 8601 format: "2026-11-01T09:00:00.0000000"
  timeZone: string            // IANA timezone: "Europe/London"
}

export interface MsLocation {
  displayName?: string
  address?: {
    street?: string
    city?: string
    state?: string
    countryOrRegion?: string
    postalCode?: string
  }
}

export interface MsAttendee {
  emailAddress: {
    address: string
    name?: string
  }
  type: 'required' | 'optional' | 'resource'
  status?: {
    response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded'
    time?: string
  }
}

export interface MsItemBody {
  contentType: 'text' | 'html'
  content: string
}

/**
 * Open extension on a calendar event — used to store Coordin entity refs
 * (e.g. milestone ID, leave request ID) without polluting native fields.
 */
export interface MsOpenExtension {
  '@odata.type': 'microsoft.graph.openExtension'
  extensionName: string       // e.g. "com.coordin.metadata"
  [key: string]: unknown      // arbitrary key-value pairs
}

/**
 * Calendar event from Microsoft Graph /events endpoint.
 */
export interface MsEvent {
  id?: string
  subject: string
  body?: MsItemBody
  start: MsDateTimeZone
  end: MsDateTimeZone
  location?: MsLocation
  locations?: MsLocation[]
  organizer?: {
    emailAddress: {
      address: string
      name?: string
    }
  }
  attendees?: MsAttendee[]
  isOnlineMeeting?: boolean
  onlineMeetingUrl?: string
  onlineMeeting?: {
    joinUrl?: string
  }
  isAllDay?: boolean
  isCancelled?: boolean
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown'
  importance?: 'low' | 'normal' | 'high'
  recurrence?: MsRecurrence
  seriesMasterId?: string
  extensions?: MsOpenExtension[]
  createdDateTime?: string
  lastModifiedDateTime?: string
  webLink?: string
  changeKey?: string
}

export interface MsRecurrence {
  pattern: {
    type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly'
    interval: number
    daysOfWeek?: string[]
    dayOfMonth?: number
    month?: number
    firstDayOfWeek?: string
  }
  range: {
    type: 'endDate' | 'noEnd' | 'numbered'
    startDate: string         // YYYY-MM-DD
    endDate?: string
    numberOfOccurrences?: number
  }
}

/* ── Mail ──────────────────────────────────────────────── */

export interface MsEmailAddress {
  address: string
  name?: string
}

export interface MsRecipient {
  emailAddress: MsEmailAddress
}

/**
 * Mail message from Microsoft Graph /messages endpoint.
 * Read-only in Coordin (Mail.Read scope — no send/write).
 */
export interface MsMessage {
  id?: string
  subject?: string
  body?: MsItemBody
  bodyPreview?: string
  from?: MsRecipient
  sender?: MsRecipient
  toRecipients?: MsRecipient[]
  ccRecipients?: MsRecipient[]
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  isDraft?: boolean
  hasAttachments?: boolean
  importance?: 'low' | 'normal' | 'high'
  conversationId?: string
  webLink?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
}

/* ── SharePoint / OneDrive ─────────────────────────────── */

/**
 * SharePoint site from Microsoft Graph /sites endpoint.
 */
export interface MsSite {
  id: string                  // "{hostname},{site-collection-id},{site-id}"
  displayName: string
  name?: string
  webUrl: string
  description?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  root?: Record<string, unknown>
  siteCollection?: {
    hostname: string
  }
}

/**
 * Drive item — file or folder in OneDrive / SharePoint document library.
 */
export interface MsDriveItem {
  id: string
  name: string
  size?: number               // bytes
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  createdBy?: MsIdentitySet
  lastModifiedBy?: MsIdentitySet
  parentReference?: {
    driveId?: string
    driveType?: 'personal' | 'business' | 'documentLibrary'
    id?: string               // parent folder ID
    name?: string
    path?: string             // e.g. "/drive/root:/Documents"
    siteId?: string
  }
  /** Present when item is a file */
  file?: {
    mimeType: string
    hashes?: {
      quickXorHash?: string
      sha1Hash?: string
      sha256Hash?: string
    }
  }
  /** Present when item is a folder */
  folder?: {
    childCount: number
  }
  /** Download URL — short-lived, valid for ~1 hour */
  '@microsoft.graph.downloadUrl'?: string
}

export interface MsIdentitySet {
  user?: {
    id?: string
    displayName?: string
    email?: string
  }
  application?: {
    id?: string
    displayName?: string
  }
}

/**
 * Upload session for large files (> 4 MB) via resumable upload.
 */
export interface MsUploadSession {
  uploadUrl: string
  expirationDateTime: string
  nextExpectedRanges?: string[]   // e.g. ["0-"]
}

/* ── Webhooks / Subscriptions ──────────────────────────── */

/**
 * Graph subscription for change notifications.
 * Max expiry: 3 days for most resources — needs cron renewal.
 */
export interface MsSubscription {
  id?: string
  resource: string            // e.g. "me/events", "me/messages"
  changeType: string          // comma-separated: "created,updated,deleted"
  notificationUrl: string
  expirationDateTime: string  // ISO 8601
  clientState?: string        // secret for validation
  includeResourceData?: boolean
  encryptionCertificate?: string
  encryptionCertificateId?: string
  latestSupportedTlsVersion?: string
  lifecycleNotificationUrl?: string
}

/**
 * Incoming webhook notification payload from Graph.
 */
export interface MsChangeNotification {
  subscriptionId: string
  subscriptionExpirationDateTime: string
  changeType: 'created' | 'updated' | 'deleted'
  resource: string            // e.g. "me/events('abc-123')"
  resourceData?: {
    '@odata.type': string
    '@odata.id': string
    '@odata.etag'?: string
    id: string
  }
  clientState?: string
  tenantId: string
}

export interface MsNotificationPayload {
  value: MsChangeNotification[]
}

/* ── API Response Wrappers ─────────────────────────────── */

/**
 * Standard Graph API collection response with optional pagination.
 */
export interface MsGraphResponse<T> {
  value: T[]
  '@odata.count'?: number
  '@odata.nextLink'?: string  // URL for next page of results
  '@odata.deltaLink'?: string // URL for delta sync (incremental changes)
}

export interface MsGraphError {
  error: {
    code: string              // e.g. "InvalidAuthenticationToken", "ItemNotFound"
    message: string
    innerError?: {
      'request-id'?: string
      date?: string
      'client-request-id'?: string
    }
  }
}

/* ── Sync payloads ─────────────────────────────────────── */

export interface SyncResult {
  synced: number
  failed: number
  skipped: number
  errors: Array<{ entityId: string; message: string }>
}

/**
 * Tracks which Microsoft services are enabled for a connection.
 * All go through a single OAuth token, but individual services
 * can be toggled on/off per organisation.
 */
export type MsServiceType = 'outlook_calendar' | 'outlook_mail' | 'sharepoint' | 'onedrive' | 'teams'
