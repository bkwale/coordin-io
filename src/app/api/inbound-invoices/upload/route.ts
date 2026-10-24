import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ValidationError } from '@/lib/errors'
import { parseUBLInvoice } from '@/lib/invoicing/parsers/ubl-parser'
import { parsePdfInvoices, parseImageInvoices } from '@/lib/invoicing/parsers/pdf-parser'
import { applyRules, detectReverseCharge } from '@/lib/invoicing/rules-engine'
import type { ParsedInvoice } from '@/lib/invoicing/parsers/ubl-parser'
import type { CategorisationRule } from '@/lib/invoicing/rules-engine'
import type { InboundInvoiceSource, InboundDocumentType, Currency } from '@/generated/prisma/client'
import { Prisma } from '@/generated/prisma/client'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/xml', 'text/xml',
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
]

/**
 * POST /api/inbound-invoices/upload — Upload and parse an invoice file.
 *
 * Accepts: UBL XML (Peppol), PDF, or image.
 * Returns the created invoice(s) with parsed line items and auto-categorisation.
 *
 * ADMIN/OWNER only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) throw new ValidationError('Invoicing feature is not enabled')

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new ValidationError('Only admins and owners can upload invoices')
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file) throw new ValidationError('No file provided')
  if (file.size > MAX_FILE_SIZE) throw new ValidationError('File exceeds 10 MB limit')
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.xml')) {
    throw new ValidationError(`Unsupported file type: ${file.type}. Accepted: XML, PDF, JPEG, PNG, WebP`)
  }

  // Verify project if provided
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId: profile.organisationId },
    })
    if (!project) throw new ValidationError('Project not found in this organisation')
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Determine source type and parse
  let parsedInvoices: ParsedInvoice[]
  let source: InboundInvoiceSource

  if (file.type === 'application/xml' || file.type === 'text/xml' || file.name.endsWith('.xml')) {
    // UBL XML
    source = 'PEPPOL'
    const xmlString = buffer.toString('utf-8')
    const parsed = parseUBLInvoice(xmlString)
    parsedInvoices = [parsed]
  } else if (file.type === 'application/pdf') {
    // PDF — may contain multiple invoices
    source = 'PDF_UPLOAD'
    parsedInvoices = await parsePdfInvoices(buffer)
  } else {
    // Image
    source = 'IMAGE_UPLOAD'
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    parsedInvoices = await parseImageInvoices(buffer, mimeType)
  }

  if (parsedInvoices.length === 0) {
    throw new ValidationError('No invoices could be extracted from this file')
  }

  // Load categorisation rules for the org
  const dbRules = await prisma.categorisationRule.findMany({
    where: { organisationId: profile.organisationId, active: true },
    orderBy: { priority: 'desc' },
  })
  const rules: CategorisationRule[] = dbRules.map((r) => ({
    id: r.id,
    organisationId: r.organisationId,
    projectId: r.projectId,
    supplierId: r.supplierId,
    keyword: r.keyword,
    accountCode: r.accountCode,
    priority: r.priority,
    active: r.active,
  }))

  // Process all parsed invoices in a single transaction for atomicity
  const createdInvoices = await prisma.$transaction(async (tx) => {
    const results = []
    for (const parsed of parsedInvoices) {
      // Try to match supplier by VAT number
      let matchedSupplierId: string | null = null
      if (parsed.supplier.vatNumber) {
        const supplier = await tx.supplier.findFirst({
          where: { organisationId: profile.organisationId, vatNumber: parsed.supplier.vatNumber },
        })
        if (supplier) matchedSupplierId = supplier.id
      }

      // Auto-detect reverse charge
      const reverseCharge = parsed.reverseCharge || detectReverseCharge(parsed)

      // Apply categorisation rules
      const categorised = applyRules(rules, matchedSupplierId, projectId, parsed)

      // Map currency — default to EUR if not in our enum
      const currencyMap: Record<string, Currency> = {
        EUR: 'EUR', GBP: 'GBP', USD: 'USD', NGN: 'NGN',
      }
      const currency = currencyMap[parsed.currency] || 'EUR'

      // Map document type
      const documentType: InboundDocumentType = parsed.documentType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'INVOICE'

      // Determine initial status
      const status = categorised.overallConfidence >= 0.8 ? 'CATEGORISED' : 'RECEIVED'

      const invoice = await tx.inboundInvoice.create({
        data: {
          organisationId: profile.organisationId,
          supplierId: matchedSupplierId,
          projectId: projectId || null,
          invoiceNumber: parsed.invoiceNumber || `UPLOAD-${Date.now()}`,
          documentType,
          invoiceDate: parsed.invoiceDate,
          dueDate: parsed.dueDate,
          currency,
          netAmount: parsed.netAmount,
          vatAmount: parsed.vatAmount,
          grossAmount: parsed.grossAmount,
          reverseCharge,
          vatExemptionReason: parsed.vatExemptionReason,
          vatBreakdown: parsed.vatBreakdown as unknown as Prisma.InputJsonValue,
          source,
          parsedSupplierName: parsed.supplier.name || null,
          parsedSupplierVat: parsed.supplier.vatNumber || null,
          parsedBuyerName: parsed.buyer.name || null,
          parsedBuyerVat: parsed.buyer.vatNumber || null,
          linkedInvoiceNumber: parsed.linkedInvoiceNumber,
          overallConfidence: categorised.overallConfidence,
          unmatchedLines: categorised.unmatched,
          status,
          rawXml: source === 'PEPPOL' ? buffer.toString('utf-8') : null,
          parseErrors: parsed.errors.length > 0 ? (parsed.errors as unknown as Prisma.InputJsonValue) : undefined,
          createdById: profile.id,
          lineItems: {
            create: categorised.lineItems.map((item, idx) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              lineTotal: item.lineTotal,
              vatExemptionReason: item.vatExemptionReason,
              accountCode: item.accountCode,
              suggestedAccountCode: item.suggestedAccountCode,
              accountCodeConfidence: item.accountCodeConfidence,
              ruleId: item.ruleId,
              sortOrder: idx,
            })),
          },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
      })

      results.push(invoice)
    }
    return results
  })

  return success({
    invoices: createdInvoices,
    count: createdInvoices.length,
    source,
  }, 201)
}, { requiredPermission: 'MANAGER' })
