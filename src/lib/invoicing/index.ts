/**
 * Coordin.io Invoicing Module
 *
 * Extracted from Morway (morway.app) — Wale Koleosho's e-invoicing tool.
 * Adapted for construction/architecture PM context.
 *
 * Provides:
 * - UBL 2.1 XML parsing (Peppol standard)
 * - PDF/image/DOCX invoice parsing via AI
 * - Accounting adapter interface (Xero, DATEV, Exact Online, etc.)
 * - Confidence-based categorisation rules engine
 * - Reverse charge / VAT exemption detection
 *
 * Dependencies to add to package.json:
 *   xmldom, xpath, @anthropic-ai/sdk, unpdf
 *
 * Optional dependencies:
 *   mammoth (for .docx parsing), xlsx (for spreadsheet parsing)
 */

// ─── Parsers ─────────────────────────────────────────────────────────────────
export { parseUBLInvoice } from './parsers/ubl-parser'
export type {
  ParsedInvoice,
  ParsedLineItem,
  VatBreakdownEntry,
  DocumentType,
} from './parsers/ubl-parser'

export {
  parsePdfInvoices,
  parsePdfInvoice,
  parseImageInvoices,
  computeVatBreakdown,
} from './parsers/pdf-parser'

// ─── Accounting Adapters ─────────────────────────────────────────────────────
export { getAdapter } from './accounting'
export type {
  AccountingAdapter,
  BillPayload,
  BillLineItem,
  PostResult,
  ContactResult,
} from './accounting'
export type { AccountingSystem } from './accounting'

// ─── Rules Engine ────────────────────────────────────────────────────────────
export { applyRules, detectReverseCharge } from './rules-engine'
export type {
  RuleMatch,
  RulesEngineResult,
  CategorisationRule,
} from './rules-engine'
