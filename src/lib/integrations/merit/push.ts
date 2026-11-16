/** Merit Aktiva: push Coordin sales invoices into the firm's Merit books. Server-only. */
import { prisma } from '@/lib/prisma'
import { openSecret } from '@/lib/secret-box'
import { MeritApiError, buildInvoicePayload, getTaxes, pickTax, sendAsEInvoice, sendInvoice, type MeritCredentials } from './client'

export const MERIT_SYSTEM = 'merit'
const BATCH = 25

export interface MeritPushResult { synced: number; failed: number; eInvoiced: number; errors: Array<{ invoiceNumber: string; message: string }> }

export async function pushInvoicesToMerit(organisationId: string): Promise<MeritPushResult> {
  const conn = await prisma.meritConnection.findFirst({ where: { organisationId, active: true } })
  if (!conn) throw new MeritApiError('Merit is not connected.', 0, 'auth')
  const creds: MeritCredentials = { apiId: openSecret(conn.apiId), apiKey: openSecret(conn.apiKey) }

  const invoices = await prisma.outboundInvoice.findMany({
    where: { organisationId, externalId: null, status: { notIn: ['DRAFT', 'VOIDED'] }, documentType: 'INVOICE' },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } }, supplier: { select: { country: true, vatNumber: true } } },
    orderBy: { invoiceDate: 'asc' },
    take: BATCH,
  })
  const result: MeritPushResult = { synced: 0, failed: 0, eInvoiced: 0, errors: [] }
  if (invoices.length === 0) {
    await prisma.meritConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastSyncError: null } })
    return result
  }

  const taxes = await getTaxes(creds)
  const byRate = (pct: number) => (conn.defaultTaxId && conn.defaultTaxPct != null && Math.abs(conn.defaultTaxPct - pct) < 0.001 ? conn.defaultTaxId : pickTax(taxes, pct)?.Id ?? null)

  for (const inv of invoices) {
    try {
      const payload = buildInvoicePayload({
        invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, currency: inv.currency,
        clientName: inv.clientName, clientEmail: inv.clientEmail, clientAddress: inv.clientAddress,
        clientCountry: inv.supplier?.country, clientVatNumber: inv.supplier?.vatNumber, notes: inv.notes,
        lineItems: inv.lineItems.length > 0 ? inv.lineItems : [{ description: `Invoice ${inv.invoiceNumber}`, quantity: 1, unitPrice: inv.netAmount, vatRate: inv.taxRate }],
      }, { byRate }, conn.itemCode)
      const out = await sendInvoice(creds, payload)
      let note: string | null = null
      if (conn.sendEInvoice && out.InvoiceId) {
        try { await sendAsEInvoice(creds, out.InvoiceId); result.eInvoiced++ }
        catch (e) { note = e instanceof MeritApiError ? `In Merit, but not sent as e-invoice: ${e.message}` : 'In Merit, but not sent as e-invoice.' }
      }
      await prisma.outboundInvoice.update({ where: { id: inv.id }, data: { accountingSystem: MERIT_SYSTEM, externalId: out.InvoiceId, syncedAt: new Date(), syncError: note } })
      result.synced++
    } catch (e) {
      const message = e instanceof MeritApiError ? e.message : 'Could not send this invoice to Merit.'
      result.failed++
      result.errors.push({ invoiceNumber: inv.invoiceNumber, message })
      await prisma.outboundInvoice.update({ where: { id: inv.id }, data: { syncError: message.slice(0, 500) } }).catch(() => {})
      if (e instanceof MeritApiError && (e.code === 'auth' || e.code === 'unavailable')) break // no point trying the rest
    }
  }
  await prisma.meritConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastSyncError: result.errors[0]?.message?.slice(0, 500) ?? null } })
  return result
}
