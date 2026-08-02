import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'

/**
 * GET /api/projects/[id]/commercial/summary — Aggregated commercial summary.
 *
 * Returns:
 * - Total budget (approved + latest draft)
 * - Committed spend (POs issued/acknowledged/delivered)
 * - Variations (approved total + pending total)
 * - Invoiced (total gross, paid, outstanding)
 * - Valuations (latest cumulative, net payable)
 * - Risk exposure (open risks estimated amount)
 * - Tender summary (active tenders, awarded value)
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  // Run all aggregations in parallel
  const [
    budgetAgg,
    approvedBudgetAgg,
    poAgg,
    approvedVariationAgg,
    pendingVariationAgg,
    invoiceAgg,
    paidInvoiceAgg,
    latestValuation,
    riskAgg,
    tenderCounts,
    awardedTenderAgg,
  ] = await Promise.all([
    // Latest budget total (any status)
    prisma.budget.aggregate({
      where: { projectId },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),

    // Approved budget total
    prisma.budget.aggregate({
      where: { projectId, status: 'APPROVED' },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),

    // Committed spend — POs that are issued, acknowledged, or delivered
    prisma.purchaseOrder.aggregate({
      where: {
        projectId,
        status: { in: ['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'DELIVERED'] },
      },
      _sum: { amount: true, taxAmount: true },
      _count: { id: true },
    }),

    // Approved variations
    prisma.variation.aggregate({
      where: { projectId, status: 'APPROVED' },
      _sum: { amount: true },
      _count: { id: true },
    }),

    // Pending variations (submitted or under review)
    prisma.variation.aggregate({
      where: { projectId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      _sum: { amount: true },
      _count: { id: true },
    }),

    // All invoices (excluding cancelled/written off)
    prisma.invoice.aggregate({
      where: {
        projectId,
        status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] },
      },
      _sum: { grossAmount: true, netAmount: true, taxAmount: true },
      _count: { id: true },
    }),

    // Paid invoices
    prisma.invoice.aggregate({
      where: { projectId, status: 'PAID' },
      _sum: { paidAmount: true },
      _count: { id: true },
    }),

    // Latest valuation
    prisma.valuation.findFirst({
      where: { projectId },
      orderBy: { valuationNumber: 'desc' },
    }),

    // Open risk exposure
    prisma.commercialRisk.aggregate({
      where: { projectId, status: { in: ['OPEN', 'ESCALATED'] } },
      _sum: { amount: true },
      _count: { id: true },
    }),

    // Active tenders count
    prisma.tender.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),

    // Awarded tender returns — recommended returns from awarded tenders
    prisma.tenderReturn.aggregate({
      where: {
        tender: { projectId, status: 'AWARDED' },
        recommended: true,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ])

  const totalInvoiced = invoiceAgg._sum.grossAmount ?? 0
  const totalPaid = paidInvoiceAgg._sum.paidAmount ?? 0

  const tenderStatusMap = (tenderCounts as Array<{ status: string; _count: { id: number } }>).reduce<Record<string, number>>(
    (acc: Record<string, number>, row: { status: string; _count: { id: number } }) => {
      acc[row.status] = row._count.id
      return acc
    },
    {},
  )

  const summary = {
    budget: {
      totalBudgeted: budgetAgg._sum.totalAmount ?? 0,
      budgetCount: budgetAgg._count.id,
      approvedTotal: approvedBudgetAgg._sum.totalAmount ?? 0,
      approvedCount: approvedBudgetAgg._count.id,
    },
    committed: {
      poTotal: poAgg._sum.amount ?? 0,
      poTaxTotal: poAgg._sum.taxAmount ?? 0,
      poCount: poAgg._count.id,
    },
    variations: {
      approvedTotal: approvedVariationAgg._sum.amount ?? 0,
      approvedCount: approvedVariationAgg._count.id,
      pendingTotal: pendingVariationAgg._sum.amount ?? 0,
      pendingCount: pendingVariationAgg._count.id,
    },
    invoicing: {
      totalInvoiced,
      totalNet: invoiceAgg._sum.netAmount ?? 0,
      totalTax: invoiceAgg._sum.taxAmount ?? 0,
      invoiceCount: invoiceAgg._count.id,
      totalPaid,
      paidCount: paidInvoiceAgg._count.id,
      outstanding: totalInvoiced - totalPaid,
    },
    valuations: {
      latestNumber: latestValuation?.valuationNumber ?? 0,
      latestPeriod: latestValuation?.period ?? null,
      cumulativeGross: latestValuation?.grossValuation ?? 0,
      latestNetPayable: latestValuation?.netPayable ?? 0,
      retentionHeld: latestValuation?.retentionAmount ?? 0,
    },
    risks: {
      openExposure: riskAgg._sum.amount ?? 0,
      openCount: riskAgg._count.id,
    },
    tenders: {
      statusBreakdown: tenderStatusMap,
      awardedValue: awardedTenderAgg._sum.amount ?? 0,
      awardedCount: awardedTenderAgg._count.id,
    },
  }

  return success({ summary })
})
