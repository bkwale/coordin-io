/**
 * Invoice Categorisation Rules Engine — adapted from Morway for Coordin
 *
 * Confidence-based categorisation hierarchy:
 *   1. Supplier + keyword match → 0.95 confidence
 *   2. Supplier default (no keyword) → 0.85 confidence
 *   3. Project keyword match → 0.75 confidence
 *   4. Organisation keyword match → 0.6 confidence
 *   5. AI-suggested (from parser) → discounted to 0.7× original
 *
 * TODO: Wire to Coordin's Prisma schema. Needs a `categorisation_rules` table:
 *   - id, organisationId, projectId?, supplierId?, keyword?, accountCode, priority, active
 */

import type { ParsedInvoice, ParsedLineItem } from './parsers/ubl-parser'

export interface RuleMatch {
  accountCode: string
  ruleId: string
  confidence: number
  reason: string
}

export interface RulesEngineResult {
  lineItems: Array<ParsedLineItem & { accountCode: string | null; ruleId: string | null }>
  overallConfidence: number
  matches: RuleMatch[]
  unmatched: number
}

export interface CategorisationRule {
  id: string
  organisationId: string
  projectId: string | null
  supplierId: string | null
  keyword: string | null
  accountCode: string
  priority: number
  active: boolean
}

/**
 * Apply categorisation rules to a parsed invoice.
 * Rules are evaluated in priority order (highest first).
 *
 * In Coordin context: "client" becomes "project", "firm" becomes "organisation"
 */
export function applyRules(
  rules: CategorisationRule[],
  supplierId: string | null,
  projectId: string | null,
  invoice: ParsedInvoice
): RulesEngineResult {
  // Filter inactive rules, then sort by priority descending
  const sortedRules = [...rules].filter((r) => r.active).sort((a, b) => b.priority - a.priority)

  const matches: RuleMatch[] = []
  let matchedCount = 0

  const enrichedLineItems = invoice.lineItems.map((item) => {
    const match = findBestRule(sortedRules, item, supplierId, projectId)

    if (match) {
      matchedCount++
      matches.push(match)
      return { ...item, accountCode: match.accountCode, ruleId: match.ruleId }
    }

    // Fall back to AI-suggested account code from parsing step
    if (item.suggestedAccountCode) {
      const aiConfidence = item.accountCodeConfidence ?? 0.5
      matchedCount++
      matches.push({
        accountCode: item.suggestedAccountCode,
        ruleId: 'AI_SUGGESTED',
        confidence: aiConfidence * 0.7,
        reason: `AI suggested: ${item.suggestedAccountCode} (${Math.round(aiConfidence * 100)}% confidence)`,
      })
      return { ...item, accountCode: item.suggestedAccountCode, ruleId: 'AI_SUGGESTED' }
    }

    return { ...item, accountCode: null, ruleId: null }
  })

  const totalItems = Math.max(enrichedLineItems.length, 1)
  const overallConfidence = matchedCount / totalItems

  return {
    lineItems: enrichedLineItems,
    overallConfidence,
    matches,
    unmatched: totalItems - matchedCount,
  }
}

function findBestRule(
  rules: CategorisationRule[],
  item: ParsedLineItem,
  supplierId: string | null,
  projectId: string | null
): RuleMatch | null {
  // 1. Supplier + keyword match (highest specificity)
  if (supplierId) {
    const supplierKeywordMatch = rules.find(
      (r) =>
        r.supplierId === supplierId &&
        r.keyword &&
        item.description.toLowerCase().includes(r.keyword.toLowerCase())
    )
    if (supplierKeywordMatch) {
      return {
        accountCode: supplierKeywordMatch.accountCode,
        ruleId: supplierKeywordMatch.id,
        confidence: 0.95,
        reason: `Supplier + keyword match: "${supplierKeywordMatch.keyword}"`,
      }
    }

    // 2. Supplier default (no keyword)
    const supplierDefault = rules.find(
      (r) => r.supplierId === supplierId && !r.keyword
    )
    if (supplierDefault) {
      return {
        accountCode: supplierDefault.accountCode,
        ruleId: supplierDefault.id,
        confidence: 0.85,
        reason: `Supplier default: ${supplierDefault.accountCode}`,
      }
    }
  }

  // 3. Project keyword match
  if (projectId) {
    const projectKeywordMatch = rules.find(
      (r) =>
        !r.supplierId &&
        r.projectId === projectId &&
        r.keyword &&
        item.description.toLowerCase().includes(r.keyword.toLowerCase())
    )
    if (projectKeywordMatch) {
      return {
        accountCode: projectKeywordMatch.accountCode,
        ruleId: projectKeywordMatch.id,
        confidence: 0.75,
        reason: `Project keyword match: "${projectKeywordMatch.keyword}"`,
      }
    }
  }

  // 4. Organisation-wide keyword match
  const orgKeywordMatch = rules.find(
    (r) =>
      !r.supplierId &&
      !r.projectId &&
      r.keyword &&
      item.description.toLowerCase().includes(r.keyword.toLowerCase())
  )
  if (orgKeywordMatch) {
    return {
      accountCode: orgKeywordMatch.accountCode,
      ruleId: orgKeywordMatch.id,
      confidence: 0.6,
      reason: `Organisation keyword match: "${orgKeywordMatch.keyword}"`,
    }
  }

  return null
}

/**
 * Detect reverse charge from parsed invoice data.
 * Cross-border B2B within the EU: both parties have VAT numbers,
 * different country prefixes, and VAT amount is 0 or negligible.
 */
export function detectReverseCharge(parsed: ParsedInvoice): boolean {
  const supplierVat = parsed.supplier.vatNumber
  const buyerVat = parsed.buyer.vatNumber

  if (!supplierVat || !buyerVat) return false

  const supplierCountry = supplierVat.slice(0, 2).toUpperCase()
  const buyerCountry = buyerVat.slice(0, 2).toUpperCase()
  if (supplierCountry === buyerCountry) return false

  if (parsed.netAmount > 0 && parsed.vatAmount / parsed.netAmount < 0.01) {
    return true
  }

  return false
}
