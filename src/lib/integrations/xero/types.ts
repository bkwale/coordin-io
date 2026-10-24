/**
 * Xero API type definitions.
 *
 * Covers OAuth tokens, invoices, contacts, and sync payloads.
 * Based on Xero API v2.0 — https://developer.xero.com/documentation/api/
 */

/* ── OAuth ─────────────────────────────────────────────── */

export interface XeroTokenSet {
  access_token: string
  refresh_token: string
  expires_in: number       // seconds until access_token expires (typically 1800)
  token_type: 'Bearer'
  scope: string
  id_token?: string
}

export interface XeroTenant {
  id: string               // Xero tenant UUID
  authEventId: string
  tenantId: string
  tenantType: 'ORGANISATION'
  tenantName: string
  createdDateUtc: string
  updatedDateUtc: string
}

/* ── Contacts ──────────────────────────────────────────── */

export interface XeroAddress {
  AddressType: 'POBOX' | 'STREET' | 'DELIVERY'
  AddressLine1?: string
  AddressLine2?: string
  City?: string
  Region?: string
  PostalCode?: string
  Country?: string
}

export interface XeroPhone {
  PhoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX'
  PhoneNumber?: string
  PhoneAreaCode?: string
  PhoneCountryCode?: string
}

export interface XeroContact {
  ContactID: string
  ContactNumber?: string
  ContactStatus: 'ACTIVE' | 'ARCHIVED' | 'GDPRREQUEST'
  Name: string
  FirstName?: string
  LastName?: string
  EmailAddress?: string
  Addresses?: XeroAddress[]
  Phones?: XeroPhone[]
  IsSupplier?: boolean
  IsCustomer?: boolean
  DefaultCurrency?: string
  TaxNumber?: string
  UpdatedDateUTC?: string
}

/* ── Line Items ────────────────────────────────────────── */

export interface XeroLineItem {
  LineItemID?: string
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode?: string
  TaxType?: string
  TaxAmount?: number
  LineAmount?: number
  ItemCode?: string
}

/* ── Invoices ──────────────────────────────────────────── */

export type XeroInvoiceType = 'ACCREC' | 'ACCPAY'

export type XeroInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AUTHORISED'
  | 'PAID'
  | 'VOIDED'
  | 'DELETED'

export interface XeroInvoice {
  InvoiceID?: string
  InvoiceNumber?: string
  Type: XeroInvoiceType
  Contact: { ContactID: string; Name?: string }
  LineItems: XeroLineItem[]
  Date?: string              // YYYY-MM-DD
  DueDate?: string           // YYYY-MM-DD
  Status?: XeroInvoiceStatus
  CurrencyCode?: string
  SubTotal?: number
  TotalTax?: number
  Total?: number
  AmountDue?: number
  AmountPaid?: number
  Reference?: string
  UpdatedDateUTC?: string
  Url?: string
}

/* ── API Response Wrappers ─────────────────────────────── */

export interface XeroApiResponse<T> {
  Id: string
  Status: string
  ProviderName: string
  DateTimeUTC: string
  [key: string]: unknown
  // The actual collection is keyed by resource name (Invoices, Contacts, etc.)
  // Callers extract it by name.
}

export interface XeroErrorDetail {
  Message: string
  ValidationErrors?: Array<{ Message: string }>
}

/* ── Sync payloads ─────────────────────────────────────── */

export interface SyncResult {
  synced: number
  failed: number
  skipped: number
  errors: Array<{ entityId: string; message: string }>
}
