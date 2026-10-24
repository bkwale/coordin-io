import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { generateInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf'

function extractId(url: string): string {
  const match = url.match(/\/outbound-invoices\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Invoice not found')
  return match[1]
}

/**
 * GET /api/outbound-invoices/[id]/pdf — Generate and download the invoice as a PDF.
 *
 * MANAGER+ can download.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
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
  const uint8 = new Uint8Array(pdfBuffer)

  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
    },
  })
})
