import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { generateQuotePdf, type QuotePdfData } from '@/lib/quote-pdf'
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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <onboarding@resend.dev>'

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
  const match = url.match(/\/fee-quotes\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Fee quote not found')
  return match[1]
}

/**
 * POST /api/fee-quotes/[id]/send — Generate PDF, email it to the client,
 * and transition the quote from DRAFT → SENT.
 *
 * ADMIN/OWNER only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)

  const quote = await prisma.feeQuote.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      organisation: { select: { name: true } },
    },
  })

  if (!quote) throw new NotFoundError('Fee quote not found')
  if (quote.organisationId !== profile.organisationId) {
    throw new NotFoundError('Fee quote not found')
  }

  // Must be DRAFT to send
  if (quote.status !== 'DRAFT') {
    throw new ValidationError(
      quote.status === 'SENT'
        ? 'This quote has already been sent'
        : `Cannot send a quote with status ${quote.status}`,
    )
  }

  // Must have a client email
  if (!quote.clientEmail) {
    throw new ValidationError('Cannot send — no client email address on this quote')
  }

  // Must have RESEND_API_KEY configured
  if (!process.env.RESEND_API_KEY) {
    throw new ValidationError('Email service not configured — contact your administrator')
  }

  // Atomic lock: transition DRAFT → SENT before sending email to prevent
  // concurrent sends (TOCTOU race). If another request already moved it,
  // updateMany returns count=0 and we reject.
  const lockResult = await prisma.feeQuote.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status: 'SENT', sentAt: new Date() },
  })

  if (lockResult.count === 0) {
    throw new ValidationError('This quote has already been sent or its status changed')
  }

  // Generate PDF
  const pdfData: QuotePdfData = {
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientAddress: quote.clientAddress,
    description: quote.description,
    lineItems: quote.lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.total,
    })),
    netTotal: quote.netTotal,
    taxRate: quote.taxRate,
    taxAmount: quote.taxAmount,
    grossTotal: quote.grossTotal,
    currency: quote.currency,
    validUntil: quote.validUntil?.toISOString() ?? null,
    notes: quote.notes,
    termsAndConditions: quote.termsAndConditions,
    createdAt: quote.createdAt.toISOString(),
    createdByName: quote.createdBy.fullName,
    organisationName: quote.organisation.name,
    projectName: quote.project?.name ?? null,
  }

  const pdfBuffer = await generateQuotePdf(pdfData)
  const filename = `${quote.quoteNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

  // Format currency for email
  const currencySymbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', NGN: '₦' }
  const sym = currencySymbols[quote.currency] || quote.currency + ' '
  const formattedTotal = `${sym}${quote.grossTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  // Send email with PDF attachment
  const { error: emailError } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: quote.clientEmail,
    subject: `Fee Quote ${quote.quoteNumber} — ${quote.organisation.name}`,
    html: buildQuoteEmail({
      clientName: quote.clientName,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      total: formattedTotal,
      validUntil: quote.validUntil
        ? new Date(quote.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
      organisationName: quote.organisation.name,
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
    await prisma.feeQuote.updateMany({
      where: { id, status: 'SENT' },
      data: { status: 'DRAFT', sentAt: null },
    })
    throw new ValidationError(`Failed to send email: ${emailError.message}`)
  }

  // Fetch the updated quote for the response
  const updated = await prisma.feeQuote.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  })

  // Audit + notification — non-fatal (email already sent, status already updated)
  try {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'fee_quote.sent',
      entityType: 'fee_quote',
      entityId: id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        clientEmail: quote.clientEmail,
        grossTotal: quote.grossTotal,
        currency: quote.currency,
      },
    })
  } catch {
    console.error(`[fee-quotes] Audit event failed for quote ${id}`)
  }

  try {
    if (quote.createdBy.id !== profile.id) {
      await createNotification({
        profileId: quote.createdBy.id,
        type: 'project.update',
        title: `Quote ${quote.quoteNumber} sent to ${quote.clientName}`,
        body: `${profile.fullName} sent the fee quote to ${quote.clientEmail}`,
        linkUrl: `/fee-quotes/${id}`,
      })
    }
  } catch {
    console.error(`[fee-quotes] Notification failed for quote ${id}`)
  }

  return success({ quote: updated, emailSent: true })
}, { requiredPermission: 'ADMIN' })

/* ── Email Template ───────────────────────────────────── */

function buildQuoteEmail(params: {
  clientName: string
  quoteNumber: string
  title: string
  total: string
  validUntil: string | null
  organisationName: string
  senderName: string
}): string {
  // Escape all user-supplied strings to prevent HTML injection
  const clientName = escapeHtml(params.clientName)
  const quoteNumber = escapeHtml(params.quoteNumber)
  const title = escapeHtml(params.title)
  const total = escapeHtml(params.total)
  const validUntil = params.validUntil ? escapeHtml(params.validUntil) : null
  const organisationName = escapeHtml(params.organisationName)
  const senderName = escapeHtml(params.senderName)

  const validityLine = validUntil
    ? `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">This quote is valid until <strong>${validUntil}</strong>.</p>`
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
              Please find attached our fee quote <strong>${quoteNumber}</strong> for <strong>${title}</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f4f4f5;border-radius:8px;width:100%;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Total Amount</p>
                  <p style="margin:0;color:#18181b;font-size:24px;font-weight:700;">${total}</p>
                </td>
              </tr>
            </table>
            ${validityLine}
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
              The full quote is attached as a PDF. If you have any questions, please don't hesitate to get in touch.
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
