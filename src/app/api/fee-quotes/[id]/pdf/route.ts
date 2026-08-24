import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError } from '@/lib/errors'
import { generateQuotePdf, type QuotePdfData } from '@/lib/quote-pdf'

function extractId(url: string): string {
  const match = url.match(/\/fee-quotes\/([^/?]+)/)
  if (!match?.[1]) throw new NotFoundError('Fee quote not found')
  return match[1]
}

/**
 * GET /api/fee-quotes/[id]/pdf — Generate and download the quote as a PDF.
 *
 * MANAGER+ can download.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
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
  const uint8 = new Uint8Array(pdfBuffer)

  const filename = `${quote.quoteNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
    },
  })
}, { requiredPermission: 'MANAGER' })
