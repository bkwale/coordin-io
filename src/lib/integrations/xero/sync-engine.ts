/**
 * Xero sync engine — bidirectional invoice + contact synchronisation.
 *
 * Direction mapping:
 *  - Coordin OutboundInvoice → Xero ACCREC (sales invoice)
 *  - Coordin InboundInvoice  → Xero ACCPAY (purchase bill)
 *  - Coordin Supplier        ↔ Xero Contact
 *
 * Each sync operation:
 * 1. Finds unsynced records (externalId is null)
 * 2. Ensures the contact exists in Xero (create if needed)
 * 3. Creates or updates the Xero invoice/contact
 * 4. Writes back the externalId + syncedAt
 * 5. Logs each operation in XeroSyncLog
 */

import { prisma } from '@/lib/prisma'
import {
  createInvoice,
  createContact,
  getContact,
  mapOutboundToXeroInvoice,
  mapInboundToXeroInvoice,
  mapSupplierToXeroContact,
  XeroApiError,
} from './api-client'
import type { SyncResult } from './types'

/* ── Helpers ───────────────────────────────────────────── */

async function getConnectionTenantId(connectionId: string): Promise<string> {
  const conn = await prisma.xeroConnection.findUnique({
    where: { id: connectionId },
    select: { xeroTenantId: true },
  })
  if (!conn) throw new Error(`Xero connection ${connectionId} not found`)
  return conn.xeroTenantId
}

async function logSync(params: {
  connectionId: string
  direction: 'TO_XERO' | 'FROM_XERO'
  entityType: string
  entityId: string
  xeroId?: string | null
  action: string
  status: 'SUCCESS' | 'FAILED'
  errorMessage?: string | null
}) {
  try {
    await prisma.xeroSyncLog.create({
      data: {
        connectionId: params.connectionId,
        direction: params.direction,
        entityType: params.entityType,
        entityId: params.entityId,
        xeroId: params.xeroId || null,
        action: params.action,
        status: params.status,
        error: params.errorMessage || null,
      },
    })
  } catch (err) {
    console.error('[xero-sync] Failed to write sync log:', err)
  }
}

/* ── Ensure Supplier → Xero Contact ───────────────────── */

/**
 * Ensure a supplier has a corresponding Xero contact.
 * Returns the Xero contact ID.
 */
async function ensureXeroContact(
  connectionId: string,
  tenantId: string,
  supplierId: string,
): Promise<string> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      vatNumber: true,
      country: true,
      xeroContactId: true,
    },
  })

  if (!supplier) throw new Error(`Supplier ${supplierId} not found`)

  // Already linked?
  if (supplier.xeroContactId) {
    // Verify it still exists in Xero
    const existing = await getContact(connectionId, tenantId, supplier.xeroContactId)
    if (existing) return supplier.xeroContactId
    // Contact was deleted in Xero — fall through to create
  }

  // Create in Xero
  const payload = mapSupplierToXeroContact(supplier)
  const xeroContact = await createContact(connectionId, tenantId, payload)

  // Write back the Xero contact ID
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { xeroContactId: xeroContact.ContactID },
  })

  return xeroContact.ContactID
}

/* ── Outbound Invoices → Xero ACCREC ──────────────────── */

export async function syncInvoicesToXero(
  connectionId: string,
  organisationId: string,
): Promise<SyncResult> {
  const tenantId = await getConnectionTenantId(connectionId)
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] }

  // Find outbound invoices not yet synced (no externalId) and in SENT or PAID status
  const invoices = await prisma.outboundInvoice.findMany({
    where: {
      organisationId,
      externalId: null,
      accountingSystem: null,
      status: { in: ['SENT', 'PAID'] },
    },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      supplier: { select: { id: true, name: true, xeroContactId: true } },
    },
    take: 50, // batch size to stay within rate limits
  })

  for (const invoice of invoices) {
    try {
      // We need a contact in Xero. If no supplier, create one from clientName.
      let xeroContactId: string

      if (invoice.supplierId) {
        xeroContactId = await ensureXeroContact(connectionId, tenantId, invoice.supplierId)
      } else {
        // Create/find a contact from clientName
        const clientContact = await createContact(connectionId, tenantId, {
          Name: invoice.clientName,
          EmailAddress: invoice.clientEmail || undefined,
          IsCustomer: true,
        })
        xeroContactId = clientContact.ContactID
      }

      const xeroPayload = mapOutboundToXeroInvoice(
        {
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
          taxRate: invoice.taxRate,
          notes: invoice.notes,
          lineItems: invoice.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            vatRate: li.vatRate,
          })),
        },
        xeroContactId,
      )

      const xeroInvoice = await createInvoice(connectionId, tenantId, xeroPayload)

      // Write back sync state
      await prisma.outboundInvoice.update({
        where: { id: invoice.id },
        data: {
          externalId: xeroInvoice.InvoiceID,
          accountingSystem: 'xero',
          syncedAt: new Date(),
          syncError: null,
        },
      })

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'outbound_invoice',
        entityId: invoice.id,
        xeroId: xeroInvoice.InvoiceID,
        action: 'CREATE',
        status: 'SUCCESS',
      })

      result.synced++
    } catch (err) {
      const message = err instanceof XeroApiError
        ? `${err.statusCode}: ${err.xeroMessage}`
        : (err instanceof Error ? err.message : 'Unknown error')

      await prisma.outboundInvoice.update({
        where: { id: invoice.id },
        data: { syncError: message.slice(0, 500) },
      })

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'outbound_invoice',
        entityId: invoice.id,
        action: 'CREATE',
        status: 'FAILED',
        errorMessage: message,
      })

      result.failed++
      result.errors.push({ entityId: invoice.id, message })
    }
  }

  return result
}

