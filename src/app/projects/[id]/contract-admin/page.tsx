'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  TrendingUp, TrendingDown, DollarSign, FileText, ShieldAlert,
  ChevronRight, Clock, CheckCircle2, XCircle, Eye,
  Package, Gavel, Receipt, BarChart3, AlertOctagon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow, SkeletonCard } from '@/components/Skeleton'

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

type CommercialTab = 'overview' | 'budgets' | 'variations' | 'purchase-orders' | 'tenders' | 'valuations' | 'invoices' | 'risks'

/* ── Summary ────────────────────────────────────────────── */

interface CommercialSummary {
  totalBudget: number
  committed: number
  variationsApproved: number
  invoiced: number
  outstanding: number
  currency: string
  recentActivity: ActivityItem[]
}

interface ActivityItem {
  id: string
  type: 'budget' | 'variation' | 'po' | 'tender' | 'valuation' | 'invoice' | 'risk'
  description: string
  amount: number | null
  user: string
  createdAt: string
}

/* ── Budgets ────────────────────────────────────────────── */

interface BudgetItem {
  id: string
  name: string
  code: string
  totalValue: number
  committed: number
  spent: number
  status: 'DRAFT' | 'APPROVED' | 'REVISED' | 'CLOSED'
  createdAt: string
  approvedBy: string | null
  lines: BudgetLine[]
}

interface BudgetLine {
  id: string
  description: string
  quantity: number
  rate: number
  total: number
  category: string
}

/* ── Variations ─────────────────────────────────────────── */

interface VariationItem {
  id: string
  reference: string
  title: string
  description: string
  reason: 'CLIENT_CHANGE' | 'DESIGN_DEVELOPMENT' | 'SITE_CONDITION' | 'REGULATORY' | 'VALUE_ENGINEERING' | 'OTHER'
  value: number
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
}

/* ── Purchase Orders ────────────────────────────────────── */

interface PurchaseOrderItem {
  id: string
  poNumber: string
  supplier: string
  description: string
  value: number
  status: 'DRAFT' | 'ISSUED' | 'ACKNOWLEDGED' | 'PARTIALLY_DELIVERED' | 'COMPLETED' | 'CANCELLED'
  issuedAt: string | null
  deliveryDate: string | null
  createdAt: string
}

/* ── Tenders ────────────────────────────────────────────── */

interface TenderItem {
  id: string
  packageName: string
  discipline: string
  estimatedValue: number
  status: 'PREPARATION' | 'ISSUED' | 'RETURNED' | 'EVALUATION' | 'AWARDED' | 'CANCELLED'
  issueDate: string | null
  returnDate: string | null
  bidsReceived: number
  awardedTo: string | null
  createdAt: string
}

/* ── Valuations ─────────────────────────────────────────── */

interface ValuationItem {
  id: string
  valuationNumber: number
  period: string
  grossValue: number
  retention: number
  previouslyCertified: number
  thisCertificate: number
  status: 'DRAFT' | 'SUBMITTED' | 'ASSESSED' | 'CERTIFIED' | 'PAID'
  certifiedAt: string | null
  createdAt: string
}

/* ── Invoices ───────────────────────────────────────────── */

interface InvoiceItem {
  id: string
  invoiceNumber: string
  supplier: string
  description: string
  netAmount: number
  vatAmount: number
  grossAmount: number
  status: 'DRAFT' | 'RECEIVED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'DISPUTED' | 'VOID'
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

/* ── Risks ──────────────────────────────────────────────── */

interface RiskItem {
  id: string
  reference: string
  title: string
  description: string
  category: 'COST_OVERRUN' | 'PROGRAMME_DELAY' | 'SCOPE_CHANGE' | 'SUPPLY_CHAIN' | 'REGULATORY' | 'MARKET' | 'OTHER'
  likelihood: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  exposure: number
  mitigation: string
  owner: string
  status: 'OPEN' | 'MITIGATED' | 'CLOSED' | 'ESCALATED'
  createdAt: string
}

/* ══════════════════════════════════════════════════════════
   Constants & Helpers
   ══════════════════════════════════════════════════════════ */

const TABS: { key: CommercialTab; label: string; icon: typeof DollarSign }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'budgets', label: 'Budgets', icon: DollarSign },
  { key: 'variations', label: 'Variations', icon: TrendingUp },
  { key: 'purchase-orders', label: 'Purchase Orders', icon: Package },
  { key: 'tenders', label: 'Tenders', icon: Gavel },
  { key: 'valuations', label: 'Valuations', icon: FileText },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'risks', label: 'Risks', icon: ShieldAlert },
]

const fmt = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const fmtFull = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(iso)
}

function riskScore(likelihood: number, impact: number): number {
  return likelihood * impact
}

function riskScoreColor(score: number): string {
  if (score >= 15) return 'bg-red-600 text-white'
  if (score >= 10) return 'bg-orange-500 text-white'
  if (score >= 5) return 'bg-amber-400 text-amber-900'
  return 'bg-emerald-100 text-emerald-800'
}

/* ── Status badge meta maps ──────────────────────────────── */

const BUDGET_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REVISED: { label: 'Revised', color: 'text-amber-700', bg: 'bg-amber-50' },
  CLOSED: { label: 'Closed', color: 'text-ink-500', bg: 'bg-ink-50' },
}

const VARIATION_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-50' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-700', bg: 'bg-amber-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-500', bg: 'bg-ink-50' },
}

const VARIATION_REASON_LABELS: Record<string, string> = {
  CLIENT_CHANGE: 'Client change',
  DESIGN_DEVELOPMENT: 'Design development',
  SITE_CONDITION: 'Site condition',
  REGULATORY: 'Regulatory',
  VALUE_ENGINEERING: 'Value engineering',
  OTHER: 'Other',
}

const PO_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-50' },
  ISSUED: { label: 'Issued', color: 'text-blue-700', bg: 'bg-blue-50' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-purple-700', bg: 'bg-purple-50' },
  PARTIALLY_DELIVERED: { label: 'Part delivered', color: 'text-amber-700', bg: 'bg-amber-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50' },
}

const TENDER_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PREPARATION: { label: 'Preparation', color: 'text-slate-600', bg: 'bg-slate-50' },
  ISSUED: { label: 'Issued', color: 'text-blue-700', bg: 'bg-blue-50' },
  RETURNED: { label: 'Returned', color: 'text-amber-700', bg: 'bg-amber-50' },
  EVALUATION: { label: 'Evaluation', color: 'text-purple-700', bg: 'bg-purple-50' },
  AWARDED: { label: 'Awarded', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50' },
}

