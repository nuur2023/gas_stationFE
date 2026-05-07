import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import {
  useGetAccountingPeriodsQuery,
  useGetAccountsQuery,
  useGetBalanceSheetReportQuery,
  useGetBusinessesQuery,
  useGetCapitalStatementReportQuery,
  useGetCustomerBalancesReportQuery,
  useGetGeneralLedgerReportQuery,
  useGetProfitLossReportQuery,
  useGetReportPeriodViewQuery,
  useGetStationsQuery,
  useGetSupplierBalancesReportQuery,
  useGetTrialBalanceReportQuery,
} from '../../app/api/apiSlice'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { isAccountsPayable, isAccountsReceivable } from '../../lib/accountingSubledger'
import { formatDecimal, formatDecimalSigned } from '../../lib/formatNumber'
import {
  filterAccountsForFinancialReportsPicker,
  filterAccountsForViewer,
  filterBusinessLeafAccounts,
} from '../../lib/accountScope'
import { cn } from '../../lib/cn'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import { BalanceSheetReportView } from './BalanceSheetReportView'
import { CapitalStatementReportView } from './CapitalStatementReportView'
import { ProfitLossReportView } from './ProfitLossReportView'

type ReportKind =
  | 'trial'
  | 'ledger'
  | 'pl'
  | 'bs'
  | 'capital'
  | 'customer'
  | 'supplier'
  | 'daily-cash-flow'
  | 'period-view'

const REPORT_KINDS: ReportKind[] = [
  'trial',
  'ledger',
  'pl',
  'bs',
  'capital',
  'customer',
  'supplier',
  'daily-cash-flow',
  'period-view',
]

function parseKindParam(v: string | null): ReportKind | null {
  if (!v) return null
  return REPORT_KINDS.includes(v as ReportKind) ? (v as ReportKind) : null
}

/** Journal entry scope for trial balance, income statement, and balance sheet (URL `?view=`). */
type FinancialEntryView = 'adjusted' | 'unadjusted' | 'postclosing'

const FINANCIAL_ENTRY_VIEWS: readonly FinancialEntryView[] = ['unadjusted', 'adjusted', 'postclosing']

function parseFinancialEntryViewParam(v: string | null): FinancialEntryView | null {
  if (!v) return null
  return FINANCIAL_ENTRY_VIEWS.includes(v as FinancialEntryView) ? (v as FinancialEntryView) : null
}

function entryViewReportTitle(
  kind: 'trial' | 'pl' | 'bs' | 'capital' | 'ledger' | 'cashflow',
  view: FinancialEntryView,
): string {
  const cap =
    view === 'postclosing' ? 'Post-closing' : view === 'adjusted' ? 'Adjusted' : 'Unadjusted'
  if (kind === 'trial') return `${cap} trial balance`
  if (kind === 'bs') return `${cap} balance sheet`
  if (kind === 'capital') return `${cap} capital statement`
  if (kind === 'ledger') return `${cap} general ledger`
  if (kind === 'cashflow') return `${cap} cash flow statement`
  return `${cap} income statement`
}

function signedLedgerAmountClass(value: number): string {
  if (!Number.isFinite(value)) return 'text-slate-500'
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-slate-700'
}

function EntryViewTabs({
  value,
  onChange,
}: {
  value: FinancialEntryView
  onChange: (v: FinancialEntryView) => void
}) {
  const tabs: { id: FinancialEntryView; label: string }[] = [
    { id: 'unadjusted', label: 'Unadjusted' },
    { id: 'adjusted', label: 'Adjusted' },
    { id: 'postclosing', label: 'Post-closing' },
  ]
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function reportKindFromPathname(pathname: string): ReportKind | null {
  switch (pathname) {
    case '/financial-reports/trial-balance':
      return 'trial'
    case '/financial-reports/general-ledger':
      return 'ledger'
    case '/financial-reports/profit-and-loss':
      return 'pl'
    case '/financial-reports/balance-sheet':
      return 'bs'
    case '/financial-reports/capital-statement':
      return 'capital'
    case '/financial-reports/customer-balances':
      return 'customer'
    case '/financial-reports/supplier-balances':
      return 'supplier'
    case '/financial-reports/daily-cash-flow':
      return 'daily-cash-flow'
    case '/financial-reports/report-period-view':
      return 'period-view'
    default:
      return null
  }
}

/** yyyy-MM-dd in local calendar; used as default From/To on financial reports. */
function defaultReportDate(): string {
  return new Date().toISOString().slice(0, 10)
}

type PeriodRowLite = { periodStart: string; periodEnd: string; status: number }

/** Prefer open period containing local today; else latest open period by end date; else latest period by end date. */
function pickAccountingPeriodDateRange(rows: PeriodRowLite[]): { from: string; to: string } | null {
  if (!rows.length) return null
  const open = rows.filter((r) => r.status === 0)
  const list = open.length > 0 ? open : rows
  const t = new Date()
  const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  const inRange = list.find((r) => {
    const a = r.periodStart.slice(0, 10)
    const b = r.periodEnd.slice(0, 10)
    return a <= todayStr && todayStr <= b
  })
  const pick = inRange ?? [...list].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]
  if (!pick) return null
  return { from: pick.periodStart.slice(0, 10), to: pick.periodEnd.slice(0, 10) }
}

