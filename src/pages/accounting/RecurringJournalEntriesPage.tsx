import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import {
  useCreateRecurringJournalEntryMutation,
  useDeleteRecurringJournalEntryMutation,
  useEnsureRecurringJournalPendingIfDueMutation,
  useGetAccountsQuery,
  useGetBusinessesQuery,
  useGetCustomerFuelGivensQuery,
  useGetRecurringJournalEntriesQuery,
  useGetStationsQuery,
  useGetSuppliersQuery,
  useGetTrialBalanceReportQuery,
  useUpdateRecurringJournalEntryMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { RecurringJournalConfirmModal } from '../../components/RecurringJournalConfirmModal'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { filterAccountsForViewer, filterBusinessLeafAccounts } from '../../lib/accountScope'
import { formatDecimal } from '../../lib/formatNumber'
import { isRecurringCreditAccount, isRecurringDebitAccount } from '../../lib/recurringAccountRules'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessPickerInForms,
  showStationColumnInTables,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { Account } from '../../types/models'

type RecurringRow = {
  id: number
  businessId: number
  stationId?: number | null
  name: string
  debitAccountId: number
  creditAccountId: number
  amount: number
  frequency: number
  startDate: string
  endDate?: string | null
  autoPost: boolean
  isPaused: boolean
  confirmWhenDue?: boolean
  pendingConfirmationRunDate?: string | null
  supplierId?: number | null
  customerFuelGivenId?: number | null
  lastRunDate?: string | null
  nextRunDate?: string | null
  postingUserId: number
}

const frequencyOptions: SelectOption[] = [
  { value: '0', label: 'Daily' },
  { value: '1', label: 'Weekly' },
  { value: '2', label: 'Monthly' },
  { value: '3', label: 'Yearly' },
]

function frequencyLabel(v: number): string {
  return frequencyOptions.find((o) => o.value === String(v))?.label ?? String(v)
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  return d || '—'
}

/** Calendar compare using YYYY-MM-DD (matches server UTC date logic). */
function ymdFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const y = iso.slice(0, 10)
  return y.length === 10 ? y : null
}

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatReviewTrialMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$ ${formatDecimal(Math.abs(n))}`
}

/** Same rules as the API for “due” for confirm-when-due (next run ≤ today, in start/end window). */
function calendarDueForConfirm(r: RecurringRow): boolean {
  const next = ymdFromIso(r.nextRunDate ?? null)
  const start = ymdFromIso(r.startDate)
  if (!next || !start) return false
  const today = utcTodayYmd()
  const end = r.endDate ? ymdFromIso(r.endDate) : null
  if (next > today || start > today) return false
  if (end != null && end < today) return false
  return true
}

function showReviewEye(r: RecurringRow): boolean {
  if (!r.confirmWhenDue || !r.autoPost || r.isPaused) return false
  return !!(r.pendingConfirmationRunDate || calendarDueForConfirm(r))
}

export function RecurringJournalEntriesPage() {
  const { canCreate: routeCanCreate, canUpdate: routeCanUpdate, canDelete: routeCanDelete } =
    usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const userId = useAppSelector((s) => s.auth.userId)
  const showBizPicker = showBusinessPickerInForms(role)
  const effectiveStationId = useEffectiveStationId()

  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)
  const effectiveBusinessId = showBizPicker ? (filterBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: rows = [], isFetching } = useGetRecurringJournalEntriesQuery(
    {
      businessId: effectiveBusinessId,
      ...(effectiveStationId != null && effectiveStationId > 0
        ? { filterStationId: effectiveStationId }
        : {}),
    },
    { skip: effectiveBusinessId <= 0 },
  )
  const accountsSkipped = effectiveBusinessId <= 0
  const { data: accountsPaged } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId },
    { skip: accountsSkipped },
  )
  const { data: customerFuelPaged } = useGetCustomerFuelGivensQuery(
    { page: 1, pageSize: 500 },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: suppliersPaged } = useGetSuppliersQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: stationsPaged } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )

  const [createRecurring, { isLoading: creating }] = useCreateRecurringJournalEntryMutation()
  const [updateRecurring, { isLoading: updating }] = useUpdateRecurringJournalEntryMutation()
  const [deleteRecurring] = useDeleteRecurringJournalEntryMutation()
  const [ensurePending, { isLoading: ensuringPending }] = useEnsureRecurringJournalPendingIfDueMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const pendingSyncAttempted = useRef(new Set<number>())

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringRow | null>(null)
  const [tableConfirmRow, setTableConfirmRow] = useState<RecurringRow | null>(null)
  const [viewRow, setViewRow] = useState<RecurringRow | null>(null)
  const [reviewAmount, setReviewAmount] = useState('')
  const [reviewActionError, setReviewActionError] = useState<string | null>(null)
  const [pageDueDismissedSnapshot, setPageDueDismissedSnapshot] = useState('')

  const pagePendingSnapshot = useMemo(
    () =>
      rows
        .filter((r) => r.pendingConfirmationRunDate)
        .map((r) => r.id)
        .sort((a, b) => a - b)
        .join(','),
    [rows],
  )

  useEffect(() => {
    if (effectiveBusinessId <= 0) return
    if (!pagePendingSnapshot) {
      setPageDueDismissedSnapshot('')
      return
    }
    if (tableConfirmRow != null) return
    if (pagePendingSnapshot !== pageDueDismissedSnapshot) {
      const first = rows.find((r) => r.pendingConfirmationRunDate)
      if (first) setTableConfirmRow(first)
    }
  }, [rows, effectiveBusinessId, pagePendingSnapshot, pageDueDismissedSnapshot, tableConfirmRow])

  useEffect(() => {
    if (effectiveBusinessId <= 0) return
    for (const r of rows) {
      if (!r.confirmWhenDue || !r.autoPost || r.isPaused) continue
      if (!calendarDueForConfirm(r) || r.pendingConfirmationRunDate) continue
      if (pendingSyncAttempted.current.has(r.id)) continue
      pendingSyncAttempted.current.add(r.id)
      void ensurePending({ id: r.id, body: { businessId: effectiveBusinessId } })
        .unwrap()
        .catch(() => pendingSyncAttempted.current.delete(r.id))
    }
  }, [rows, effectiveBusinessId, ensurePending])

  useEffect(() => {
    if (viewRow) setReviewAmount(String(viewRow.amount))
  }, [viewRow])

  const [name, setName] = useState('')
  const [debitAccountId, setDebitAccountId] = useState<number | null>(null)
  const [creditAccountId, setCreditAccountId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState(2)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [autoPost, setAutoPost] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [confirmWhenDue, setConfirmWhenDue] = useState(false)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [customerFuelGivenId, setCustomerFuelGivenId] = useState<number | null>(null)

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businesses?.items ?? []
    if (showBizPicker) return items.map((x) => ({ value: String(x.id), label: x.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businesses?.items, showBizPicker, authBusinessId])

  const leafAccounts = useMemo(() => {
    const raw = accountsPaged?.items ?? []
    const scoped = filterAccountsForViewer(raw, role, authBusinessId)
    return filterBusinessLeafAccounts(scoped)
  }, [accountsPaged?.items, role, authBusinessId])

  const accountById = useMemo(() => {
    const m = new Map<number, Account>()
    for (const a of leafAccounts) m.set(a.id, a)
    return m
  }, [leafAccounts])

  const debitOptions: SelectOption[] = useMemo(
    () =>
      leafAccounts
        .filter((a) => isRecurringDebitAccount(a))
        .map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
    [leafAccounts],
  )
  const creditOptions: SelectOption[] = useMemo(
    () =>
      leafAccounts
        .filter((a) => isRecurringCreditAccount(a))
        .map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
    [leafAccounts],
  )

  const supplierOptions: SelectOption[] = useMemo(
    () => (suppliersPaged?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [suppliersPaged?.items],
  )
  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsPaged?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsPaged?.items])

  const customerOptions: SelectOption[] = useMemo(
    () =>
      (customerFuelPaged?.items ?? [])
        .filter((c) => c.businessId === effectiveBusinessId)
        .map((c) => ({ value: String(c.id), label: `${c.name} (${c.phone})` })),
    [customerFuelPaged?.items, effectiveBusinessId],
  )

  const customerNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of customerFuelPaged?.items ?? []) m.set(c.id, c.name)
    return m
  }, [customerFuelPaged?.items])

  const supplierNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of suppliersPaged?.items ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersPaged?.items])

  const reviewTrialToDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const reviewTrialStationId =
    viewRow?.stationId != null && viewRow.stationId > 0 ? viewRow.stationId : undefined

  const { data: reviewTrialRows, isLoading: reviewTrialLoading } = useGetTrialBalanceReportQuery(
    {
      businessId: effectiveBusinessId,
      to: reviewTrialToDate,
      trialBalanceMode: 'adjusted',
      ...(reviewTrialStationId != null ? { stationId: reviewTrialStationId } : {}),
    },
    { skip: !viewRow || effectiveBusinessId <= 0 },
  )

  const reviewBalanceByAccountId = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of reviewTrialRows ?? []) {
      const row = r as { accountId: number; balance: number }
      if (row.accountId != null) m.set(row.accountId, Number(row.balance ?? 0))
    }
    return m
  }, [reviewTrialRows])

  const stationListCount = (stationsPaged?.items ?? []).length
  const formError = useMemo(() => {
    if (!name.trim()) return 'Expense / entry name is required.'
    if (debitAccountId == null || creditAccountId == null) return 'Select debit and credit accounts.'
    if (debitAccountId === creditAccountId) return 'Debit and credit must be different accounts.'
    const n = Number.parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return 'Amount must be greater than zero.'
    if (endDate.trim()) {
      if (endDate < startDate) return 'End date must be on or after start date.'
    }
    if (
      stationListCount > 0 &&
      autoPost &&
      (effectiveStationId == null || effectiveStationId <= 0)
    ) {
      return SETTINGS_STATION_HINT
    }
    if (confirmWhenDue && !autoPost) return 'Confirm when due requires Auto-post to be enabled.'
    return null
  }, [
    name,
    debitAccountId,
    creditAccountId,
    amount,
    endDate,
    startDate,
    stationListCount,
    autoPost,
    effectiveStationId,
    confirmWhenDue,
  ])

  function resetForm() {
    setEditing(null)
    setName('')
    setDebitAccountId(null)
    setCreditAccountId(null)
    setAmount('')
    setFrequency(2)
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate('')
    setAutoPost(true)
    setIsPaused(false)
    setConfirmWhenDue(false)
    setSupplierId(null)
    setCustomerFuelGivenId(null)
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  function openEdit(row: RecurringRow) {
    setEditing(row)
    setName(row.name)
    setDebitAccountId(row.debitAccountId)
    setCreditAccountId(row.creditAccountId)
    setAmount(String(row.amount))
    setFrequency(row.frequency)
    setStartDate(row.startDate.slice(0, 10))
    setEndDate(row.endDate ? row.endDate.slice(0, 10) : '')
    setAutoPost(row.autoPost)
    setIsPaused(row.isPaused)
    setConfirmWhenDue(!!row.confirmWhenDue)
    setSupplierId(row.supplierId && row.supplierId > 0 ? row.supplierId : null)
    setCustomerFuelGivenId(
      row.customerFuelGivenId && row.customerFuelGivenId > 0 ? row.customerFuelGivenId : null,
    )
    setOpen(true)
  }

  async function save() {
    if (formError != null || effectiveBusinessId <= 0) return
    const postingUserId = userId && userId > 0 ? userId : 0
    const stationId =
      effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : null
    const body: Record<string, unknown> = {
      businessId: effectiveBusinessId,
      stationId,
      name: name.trim(),
      debitAccountId,
      creditAccountId,
      amount: String(Number.parseFloat(amount.replace(',', '.')) || 0),
      frequency,
      startDate: `${startDate}T12:00:00.000Z`,
      endDate: endDate.trim() ? `${endDate.trim()}T12:00:00.000Z` : null,
      autoPost,
      isPaused,
      confirmWhenDue: autoPost && confirmWhenDue,
      supplierId: supplierId && supplierId > 0 ? supplierId : null,
      customerFuelGivenId: customerFuelGivenId && customerFuelGivenId > 0 ? customerFuelGivenId : null,
      postingUserId,
    }
    if (editing) {
      await updateRecurring({ id: editing.id, body }).unwrap()
    } else {
      await createRecurring(body).unwrap()
    }
    setOpen(false)
    resetForm()
  }

  async function requestConfirmFromReview() {
    setReviewActionError(null)
    if (!viewRow || effectiveBusinessId <= 0) return
    const amt = Number.parseFloat(reviewAmount.replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) {
      setReviewActionError('Amount must be greater than zero.')
      return
    }
    let row: RecurringRow = { ...viewRow, amount: amt }
    try {
      if (!row.pendingConfirmationRunDate) {
        const updated = (await ensurePending({
          id: row.id,
          body: { businessId: effectiveBusinessId },
        }).unwrap()) as RecurringRow
        row = { ...row, ...updated, amount: amt }
      }
      if (!row.pendingConfirmationRunDate) {
        setReviewActionError(
          'This run is not queued for confirmation yet. Save the template again, check the accounting period for this date, or wait a moment after opening this page.',
        )
        return
      }
      setTableConfirmRow(row)
      setViewRow(null)
    } catch {
      setReviewActionError('Could not reach the server. Try again.')
    }
  }

  const cols: Column<RecurringRow>[] = useMemo(() => {
    const c: Column<RecurringRow>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }]
    if (showStationColumnInTables(role)) {
      c.push({
        key: 'stationId',
        header: 'Station',
        render: (r) => (r.stationId ? (stationNameById.get(r.stationId) ?? `#${r.stationId}`) : '—'),
      })
    }
    c.push(
      {
        key: 'debit',
        header: 'Debit',
        render: (r) => {
          const a = accountById.get(r.debitAccountId)
          return a ? `${a.code} ${a.name}` : `#${r.debitAccountId}`
        },
      },
      {
        key: 'credit',
        header: 'Credit',
        render: (r) => {
          const a = accountById.get(r.creditAccountId)
          return a ? `${a.code} ${a.name}` : `#${r.creditAccountId}`
        },
      },
      { key: 'amount', header: 'Amount', render: (r) => String(r.amount) },
      { key: 'frequency', header: 'Frequency', render: (r) => frequencyLabel(r.frequency) },
      { key: 'next', header: 'Next run', render: (r) => formatDateShort(r.nextRunDate) },
      {
        key: 'due',
        header: 'Due confirm',
        render: (r) =>
          r.pendingConfirmationRunDate ? (
            <button
              type="button"
              className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-200"
              onClick={(e) => {
                e.stopPropagation()
                setTableConfirmRow(r)
              }}
            >
              Confirm posting
            </button>
          ) : r.confirmWhenDue && r.autoPost && !r.isPaused ? (
            <span className="text-xs text-slate-500">Prompts when due</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'auto',
        header: 'Auto',
        render: (r) =>
          r.autoPost
            ? r.isPaused
              ? 'Paused'
              : r.confirmWhenDue
                ? 'On (confirm)'
                : 'On'
            : 'Off',
      },
    )
    return c
  }, [accountById, role, stationNameById])

  return (
    <>
      {showBizPicker && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
          <div className="max-w-sm">
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
              onChange={(opt) => setFilterBusinessId(opt ? Number(opt.value) : null)}
              placeholder="Select business"
            />
          </div>
        </div>
      )}
      <DataTable<RecurringRow>
        title="Recurring journal entries"
        addLabel="Add recurring entry"
        rows={rows}
        totalCount={rows.length}
        page={1}
        pageSize={Math.max(rows.length, 1)}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        hideSearch={true}
        showRowSelection={false}
        search=""
        onSearchChange={() => {}}
        columns={cols}
        isLoading={isFetching}
        selectedIds={new Set()}
        onSelectedIdsChange={() => {}}
        onAdd={
          routeCanCreate &&
          effectiveBusinessId > 0 &&
          !adminNeedsSettingsStation(role, effectiveStationId)
            ? openCreate
            : undefined
        }
        onEdit={routeCanUpdate && effectiveBusinessId > 0 ? (row) => openEdit(row) : undefined}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete recurring entry?',
            description: 'Scheduled runs will stop; existing posted journals are unchanged.',
            action: async () => {
              await deleteRecurring(id).unwrap()
            },
          })
        }
        onDeleteSelected={() => {}}
        tableActionPermissions={{
          canCreate: routeCanCreate,
          canUpdate: routeCanUpdate,
          canDelete: routeCanDelete,
        }}
        renderExtraRowActions={(row) =>
          showReviewEye(row) ? (
            <button
              type="button"
              title="Review before confirming"
              onClick={() => {
                setReviewActionError(null)
                setReviewAmount(String(row.amount))
                setViewRow(row)
              }}
              className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Eye className="h-4 w-4" />
            </button>
          ) : null
        }
      />

      {effectiveBusinessId <= 0 && showBizPicker ? (
        <p className="mt-2 text-sm text-amber-800">Select a business to manage recurring journals.</p>
      ) : null}
      {effectiveBusinessId > 0 && adminNeedsSettingsStation(role, effectiveStationId) ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {SETTINGS_STATION_HINT}
        </p>
      ) : null}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          resetForm()
        }}
        title={editing ? 'Edit recurring journal' : 'New recurring journal'}
        className="max-w-lg"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expense / entry name</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {stationListCount > 0 && effectiveStationId != null && effectiveStationId > 0 ? (
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Auto-posted journals use your workspace station:{' '}
              <span className="font-medium text-slate-800">
                {stationNameById.get(effectiveStationId) ?? `Station #${effectiveStationId}`}
              </span>
              . Change it under <strong>Settings</strong> (Workspace) or from the sidebar station control.
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Debit account</label>
            <FormSelect
              options={debitOptions}
              value={debitOptions.find((o) => o.value === String(debitAccountId ?? '')) ?? null}
              onChange={(o) => setDebitAccountId(o ? Number(o.value) : null)}
              placeholder="Asset, expense, or COGS"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Credit account</label>
            <FormSelect
              options={creditOptions}
              value={creditOptions.find((o) => o.value === String(creditAccountId ?? '')) ?? null}
              onChange={(o) => setCreditAccountId(o ? Number(o.value) : null)}
              placeholder="Liability, equity, or cash (asset)"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Frequency</label>
            <FormSelect
              options={frequencyOptions}
              value={frequencyOptions.find((o) => o.value === String(frequency)) ?? null}
              onChange={(o) => setFrequency(o ? Number(o.value) : 2)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => {
                const v = e.target.checked
                setAutoPost(v)
                if (!v) setConfirmWhenDue(false)
              }}
            />
            Auto-post when due
          </label>
          <label
            className={`flex items-start gap-2 text-sm ${autoPost ? 'text-slate-700' : 'cursor-not-allowed text-slate-400'}`}
          >
            <input
              type="checkbox"
              disabled={!autoPost}
              checked={confirmWhenDue && autoPost}
              onChange={(e) => setConfirmWhenDue(e.target.checked)}
            />
            <span>
              Confirm before posting when due
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                If checked, you will be asked to confirm (and you may change the amount) when a run is due. If
                unchecked, posting runs silently in the background.
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isPaused} onChange={(e) => setIsPaused(e.target.checked)} />
            Paused
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Supplier (optional)</label>
            <FormSelect
              options={supplierOptions}
              value={supplierOptions.find((o) => o.value === String(supplierId ?? '')) ?? null}
              onChange={(o) => setSupplierId(o ? Number(o.value) : null)}
              isClearable
              placeholder="None"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer (AR tag, optional)</label>
            <FormSelect
              options={customerOptions}
              value={customerOptions.find((o) => o.value === String(customerFuelGivenId ?? '')) ?? null}
              onChange={(o) => setCustomerFuelGivenId(o ? Number(o.value) : null)}
              isClearable
              placeholder="None"
            />
          </div>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                !!formError ||
                creating ||
                updating ||
                effectiveBusinessId <= 0 ||
                (editing ? !routeCanUpdate : !routeCanCreate)
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void save()}
            >
              {editing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
      {viewRow && effectiveBusinessId > 0 ? (
        <Modal
          open
          onClose={() => {
            setViewRow(null)
            setReviewActionError(null)
          }}
          title="Review recurring journal"
          className="max-w-6xl"
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p className="text-slate-600">
              Review the line below. Edit <strong>Amount</strong> if needed, then continue to post.
            </p>
            <p className="text-xs text-slate-500">
              <strong>Debit balance</strong> / <strong>Credit balance</strong> use the adjusted trial balance through
              today
              {reviewTrialStationId != null ? ` (station #${reviewTrialStationId})` : ''}, same basis as the chart of
              accounts tree.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-max min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Name</th>
                    {showStationColumnInTables(role) ? (
                      <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Station</th>
                    ) : null}
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Debit</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-600">
                      Debit balance
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Credit</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-600">
                      Credit balance
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Amount</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Frequency</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Start</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">End</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Next run</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">
                      Awaiting confirm
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Supplier</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Customer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-white hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{viewRow.name}</td>
                    {showStationColumnInTables(role) ? (
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {viewRow.stationId
                          ? (stationNameById.get(viewRow.stationId) ?? `Station #${viewRow.stationId}`)
                          : '—'}
                      </td>
                    ) : null}
                    <td className="max-w-[14rem] whitespace-normal px-3 py-2 text-slate-700">
                      {(() => {
                        const a = accountById.get(viewRow.debitAccountId)
                        return a ? `${a.code} ${a.name}` : `#${viewRow.debitAccountId}`
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                      {reviewTrialLoading
                        ? '…'
                        : formatReviewTrialMoney(reviewBalanceByAccountId.get(viewRow.debitAccountId) ?? 0)}
                    </td>
                    <td className="max-w-[14rem] whitespace-normal px-3 py-2 text-slate-700">
                      {(() => {
                        const a = accountById.get(viewRow.creditAccountId)
                        return a ? `${a.code} ${a.name}` : `#${viewRow.creditAccountId}`
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                      {reviewTrialLoading
                        ? '…'
                        : formatReviewTrialMoney(reviewBalanceByAccountId.get(viewRow.creditAccountId) ?? 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={reviewAmount}
                        onChange={(e) => setReviewAmount(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        aria-label="Amount to post"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {frequencyLabel(viewRow.frequency)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {formatDateShort(viewRow.startDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDateShort(viewRow.endDate)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                      {formatDateShort(viewRow.nextRunDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-amber-950">
                      {viewRow.pendingConfirmationRunDate
                        ? formatDateShort(viewRow.pendingConfirmationRunDate)
                        : calendarDueForConfirm(viewRow)
                          ? '— (use Confirm below)'
                          : '—'}
                    </td>
                    <td className="max-w-[10rem] whitespace-normal px-3 py-2 text-slate-700">
                      {viewRow.supplierId && viewRow.supplierId > 0
                        ? (supplierNameById.get(viewRow.supplierId) ?? `#${viewRow.supplierId}`)
                        : '—'}
                    </td>
                    <td className="max-w-[10rem] whitespace-normal px-3 py-2 text-slate-700">
                      {viewRow.customerFuelGivenId && viewRow.customerFuelGivenId > 0
                        ? (customerNameById.get(viewRow.customerFuelGivenId) ?? `#${viewRow.customerFuelGivenId}`)
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {reviewActionError ? <p className="text-sm text-rose-600">{reviewActionError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setViewRow(null)
                  setReviewActionError(null)
                }}
              >
                Close
              </button>
              {showReviewEye(viewRow) ? (
                <button
                  type="button"
                  disabled={ensuringPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => void requestConfirmFromReview()}
                >
                  {ensuringPending ? 'Working…' : 'Confirm posting…'}
                </button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {tableConfirmRow && effectiveBusinessId > 0 ? (
        <RecurringJournalConfirmModal
          open
          onLater={() => {
            setPageDueDismissedSnapshot(pagePendingSnapshot)
            setTableConfirmRow(null)
          }}
          onPosted={() => setTableConfirmRow(null)}
          businessId={effectiveBusinessId}
          showStationColumn={showStationColumnInTables(role)}
          pendingRows={[
            {
              id: tableConfirmRow.id,
              name: tableConfirmRow.name,
              amount: tableConfirmRow.amount,
              pendingConfirmationRunDate: tableConfirmRow.pendingConfirmationRunDate ?? null,
              stationId: tableConfirmRow.stationId,
              stationName: tableConfirmRow.stationId
                ? (stationNameById.get(tableConfirmRow.stationId) ?? null)
                : null,
              debitAccountId: tableConfirmRow.debitAccountId,
              creditAccountId: tableConfirmRow.creditAccountId,
              debitLabel: (() => {
                const a = accountById.get(tableConfirmRow.debitAccountId)
                return a ? `${a.code} ${a.name}` : null
              })(),
              creditLabel: (() => {
                const a = accountById.get(tableConfirmRow.creditAccountId)
                return a ? `${a.code} ${a.name}` : null
              })(),
              frequency: tableConfirmRow.frequency,
              startDate: tableConfirmRow.startDate,
              endDate: tableConfirmRow.endDate ?? null,
              nextRunDate: tableConfirmRow.nextRunDate ?? null,
              supplierLabel:
                tableConfirmRow.supplierId && tableConfirmRow.supplierId > 0
                  ? (supplierNameById.get(tableConfirmRow.supplierId) ?? null)
                  : null,
              customerLabel:
                tableConfirmRow.customerFuelGivenId && tableConfirmRow.customerFuelGivenId > 0
                  ? (customerNameById.get(tableConfirmRow.customerFuelGivenId) ?? null)
                  : null,
            },
          ]}
        />
      ) : null}
      {deleteDialog}
    </>
  )
}
