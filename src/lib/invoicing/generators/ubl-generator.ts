/**
 * UBL 2.1 Invoice Generator — outbound counterpart to ubl-parser.ts
 *
 * Generates UBL 2.1 XML invoices (Peppol standard) from outbound invoice data.
 * Pure generation logic — no database dependencies.
 */

export interface UBLInvoiceData {
  invoiceNumber: string
  invoiceDate: string // ISO date string YYYY-MM-DD
  dueDate?: string | null
  currency: string
  documentType: 'INVOICE' | 'CREDIT_NOTE'

  supplier: {
    name: string
    vatNumber?: string | null
    address?: string | null
    country?: string | null // ISO 3166-1 alpha-2
    peppolId?: string | null
  }

  buyer: {
    name: string
    vatNumber?: string | null
    address?: string | null
    country?: string | null
    peppolId?: string | null
    email?: string | null
  }

  lineItems: UBLLineItem[]

  netAmount: number
  vatAmount: number
  grossAmount: number
  taxRate: number // e.g. 20 for 20%

  notes?: string | null
  paymentTerms?: string | null
}

export interface UBLLineItem {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number // percentage, e.g. 20
  lineTotal: number
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(n: number): string {
  return n.toFixed(2)
}

function formatDate(dateStr: string): string {
  // Ensure YYYY-MM-DD format
  return dateStr.substring(0, 10)
}

/**
 * Generate a UBL 2.1 XML invoice string.
 *
 * Follows the Peppol BIS Billing 3.0 profile for maximum interoperability.
 */
export function generateUBLInvoice(data: UBLInvoiceData): string {
  const isCreditNote = data.documentType === 'CREDIT_NOTE'
  const rootTag = isCreditNote ? 'CreditNote' : 'Invoice'
  const rootNs = isCreditNote
    ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    : 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
  const quantityTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity'
  const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine'
  const typeCode = isCreditNote ? '381' : '380'

  const supplierCountry = data.supplier.country || 'GB'
  const buyerCountry = data.buyer.country || 'GB'

  const lines = data.lineItems
    .map(
      (item, index) => `
    <cac:${lineTag}>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:${quantityTag} unitCode="EA">${formatAmount(item.quantity)}</cbc:${quantityTag}>
      <cbc:LineExtensionAmount currencyID="${escapeXml(data.currency)}">${formatAmount(item.lineTotal)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${formatAmount(item.lineTotal * (item.vatRate / 100))}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${escapeXml(data.currency)}">${formatAmount(item.lineTotal)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${formatAmount(item.lineTotal * (item.vatRate / 100))}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>${formatAmount(item.vatRate)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${formatAmount(item.vatRate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(data.currency)}">${formatAmount(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:${lineTag}>`,
    )
    .join('')

  const notesSection = data.notes
    ? `\n  <cbc:Note>${escapeXml(data.notes)}</cbc:Note>`
    : ''

  const dueDateSection = data.dueDate
    ? `\n  <cbc:DueDate>${formatDate(data.dueDate)}</cbc:DueDate>`
    : ''

  const supplierVatSection = data.supplier.vatNumber
    ? `
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${escapeXml(data.supplier.vatNumber)}</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>`
    : ''

  const supplierPeppolSection = data.supplier.peppolId
    ? `\n          <cbc:EndpointID schemeID="0088">${escapeXml(data.supplier.peppolId)}</cbc:EndpointID>`
    : ''

  const buyerVatSection = data.buyer.vatNumber
    ? `
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${escapeXml(data.buyer.vatNumber)}</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>`
    : ''

  const buyerPeppolSection = data.buyer.peppolId
    ? `\n          <cbc:EndpointID schemeID="0088">${escapeXml(data.buyer.peppolId)}</cbc:EndpointID>`
    : ''

  const buyerContactSection = data.buyer.email
    ? `
          <cac:Contact>
            <cbc:ElectronicMail>${escapeXml(data.buyer.email)}</cbc:ElectronicMail>
          </cac:Contact>`
    : ''

  const paymentTermsSection = data.paymentTerms
    ? `
  <cac:PaymentTerms>
    <cbc:Note>${escapeXml(data.paymentTerms)}</cbc:Note>
  </cac:PaymentTerms>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag}
  xmlns="${rootNs}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${formatDate(data.invoiceDate)}</cbc:IssueDate>${dueDateSection}
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>${notesSection}
  <cbc:DocumentCurrencyCode>${escapeXml(data.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>${supplierPeppolSection}
      <cac:PartyName>
        <cbc:Name>${escapeXml(data.supplier.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${data.supplier.address ? `<cbc:StreetName>${escapeXml(data.supplier.address)}</cbc:StreetName>` : '<cbc:StreetName/>'}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(supplierCountry)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${supplierVatSection}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(data.supplier.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>${buyerPeppolSection}
      <cac:PartyName>
        <cbc:Name>${escapeXml(data.buyer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${data.buyer.address ? `<cbc:StreetName>${escapeXml(data.buyer.address)}</cbc:StreetName>` : '<cbc:StreetName/>'}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(buyerCountry)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${buyerVatSection}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(data.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>${buyerContactSection}
    </cac:Party>
  </cac:AccountingCustomerParty>${paymentTermsSection}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.netAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.vatAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${formatAmount(data.taxRate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.netAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.netAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.grossAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escapeXml(data.currency)}">${formatAmount(data.grossAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</${rootTag}>`
}