function formatReportPeriod(from: string, to: string): string {
  if (!from && !to) return 'All periods'
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  try {
    if (from && to) {
      const a = new Date(`${from}T12:00:00`)
      const b = new Date(`${to}T12:00:00`)
      return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`
    }
    if (from) return `From ${new Date(`${from}T12:00:00`).toLocaleDateString(undefined, o)}`
    return `Through ${new Date(`${to}T12:00:00`).toLocaleDateString(undefined, o)}`
  } catch {
    return 'Selected period'
  }
}

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

function buildSimpleReportPdf(
  title: string,
  periodLabel: string,
  head: string[],
  body: Array<Array<string | number>>,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, margin, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(periodLabel || 'All periods', margin, 58)

  autoTable(doc, {
    startY: 72,
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
    headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 40 },
    didDrawPage: ({ pageNumber }) => {
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`Page ${pageNumber}`, pageW - margin, pageH - 16, { align: 'right' })
    },
  })

  openPdfInNewTab(doc)
}

function addPdfSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(31, 41, 55)
  doc.text(title, margin, y)
  return y + 10
}

interface TrialBalanceRow {
  id: number
  code: string
  name: string
  debit: number
  credit: number
  balance: number
}

/** Customer sub-ledger row; columns mirror trial balance (code / name / debit-like / credit-like / balance). */
interface CustomerBalanceRow {
  id: number
  code: string
  name: string
  given: number
  paid: number
  balance: number
}

export function FinancialReportsPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canView: routeCanView } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessIdRaw = useAppSelector((s) => s.auth.businessId)
  const authBusinessId = authBusinessIdRaw ?? 0
  const isSuperAdmin = role === 'SuperAdmin'
  const effectiveStationId = useEffectiveStationId()
  const showStationPicker = showStationPickerInForms(role)
  const needsReportStation = !showStationPicker && (effectiveStationId == null || effectiveStationId <= 0)
  const showSettingsStationHint = adminNeedsSettingsStation(role, effectiveStationId)
  const reportStationBlockedMessage = needsReportStation
    ? showSettingsStationHint
      ? SETTINGS_STATION_HINT
      : 'Your account has no station assigned. Contact an administrator.'
    : null

  const reportStationId = (stateId: number | null) =>
    showStationPicker ? (stateId != null && stateId > 0 ? stateId : undefined) : effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : undefined

  const urlKind =
    reportKindFromPathname(location.pathname) ?? parseKindParam(searchParams.get('kind'))
  const [kind, setKind] = useState<ReportKind>(urlKind ?? 'trial')

  useEffect(() => {
    const k =
      reportKindFromPathname(location.pathname) ?? parseKindParam(searchParams.get('kind'))
    if (k) setKind(k)
  }, [location.pathname, searchParams])

  const [from, setFrom] = useState(defaultReportDate)
  const [to, setTo] = useState(defaultReportDate)
  const [periodViewClosedPeriod, setPeriodViewClosedPeriod] = useState<string | null>(null)
  const [periodIncludeIncome, setPeriodIncludeIncome] = useState(true)
  const [periodIncludeBalanceSheet, setPeriodIncludeBalanceSheet] = useState(true)
  const [periodIncludeCashFlow, setPeriodIncludeCashFlow] = useState(true)
  const [bsAsOf, setBsAsOf] = useState('')
  const [trialBusinessId, setTrialBusinessId] = useState<number | null>(null)
  const [trialStationId, setTrialStationId] = useState<number | null>(null)
  const [trialPage, setTrialPage] = useState(1)
  const [trialPageSize, setTrialPageSize] = useState(50)
  const [trialSearch, setTrialSearch] = useState('')
  const [trialSelected, setTrialSelected] = useState<Set<number>>(new Set())
  const financialEntryView = useMemo((): FinancialEntryView | null => {
    if (
      kind !== 'trial' &&
      kind !== 'pl' &&
      kind !== 'bs' &&
      kind !== 'capital' &&
      kind !== 'ledger' &&
      kind !== 'daily-cash-flow' &&
      kind !== 'period-view'
    )
      return null
    return parseFinancialEntryViewParam(searchParams.get('view')) ?? 'adjusted'
  }, [kind, searchParams])

  const setFinancialEntryView = useCallback(
    (v: FinancialEntryView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('view', v)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  /** URL `view` when on a report that supports entry tabs; otherwise defaults to adjusted. */
  const effectiveReportTrialBalanceMode = financialEntryView ?? 'adjusted'

  const [plBusinessId, setPlBusinessId] = useState<number | null>(null)
  const [plStationId, setPlStationId] = useState<number | null>(null)
  const [ledgerBusinessId, setLedgerBusinessId] = useState<number | null>(null)
  const [ledgerStationId, setLedgerStationId] = useState<number | null>(null)
  const [ledgerAccountId, setLedgerAccountId] = useState<number | null>(null)

  const accountIdFromUrl = useMemo(() => {
    const raw = searchParams.get('accountId')
    if (!raw) return null
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])

  const businessIdFromUrl = useMemo(() => {
    const raw = searchParams.get('businessId')
    if (!raw) return null
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])
  const [bsBusinessId, setBsBusinessId] = useState<number | null>(null)
  const [bsStationId, setBsStationId] = useState<number | null>(null)
  const [customerBusinessId, setCustomerBusinessId] = useState<number | null>(null)
  const [customerStationId, setCustomerStationId] = useState<number | null>(null)
  const [customerPage, setCustomerPage] = useState(1)
  const [customerPageSize, setCustomerPageSize] = useState(50)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerFrom, setCustomerFrom] = useState('')
  const [customerTo, setCustomerTo] = useState('')
  const [customerReceivableAccountId, setCustomerReceivableAccountId] = useState<number | null>(null)
  const [customerApplied, setCustomerApplied] = useState<{
    businessId: number
    stationId?: number
    from?: string
    to?: string
    receivableAccountId: number
  } | null>(null)
  const [customerSelected, setCustomerSelected] = useState<Set<number>>(new Set())

  const [supplierBusinessId, setSupplierBusinessId] = useState<number | null>(null)
  const [supplierStationId, setSupplierStationId] = useState<number | null>(null)
  const [supplierFrom, setSupplierFrom] = useState('')
  const [supplierTo, setSupplierTo] = useState('')
  const [supplierPayableAccountId, setSupplierPayableAccountId] = useState<number | null>(null)
  const [supplierApplied, setSupplierApplied] = useState<{
    businessId: number
    stationId?: number
    from?: string
    to?: string
    payableAccountId: number
  } | null>(null)
  const [supplierPage, setSupplierPage] = useState(1)
  const [supplierPageSize, setSupplierPageSize] = useState(50)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierSelected, setSupplierSelected] = useState<Set<number>>(new Set())

  const { data: businesses } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    {
      skip:
        !isSuperAdmin ||
      (kind !== 'trial' &&
          kind !== 'pl' &&
          kind !== 'ledger' &&
          kind !== 'bs' &&
          kind !== 'capital' &&
          kind !== 'customer' &&
          kind !== 'supplier' &&
          kind !== 'daily-cash-flow' &&
          kind !== 'period-view'),
    },
  )
  const { data: trialStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: trialBusinessId ?? undefined },
    { skip: !isSuperAdmin || kind !== 'trial' || !trialBusinessId },
  )

  const plStationsBusinessId =
    kind === 'pl' || kind === 'capital' || kind === 'period-view'
      ? (isSuperAdmin ? (plBusinessId ?? 0) : authBusinessId)
      : 0
  const { data: plStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: plStationsBusinessId || undefined },
    { skip: (kind !== 'pl' && kind !== 'capital' && kind !== 'period-view') || plStationsBusinessId <= 0 },
  )
  const ledgerStationsBusinessId =
    kind === 'ledger' || kind === 'daily-cash-flow' ? (isSuperAdmin ? (ledgerBusinessId ?? 0) : authBusinessId) : 0
  const { data: ledgerStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: ledgerStationsBusinessId || undefined },
    { skip: (kind !== 'ledger' && kind !== 'daily-cash-flow') || ledgerStationsBusinessId <= 0 },
  )
  const bsStationsBusinessId = kind === 'bs' ? (isSuperAdmin ? (bsBusinessId ?? 0) : authBusinessId) : 0
  const { data: bsStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: bsStationsBusinessId || undefined },
    { skip: kind !== 'bs' || bsStationsBusinessId <= 0 },
  )
  const customerStationsBusinessId =
    kind === 'customer' ? (isSuperAdmin ? (customerBusinessId ?? 0) : authBusinessId) : 0
  const { data: customerStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: customerStationsBusinessId || undefined },
    { skip: kind !== 'customer' || customerStationsBusinessId <= 0 },
  )
  const supplierStationsBusinessId =
    kind === 'supplier' ? (isSuperAdmin ? (supplierBusinessId ?? 0) : authBusinessId) : 0
  const { data: supplierStations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: supplierStationsBusinessId || undefined },
    { skip: kind !== 'supplier' || supplierStationsBusinessId <= 0 },
  )

  useEffect(() => {
    if (!isSuperAdmin || kind !== 'trial') return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setTrialBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items])

  useEffect(() => {
    if (!isSuperAdmin || (kind !== 'pl' && kind !== 'capital' && kind !== 'period-view')) return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setPlBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items])
  useEffect(() => {
    if (!isSuperAdmin || (kind !== 'ledger' && kind !== 'daily-cash-flow')) return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    if (businessIdFromUrl != null && items.some((b) => b.id === businessIdFromUrl)) {
      setLedgerBusinessId((prev) => {
        if (prev != null && prev !== businessIdFromUrl) return prev
        return businessIdFromUrl
      })
      return
    }
    setLedgerBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items, businessIdFromUrl])
  useEffect(() => {
    if (!isSuperAdmin || kind !== 'bs') return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setBsBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items])
  useEffect(() => {
    if (!isSuperAdmin || kind !== 'customer') return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setCustomerBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items])
  useEffect(() => {
    if (!isSuperAdmin || kind !== 'supplier') return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setSupplierBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, kind, businesses?.items])

  const effectiveBusinessId = isSuperAdmin ? (trialBusinessId ?? 0) : authBusinessId
  const effectivePlBusinessId = isSuperAdmin ? (plBusinessId ?? 0) : authBusinessId

  const { data: accountingPeriodsTrial = [] } = useGetAccountingPeriodsQuery(
    { businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: accountingPeriodsPl = [] } = useGetAccountingPeriodsQuery(
    { businessId: effectivePlBusinessId },
    { skip: effectivePlBusinessId <= 0 },
  )

  const periodDateAutoKeyRef = useRef<string>('')
  const prevFinancialReportKindRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevFinancialReportKindRef.current
    prevFinancialReportKindRef.current = kind
    if (
      (kind === 'trial' || kind === 'pl' || kind === 'capital' || kind === 'period-view') &&
      prev != null &&
      prev !== 'trial' &&
      prev !== 'pl' &&
      prev !== 'capital' &&
      prev !== 'period-view'
    ) {
      periodDateAutoKeyRef.current = ''
    }
  }, [kind])

  useEffect(() => {
    if (kind !== 'trial' && kind !== 'pl' && kind !== 'capital' && kind !== 'period-view') return
    const bid = kind === 'trial' ? effectiveBusinessId : effectivePlBusinessId
    if (bid <= 0) return
    const periods = (
      kind === 'trial' ? accountingPeriodsTrial : accountingPeriodsPl
    ) as PeriodRowLite[]
    const effectKey = `${kind}-${bid}`

    if (periods.length === 0) {
      const emptyMark = `${effectKey}:empty`
      if (periodDateAutoKeyRef.current !== emptyMark) {
        const d = defaultReportDate()
        setFrom(d)
        setTo(d)
        periodDateAutoKeyRef.current = emptyMark
      }
      return
    }

    const range = pickAccountingPeriodDateRange(periods)
    if (!range) return
    const fullKey = `${effectKey}:${range.from}:${range.to}`
    if (periodDateAutoKeyRef.current === fullKey) return
    periodDateAutoKeyRef.current = fullKey
    setFrom(range.from)
    setTo(range.to)
  }, [kind, effectiveBusinessId, effectivePlBusinessId, accountingPeriodsTrial, accountingPeriodsPl])

  const periodViewClosedPeriods = useMemo(() => {
    return (accountingPeriodsPl as PeriodRowLite[])
      .filter((p) => p.status === 1)
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
      .map((p) => ({
        key: `${p.periodStart.slice(0, 10)}:${p.periodEnd.slice(0, 10)}`,
        from: p.periodStart.slice(0, 10),
        to: p.periodEnd.slice(0, 10),
      }))
  }, [accountingPeriodsPl])

  useEffect(() => {
    if (kind !== 'period-view') return
    if (periodViewClosedPeriods.length === 0) return
    setPeriodViewClosedPeriod((prev) => {
      if (prev && periodViewClosedPeriods.some((p) => p.key === prev)) return prev
      return periodViewClosedPeriods[0].key
    })
  }, [kind, periodViewClosedPeriods])

  useEffect(() => {
    if (kind !== 'period-view') return
    if (!periodViewClosedPeriod) return
    const picked = periodViewClosedPeriods.find((p) => p.key === periodViewClosedPeriod)
    if (!picked) return
    setFrom(picked.from)
    setTo(picked.to)
  }, [kind, periodViewClosedPeriod, periodViewClosedPeriods])
  const effectiveLedgerBusinessId = isSuperAdmin ? (ledgerBusinessId ?? 0) : authBusinessId
  const effectiveBsBusinessId =
    kind === 'period-view' ? effectivePlBusinessId : isSuperAdmin ? (bsBusinessId ?? 0) : authBusinessId
  const effectiveCustomerBusinessId = isSuperAdmin ? (customerBusinessId ?? 0) : authBusinessId
  const effectiveSupplierBusinessId = isSuperAdmin ? (supplierBusinessId ?? 0) : authBusinessId
  const { data: ledgerAccounts } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: effectiveLedgerBusinessId > 0 ? effectiveLedgerBusinessId : undefined },
    { skip: (kind !== 'ledger' && kind !== 'daily-cash-flow') || effectiveLedgerBusinessId <= 0 },
  )
  const { data: customerAccounts } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: effectiveCustomerBusinessId > 0 ? effectiveCustomerBusinessId : undefined },
    { skip: kind !== 'customer' || effectiveCustomerBusinessId <= 0 },
  )
  const { data: supplierAccounts } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: effectiveSupplierBusinessId > 0 ? effectiveSupplierBusinessId : undefined },
    { skip: kind !== 'supplier' || effectiveSupplierBusinessId <= 0 },
  )

  const trial = useGetTrialBalanceReportQuery(
    {
      businessId: effectiveBusinessId,
      from: from || undefined,
      to: to || undefined,
      stationId: reportStationId(trialStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    { skip: kind !== 'trial' || effectiveBusinessId <= 0 || needsReportStation },
  )

  const ledger = useGetGeneralLedgerReportQuery(
    {
      businessId: effectiveLedgerBusinessId,
      accountId: ledgerAccountId ?? 0,
      from: from || undefined,
      to: to || undefined,
      stationId: reportStationId(ledgerStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    {
      skip:
        (kind !== 'ledger' && kind !== 'daily-cash-flow') ||
        effectiveLedgerBusinessId <= 0 ||
        !ledgerAccountId ||
        needsReportStation,
    },
  )
  const pl = useGetProfitLossReportQuery(
    {
      businessId: effectivePlBusinessId,
      from: from || undefined,
      to: to || undefined,
      stationId: reportStationId(plStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    { skip: kind !== 'pl' || effectivePlBusinessId <= 0 || needsReportStation },
  )
  const capital = useGetCapitalStatementReportQuery(
    {
      businessId: effectivePlBusinessId,
      from: from || undefined,
      to: to || undefined,
      stationId: reportStationId(plStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    { skip: kind !== 'capital' || effectivePlBusinessId <= 0 || needsReportStation },
  )
  const bs = useGetBalanceSheetReportQuery(
    {
      businessId: effectiveBsBusinessId,
      to: bsAsOf || undefined,
      stationId: reportStationId(bsStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    { skip: kind !== 'bs' || effectiveBsBusinessId <= 0 || needsReportStation },
  )
  const periodView = useGetReportPeriodViewQuery(
    {
      businessId: effectivePlBusinessId,
      from: from || undefined,
      to: to || undefined,
      stationId: reportStationId(plStationId),
      trialBalanceMode: effectiveReportTrialBalanceMode,
    },
    { skip: kind !== 'period-view' || effectivePlBusinessId <= 0 || needsReportStation },
  )
  const customer = useGetCustomerBalancesReportQuery(
    {
      businessId: customerApplied?.businessId ?? 0,
      stationId: customerApplied?.stationId,
      from: customerApplied?.from,
      to: customerApplied?.to,
      receivableAccountId: customerApplied?.receivableAccountId ?? 0,
    },
    {
      skip:
        kind !== 'customer' ||
        !customerApplied ||
        customerApplied.businessId <= 0 ||
        customerApplied.receivableAccountId <= 0 ||
        needsReportStation,
    },
  )
  const supplier = useGetSupplierBalancesReportQuery(
    {
      businessId: supplierApplied?.businessId ?? 0,
      stationId: supplierApplied?.stationId,
      from: supplierApplied?.from,
      to: supplierApplied?.to,
      payableAccountId: supplierApplied?.payableAccountId ?? 0,
    },
    {
      skip:
        kind !== 'supplier' ||
        !supplierApplied ||
        supplierApplied.businessId <= 0 ||
        supplierApplied.payableAccountId <= 0 ||
        needsReportStation,
    },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businesses?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businesses?.items],
  )
  const stationOptions: SelectOption[] = useMemo(
    () => (trialStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [trialStations?.items],
  )
  const plStationOptions: SelectOption[] = useMemo(
    () => (plStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [plStations?.items],
  )
  const ledgerStationOptions: SelectOption[] = useMemo(
    () => (ledgerStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [ledgerStations?.items],
  )
  const bsStationOptions: SelectOption[] = useMemo(
    () => (bsStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [bsStations?.items],
  )
  const customerStationOptions: SelectOption[] = useMemo(
    () => (customerStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [customerStations?.items],
  )
  const supplierStationOptions: SelectOption[] = useMemo(
    () => (supplierStations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [supplierStations?.items],
  )
  const customerAccountItemsFiltered = useMemo(
    () => filterAccountsForViewer(customerAccounts?.items, role, authBusinessIdRaw),
    [customerAccounts?.items, role, authBusinessIdRaw],
  )
  const supplierAccountItemsFiltered = useMemo(
    () => filterAccountsForViewer(supplierAccounts?.items, role, authBusinessIdRaw),
    [supplierAccounts?.items, role, authBusinessIdRaw],
  )
  const ledgerAccountItemsFiltered = useMemo(() => {
    const scoped = filterAccountsForFinancialReportsPicker(
      ledgerAccounts?.items,
      role,
      authBusinessIdRaw,
      effectiveLedgerBusinessId,
    )
    return filterBusinessLeafAccounts(scoped)
  }, [ledgerAccounts?.items, role, authBusinessIdRaw, effectiveLedgerBusinessId])
  const receivableAccountOptions: SelectOption[] = useMemo(
    () =>
      customerAccountItemsFiltered
        .filter((a) => isAccountsReceivable(a))
        .map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
    [customerAccountItemsFiltered],
  )
  const payableAccountOptions: SelectOption[] = useMemo(
    () =>
      supplierAccountItemsFiltered
        .filter((a) => isAccountsPayable(a))
        .map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
    [supplierAccountItemsFiltered],
  )
  const ledgerAccountOptions: SelectOption[] = useMemo(
    () => ledgerAccountItemsFiltered.map((a) => ({ value: String(a.id), label: `${a.code} - ${a.name}` })),
    [ledgerAccountItemsFiltered],
  )
  useEffect(() => {
    if (kind !== 'ledger' && kind !== 'daily-cash-flow') return
    const items = ledgerAccountItemsFiltered
    if (items.length === 0) return
    if (accountIdFromUrl != null && items.some((a) => a.id === accountIdFromUrl)) {
      setLedgerAccountId((prev) => {
        if (prev != null && prev !== accountIdFromUrl) return prev
        return accountIdFromUrl
      })
      return
    }
    setLedgerAccountId((prev) => {
      if (prev != null && items.some((a) => a.id === prev)) return prev
      return items[0].id
    })
  }, [kind, ledgerAccountItemsFiltered, accountIdFromUrl])

  const trialRowsAll = useMemo((): TrialBalanceRow[] => {
    const raw = trial.data ?? []
    return raw.map((r: { accountId: number; code: string; name: string; debit: number; credit: number; balance: number }) => ({
      id: r.accountId,
      code: r.code,
      name: r.name,
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    }))
  }, [trial.data])

  const trialRowsFiltered = useMemo(() => {
    const q = trialSearch.trim().toLowerCase()
    if (!q) return trialRowsAll
    return trialRowsAll.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    )
  }, [trialRowsAll, trialSearch])

  const trialRowsPage = useMemo(() => {
    const start = (trialPage - 1) * trialPageSize
    return trialRowsFiltered.slice(start, start + trialPageSize)
  }, [trialRowsFiltered, trialPage, trialPageSize])
  const trialTotals = useMemo(() => {
    return trialRowsFiltered.reduce(
      (acc, row) => {
        acc.debit += row.debit
        acc.credit += row.credit
        return acc
      },
      { debit: 0, credit: 0 },
    )
  }, [trialRowsFiltered])

  const plPeriodLabel = formatReportPeriod(from, to)
  const bsPeriodLabel = formatReportPeriod('', bsAsOf)
  const periodViewCashFlowRows = useMemo(() => {
    const incomeTotal = Number(periodView.data?.cashFlowStatement?.cashReceivedFromFuelSales ?? 0)
    const expenseTotal = Number(periodView.data?.cashFlowStatement?.cashPaidForExpense ?? 0)
    const netOperating = Number(periodView.data?.cashFlowStatement?.netCashFromOperating ?? incomeTotal - expenseTotal)
    return {
      incomeTotal,
      expenseTotal,
      netOperating,
    }
  }, [periodView.data])
  const ledgerRows = useMemo(() => {
    let running = 0
    const rows = (ledger.data ?? []).map((r: any, i: number) => {
      const debit = Number(r.debit ?? 0)
      const credit = Number(r.credit ?? 0)
      running += debit - credit
      return {
        id: i + 1,
        date: r.date,
        description: r.description ?? '—',
        debit,
        credit,
        balance: running,
      }
    })
    return [
      { id: 0, date: from || null, description: 'Opening Balance', debit: 0, credit: 0, balance: 0 },
      ...rows,
    ]
  }, [ledger.data, from])

  interface DailyCashFlowRow {
    id: string
    dateLabel: string
    totalDebit: number
    totalCredit: number
    netMovement: number
    endingBalance: number
  }

  const dailyCashFlowRows = useMemo((): DailyCashFlowRow[] => {
    if (kind !== 'daily-cash-flow') return []
    const raw = ledger.data ?? []
    const byDay = new Map<string, { debit: number; credit: number }>()
    for (const r of raw) {
      if (!r?.date) continue
      const d = new Date(r.date as string)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const debit = Number(r.debit ?? 0)
      const credit = Number(r.credit ?? 0)
      const cur = byDay.get(key) ?? { debit: 0, credit: 0 }
      cur.debit += debit
      cur.credit += credit
      byDay.set(key, cur)
    }
    const keys = [...byDay.keys()].sort()
    let running = 0
    return keys.map((key) => {
      const { debit, credit } = byDay.get(key)!
      const net = debit - credit
      running += net
      const [y, m, da] = key.split('-').map(Number)
      const label = new Date(y, m - 1, da).toLocaleDateString(undefined, { dateStyle: 'medium' })
      return {
        id: key,
        dateLabel: label,
        totalDebit: debit,
        totalCredit: credit,
        netMovement: net,
        endingBalance: running,
      }
    })
  }, [kind, ledger.data])

  function customerBalanceStableId(name: string): number {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
    const x = Math.abs(h) % 2147483647
    return x === 0 ? 1 : x
  }

  const customerRowsAll = useMemo((): CustomerBalanceRow[] => {
    const raw = customer.data ?? []
    return [...raw]
      .sort((a: { customer?: string }, b: { customer?: string }) =>
        String(a.customer ?? '').localeCompare(String(b.customer ?? '')),
      )
      .map((r: { code?: string; customer?: string; givenAmount?: number; paidAmount?: number; balance?: number }) => {
        const name = String(r.customer ?? '')
        return {
          id: customerBalanceStableId(name),
          code: String(r.code ?? '—'),
          name,
          given: Number(r.givenAmount ?? 0),
          paid: Number(r.paidAmount ?? 0),
          balance: Number(r.balance ?? 0),
        }
      })
  }, [customer.data])

  const customerRowsFiltered = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customerRowsAll
    return customerRowsAll.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    )
  }, [customerRowsAll, customerSearch])

  const customerRowsPage = useMemo(() => {
    const start = (customerPage - 1) * customerPageSize
    return customerRowsFiltered.slice(start, start + customerPageSize)
  }, [customerRowsFiltered, customerPage, customerPageSize])

  const customerTotals = useMemo(
    () =>
      customerRowsFiltered.reduce(
        (acc, row) => {
          acc.given += row.given
          acc.paid += row.paid
          acc.balance += row.balance
          return acc
        },
        { given: 0, paid: 0, balance: 0 },
      ),
    [customerRowsFiltered],
  )

  const customerCols: Column<CustomerBalanceRow>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'given', header: 'Given', render: (r) => formatDecimal(r.given) },
    { key: 'paid', header: 'Paid', render: (r) => formatDecimal(r.paid) },
    { key: 'balance', header: 'Balance', render: (r) => formatDecimal(r.balance) },
  ]

  const supplierRowsAll = useMemo((): CustomerBalanceRow[] => {
    const raw = supplier.data ?? []
    return [...raw]
      .sort((a: { supplier?: string }, b: { supplier?: string }) =>
        String(a.supplier ?? '').localeCompare(String(b.supplier ?? '')),
      )
      .map((r: { code?: string; supplier?: string; givenAmount?: number; paidAmount?: number; balance?: number }) => {
        const name = String(r.supplier ?? '')
        return {
          id: customerBalanceStableId(`sup:${name}`),
          code: String(r.code ?? '—'),
          name,
          given: Number(r.givenAmount ?? 0),
          paid: Number(r.paidAmount ?? 0),
          balance: Number(r.balance ?? 0),
        }
      })
  }, [supplier.data])

  const supplierRowsFiltered = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase()
    if (!q) return supplierRowsAll
    return supplierRowsAll.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    )
  }, [supplierRowsAll, supplierSearch])

  const supplierRowsPage = useMemo(() => {
    const start = (supplierPage - 1) * supplierPageSize
    return supplierRowsFiltered.slice(start, start + supplierPageSize)
  }, [supplierRowsFiltered, supplierPage, supplierPageSize])

  const supplierTotals = useMemo(
    () =>
      supplierRowsFiltered.reduce(
        (acc, row) => {
          acc.given += row.given
          acc.paid += row.paid
          acc.balance += row.balance
          return acc
        },
        { given: 0, paid: 0, balance: 0 },
      ),
    [supplierRowsFiltered],
  )

  const supplierCols: Column<CustomerBalanceRow>[] = customerCols

  useEffect(() => {
    if (kind !== 'customer') return
    if (!routeCanView || needsReportStation || effectiveCustomerBusinessId <= 0 || !customerReceivableAccountId) {
      setCustomerApplied(null)
      return
    }
    setCustomerApplied({
      businessId: effectiveCustomerBusinessId,
      stationId: reportStationId(customerStationId),
      from: customerFrom.trim() || undefined,
      to: customerTo.trim() || undefined,
      receivableAccountId: customerReceivableAccountId,
    })
    setCustomerPage(1)
  }, [
    kind,
    routeCanView,
    needsReportStation,
    effectiveCustomerBusinessId,
    customerReceivableAccountId,
    customerStationId,
    customerFrom,
    customerTo,
  ])

  useEffect(() => {
    if (kind !== 'supplier') return
    if (!routeCanView || needsReportStation || effectiveSupplierBusinessId <= 0 || !supplierPayableAccountId) {
      setSupplierApplied(null)
      return
    }
    setSupplierApplied({
      businessId: effectiveSupplierBusinessId,
      stationId: reportStationId(supplierStationId),
      from: supplierFrom.trim() || undefined,
      to: supplierTo.trim() || undefined,
      payableAccountId: supplierPayableAccountId,
    })
    setSupplierPage(1)
  }, [
    kind,
    routeCanView,
    needsReportStation,
    effectiveSupplierBusinessId,
    supplierPayableAccountId,
    supplierStationId,
    supplierFrom,
    supplierTo,
  ])

  const handleLedgerExport = () => {
    if (ledgerRows.length === 0) return
    const view = financialEntryView ?? 'adjusted'
    buildSimpleReportPdf(
      entryViewReportTitle('ledger', view),
      formatReportPeriod(from, to),
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ledgerRows.map((r) => [
        r.date ? new Date(r.date).toLocaleDateString() : '—',
        r.description,
        r.debit === 0 ? '' : formatDecimal(r.debit),
        r.credit === 0 ? '' : formatDecimal(r.credit),
        formatDecimal(r.balance),
      ]),
    )
  }

  const handleTrialExport = () => {
    if (trialRowsFiltered.length === 0) return
    const view = financialEntryView ?? 'adjusted'
    buildSimpleReportPdf(
      entryViewReportTitle('trial', view),
      formatReportPeriod(from, to),
      ['Code', 'Name', 'Debit', 'Credit', 'Balance'],
      trialRowsFiltered.map((r) => [r.code, r.name, formatDecimal(r.debit), formatDecimal(r.credit), formatDecimal(r.balance)]),
    )
  }

  const handleDailyCashFlowExport = () => {
    if (dailyCashFlowRows.length === 0) return
    const view = financialEntryView ?? 'adjusted'
    buildSimpleReportPdf(
      entryViewReportTitle('cashflow', view),
      formatReportPeriod(from, to),
      ['Date', 'Debit total', 'Credit total', 'Net', 'Cumulative'],
      dailyCashFlowRows.map((r) => [
        r.dateLabel,
        formatDecimal(r.totalDebit),
        formatDecimal(r.totalCredit),
        formatDecimalSigned(r.netMovement),
        formatDecimalSigned(r.endingBalance),
      ]),
    )
  }

  const handleProfitLossExport = () => {
    if (!pl.data) return
    const body: Array<Array<string | number>> = []
    body.push(['Income', '', ''])
    for (const row of pl.data.incomeAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.amount), ''])
    body.push(['Total income', formatDecimal(pl.data.incomeTotal ?? 0), ''])
    body.push(['COGS', '', ''])
    for (const row of pl.data.cogsAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.amount), ''])
    body.push(['Total COGS', formatDecimal(pl.data.cogsTotal ?? 0), ''])
    body.push(['Gross profit', formatDecimal(pl.data.grossProfit ?? 0), ''])
    body.push(['Expense', '', ''])
    for (const row of pl.data.expenseAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.amount), ''])
    body.push(['Total expense', formatDecimal(pl.data.expenseTotal ?? 0), ''])
    body.push(['Net ordinary income', formatDecimal(pl.data.netOrdinaryIncome ?? 0), ''])
    body.push(['Net income', formatDecimal(pl.data.netIncome ?? 0), ''])
    buildSimpleReportPdf(
      entryViewReportTitle('pl', financialEntryView ?? 'adjusted'),
      plPeriodLabel,
      ['Line', 'Amount', ''],
      body,
    )
  }

  const handleBalanceSheetExport = () => {
    if (!bs.data) return
    const body: Array<Array<string | number>> = []
    body.push(['Assets', ''])
    for (const row of bs.data.assetAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
    body.push(['Total assets', formatDecimal(bs.data.assets ?? 0)])
    body.push(['Liabilities', ''])
    for (const row of bs.data.liabilityAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
    body.push(['Total liabilities', formatDecimal(bs.data.liabilities ?? 0)])
    body.push(['Equity', ''])
    for (const row of bs.data.equityAccounts ?? []) body.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
    body.push(['Total equity', formatDecimal(bs.data.equity ?? 0)])
    body.push(['Total liabilities & equity', formatDecimal(bs.data.liabilitiesAndEquity ?? bs.data.liabilities + bs.data.equity)])
    buildSimpleReportPdf(
      entryViewReportTitle('bs', financialEntryView ?? 'adjusted'),
      bsPeriodLabel,
      ['Account', 'Balance'],
      body,
    )
  }

  const handleCapitalStatementExport = () => {
    if (!capital.data) return
    const view = financialEntryView ?? 'adjusted'
    const head = ['Account', 'Beginning', 'Change', 'Ending']
    const body: Array<Array<string | number>> = []
    for (const r of capital.data.equityRows ?? []) {
      body.push([
        `${r.code} · ${r.name}`,
        formatDecimalSigned(r.beginning),
        formatDecimalSigned(r.change),
        formatDecimalSigned(r.ending),
      ])
    }
    const ni = Number(capital.data.netIncome ?? 0)
    const equityCount = capital.data.equityRows?.length ?? 0
    const unadjusted = view === 'unadjusted'
    const showNiRow = unadjusted && (equityCount > 0 || Math.abs(ni) > 1e-9)
    if (showNiRow) {
      body.push(['Net income (period)', formatDecimalSigned(0), formatDecimalSigned(ni), formatDecimalSigned(ni)])
    }
    const totalBeg = capital.data.totalBeginning
    const totalChg = unadjusted ? capital.data.totalChange + ni : capital.data.totalChange
    const totalEnd = unadjusted ? capital.data.totalEnding + ni : capital.data.totalEnding
    body.push([
      'Total equity',
      formatDecimalSigned(totalBeg),
      formatDecimalSigned(totalChg),
      formatDecimalSigned(totalEnd),
    ])
    if (!unadjusted) {
      body.push(['', '', '', ''])
      body.push(['Net income (period)', formatDecimalSigned(ni), '', ''])
    }
    buildSimpleReportPdf(entryViewReportTitle('capital', view), plPeriodLabel, head, body)
  }

  const handleCustomerExport = () => {
    if (!customerApplied || customerRowsFiltered.length === 0) return
    buildSimpleReportPdf(
      'Customer Balances',
      formatReportPeriod(customerApplied.from ?? '', customerApplied.to ?? ''),
      ['Code', 'Name', 'Given', 'Paid', 'Balance'],
      customerRowsFiltered.map((r) => [r.code, r.name, formatDecimal(r.given), formatDecimal(r.paid), formatDecimal(r.balance)]),
    )
  }

  const handleSupplierExport = () => {
    if (!supplierApplied || supplierRowsFiltered.length === 0) return
    buildSimpleReportPdf(
      'Supplier Balances',
      formatReportPeriod(supplierApplied.from ?? '', supplierApplied.to ?? ''),
      ['Code', 'Name', 'Given', 'Paid', 'Balance'],
      supplierRowsFiltered.map((r) => [r.code, r.name, formatDecimal(r.given), formatDecimal(r.paid), formatDecimal(r.balance)]),
    )
  }

  const handlePeriodViewExport = () => {
    if (!periodIncludeIncome && !periodIncludeBalanceSheet && !periodIncludeCashFlow) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const margin = 40
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const addFooter = () => {
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(`Page ${i}`, pageW - margin, pageH - 16, { align: 'right' })
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42)
    doc.text('Financial Report', margin, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text(formatReportPeriod(from, to), margin, 62)

    let y = 82
    const bottomSafeY = pageH - 60
    const ensureSpace = (estimatedHeight: number) => {
      if (y + estimatedHeight <= bottomSafeY) return
      doc.addPage()
      y = 62
    }

    if (periodIncludeIncome && periodView.data) {
      const incomeRows = periodView.data.incomeStatement?.incomeAccounts ?? []
      const cogsRows = periodView.data.incomeStatement?.cogsAccounts ?? []
      const expenseRows = periodView.data.incomeStatement?.expenseAccounts ?? []
      const estimatedRows = incomeRows.length + cogsRows.length + expenseRows.length + 10
      ensureSpace(Math.max(170, estimatedRows * 18))
      y = addPdfSectionTitle(doc, 'Income Statement', y, margin)
      const incomeBody: Array<Array<string | number>> = []
      incomeBody.push(['Income', ''])
      for (const row of incomeRows) {
        incomeBody.push([`${row.code} - ${row.name}`, formatDecimal(row.amount)])
      }
      incomeBody.push(['Sales Total', formatDecimal(periodView.data.incomeStatement?.sales ?? 0)])
      incomeBody.push(['COGS', ''])
      for (const row of cogsRows) {
        incomeBody.push([`${row.code} - ${row.name}`, formatDecimal(row.amount)])
      }
      incomeBody.push(['COGS Total', formatDecimal(periodView.data.incomeStatement?.cogs ?? 0)])
      incomeBody.push(['Gross Profit', formatDecimal(periodView.data.incomeStatement?.grossProfit ?? 0)])
      incomeBody.push(['Expense', ''])
      for (const row of expenseRows) {
        incomeBody.push([`${row.code} - ${row.name}`, formatDecimal(row.amount)])
      }
      incomeBody.push(['Total Expense', formatDecimal(periodView.data.incomeStatement?.totalExpense ?? 0)])
      incomeBody.push(['Net Income', formatDecimal(periodView.data.incomeStatement?.netIncome ?? 0)])
      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount ($)']],
        body: incomeBody,
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
        theme: 'grid',
        margin: { left: margin, right: margin },
      })
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 20
    }

    if (periodIncludeBalanceSheet && periodView.data) {
      const assetRows = periodView.data.balanceSheet?.assets ?? []
      const liabilityRows = periodView.data.balanceSheet?.liabilities ?? []
      const equityRows = periodView.data.balanceSheet?.equity ?? []
      const estimatedRows = assetRows.length + liabilityRows.length + equityRows.length + 8
      ensureSpace(Math.max(200, estimatedRows * 18))
      y = addPdfSectionTitle(doc, 'Balance Sheet', y, margin)
      const balanceSheetBody: Array<Array<string | number>> = []
      balanceSheetBody.push(['Assets', ''])
      for (const row of assetRows) {
        balanceSheetBody.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
      }
      balanceSheetBody.push(['Total Asset', formatDecimal(periodView.data.balanceSheet?.totalAsset ?? 0)])
      balanceSheetBody.push(['Liabilities', ''])
      for (const row of liabilityRows) {
        balanceSheetBody.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
      }
      balanceSheetBody.push(['Equity', ''])
      for (const row of equityRows) {
        balanceSheetBody.push([`${row.code} - ${row.name}`, formatDecimal(row.balance)])
      }
      balanceSheetBody.push(['Net Income', formatDecimal(periodView.data.balanceSheet?.netIncome ?? 0)])
      balanceSheetBody.push(['Total Equity', formatDecimal(periodView.data.balanceSheet?.totalEquity ?? 0)])
      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount ($)']],
        body: balanceSheetBody,
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
        theme: 'grid',
        margin: { left: margin, right: margin },
      })
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 20
    }

    if (periodIncludeCashFlow && periodView.data) {
      const receivedRows = periodView.data.cashFlowStatement?.receivedAccounts ?? []
      const paidRows = periodView.data.cashFlowStatement?.paidAccounts ?? []
      const estimatedRows = receivedRows.length + paidRows.length + 8
      ensureSpace(Math.max(150, estimatedRows * 18))
      y = addPdfSectionTitle(doc, 'Cash Flow Statement', y, margin)
      const cashFlowBody: Array<Array<string | number>> = []
      cashFlowBody.push(['Operating Activities', ''])
      for (const row of receivedRows) {
        cashFlowBody.push([`Cash in: ${row.code} - ${row.name}`, formatDecimal(row.amount)])
      }
      cashFlowBody.push(['Cash received from fuel sales', formatDecimal(periodViewCashFlowRows.incomeTotal)])
      for (const row of paidRows) {
        cashFlowBody.push([`Cash out: ${row.code} - ${row.name}`, formatDecimal(row.amount)])
      }
      cashFlowBody.push(['Cash paid for expense', formatDecimal(periodViewCashFlowRows.expenseTotal)])
      cashFlowBody.push(['Net Cash from Operating', formatDecimal(periodViewCashFlowRows.netOperating)])
      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount ($)']],
        body: cashFlowBody,
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
        theme: 'grid',
        margin: { left: margin, right: margin },
      })
    }

    addFooter()
    openPdfInNewTab(doc)
  }

  if (kind === 'ledger') {
    const ledgerEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">General Ledger</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleLedgerExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={ledgerEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(ledgerBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setLedgerBusinessId(opt ? Number(opt.value) : null)
                    setLedgerStationId(null)
                    setLedgerAccountId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            <div className="w-full min-w-0 lg:w-64">
              <label className="mb-1 block text-sm font-medium text-slate-700">Account</label>
              <FormSelect
                options={ledgerAccountOptions}
                value={ledgerAccountOptions.find((o) => o.value === String(ledgerAccountId ?? '')) ?? null}
                onChange={(opt) => setLedgerAccountId(opt ? Number(opt.value) : null)}
                placeholder="Select account"
                isDisabled={effectiveLedgerBusinessId <= 0}
              />
            </div>
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={ledgerStationOptions}
                  value={ledgerStationOptions.find((o) => o.value === String(ledgerStationId ?? '')) ?? null}
                  onChange={(opt) => setLedgerStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectiveLedgerBusinessId <= 0 || (isSuperAdmin && !ledgerBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {effectiveLedgerBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to load the ledger.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : !ledgerAccountId ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select an account to load the ledger.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[780px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Description</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Debit</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Credit</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.isFetching && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!ledger.isFetching &&
                  ledgerRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 text-slate-700">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-800">{r.description}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.debit === 0 ? '' : formatDecimal(r.debit)}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.credit === 0 ? '' : formatDecimal(r.credit)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{formatDecimal(r.balance)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (kind === 'daily-cash-flow') {
    const cashFlowEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Cash flow statement</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleDailyCashFlowExport}
          >
            Print / Export
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Net movement by calendar day for the selected account (typically cash or bank). Uses the same journal lines and
          entry view (Unadjusted / Adjusted / Post-closing) as the general ledger, aggregated per day.
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={cashFlowEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(ledgerBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setLedgerBusinessId(opt ? Number(opt.value) : null)
                    setLedgerStationId(null)
                    setLedgerAccountId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            <div className="w-full min-w-0 lg:w-64">
              <label className="mb-1 block text-sm font-medium text-slate-700">Account</label>
              <FormSelect
                options={ledgerAccountOptions}
                value={ledgerAccountOptions.find((o) => o.value === String(ledgerAccountId ?? '')) ?? null}
                onChange={(opt) => setLedgerAccountId(opt ? Number(opt.value) : null)}
                placeholder="Select account"
                isDisabled={effectiveLedgerBusinessId <= 0}
              />
            </div>
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={ledgerStationOptions}
                  value={ledgerStationOptions.find((o) => o.value === String(ledgerStationId ?? '')) ?? null}
                  onChange={(opt) => setLedgerStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectiveLedgerBusinessId <= 0 || (isSuperAdmin && !ledgerBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {effectiveLedgerBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to run the report.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : !ledgerAccountId ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Select an account to load the cash flow statement.
          </p>
        ) : (
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[860px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Debit total</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Credit total</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-600">
                    Net (debit − credit)
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-600">
                    Cumulative in period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.isFetching && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!ledger.isFetching &&
                  dailyCashFlowRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 text-slate-800">{r.dateLabel}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.totalDebit === 0 ? '—' : formatDecimal(r.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.totalCredit === 0 ? '—' : formatDecimal(r.totalCredit)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`tabular-nums font-medium ${signedLedgerAmountClass(r.netMovement)}`}
                        >
                          {formatDecimalSigned(r.netMovement)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`tabular-nums font-medium ${signedLedgerAmountClass(r.endingBalance)}`}
                        >
                          {formatDecimalSigned(r.endingBalance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                {!ledger.isFetching && dailyCashFlowRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No journal lines in this date range for the selected account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (kind === 'pl') {
    const plEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Income Statement</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleProfitLossExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={plEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(plBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setPlBusinessId(opt ? Number(opt.value) : null)
                    setPlStationId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={plStationOptions}
                  value={plStationOptions.find((o) => o.value === String(plStationId ?? '')) ?? null}
                  onChange={(opt) => setPlStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectivePlBusinessId <= 0 || (isSuperAdmin && !plBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {effectivePlBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to load the report.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : (
          <ProfitLossReportView
            data={pl.data}
            isLoading={pl.isFetching}
            periodLabel={plPeriodLabel}
            documentHeading={entryViewReportTitle('pl', plEntryView)}
          />
        )}
      </div>
    )
  }

  if (kind === 'period-view') {
    const periodEntryView = financialEntryView ?? 'adjusted'
    const selectedClosedPeriod = periodViewClosedPeriods.find((p) => p.key === periodViewClosedPeriod) ?? null
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Financial report period view</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handlePeriodViewExport}
          >
            Print / Export PDF
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={periodEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(plBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setPlBusinessId(opt ? Number(opt.value) : null)
                    setPlStationId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={plStationOptions}
                  value={plStationOptions.find((o) => o.value === String(plStationId ?? '')) ?? null}
                  onChange={(opt) => setPlStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectivePlBusinessId <= 0 || (isSuperAdmin && !plBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 lg:w-80">
              <label className="mb-1 block text-sm font-medium text-slate-700">Closed period</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={periodViewClosedPeriod ?? ''}
                onChange={(e) => setPeriodViewClosedPeriod(e.target.value || null)}
                disabled={periodViewClosedPeriods.length === 0}
              >
                {periodViewClosedPeriods.length === 0 ? (
                  <option value="">No closed periods</option>
                ) : (
                  periodViewClosedPeriods.map((p) => (
                    <option key={p.key} value={p.key}>
                      {formatReportPeriod(p.from, p.to)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50" value={selectedClosedPeriod?.from ?? from} readOnly />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50" value={selectedClosedPeriod?.to ?? to} readOnly />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={periodIncludeIncome}
                onChange={(e) => setPeriodIncludeIncome(e.target.checked)}
              />
              Income Statement
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={periodIncludeBalanceSheet}
                onChange={(e) => setPeriodIncludeBalanceSheet(e.target.checked)}
              />
              Balance Sheet
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={periodIncludeCashFlow}
                onChange={(e) => setPeriodIncludeCashFlow(e.target.checked)}
              />
              Cash Flow Statement
            </label>
          </div>
        </div>

        {effectivePlBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Select a business to load the report.
          </p>
        ) : periodViewClosedPeriods.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No closed accounting periods found for this business.
          </p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : periodView.isFetching ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Loading report period view…</p>
        ) : (
          <div className="space-y-5">
            {periodIncludeIncome && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">Income Statement</div>
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-800">Amount ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">Income</td>
                      <td />
                    </tr>
                    {(periodView.data?.incomeStatement?.incomeAccounts ?? []).map((row) => (
                      <tr className="border-t" key={`pv-income-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t">
                      <td className="px-4 py-2 font-bold text-slate-800">Sales Total</td>
                      <td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.incomeStatement?.sales ?? 0)}</td>
                    </tr>
                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">COGS</td>
                      <td />
                    </tr>
                    {(periodView.data?.incomeStatement?.cogsAccounts ?? []).map((row) => (
                      <tr className="border-t" key={`pv-cogs-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t">
                      <td className="px-4 py-2 font-bold text-slate-800">COGS Total</td>
                      <td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.incomeStatement?.cogs ?? 0)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-2 font-semibold text-slate-800">Gross Profit</td>
                      <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(periodView.data?.incomeStatement?.grossProfit ?? 0)}</td>
                    </tr>
                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">Expense</td>
                      <td />
                    </tr>
                    {(periodView.data?.incomeStatement?.expenseAccounts ?? []).map((row) => (
                      <tr className="border-t" key={`pv-expense-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t"><td className="px-4 py-2 font-semibold text-slate-800">Total Expense</td><td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(periodView.data?.incomeStatement?.totalExpense ?? 0)}</td></tr>
                    <tr className="border-t"><td className="px-4 py-2 font-bold text-green-600">Net Income</td><td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.incomeStatement?.netIncome ?? 0)}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {periodIncludeBalanceSheet && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">Balance Sheet</div>
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-800">Amount ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">Assets</td>
                      <td />
                    </tr>
                    {(periodView.data?.balanceSheet?.assets ?? []).map((row) => (
                      <tr className="border-t" key={`pv-asset-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t">
                      <td className="px-4 py-2 font-bold text-slate-800">Total Asset</td>
                      <td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.balanceSheet?.totalAsset ?? 0)}</td>
                    </tr>

                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">Liabilities</td>
                      <td />
                    </tr>
                    {(periodView.data?.balanceSheet?.liabilities ?? []).map((row) => (
                      <tr className="border-t" key={`pv-liability-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.balance)}</td>
                      </tr>
                    ))}

                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-800">Equity</td>
                      <td />
                    </tr>
                    {(periodView.data?.balanceSheet?.equity ?? []).map((row) => (
                      <tr className="border-t" key={`pv-equity-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">{row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t">
                      <td className="px-4 py-2 font-bold text-green-600">Net Income</td>
                      <td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.balanceSheet?.netIncome ?? 0)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-2 font-bold text-slate-800">Total Equity</td>
                      <td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodView.data?.balanceSheet?.totalEquity ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {periodIncludeCashFlow && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900">Cash Flow Statement</div>
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-800">Amount ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t"><td className="px-4 py-2 font-bold text-slate-800">Operating Activities</td><td className="px-4 py-2" /></tr>
                    {(periodView.data?.cashFlowStatement?.receivedAccounts ?? []).map((row) => (
                      <tr className="border-t" key={`pv-cf-in-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">Cash in: {row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t"><td className="px-4 py-2 pl-8 font-semibold text-slate-800">Cash received from fuel sales</td><td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(periodViewCashFlowRows.incomeTotal)}</td></tr>
                    {(periodView.data?.cashFlowStatement?.paidAccounts ?? []).map((row) => (
                      <tr className="border-t" key={`pv-cf-out-${row.code}`}>
                        <td className="px-4 py-2 pl-8 font-semibold text-slate-800">Cash out: {row.code} - {row.name}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t"><td className="px-4 py-2 pl-8 font-semibold text-slate-800">Cash paid for expense</td><td className="px-4 py-2 font-semibold text-emerald-900">{formatDecimal(periodViewCashFlowRows.expenseTotal)}</td></tr>
                    <tr className="border-t"><td className="px-4 py-2 font-bold text-green-600">Net Cash from Operating</td><td className="px-4 py-2 font-bold text-emerald-900">{formatDecimal(periodViewCashFlowRows.netOperating)}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const trialCols: Column<TrialBalanceRow>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'debit',
      header: 'Debit',
      render: (r) => formatDecimal(r.debit),
    },
    {
      key: 'credit',
      header: 'Credit',
      render: (r) => formatDecimal(r.credit),
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (r) => formatDecimal(r.balance),
    },
  ]

  if (kind === 'trial') {
    const trialEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs
              value={trialEntryView}
              onChange={(v) => {
                setFinancialEntryView(v)
                setTrialPage(1)
              }}
            />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(trialBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setTrialBusinessId(opt ? Number(opt.value) : null)
                    setTrialStationId(null)
                    setTrialPage(1)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={stationOptions}
                  value={stationOptions.find((o) => o.value === String(trialStationId ?? '')) ?? null}
                  onChange={(opt) => {
                    setTrialStationId(opt ? Number(opt.value) : null)
                    setTrialPage(1)
                  }}
                  placeholder="All stations"
                  isClearable
                  isDisabled={!trialBusinessId}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setTrialPage(1)
                }}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setTrialPage(1)
                }}
              />
            </div>
          </div>
          {/* <p className="mt-3 text-xs text-slate-500">
            Report loads automatically for the selected business. Use <strong>From</strong> / <strong>To</strong> to limit by
            journal entry date (optional).
          </p> */}
        </div>

        {effectiveBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to load the trial balance.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : (
          <DataTable<TrialBalanceRow>
            readOnly
            title={entryViewReportTitle('trial', trialEntryView)}
            extraToolbar={
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={handleTrialExport}
              >
                Print / Export
              </button>
            }
            rows={trialRowsPage}
            totalCount={trialRowsFiltered.length}
            page={trialPage}
            pageSize={trialPageSize}
            onPageChange={setTrialPage}
            onPageSizeChange={(n) => {
              setTrialPageSize(n)
              setTrialPage(1)
            }}
            search={trialSearch}
            onSearchChange={(q) => {
              setTrialSearch(q)
              setTrialPage(1)
            }}
            columns={trialCols}
            isLoading={trial.isFetching}
            selectedIds={trialSelected}
            onSelectedIdsChange={setTrialSelected}
            belowTable={
              <div className="flex justify-end gap-8 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>Debit total: {formatDecimal(trialTotals.debit)}</span>
                <span>Credit total: {formatDecimal(trialTotals.credit)}</span>
              </div>
            }
            onDeleteOne={() => {}}
            onDeleteSelected={() => {}}
          />
        )}
      </div>
    )
  }

  if (kind === 'bs') {
    const bsEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Balance sheet</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleBalanceSheetExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={bsEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(bsBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setBsBusinessId(opt ? Number(opt.value) : null)
                    setBsStationId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={bsStationOptions}
                  value={bsStationOptions.find((o) => o.value === String(bsStationId ?? '')) ?? null}
                  onChange={(opt) => setBsStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectiveBsBusinessId <= 0 || (isSuperAdmin && !bsBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">As of</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={bsAsOf}
                onChange={(e) => setBsAsOf(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Balances for <strong>Asset</strong>, <strong>Liability</strong>, and <strong>Equity</strong> accounts through the selected date (optional).
            Use the entry view tabs: <strong>Unadjusted</strong> excludes adjusting and closing entries; <strong>Adjusted</strong> excludes closing only;{' '}
            <strong>Post-closing</strong> includes all entries.
          </p>
        </div>

        {effectiveBsBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to load the balance sheet.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : (
          <BalanceSheetReportView
            data={bs.data}
            isLoading={bs.isFetching}
            periodLabel={bsPeriodLabel}
            documentHeading={entryViewReportTitle('bs', bsEntryView)}
          />
        )}
      </div>
    )
  }

  if (kind === 'capital') {
    const capitalEntryView = financialEntryView ?? 'adjusted'
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Capital Statement</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleCapitalStatementExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Entry view</p>
            <EntryViewTabs value={capitalEntryView} onChange={setFinancialEntryView} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(plBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setPlBusinessId(opt ? Number(opt.value) : null)
                    setPlStationId(null)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={plStationOptions}
                  value={plStationOptions.find((o) => o.value === String(plStationId ?? '')) ?? null}
                  onChange={(opt) => setPlStationId(opt ? Number(opt.value) : null)}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectivePlBusinessId <= 0 || (isSuperAdmin && !plBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          {/* <p className="mt-3 text-xs text-slate-500">
            Beginning equity is cumulative through the day before <strong>From</strong>. Ending is through <strong>To</strong>.
            Net income shown for the same dates matches the Income Statement for comparison with equity changes (including closing entries when applicable).
          </p> */}
        </div>

        {effectivePlBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to load the report.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : (
          <CapitalStatementReportView
            data={capital.data}
            isLoading={capital.isFetching}
            periodLabel={plPeriodLabel}
            documentHeading={entryViewReportTitle('capital', capitalEntryView)}
            entryView={capitalEntryView}
          />
        )}
      </div>
    )
  }

  if (kind === 'customer') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Customer balances</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleCustomerExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(customerBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setCustomerBusinessId(opt ? Number(opt.value) : null)
                    setCustomerStationId(null)
                    setCustomerReceivableAccountId(null)
                    setCustomerApplied(null)
                    setCustomerPage(1)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={customerStationOptions}
                  value={customerStationOptions.find((o) => o.value === String(customerStationId ?? '')) ?? null}
                  onChange={(opt) => {
                    setCustomerStationId(opt ? Number(opt.value) : null)
                    setCustomerPage(1)
                  }}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectiveCustomerBusinessId <= 0 || (isSuperAdmin && !customerBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 lg:w-72">
              <label className="mb-1 block text-sm font-medium text-slate-700">Receivable account</label>
              <FormSelect
                options={receivableAccountOptions}
                value={receivableAccountOptions.find((o) => o.value === String(customerReceivableAccountId ?? '')) ?? null}
                onChange={(opt) => {
                  setCustomerReceivableAccountId(opt ? Number(opt.value) : null)
                  setCustomerPage(1)
                }}
                placeholder="Select receivable account"
                isDisabled={effectiveCustomerBusinessId <= 0}
                isSearchable
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={customerFrom}
                onChange={(e) => setCustomerFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={customerTo}
                onChange={(e) => setCustomerTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {effectiveCustomerBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to run customer balances.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : !routeCanView ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No view permission for this report.
          </p>
        ) : !customerApplied ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Choose a receivable account and optional dates. Results load automatically from journal entries on that account (customer subledger lines).
          </p>
        ) : (
          <DataTable<CustomerBalanceRow>
            readOnly
            title="Customer balances"
            rows={customerRowsPage}
            totalCount={customerRowsFiltered.length}
            page={customerPage}
            pageSize={customerPageSize}
            onPageChange={setCustomerPage}
            onPageSizeChange={(n) => {
              setCustomerPageSize(n)
              setCustomerPage(1)
            }}
            search={customerSearch}
            onSearchChange={(q) => {
              setCustomerSearch(q)
              setCustomerPage(1)
            }}
            columns={customerCols}
            isLoading={customer.isFetching}
            selectedIds={customerSelected}
            onSelectedIdsChange={setCustomerSelected}
            belowTable={
              <div className="flex justify-end gap-8 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>Given total: {formatDecimal(customerTotals.given)}</span>
                <span>Paid total: {formatDecimal(customerTotals.paid)}</span>
                <span>Balance total: {formatDecimal(customerTotals.balance)}</span>
              </div>
            }
            onDeleteOne={() => {}}
            onDeleteSelected={() => {}}
          />
        )}
      </div>
    )
  }

  if (kind === 'supplier') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Supplier balances</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleSupplierExport}
          >
            Print / Export
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {isSuperAdmin && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(supplierBusinessId ?? '')) ?? null}
                  onChange={(opt) => {
                    setSupplierBusinessId(opt ? Number(opt.value) : null)
                    setSupplierStationId(null)
                    setSupplierPayableAccountId(null)
                    setSupplierApplied(null)
                    setSupplierPage(1)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="w-full min-w-0 lg:w-52">
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={supplierStationOptions}
                  value={supplierStationOptions.find((o) => o.value === String(supplierStationId ?? '')) ?? null}
                  onChange={(opt) => {
                    setSupplierStationId(opt ? Number(opt.value) : null)
                    setSupplierPage(1)
                  }}
                  placeholder="All stations"
                  isClearable
                  isDisabled={effectiveSupplierBusinessId <= 0 || (isSuperAdmin && !supplierBusinessId)}
                />
              </div>
            )}
            <div className="w-full min-w-0 lg:w-72">
              <label className="mb-1 block text-sm font-medium text-slate-700">Payable account</label>
              <FormSelect
                options={payableAccountOptions}
                value={payableAccountOptions.find((o) => o.value === String(supplierPayableAccountId ?? '')) ?? null}
                onChange={(opt) => {
                  setSupplierPayableAccountId(opt ? Number(opt.value) : null)
                  setSupplierPage(1)
                }}
                placeholder="Select payable account"
                isDisabled={effectiveSupplierBusinessId <= 0}
                isSearchable
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={supplierFrom}
                onChange={(e) => setSupplierFrom(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:max-w-[11rem]">
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={supplierTo}
                onChange={(e) => setSupplierTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {effectiveSupplierBusinessId <= 0 && isSuperAdmin ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Select a business to run supplier balances.</p>
        ) : needsReportStation ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reportStationBlockedMessage}</p>
        ) : !routeCanView ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No view permission for this report.
          </p>
        ) : !supplierApplied ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Choose a payable account and optional dates. Results load automatically from journal activity on that account with supplier subledger links.
          </p>
        ) : (
          <DataTable<CustomerBalanceRow>
            readOnly
            title="Supplier balances"
            rows={supplierRowsPage}
            totalCount={supplierRowsFiltered.length}
            page={supplierPage}
            pageSize={supplierPageSize}
            onPageChange={setSupplierPage}
            onPageSizeChange={(n) => {
              setSupplierPageSize(n)
              setSupplierPage(1)
            }}
            search={supplierSearch}
            onSearchChange={(q) => {
              setSupplierSearch(q)
              setSupplierPage(1)
            }}
            columns={supplierCols}
            isLoading={supplier.isFetching}
            selectedIds={supplierSelected}
            onSelectedIdsChange={setSupplierSelected}
            belowTable={
              <div className="flex justify-end gap-8 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>Given total: {formatDecimal(supplierTotals.given)}</span>
                <span>Paid total: {formatDecimal(supplierTotals.paid)}</span>
                <span>Balance total: {formatDecimal(supplierTotals.balance)}</span>
              </div>
            }
            onDeleteOne={() => {}}
            onDeleteSelected={() => {}}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-600">Choose a financial report from the sidebar.</p>
    </div>
  )
}