const VALUATION_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-50' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-50' },
  ASSESSED: { label: 'Assessed', color: 'text-amber-700', bg: 'bg-amber-50' },
  CERTIFIED: { label: 'Certified', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PAID: { label: 'Paid', color: 'text-emerald-800', bg: 'bg-emerald-100' },
}

const INVOICE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-50' },
  RECEIVED: { label: 'Received', color: 'text-blue-700', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-700', bg: 'bg-amber-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PAID: { label: 'Paid', color: 'text-emerald-800', bg: 'bg-emerald-100' },
  DISPUTED: { label: 'Disputed', color: 'text-red-700', bg: 'bg-red-50' },
  VOID: { label: 'Void', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const RISK_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: 'text-red-700', bg: 'bg-red-50' },
  MITIGATED: { label: 'Mitigated', color: 'text-amber-700', bg: 'bg-amber-50' },
  CLOSED: { label: 'Closed', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ESCALATED: { label: 'Escalated', color: 'text-red-800', bg: 'bg-red-100' },
}

const RISK_CATEGORY_LABELS: Record<string, string> = {
  COST_OVERRUN: 'Cost overrun',
  PROGRAMME_DELAY: 'Programme delay',
  SCOPE_CHANGE: 'Scope change',
  SUPPLY_CHAIN: 'Supply chain',
  REGULATORY: 'Regulatory',
  MARKET: 'Market',
  OTHER: 'Other',
}

const ACTIVITY_TYPE_ICONS: Record<string, typeof DollarSign> = {
  budget: DollarSign,
  variation: TrendingUp,
  po: Package,
  tender: Gavel,
  valuation: FileText,
  invoice: Receipt,
  risk: ShieldAlert,
}

/* ── Shared badge component ──────────────────────────────── */

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0', bg, color)}>
      {label}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════ */

export default function CommercialPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  /* ── Tab state ──────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<CommercialTab>('overview')

  /* ── Data state per tab ─────────────────────────────── */
  const [summary, setSummary] = useState<CommercialSummary | null>(null)
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [variations, setVariations] = useState<VariationItem[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderItem[]>([])
  const [tenders, setTenders] = useState<TenderItem[]>([])
  const [valuations, setValuations] = useState<ValuationItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [risks, setRisks] = useState<RiskItem[]>([])

  /* ── Loading / error ────────────────────────────────── */
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── Track which tabs have been fetched ─────────────── */
  const [fetched, setFetched] = useState<Set<CommercialTab>>(new Set())

  /* ── Filter state ───────────────────────────────────── */
  const [variationStatusFilter, setVariationStatusFilter] = useState('ALL')
  const [variationReasonFilter, setVariationReasonFilter] = useState('ALL')
  const [poStatusFilter, setPoStatusFilter] = useState('ALL')
  const [tenderStatusFilter, setTenderStatusFilter] = useState('ALL')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL')
  const [riskStatusFilter, setRiskStatusFilter] = useState('ALL')

  /* ── Create form visibility ─────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)

  /* ── Budget detail view ─────────────────────────────── */
  const [selectedBudget, setSelectedBudget] = useState<BudgetItem | null>(null)

  /* ── Permission simulation (would come from auth context) */
  const [userRole] = useState<'viewer' | 'member' | 'manager'>('manager')
  const isManager = userRole === 'manager'

  /* ══════════════════════════════════════════════════════
     Data Fetching
     ══════════════════════════════════════════════════════ */

  const fetchTabData = useCallback(async (tab: CommercialTab, force = false) => {
    if (fetched.has(tab) && !force) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const endpointMap: Record<CommercialTab, string> = {
        overview: `/api/projects/${projectId}/commercial/summary`,
        budgets: `/api/projects/${projectId}/commercial/budgets`,
        variations: `/api/projects/${projectId}/commercial/variations`,
        'purchase-orders': `/api/projects/${projectId}/commercial/purchase-orders`,
        tenders: `/api/projects/${projectId}/commercial/tenders`,
        valuations: `/api/projects/${projectId}/commercial/valuations`,
        invoices: `/api/projects/${projectId}/commercial/invoices`,
        risks: `/api/projects/${projectId}/commercial/risks`,
      }

      const res = await fetch(endpointMap[tab])
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()

      switch (tab) {
        case 'overview': setSummary(json.data); break
        case 'budgets': setBudgets(json.data.budgets ?? json.data ?? []); break
        case 'variations': setVariations(json.data.variations ?? json.data ?? []); break
        case 'purchase-orders': setPurchaseOrders(json.data.purchaseOrders ?? json.data ?? []); break
        case 'tenders': setTenders(json.data.tenders ?? json.data ?? []); break
        case 'valuations': setValuations(json.data.valuations ?? json.data ?? []); break
        case 'invoices': setInvoices(json.data.invoices ?? json.data ?? []); break
        case 'risks': setRisks(json.data.risks ?? json.data ?? []); break
      }

      setFetched((prev) => new Set(prev).add(tab))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId, fetched])

  const refreshCurrentTab = useCallback(() => {
    setFetched((prev) => {
      const next = new Set(prev)
      next.delete(activeTab)
      return next
    })
    fetchTabData(activeTab, true)
  }, [activeTab, fetchTabData])

  useEffect(() => {
    fetchTabData(activeTab)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ══════════════════════════════════════════════════════
     Mutation Hooks
     ══════════════════════════════════════════════════════ */

  const { mutate: createBudget, loading: creatingBudget, error: createBudgetError, clearError: clearBudgetError } =
    useApiMutation<BudgetItem>(`/api/projects/${projectId}/commercial/budgets`, 'POST')
  const { mutate: createVariation, loading: creatingVariation, error: createVariationError, clearError: clearVariationError } =
    useApiMutation<VariationItem>(`/api/projects/${projectId}/commercial/variations`, 'POST')
  const { mutate: createPO, loading: creatingPO, error: createPOError, clearError: clearPOError } =
    useApiMutation<PurchaseOrderItem>(`/api/projects/${projectId}/commercial/purchase-orders`, 'POST')
  const { mutate: createTender, loading: creatingTender, error: createTenderError, clearError: clearTenderError } =
    useApiMutation<TenderItem>(`/api/projects/${projectId}/commercial/tenders`, 'POST')
  const { mutate: createValuation, loading: creatingValuation, error: createValuationError, clearError: clearValuationError } =
    useApiMutation<ValuationItem>(`/api/projects/${projectId}/commercial/valuations`, 'POST')
  const { mutate: createInvoice, loading: creatingInvoice, error: createInvoiceError, clearError: clearInvoiceError } =
    useApiMutation<InvoiceItem>(`/api/projects/${projectId}/commercial/invoices`, 'POST')
  const { mutate: createRisk, loading: creatingRisk, error: createRiskError, clearError: clearRiskError } =
    useApiMutation<RiskItem>(`/api/projects/${projectId}/commercial/risks`, 'POST')

  /* ══════════════════════════════════════════════════════
     Create Form State
     ══════════════════════════════════════════════════════ */

  /* Budget form */
  const [budgetName, setBudgetName] = useState('')
  const [budgetCode, setBudgetCode] = useState('')
  const [budgetValue, setBudgetValue] = useState('')

  /* Variation form */
  const [varTitle, setVarTitle] = useState('')
  const [varDescription, setVarDescription] = useState('')
  const [varReason, setVarReason] = useState('CLIENT_CHANGE')
  const [varValue, setVarValue] = useState('')

  /* PO form */
  const [poSupplier, setPoSupplier] = useState('')
  const [poDescription, setPoDescription] = useState('')
  const [poValue, setPoValue] = useState('')
  const [poDeliveryDate, setPoDeliveryDate] = useState('')

  /* Tender form */
  const [tenderPackage, setTenderPackage] = useState('')
  const [tenderDiscipline, setTenderDiscipline] = useState('')
  const [tenderEstimate, setTenderEstimate] = useState('')
  const [tenderReturnDate, setTenderReturnDate] = useState('')

  /* Valuation form */
  const [valPeriod, setValPeriod] = useState('')
  const [valGross, setValGross] = useState('')
  const [valRetention, setValRetention] = useState('')
  const [valPrevious, setValPrevious] = useState('')

  /* Invoice form */
  const [invNumber, setInvNumber] = useState('')
  const [invSupplier, setInvSupplier] = useState('')
  const [invDescription, setInvDescription] = useState('')
  const [invNet, setInvNet] = useState('')
  const [invVat, setInvVat] = useState('')
  const [invDueDate, setInvDueDate] = useState('')

  /* Risk form */
  const [riskTitle, setRiskTitle] = useState('')
  const [riskDescription, setRiskDescription] = useState('')
  const [riskCategory, setRiskCategory] = useState('COST_OVERRUN')
  const [riskLikelihood, setRiskLikelihood] = useState('3')
  const [riskImpact, setRiskImpact] = useState('3')
  const [riskExposure, setRiskExposure] = useState('')
  const [riskMitigation, setRiskMitigation] = useState('')
  const [riskOwner, setRiskOwner] = useState('')

  /* ── Form reset ─────────────────────────────────────── */

  const resetForms = () => {
    setShowCreateForm(false)
    setBudgetName(''); setBudgetCode(''); setBudgetValue('')
    setVarTitle(''); setVarDescription(''); setVarReason('CLIENT_CHANGE'); setVarValue('')
    setPoSupplier(''); setPoDescription(''); setPoValue(''); setPoDeliveryDate('')
    setTenderPackage(''); setTenderDiscipline(''); setTenderEstimate(''); setTenderReturnDate('')
    setValPeriod(''); setValGross(''); setValRetention(''); setValPrevious('')
    setInvNumber(''); setInvSupplier(''); setInvDescription(''); setInvNet(''); setInvVat(''); setInvDueDate('')
    setRiskTitle(''); setRiskDescription(''); setRiskCategory('COST_OVERRUN')
    setRiskLikelihood('3'); setRiskImpact('3'); setRiskExposure(''); setRiskMitigation(''); setRiskOwner('')
    clearBudgetError(); clearVariationError(); clearPOError(); clearTenderError()
    clearValuationError(); clearInvoiceError(); clearRiskError()
  }

  /* ══════════════════════════════════════════════════════
     Create Handlers
     ══════════════════════════════════════════════════════ */

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await createBudget({
      name: budgetName.trim(),
      code: budgetCode.trim(),
      totalValue: parseFloat(budgetValue),
    })
    if (result) {
      toast('Budget created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await createVariation({
      title: varTitle.trim(),
      description: varDescription.trim(),
      reason: varReason,
      value: parseFloat(varValue),
    })
    if (result) {
      toast('Variation created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      supplier: poSupplier.trim(),
      description: poDescription.trim(),
      value: parseFloat(poValue),
    }
    if (poDeliveryDate) body.deliveryDate = poDeliveryDate
    const result = await createPO(body)
    if (result) {
      toast('Purchase order created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      packageName: tenderPackage.trim(),
      discipline: tenderDiscipline.trim(),
      estimatedValue: parseFloat(tenderEstimate),
    }
    if (tenderReturnDate) body.returnDate = tenderReturnDate
    const result = await createTender(body)
    if (result) {
      toast('Tender package created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreateValuation = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await createValuation({
      period: valPeriod.trim(),
      grossValue: parseFloat(valGross),
      retention: parseFloat(valRetention || '0'),
      previouslyCertified: parseFloat(valPrevious || '0'),
    })
    if (result) {
      toast('Valuation created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      invoiceNumber: invNumber.trim(),
      supplier: invSupplier.trim(),
      description: invDescription.trim(),
      netAmount: parseFloat(invNet),
      vatAmount: parseFloat(invVat || '0'),
    }
    if (invDueDate) body.dueDate = invDueDate
    const result = await createInvoice(body)
    if (result) {
      toast('Invoice created', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  const handleCreateRisk = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await createRisk({
      title: riskTitle.trim(),
      description: riskDescription.trim(),
      category: riskCategory,
      likelihood: parseInt(riskLikelihood),
      impact: parseInt(riskImpact),
      exposure: parseFloat(riskExposure || '0'),
      mitigation: riskMitigation.trim(),
      owner: riskOwner.trim(),
    })
    if (result) {
      toast('Risk added to register', 'success')
      resetForms()
      refreshCurrentTab()
    }
  }

  /* ══════════════════════════════════════════════════════
     Approve / Reject handlers
     ══════════════════════════════════════════════════════ */

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleApproveReject = async (type: string, id: string, action: 'approve' | 'reject') => {
    setActionLoading(id)
    try {
      const endpointMap: Record<string, string> = {
        variation: `/api/projects/${projectId}/commercial/variations`,
        invoice: `/api/projects/${projectId}/commercial/invoices`,
        budget: `/api/projects/${projectId}/commercial/budgets`,
      }
      const status = action === 'approve'
        ? (type === 'variation' ? 'APPROVED' : type === 'invoice' ? 'APPROVED' : 'APPROVED')
        : (type === 'variation' ? 'REJECTED' : type === 'invoice' ? 'DISPUTED' : 'DRAFT')

      const res = await fetch(`${endpointMap[type]}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error?.message || `Failed (${res.status})`)
      }
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} ${action}d`, 'success')
      refreshCurrentTab()
    } catch (err) {
      toast(err instanceof Error ? err.message : `${action} failed`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  /* ══════════════════════════════════════════════════════
     Shared UI Helpers
     ══════════════════════════════════════════════════════ */

  const inputClass = 'w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300'
  const selectClass = cn(inputClass, 'bg-white')
  const labelClass = 'block text-[11px] font-medium text-ink-500 mb-1'

  /* ══════════════════════════════════════════════════════
     Loading State
     ══════════════════════════════════════════════════════ */

  if (loading && !fetched.has(activeTab)) {
    return (
      <div className="space-y-5">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <div key={t.key} className="h-9 w-28 bg-ink-100 animate-pulse rounded-lg shrink-0" />
          ))}
        </div>
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     Error State
     ══════════════════════════════════════════════════════ */

  if (error) {
    return (
      <div className="space-y-5">
        {/* Still show tab bar on error so user can switch */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => { setError(null); setActiveTab(t.key) }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors shrink-0',
                  activeTab === t.key ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-[13px] text-ink-600">{error}</p>
          <button onClick={refreshCurrentTab} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════ */

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Commercial</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            Contract administration, budgets, variations and cost management
          </p>
        </div>
        {activeTab !== 'overview' && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New {TABS.find(t => t.key === activeTab)?.label.replace(/s$/, '').toLowerCase()}
          </button>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => { resetForms(); setActiveTab(t.key); setSelectedBudget(null) }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors shrink-0',
                activeTab === t.key ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════
         TAB: Overview
         ══════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Budget', value: summary?.totalBudget ?? 0, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Committed', value: summary?.committed ?? 0, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Variations', value: summary?.variationsApproved ?? 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Invoiced', value: summary?.invoiced ?? 0, icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Outstanding', value: summary?.outstanding ?? 0, icon: AlertOctagon, color: summary?.outstanding && summary.outstanding > 0 ? 'text-red-600' : 'text-ink-500', bg: summary?.outstanding && summary.outstanding > 0 ? 'bg-red-50' : 'bg-ink-50' },
            ].map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="bg-white rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bg)}>
                      <Icon className={cn('w-4.5 h-4.5', card.color)} />
                    </div>
                    <div>
                      <p className="text-[17px] font-semibold text-ink-900">{fmt(card.value, summary?.currency)}</p>
                      <p className="text-[11px] text-ink-400">{card.label}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Budget utilisation bar */}
          {summary && summary.totalBudget > 0 && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-ink-900">Budget Utilisation</h3>
                <span className="text-[12px] text-ink-400">
                  {((summary.committed / summary.totalBudget) * 100).toFixed(1)}% committed
                </span>
              </div>
              <div className="w-full h-3 bg-ink-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${Math.min((summary.invoiced / summary.totalBudget) * 100, 100)}%` }}
                  title={`Invoiced: ${fmt(summary.invoiced)}`}
                />
                <div
                  className="bg-blue-400 h-full transition-all"
                  style={{ width: `${Math.min(((summary.committed - summary.invoiced) / summary.totalBudget) * 100, 100)}%` }}
                  title={`Committed (uninvoiced): ${fmt(summary.committed - summary.invoiced)}`}
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${Math.min((summary.variationsApproved / summary.totalBudget) * 100, 100)}%` }}
                  title={`Variations: ${fmt(summary.variationsApproved)}`}
                />
              </div>
              <div className="flex items-center gap-5 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Invoiced
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Committed
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Variations
                </span>
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="px-5 py-3 border-b border-ink-100">
              <h3 className="text-[13px] font-semibold text-ink-900">Recent Activity</h3>
            </div>
            {(!summary?.recentActivity || summary.recentActivity.length === 0) ? (
              <div className="p-8 text-center">
                <Clock className="w-8 h-8 text-ink-200 mx-auto mb-2" />
                <p className="text-[13px] text-ink-400">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {summary.recentActivity.map((item) => {
                  const Icon = ACTIVITY_TYPE_ICONS[item.type] || FileText
                  return (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-ink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-ink-900 truncate">{item.description}</p>
                        <p className="text-[11px] text-ink-400">{item.user}</p>
                      </div>
                      {item.amount !== null && (
                        <span className="text-[12px] font-medium text-ink-700 shrink-0">{fmt(item.amount, summary.currency)}</span>
                      )}
                      <span className="text-[11px] text-ink-400 shrink-0 w-16 text-right">{timeAgo(item.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Budgets
         ══════════════════════════════════════════════════ */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateBudget} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Budget</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Name <span className="text-red-400">*</span></label>
                  <input type="text" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} placeholder="e.g. Main Contract Budget" className={inputClass} required autoFocus maxLength={200} />
                </div>
                <div className="w-40">
                  <label className={labelClass}>Code <span className="text-red-400">*</span></label>
                  <input type="text" value={budgetCode} onChange={(e) => setBudgetCode(e.target.value)} placeholder="e.g. BUD-001" className={inputClass} required maxLength={50} />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Total Value <span className="text-red-400">*</span></label>
                  <input type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} placeholder="0.00" className={inputClass} required min="0" step="0.01" />
                </div>
              </div>
              {createBudgetError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createBudgetError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingBudget}>Cancel</button>
                <button type="submit" disabled={creatingBudget || !budgetName.trim() || !budgetCode.trim() || !budgetValue}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingBudget || !budgetName.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingBudget && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create budget
                </button>
              </div>
            </form>
          )}

          {/* Budget detail view */}
          {selectedBudget ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedBudget(null)} className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-700 transition-colors">
                <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back to budgets
              </button>
              <div className="bg-white rounded-xl border border-ink-100 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink-900">{selectedBudget.name}</h3>
                    <p className="text-[12px] text-ink-400 mt-0.5">{selectedBudget.code}</p>
                  </div>
                  <StatusBadge {...(BUDGET_STATUS_META[selectedBudget.status] ?? BUDGET_STATUS_META.DRAFT)} />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-surface-50 rounded-lg p-3">
                    <p className="text-[11px] text-ink-400">Total Value</p>
                    <p className="text-[15px] font-semibold text-ink-900">{fmt(selectedBudget.totalValue)}</p>
                  </div>
                  <div className="bg-surface-50 rounded-lg p-3">
                    <p className="text-[11px] text-ink-400">Committed</p>
                    <p className="text-[15px] font-semibold text-ink-900">{fmt(selectedBudget.committed)}</p>
                  </div>
                  <div className="bg-surface-50 rounded-lg p-3">
                    <p className="text-[11px] text-ink-400">Spent</p>
                    <p className="text-[15px] font-semibold text-ink-900">{fmt(selectedBudget.spent)}</p>
                  </div>
                </div>
                {/* Cost plan lines */}
                {selectedBudget.lines && selectedBudget.lines.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-semibold text-ink-700 mb-2">Cost Plan Lines</h4>
                    <div className="border border-ink-100 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-50 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                        <div className="col-span-5">Description</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-1 text-right">Qty</div>
                        <div className="col-span-2 text-right">Rate</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      <div className="divide-y divide-ink-50">
                        {selectedBudget.lines.map((line) => (
                          <div key={line.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[13px]">
                            <div className="col-span-5 text-ink-900 truncate">{line.description}</div>
                            <div className="col-span-2 text-ink-500">{line.category}</div>
                            <div className="col-span-1 text-right text-ink-700">{line.quantity}</div>
                            <div className="col-span-2 text-right text-ink-700">{fmtFull(line.rate)}</div>
                            <div className="col-span-2 text-right font-medium text-ink-900">{fmtFull(line.total)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Budget list */
            budgets.length === 0 ? (
              <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                <DollarSign className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-ink-600">No budgets yet</p>
                <p className="text-[12px] text-ink-400 mt-1">Create a budget to start tracking project costs.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                  <div className="col-span-4">Budget</div>
                  <div className="col-span-2 text-right">Total Value</div>
                  <div className="col-span-2 text-right">Committed</div>
                  <div className="col-span-2 text-right">Spent</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-ink-50">
                  {budgets.map((b) => {
                    const meta = BUDGET_STATUS_META[b.status] ?? BUDGET_STATUS_META.DRAFT
                    const utilPct = b.totalValue > 0 ? (b.spent / b.totalValue) * 100 : 0
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBudget(b)}
                        className="w-full grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center text-left"
                      >
                        <div className="sm:col-span-4 min-w-0">
                          <p className="text-[13px] font-medium text-ink-900 truncate">{b.name}</p>
                          <p className="text-[11px] text-ink-400">{b.code}</p>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className="text-[13px] font-medium text-ink-900">{fmt(b.totalValue)}</span>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className="text-[13px] text-ink-700">{fmt(b.committed)}</span>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className={cn('text-[13px] font-medium', utilPct > 90 ? 'text-red-600' : 'text-ink-700')}>{fmt(b.spent)}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <StatusBadge {...meta} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Variations
         ══════════════════════════════════════════════════ */}
      {activeTab === 'variations' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateVariation} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Variation</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className={labelClass}>Title <span className="text-red-400">*</span></label>
                <input type="text" value={varTitle} onChange={(e) => setVarTitle(e.target.value)} placeholder="e.g. Additional drainage works" className={inputClass} required autoFocus maxLength={300} />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={varDescription} onChange={(e) => setVarDescription(e.target.value)} placeholder="Detail the scope of the variation..." className={cn(inputClass, 'min-h-[80px]')} maxLength={5000} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Reason <span className="text-red-400">*</span></label>
                  <select value={varReason} onChange={(e) => setVarReason(e.target.value)} className={selectClass}>
                    {Object.entries(VARIATION_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="w-48">
                  <label className={labelClass}>Value <span className="text-red-400">*</span></label>
                  <input type="number" value={varValue} onChange={(e) => setVarValue(e.target.value)} placeholder="0.00" className={inputClass} required step="0.01" />
                </div>
              </div>
              {createVariationError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createVariationError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingVariation}>Cancel</button>
                <button type="submit" disabled={creatingVariation || !varTitle.trim() || !varValue}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingVariation || !varTitle.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingVariation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create variation
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((s) => (
                <button key={s} onClick={() => setVariationStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    variationStatusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')}>
                  {s === 'ALL' ? 'All' : (VARIATION_STATUS_META[s]?.label ?? s)}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <select value={variationReasonFilter} onChange={(e) => setVariationReasonFilter(e.target.value)}
                className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300">
                <option value="ALL">All reasons</option>
                {Object.entries(VARIATION_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* List */}
          {(() => {
            let filtered = variations
            if (variationStatusFilter !== 'ALL') filtered = filtered.filter(v => v.status === variationStatusFilter)
            if (variationReasonFilter !== 'ALL') filtered = filtered.filter(v => v.reason === variationReasonFilter)

            if (filtered.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <TrendingUp className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No variations found</p>
                  <p className="text-[12px] text-ink-400 mt-1">Create a variation or adjust the filters.</p>
                </div>
              )
            }

            return (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filtered.map((v) => {
                  const meta = VARIATION_STATUS_META[v.status] ?? VARIATION_STATUS_META.DRAFT
                  const canApprove = isManager && (v.status === 'SUBMITTED' || v.status === 'UNDER_REVIEW')
                  return (
                    <div key={v.id} className="px-5 py-4 hover:bg-surface-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-ink-400">{v.reference}</span>
                            <p className="text-[13px] font-medium text-ink-900 truncate">{v.title}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-ink-500">{VARIATION_REASON_LABELS[v.reason] ?? v.reason}</span>
                            {v.submittedAt && <span className="text-[11px] text-ink-400">Submitted {formatShortDate(v.submittedAt)}</span>}
                          </div>
                        </div>
                        <span className={cn('text-[14px] font-semibold shrink-0', v.value >= 0 ? 'text-ink-900' : 'text-red-600')}>
                          {v.value >= 0 ? '+' : ''}{fmt(v.value)}
                        </span>
                        <StatusBadge {...meta} />
                        {canApprove && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleApproveReject('variation', v.id, 'approve')} disabled={actionLoading === v.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => handleApproveReject('variation', v.id, 'reject')} disabled={actionLoading === v.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Purchase Orders
         ══════════════════════════════════════════════════ */}
      {activeTab === 'purchase-orders' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreatePO} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Purchase Order</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Supplier <span className="text-red-400">*</span></label>
                  <input type="text" value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} placeholder="e.g. ABC Contractors Ltd" className={inputClass} required autoFocus maxLength={200} />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Value <span className="text-red-400">*</span></label>
                  <input type="number" value={poValue} onChange={(e) => setPoValue(e.target.value)} placeholder="0.00" className={inputClass} required min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Description <span className="text-red-400">*</span></label>
                <input type="text" value={poDescription} onChange={(e) => setPoDescription(e.target.value)} placeholder="e.g. Structural steel supply and delivery" className={inputClass} required maxLength={500} />
              </div>
              <div className="w-48">
                <label className={labelClass}>Expected Delivery</label>
                <input type="date" value={poDeliveryDate} onChange={(e) => setPoDeliveryDate(e.target.value)} className={inputClass} />
              </div>
              {createPOError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createPOError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingPO}>Cancel</button>
                <button type="submit" disabled={creatingPO || !poSupplier.trim() || !poDescription.trim() || !poValue}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingPO || !poSupplier.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingPO && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create PO
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'COMPLETED', 'CANCELLED'].map((s) => (
                <button key={s} onClick={() => setPoStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    poStatusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')}>
                  {s === 'ALL' ? 'All' : (PO_STATUS_META[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {(() => {
            const filtered = poStatusFilter === 'ALL' ? purchaseOrders : purchaseOrders.filter(p => p.status === poStatusFilter)

            if (filtered.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <Package className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No purchase orders found</p>
                  <p className="text-[12px] text-ink-400 mt-1">Create a PO or adjust the filters.</p>
                </div>
              )
            }

            return (
              <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                  <div className="col-span-1">PO #</div>
                  <div className="col-span-3">Supplier</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-2 text-right">Value</div>
                  <div className="col-span-1">Delivery</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-ink-50">
                  {filtered.map((po) => {
                    const meta = PO_STATUS_META[po.status] ?? PO_STATUS_META.DRAFT
                    return (
                      <div key={po.id} className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center">
                        <div className="sm:col-span-1"><span className="text-[12px] font-mono text-ink-500">{po.poNumber}</span></div>
                        <div className="sm:col-span-3"><span className="text-[13px] font-medium text-ink-900 truncate">{po.supplier}</span></div>
                        <div className="sm:col-span-3"><span className="text-[12px] text-ink-600 truncate">{po.description}</span></div>
                        <div className="sm:col-span-2 text-right"><span className="text-[13px] font-medium text-ink-900">{fmt(po.value)}</span></div>
                        <div className="sm:col-span-1"><span className="text-[11px] text-ink-400">{po.deliveryDate ? formatShortDate(po.deliveryDate) : '--'}</span></div>
                        <div className="sm:col-span-2"><StatusBadge {...meta} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Tenders
         ══════════════════════════════════════════════════ */}
      {activeTab === 'tenders' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateTender} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Tender Package</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Package Name <span className="text-red-400">*</span></label>
                  <input type="text" value={tenderPackage} onChange={(e) => setTenderPackage(e.target.value)} placeholder="e.g. Mechanical Services" className={inputClass} required autoFocus maxLength={200} />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Discipline <span className="text-red-400">*</span></label>
                  <input type="text" value={tenderDiscipline} onChange={(e) => setTenderDiscipline(e.target.value)} placeholder="e.g. MEP" className={inputClass} required maxLength={100} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-48">
                  <label className={labelClass}>Estimated Value <span className="text-red-400">*</span></label>
                  <input type="number" value={tenderEstimate} onChange={(e) => setTenderEstimate(e.target.value)} placeholder="0.00" className={inputClass} required min="0" step="0.01" />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Return Date</label>
                  <input type="date" value={tenderReturnDate} onChange={(e) => setTenderReturnDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              {createTenderError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createTenderError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingTender}>Cancel</button>
                <button type="submit" disabled={creatingTender || !tenderPackage.trim() || !tenderDiscipline.trim() || !tenderEstimate}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingTender || !tenderPackage.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingTender && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create tender
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'PREPARATION', 'ISSUED', 'RETURNED', 'EVALUATION', 'AWARDED', 'CANCELLED'].map((s) => (
                <button key={s} onClick={() => setTenderStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    tenderStatusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')}>
                  {s === 'ALL' ? 'All' : (TENDER_STATUS_META[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {(() => {
            const filtered = tenderStatusFilter === 'ALL' ? tenders : tenders.filter(t => t.status === tenderStatusFilter)

            if (filtered.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <Gavel className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No tender packages found</p>
                  <p className="text-[12px] text-ink-400 mt-1">Create a tender package to begin procurement.</p>
                </div>
              )
            }

            return (
              <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                  <div className="col-span-3">Package</div>
                  <div className="col-span-2">Discipline</div>
                  <div className="col-span-2 text-right">Estimate</div>
                  <div className="col-span-1 text-center">Bids</div>
                  <div className="col-span-2">Return Date</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-ink-50">
                  {filtered.map((t) => {
                    const meta = TENDER_STATUS_META[t.status] ?? TENDER_STATUS_META.PREPARATION
                    return (
                      <div key={t.id} className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center">
                        <div className="sm:col-span-3 min-w-0">
                          <p className="text-[13px] font-medium text-ink-900 truncate">{t.packageName}</p>
                          {t.awardedTo && <p className="text-[11px] text-emerald-600 mt-0.5">Awarded: {t.awardedTo}</p>}
                        </div>
                        <div className="sm:col-span-2"><span className="text-[12px] text-ink-600">{t.discipline}</span></div>
                        <div className="sm:col-span-2 text-right"><span className="text-[13px] font-medium text-ink-900">{fmt(t.estimatedValue)}</span></div>
                        <div className="sm:col-span-1 text-center"><span className="text-[12px] text-ink-600">{t.bidsReceived}</span></div>
                        <div className="sm:col-span-2"><span className="text-[11px] text-ink-400">{t.returnDate ? formatDate(t.returnDate) : '--'}</span></div>
                        <div className="sm:col-span-2"><StatusBadge {...meta} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Valuations
         ══════════════════════════════════════════════════ */}
      {activeTab === 'valuations' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateValuation} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Valuation</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Period <span className="text-red-400">*</span></label>
                  <input type="text" value={valPeriod} onChange={(e) => setValPeriod(e.target.value)} placeholder="e.g. July 2026" className={inputClass} required autoFocus maxLength={100} />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Gross Value <span className="text-red-400">*</span></label>
                  <input type="number" value={valGross} onChange={(e) => setValGross(e.target.value)} placeholder="0.00" className={inputClass} required min="0" step="0.01" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-48">
                  <label className={labelClass}>Retention (%)</label>
                  <input type="number" value={valRetention} onChange={(e) => setValRetention(e.target.value)} placeholder="0.00" className={inputClass} min="0" step="0.01" />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Previously Certified</label>
                  <input type="number" value={valPrevious} onChange={(e) => setValPrevious(e.target.value)} placeholder="0.00" className={inputClass} min="0" step="0.01" />
                </div>
              </div>
              {createValuationError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createValuationError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingValuation}>Cancel</button>
                <button type="submit" disabled={creatingValuation || !valPeriod.trim() || !valGross}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingValuation || !valPeriod.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingValuation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create valuation
                </button>
              </div>
            </form>
          )}

          {/* List */}
          {valuations.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <FileText className="w-10 h-10 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No valuations yet</p>
              <p className="text-[12px] text-ink-400 mt-1">Create an interim valuation to track progress payments.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-1">No.</div>
                <div className="col-span-2">Period</div>
                <div className="col-span-2 text-right">Gross Value</div>
                <div className="col-span-2 text-right">Retention</div>
                <div className="col-span-2 text-right">This Certificate</div>
                <div className="col-span-1">Certified</div>
                <div className="col-span-2">Status</div>
              </div>
              <div className="divide-y divide-ink-50">
                {valuations.map((v) => {
                  const meta = VALUATION_STATUS_META[v.status] ?? VALUATION_STATUS_META.DRAFT
                  return (
                    <div key={v.id} className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center">
                      <div className="sm:col-span-1"><span className="text-[13px] font-semibold text-ink-700">#{v.valuationNumber}</span></div>
                      <div className="sm:col-span-2"><span className="text-[13px] text-ink-900">{v.period}</span></div>
                      <div className="sm:col-span-2 text-right"><span className="text-[13px] text-ink-700">{fmt(v.grossValue)}</span></div>
                      <div className="sm:col-span-2 text-right"><span className="text-[13px] text-ink-500">{fmt(v.retention)}</span></div>
                      <div className="sm:col-span-2 text-right"><span className="text-[13px] font-medium text-ink-900">{fmt(v.thisCertificate)}</span></div>
                      <div className="sm:col-span-1"><span className="text-[11px] text-ink-400">{v.certifiedAt ? formatShortDate(v.certifiedAt) : '--'}</span></div>
                      <div className="sm:col-span-2"><StatusBadge {...meta} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Invoices
         ══════════════════════════════════════════════════ */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateInvoice} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Invoice</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="w-40">
                  <label className={labelClass}>Invoice # <span className="text-red-400">*</span></label>
                  <input type="text" value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="e.g. INV-001" className={inputClass} required autoFocus maxLength={50} />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Supplier <span className="text-red-400">*</span></label>
                  <input type="text" value={invSupplier} onChange={(e) => setInvSupplier(e.target.value)} placeholder="e.g. ABC Contractors Ltd" className={inputClass} required maxLength={200} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Description <span className="text-red-400">*</span></label>
                <input type="text" value={invDescription} onChange={(e) => setInvDescription(e.target.value)} placeholder="e.g. Interim payment application #3" className={inputClass} required maxLength={500} />
              </div>
              <div className="flex gap-4">
                <div className="w-48">
                  <label className={labelClass}>Net Amount <span className="text-red-400">*</span></label>
                  <input type="number" value={invNet} onChange={(e) => setInvNet(e.target.value)} placeholder="0.00" className={inputClass} required min="0" step="0.01" />
                </div>
                <div className="w-48">
                  <label className={labelClass}>VAT Amount</label>
                  <input type="number" value={invVat} onChange={(e) => setInvVat(e.target.value)} placeholder="0.00" className={inputClass} min="0" step="0.01" />
                </div>
                <div className="w-48">
                  <label className={labelClass}>Due Date</label>
                  <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              {createInvoiceError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createInvoiceError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingInvoice}>Cancel</button>
                <button type="submit" disabled={creatingInvoice || !invNumber.trim() || !invSupplier.trim() || !invNet}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingInvoice || !invNumber.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingInvoice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create invoice
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'PAID', 'DISPUTED', 'VOID'].map((s) => (
                <button key={s} onClick={() => setInvoiceStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    invoiceStatusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')}>
                  {s === 'ALL' ? 'All' : (INVOICE_STATUS_META[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {(() => {
            const filtered = invoiceStatusFilter === 'ALL' ? invoices : invoices.filter(i => i.status === invoiceStatusFilter)

            if (filtered.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <Receipt className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No invoices found</p>
                  <p className="text-[12px] text-ink-400 mt-1">Create an invoice or adjust the filters.</p>
                </div>
              )
            }

            return (
              <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                  <div className="col-span-1">Inv #</div>
                  <div className="col-span-2">Supplier</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1 text-right">Net</div>
                  <div className="col-span-1 text-right">Gross</div>
                  <div className="col-span-1">Due</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Actions</div>
                </div>
                <div className="divide-y divide-ink-50">
                  {filtered.map((inv) => {
                    const meta = INVOICE_STATUS_META[inv.status] ?? INVOICE_STATUS_META.DRAFT
                    const isOverdue = inv.dueDate && inv.status !== 'PAID' && inv.status !== 'VOID' && new Date(inv.dueDate) < new Date()
                    const canApproveInv = isManager && (inv.status === 'RECEIVED' || inv.status === 'UNDER_REVIEW')
                    return (
                      <div key={inv.id} className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center">
                        <div className="sm:col-span-1"><span className="text-[12px] font-mono text-ink-500">{inv.invoiceNumber}</span></div>
                        <div className="sm:col-span-2"><span className="text-[13px] font-medium text-ink-900 truncate">{inv.supplier}</span></div>
                        <div className="sm:col-span-3"><span className="text-[12px] text-ink-600 truncate">{inv.description}</span></div>
                        <div className="sm:col-span-1 text-right"><span className="text-[13px] text-ink-700">{fmt(inv.netAmount)}</span></div>
                        <div className="sm:col-span-1 text-right"><span className="text-[13px] font-medium text-ink-900">{fmt(inv.grossAmount)}</span></div>
                        <div className="sm:col-span-1">
                          <span className={cn('text-[11px]', isOverdue ? 'text-red-600 font-medium' : 'text-ink-400')}>
                            {inv.dueDate ? formatShortDate(inv.dueDate) : '--'}
                          </span>
                        </div>
                        <div className="sm:col-span-1"><StatusBadge {...meta} /></div>
                        <div className="sm:col-span-2">
                          {canApproveInv && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleApproveReject('invoice', inv.id, 'approve')} disabled={actionLoading === inv.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                              <button onClick={() => handleApproveReject('invoice', inv.id, 'reject')} disabled={actionLoading === inv.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors">
                                <XCircle className="w-3 h-3" /> Dispute
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Risks
         ══════════════════════════════════════════════════ */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateRisk} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Commercial Risk</h3>
                <button type="button" onClick={resetForms} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className={labelClass}>Title <span className="text-red-400">*</span></label>
                <input type="text" value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} placeholder="e.g. Steel price escalation" className={inputClass} required autoFocus maxLength={300} />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={riskDescription} onChange={(e) => setRiskDescription(e.target.value)} placeholder="Describe the risk and its potential effects..." className={cn(inputClass, 'min-h-[80px]')} maxLength={5000} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Category <span className="text-red-400">*</span></label>
                  <select value={riskCategory} onChange={(e) => setRiskCategory(e.target.value)} className={selectClass}>
                    {Object.entries(RISK_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className={labelClass}>Likelihood (1-5)</label>
                  <select value={riskLikelihood} onChange={(e) => setRiskLikelihood(e.target.value)} className={selectClass}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} - {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'][n - 1]}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className={labelClass}>Impact (1-5)</label>
                  <select value={riskImpact} onChange={(e) => setRiskImpact(e.target.value)} className={selectClass}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} - {['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'][n - 1]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-48">
                  <label className={labelClass}>Financial Exposure</label>
                  <input type="number" value={riskExposure} onChange={(e) => setRiskExposure(e.target.value)} placeholder="0.00" className={inputClass} min="0" step="0.01" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Owner</label>
                  <input type="text" value={riskOwner} onChange={(e) => setRiskOwner(e.target.value)} placeholder="e.g. QS Lead" className={inputClass} maxLength={200} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mitigation</label>
                <textarea value={riskMitigation} onChange={(e) => setRiskMitigation(e.target.value)} placeholder="Describe mitigation measures..." className={cn(inputClass, 'min-h-[60px]')} maxLength={5000} />
              </div>
              {createRiskError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createRiskError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetForms} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingRisk}>Cancel</button>
                <button type="submit" disabled={creatingRisk || !riskTitle.trim()}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingRisk || !riskTitle.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingRisk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add risk
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'OPEN', 'MITIGATED', 'ESCALATED', 'CLOSED'].map((s) => (
                <button key={s} onClick={() => setRiskStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    riskStatusFilter === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')}>
                  {s === 'ALL' ? 'All' : (RISK_STATUS_META[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          {/* Risk matrix */}
          {risks.length > 0 && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              <h3 className="text-[13px] font-semibold text-ink-900 mb-3">Likelihood / Impact Matrix</h3>
              <div className="grid grid-cols-6 gap-1">
                {/* Header row */}
                <div className="text-[10px] text-ink-400 text-center py-1" />
                {['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'].map((label, i) => (
                  <div key={label} className="text-[10px] text-ink-400 text-center py-1">{label}</div>
                ))}
                {/* Matrix rows */}
                {[5, 4, 3, 2, 1].map((l) => (
                  <>
                    <div key={`l-${l}`} className="text-[10px] text-ink-400 text-right pr-2 py-2">
                      {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'][l - 1]}
                    </div>
                    {[1, 2, 3, 4, 5].map((imp) => {
                      const score = l * imp
                      const count = risks.filter(r => r.likelihood === l && r.impact === imp && (riskStatusFilter === 'ALL' || r.status === riskStatusFilter)).length
                      return (
                        <div key={`${l}-${imp}`} className={cn(
                          'rounded text-center py-2 text-[12px] font-medium min-h-[36px] flex items-center justify-center',
                          score >= 15 ? 'bg-red-100 text-red-800' :
                          score >= 10 ? 'bg-orange-100 text-orange-800' :
                          score >= 5 ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-50 text-emerald-700',
                        )}>
                          {count > 0 ? count : ''}
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>
          )}

          {/* List */}
          {(() => {
            const filtered = riskStatusFilter === 'ALL' ? risks : risks.filter(r => r.status === riskStatusFilter)

            if (filtered.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <ShieldAlert className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No commercial risks found</p>
                  <p className="text-[12px] text-ink-400 mt-1">Add risks to the register to track commercial threats.</p>
                </div>
              )
            }

            return (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filtered.map((r) => {
                  const meta = RISK_STATUS_META[r.status] ?? RISK_STATUS_META.OPEN
                  const score = riskScore(r.likelihood, r.impact)
                  return (
                    <div key={r.id} className="px-5 py-4 hover:bg-surface-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Risk score badge */}
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold', riskScoreColor(score))}>
                          {score}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-ink-400">{r.reference}</span>
                            <p className="text-[13px] font-medium text-ink-900 truncate">{r.title}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[11px] text-ink-500">{RISK_CATEGORY_LABELS[r.category] ?? r.category}</span>
                            <span className="text-[11px] text-ink-400">L:{r.likelihood} I:{r.impact}</span>
                            {r.exposure > 0 && (
                              <span className="text-[11px] font-medium text-red-600">Exposure: {fmt(r.exposure)}</span>
                            )}
                            {r.owner && <span className="text-[11px] text-ink-400">Owner: {r.owner}</span>}
                          </div>
                          {r.mitigation && (
                            <p className="text-[11px] text-ink-500 mt-1.5 line-clamp-2">Mitigation: {r.mitigation}</p>
                          )}
                        </div>
                        <StatusBadge {...meta} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