/* ── Inbound Invoices → Xero ACCPAY ───────────────────── */

export async function syncInboundInvoicesToXero(
  connectionId: string,
  organisationId: string,
): Promise<SyncResult> {
  const tenantId = await getConnectionTenantId(connectionId)
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] }

  // Find approved inbound invoices not yet synced
  const invoices = await prisma.inboundInvoice.findMany({
    where: {
      organisationId,
      externalId: null,
      accountingSystem: null,
      status: 'APPROVED',
    },
    include: {
      supplier: { select: { id: true, name: true, xeroContactId: true } },
    },
    take: 50,
  })

  for (const invoice of invoices) {
    try {
      if (!invoice.supplierId) {
        result.skipped++
        continue
      }

      const xeroContactId = await ensureXeroContact(connectionId, tenantId, invoice.supplierId)

      const xeroPayload = mapInboundToXeroInvoice(
        {
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
          totalAmount: invoice.grossAmount,
          notes: invoice.notes,
        },
        xeroContactId,
      )

      const xeroInvoice = await createInvoice(connectionId, tenantId, xeroPayload)

      await prisma.inboundInvoice.update({
        where: { id: invoice.id },
        data: {
          externalId: xeroInvoice.InvoiceID,
          accountingSystem: 'xero',
          syncedAt: new Date(),
          syncError: null,
        },
      })

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'inbound_invoice',
        entityId: invoice.id,
        xeroId: xeroInvoice.InvoiceID,
        action: 'CREATE',
        status: 'SUCCESS',
      })

      result.synced++
    } catch (err) {
      const message = err instanceof XeroApiError
        ? `${err.statusCode}: ${err.xeroMessage}`
        : (err instanceof Error ? err.message : 'Unknown error')

      await prisma.inboundInvoice.update({
        where: { id: invoice.id },
        data: { syncError: message.slice(0, 500) },
      })

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'inbound_invoice',
        entityId: invoice.id,
        action: 'CREATE',
        status: 'FAILED',
        errorMessage: message,
      })

      result.failed++
      result.errors.push({ entityId: invoice.id, message })
    }
  }

  return result
}

/* ── Suppliers → Xero Contacts ─────────────────────────── */

export async function syncContactsToXero(
  connectionId: string,
  organisationId: string,
): Promise<SyncResult> {
  const tenantId = await getConnectionTenantId(connectionId)
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] }

  // Find suppliers without a Xero contact ID
  const suppliers = await prisma.supplier.findMany({
    where: {
      organisationId,
      xeroContactId: null,
      active: true,
    },
    take: 50,
  })

  for (const supplier of suppliers) {
    try {
      const payload = mapSupplierToXeroContact(supplier)
      const xeroContact = await createContact(connectionId, tenantId, payload)

      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { xeroContactId: xeroContact.ContactID },
      })

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'supplier',
        entityId: supplier.id,
        xeroId: xeroContact.ContactID,
        action: 'CREATE',
        status: 'SUCCESS',
      })

      result.synced++
    } catch (err) {
      const message = err instanceof XeroApiError
        ? `${err.statusCode}: ${err.xeroMessage}`
        : (err instanceof Error ? err.message : 'Unknown error')

      await logSync({
        connectionId,
        direction: 'TO_XERO',
        entityType: 'supplier',
        entityId: supplier.id,
        action: 'CREATE',
        status: 'FAILED',
        errorMessage: message,
      })

      result.failed++
      result.errors.push({ entityId: supplier.id, message })
    }
  }

  return result
}
