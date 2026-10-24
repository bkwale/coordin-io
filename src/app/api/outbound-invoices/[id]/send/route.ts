import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { generateInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf'
import { createNotification } from '@/lib/notifications'
import { recordAuditEvent } from '@/lib/audit'

// Lazy Resend — avoids crash when key is unset at build time
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <noreply@coordin.io>'

/** Escape HTML entities to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractId(url: string): string {
  const match = url.match(/\/outbound-invoices\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Invoice not found')
  return match[1]
}

/**
 * POST /api/outbound-invoices/[id]/send — Generate PDF, email it to the client,
 * and transition the invoice from DRAFT → SENT.
 *
 * ADMIN/OWNER only. Feature-gated.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can send invoices')
  }

  const id = extractId(request.url)

  const invoice = await prisma.outboundInvoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      organisation: { select: { name: true } },
    },
  })

  if (!invoice || invoice.organisationId !== profile.organisationId) {
    throw new NotFoundError('Invoice not found')
  }

  // Must be DRAFT to send
  if (invoice.status !== 'DRAFT') {
    throw new ValidationError(
      invoice.status === 'SENT'
        ? 'This invoice has already been sent'
        : `Cannot send an invoice with status ${invoice.status}`,
    )
  }

  // Must have a client email
  if (!invoice.clientEmail) {
    throw new ValidationError('Cannot send — no client email address on this invoice')
  }

  // Must have RESEND_API_KEY configured
  if (!process.env.RESEND_API_KEY) {
    throw new ValidationError('Email service not configured — contact your administrator')
  }

  // Atomic lock: transition DRAFT → SENT before sending email to prevent
  // concurrent sends (TOCTOU race). If another request already moved it,
  // updateMany returns count=0 and we reject.
  const lockResult = await prisma.outboundInvoice.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status: 'SENT', sentAt: new Date() },
  })

  if (lockResult.count === 0) {
    throw new ValidationError('This invoice has already been sent or its status changed')
  }

  // Generate PDF
  const pdfData: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientAddress: invoice.clientAddress,
    lineItems: invoice.lineItems.map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
      lineTotal: li.lineTotal,
    })),
    netAmount: invoice.netAmount,
    taxRate: invoice.taxRate,
    vatAmount: invoice.vatAmount,
    grossAmount: invoice.grossAmount,
    currency: invoice.currency,
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,
    createdByName: invoice.createdBy.fullName,
    organisationName: invoice.organisation.name,
    projectName: invoice.project?.name ?? null,
    status: invoice.status,
  }

  const pdfBuffer = await generateInvoicePdf(pdfData)
  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

  // Format currency for email
  const currencySymbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', NGN: '₦' }
  const sym = currencySymbols[invoice.currency] || invoice.currency + ' '
  const formattedTotal = `${sym}${invoice.grossAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  // Send email with PDF attachment
  const { error: emailError } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: invoice.clientEmail,
    subject: `Invoice ${invoice.invoiceNumber} — ${invoice.organisation.name}`,
    html: buildInvoiceEmail({
      clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      total: formattedTotal,
      dueDate: invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
      organisationName: invoice.organisation.name,
      senderName: profile.fullName,
    }),
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })

  if (emailError) {
    // Revert status back to DRAFT since email failed
    await prisma.outboundInvoice.updateMany({
      where: { id, status: 'SENT' },
      data: { status: 'DRAFT', sentAt: null },
    })
    throw new ValidationError(`Failed to send email: ${emailError.message}`)
  }

  // Fetch the updated invoice for the response
  const updated = await prisma.outboundInvoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true } },
      sourceQuote: { select: { id: true, quoteNumber: true, title: true } },
    },
  })

  // Audit + notification — non-fatal (email already sent, status already updated)
  try {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'outbound_invoice.sent',
      entityType: 'outbound_invoice',
      entityId: id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: invoice.clientEmail,
        grossAmount: invoice.grossAmount,
        currency: invoice.currency,
      },
    })
  } catch {
    console.error(`[outbound-invoices] Audit event failed for invoice ${id}`)
  }

  try {
    if (invoice.createdBy.id !== profile.id) {
      await createNotification({
        profileId: invoice.createdBy.id,
        type: 'project.update',
        title: `Invoice ${invoice.invoiceNumber} sent to ${invoice.clientName}`,
        body: `${profile.fullName} sent the invoice to ${invoice.clientEmail}`,
        linkUrl: `/invoices/${id}`,
      })
    }
  } catch {
    console.error(`[outbound-invoices] Notification failed for invoice ${id}`)
  }

  return success({ invoice: updated, emailSent: true })
})

/* ── Email Template ───────────────────────────────────── */

function buildInvoiceEmail(params: {
  clientName: string
  invoiceNumber: string
  total: string
  dueDate: string | null
  organisationName: string
  senderName: string
}): string {
  const clientName = escapeHtml(params.clientName)
  const invoiceNumber = escapeHtml(params.invoiceNumber)
  const total = escapeHtml(params.total)
  const dueDate = params.dueDate ? escapeHtml(params.dueDate) : null
  const organisationName = escapeHtml(params.organisationName)
  const senderName = escapeHtml(params.senderName)

  const dueDateLine = dueDate
    ? `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Payment is due by <strong>${dueDate}</strong>.</p>`
    : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#18181b;padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${organisationName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.6;">
              Dear ${clientName},
            </p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
              Please find attached invoice <strong>${invoiceNumber}</strong> for your records.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f4f4f5;border-radius:8px;width:100%;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Amount Due</p>
                  <p style="margin:0;color:#18181b;font-size:24px;font-weight:700;">${total}</p>
                </td>
              </tr>
            </table>
            ${dueDateLine}
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
              The full invoice is attached as a PDF. If you have any questions regarding this invoice, please don't hesitate to get in touch.
            </p>
            <p style="margin:24px 0 0;color:#18181b;font-size:15px;line-height:1.6;">
              Kind regards,<br/>
              <strong>${senderName}</strong><br/>
              <span style="color:#71717a;font-size:13px;">${organisationName}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">
              This email was sent via Coordin.io on behalf of ${organisationName}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
