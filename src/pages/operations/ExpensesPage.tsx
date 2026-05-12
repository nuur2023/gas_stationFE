import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useGetBusinessesQuery,
  useGetCurrenciesQuery,
  useGetExpensesQuery,
  useGetFuelPricesQuery,
  useGetPermissionContextUsersQuery,
  useGetRatesQuery,
  useGetStationsQuery,
  useGetUsersQuery,
  useUpdateExpenseMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { DateField } from '../../components/DateField'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatCurrency, formatDecimal, formatDecimalFlexible, formatWithCurrencySymbol, parseNumericInput } from '../../lib/formatNumber'
import { formatRateNumber } from '../../lib/formatRateNumber'
import { useDebouncedValue } from '../../lib/hooks'
import {
  adminNeedsSettingsStation,
  resolveFormStationId,
  SETTINGS_STATION_HINT,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { Expense, ExpenseWriteRequest } from '../../types/models'

type ExpenseFormTab = 'expense' | 'exchange'
type ExpenseEntryKind = 'Expense' | 'Exchange' | 'cashOrUsdTaken'
type ExpenseSideAction = 'Operation' | 'Management'

export function ExpensesPage({
  expenseKind = 'Expense',
  sideAction,
}: {
  expenseKind?: ExpenseEntryKind
  sideAction?: ExpenseSideAction
}) {
  const location = useLocation()
  const resolvedSideAction: ExpenseSideAction =
    sideAction ?? (location.pathname.startsWith('/management/') ? 'Management' : 'Operation')
  const isManagementSide = resolvedSideAction === 'Management'
  const isExchangePage = expenseKind === 'Exchange'
  const isCashOrUsdTakenPage = expenseKind === 'cashOrUsdTaken'
  const pageTitle = isExchangePage ? 'Exchange' : isCashOrUsdTakenPage ? 'Cash or USD Taken' : 'Expenses'
  const addLabel = isExchangePage ? 'Add exchange' : isCashOrUsdTakenPage ? 'Add cash or USD taken' : 'Add expense'
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetExpensesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    type: expenseKind,
    sideAction: resolvedSideAction,
    // Management entries are stored with NULL StationId, so we never filter by station for them —
    // otherwise the workspace station scope would hide every row.
    ...(!isManagementSide && effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  })
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  /** Users list omits Admin/SuperAdmin for non–SuperAdmin; context-users includes all linked users. */
  const { data: permissionContextUsers } = useGetPermissionContextUsersQuery(
    {},
    { skip: isSuperAdmin || authBusinessId == null || authBusinessId <= 0 },
  )
  const { data: ratesData } = useGetRatesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: fuelPrices = [] } = useGetFuelPricesQuery()
  const { data: currencies = [] } = useGetCurrenciesQuery()
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stationsForTable } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveFormBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: stationsForForm } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [createExp] = useCreateExpenseMutation()
  const [updateExp] = useUpdateExpenseMutation()
  const [deleteExp] = useDeleteExpenseMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseWriteRequest>({
    type: expenseKind,
    sideAction: resolvedSideAction,
    description: '',
    currencyId: 0,
    localAmount: '0',
    rate: '0',
    amountUsd: '0',
    stationId: isManagementSide ? null : 0,
  })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [localAmountFocused, setLocalAmountFocused] = useState(false)
  const [rateFocused, setRateFocused] = useState(false)
  const [amountUsdFocused, setAmountUsdFocused] = useState(false)
  const [formTab, setFormTab] = useState<ExpenseFormTab>(isExchangePage ? 'exchange' : 'expense')
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10))
  const expenseBusinessContextRef = useRef<number | null>(null)
  /** Exchange tab: user typed Amount USD; cleared when local amount or rate changes so auto-fill applies again. */
  const exchangeUsdManualRef = useRef(false)

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) {
      return items.map((b) => ({ value: String(b.id), label: b.name }))
    }
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])

  const stationOptionsBase: SelectOption[] = useMemo(
    () => (stationsForForm?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsForForm?.items],
  )

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const stationSel = stationOptionsBase.find((o) => o.value === String(form.stationId ?? '')) ?? null

  const userNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usersData?.items ?? []) {
      m.set(u.id, u.name)
    }
    for (const u of permissionContextUsers ?? []) {
      m.set(u.id, u.name)
    }
    return m
  }, [usersData, permissionContextUsers])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsForTable?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsForTable?.items])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const expenseCurrencySymbolByBusinessStation = useMemo(() => {
    const currencyById = new Map(currencies.map((c) => [c.id, c.symbol]))
    const out = new Map<string, string>()
    for (const fp of fuelPrices) {
      const sym = currencyById.get(fp.currencyId)
      if (!sym) continue
      const k = `${fp.businessId}:${fp.stationId}`
      if (!out.has(k)) out.set(k, sym)
    }
    return out
  }, [fuelPrices, currencies])
  const currencySymbolByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of currencies) m.set(c.code.toUpperCase(), c.symbol)
    return m
  }, [currencies])
  const currencyById = useMemo(() => {
    const m = new Map<number, { code: string; symbol: string }>()
    for (const c of currencies) m.set(c.id, { code: c.code.toUpperCase(), symbol: c.symbol })
    return m
  }, [currencies])
  /** All currencies from setup (Currencies API), same as Management → Currencies. */
  const currencyOptionsForForm = useMemo(
    () =>
      [...currencies]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((c) => ({ value: String(c.id), label: `${c.code.trim().toUpperCase()} (${c.symbol})` })),
    [currencies],
  )
  const preferredDefaultCurrencyId = useMemo(() => {
    const ssp = currencies.find((c) => c.code.trim().toUpperCase() === 'SSP')
    if (ssp && currencyOptionsForForm.some((o) => Number(o.value) === ssp.id)) return ssp.id
    const first = Number(currencyOptionsForForm[0]?.value)
    return Number.isFinite(first) && first > 0 ? first : 0
  }, [currencies, currencyOptionsForForm])
  const currencySel = currencyOptionsForForm.find((o) => Number(o.value) === form.currencyId) ?? null
  const formCurrencyCode = (currencyById.get(form.currencyId)?.code ?? '').trim().toUpperCase()

  const activeRateStr = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    const items = ratesData?.items ?? []
    const active = items.filter((r) => r.active && r.businessId === effectiveFormBusinessId)
    if (active.length === 0) return null
    active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return formatRateNumber(active[0].rateNumber)
  }, [ratesData, effectiveFormBusinessId])

  useEffect(() => {
    if (isManagementSide) return
    if (!open || !showStationPicker || formBusinessId == null || formBusinessId <= 0) return
    const items = stationsForForm?.items ?? []
    if (items.length === 0) return
    setForm((f) => {
      const sid = f.stationId ?? 0
      if (sid > 0 && items.some((s) => s.id === sid)) return f
      return { ...f, stationId: items[0].id }
    })
  }, [open, showStationPicker, formBusinessId, stationsForForm?.items, isManagementSide])

  useEffect(() => {
    if (isManagementSide) return
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setForm((f) => (f.stationId === sid ? f : { ...f, stationId: sid }))
  }, [open, showStationPicker, effectiveStationId, isManagementSide])

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const needsWorkspaceStation = !isManagementSide && adminNeedsSettingsStation(role, effectiveStationId)

  const localInputValue = useMemo(() => {
    if (localAmountFocused) return form.localAmount
    if (form.localAmount.trim() === '') return ''
    const n = parseNumericInput(form.localAmount)
    if (!Number.isFinite(n)) return form.localAmount
    return formatDecimal(n)
  }, [form.localAmount, localAmountFocused])

  const rateInputValue = useMemo(() => {
    if (rateFocused) return form.rate
    if (form.rate.trim() === '') return ''
    const n = parseNumericInput(form.rate)
    if (!Number.isFinite(n)) return form.rate
    return formatDecimalFlexible(n)
  }, [form.rate, rateFocused])

  const amountUsdInputValue = useMemo(() => {
    if (amountUsdFocused) return form.amountUsd
    if (form.amountUsd.trim() === '') return ''
    const n = parseNumericInput(form.amountUsd)
    if (!Number.isFinite(n)) return form.amountUsd
    return formatDecimal(n)
  }, [form.amountUsd, amountUsdFocused])

  const computedUsd = useMemo(() => {
    const local = parseNumericInput(form.localAmount)
    const rate = parseNumericInput(form.rate)
    if (!Number.isFinite(local) || !Number.isFinite(rate) || rate <= 0) return 0
    return local / rate
  }, [form.localAmount, form.rate])

  function usdFromLocalOverRateRounded2(usd: number): string {
    if (!Number.isFinite(usd) || usd < 0) return '0.00'
    return (Math.round(usd * 100) / 100).toFixed(2)
  }

  function sanitizeDecimalTyping(raw: string): string {
    let v = raw.replace(/,/g, '').replace(/[^\d.]/g, '')
    const firstDot = v.indexOf('.')
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
    }
    return v
  }

  const canSave = useMemo(() => {
    if (needsBusiness || needsWorkspaceStation) return false
    if (!isManagementSide) {
      const stationId = resolveFormStationId(role, form.stationId ?? 0, effectiveStationId)
      if (stationId <= 0) return false
    }
    const local = parseNumericInput(form.localAmount)
    const rate = parseNumericInput(form.rate)
    const usd = parseNumericInput(form.amountUsd)
    if (!(form.description.trim().length > 0 && form.currencyId > 0 && Number.isFinite(local) && local > 0)) {
      return false
    }
    if (formTab === 'exchange') {
      const isUsd = formCurrencyCode === 'USD'
      if (isUsd) return Number.isFinite(usd) && usd >= 0
      return Number.isFinite(rate) && rate > 0 && Number.isFinite(usd) && usd >= 0
    }
    return true
  }, [
    needsBusiness,
    needsWorkspaceStation,
    isManagementSide,
    role,
    effectiveStationId,
    form.stationId,
    form.localAmount,
    form.rate,
    form.amountUsd,
    form.description,
    form.currencyId,
    formTab,
    formCurrencyCode,
  ])

  /** Re-apply auto USD when local or rate changes (Exchange tab manual override is dropped). */
  useEffect(() => {
    exchangeUsdManualRef.current = false
  }, [form.localAmount, form.rate])

  /** Keep Amount USD = local ÷ rate when not USD currency (Expense always; Exchange unless user is editing USD). */
  useEffect(() => {
    if (!open || amountUsdFocused) return
    if (formCurrencyCode === 'USD') return
    if (formTab === 'exchange' && exchangeUsdManualRef.current) return
    const next = usdFromLocalOverRateRounded2(computedUsd)
    setForm((f) => (f.amountUsd === next ? f : { ...f, amountUsd: next }))
  }, [computedUsd, amountUsdFocused, open, formTab, formCurrencyCode])

  /** When business context changes (new row or different business), apply active rate if any; else allow manual rate. */
  useEffect(() => {
    if (!open) {
      expenseBusinessContextRef.current = null
      return
    }
    if (editing || needsBusiness) return
    const bid = effectiveFormBusinessId
    if (bid == null || bid <= 0) return
    if (expenseBusinessContextRef.current === bid) return
    expenseBusinessContextRef.current = bid
    setForm((f) => ({ ...f, rate: activeRateStr ?? '0' }))
  }, [open, editing, needsBusiness, effectiveFormBusinessId, activeRateStr])

  function openCreate() {
    setEditing(null)
    setFormTab(isExchangePage ? 'exchange' : 'expense')
    exchangeUsdManualRef.current = false
    setLocalAmountFocused(false)
    setRateFocused(false)
    setAmountUsdFocused(false)
    if (showBizPicker) {
      setFormBusinessId(null)
    }
    const defaultSt = isManagementSide
      ? null
      : effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : stationsForForm?.items[0]?.id ?? 0
    setForm({
      type: expenseKind,
      sideAction: resolvedSideAction,
      description: '',
      currencyId: preferredDefaultCurrencyId,
      localAmount: '0',
      rate: '0',
      amountUsd: '0',
      stationId: defaultSt,
    })
    setRecordDate(new Date().toISOString().slice(0, 10))
    setOpen(true)
  }

  function openEdit(row: Expense) {
    setEditing(row)
    setFormTab(isExchangePage ? 'exchange' : 'expense')
    exchangeUsdManualRef.current = false
    setLocalAmountFocused(false)
    setRateFocused(false)
    setAmountUsdFocused(false)
    if (showBizPicker) {
      setFormBusinessId(row.businessId)
    }
    setForm({
      type: expenseKind,
      sideAction: resolvedSideAction,
      description: row.description,
      currencyId: row.currencyId > 0 ? row.currencyId : preferredDefaultCurrencyId,
      localAmount: String(row.localAmount),
      rate: String(row.rate),
      amountUsd: String(row.amountUsd),
      stationId: isManagementSide ? null : row.stationId ?? 0,
    })
    setRecordDate(row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const resolvedStationId = isManagementSide
      ? null
      : resolveFormStationId(role, form.stationId ?? 0, effectiveStationId)
    const body: ExpenseWriteRequest = {
      ...form,
      type: expenseKind,
      sideAction: resolvedSideAction,
      stationId: resolvedStationId,
      localAmount: form.localAmount.replace(/,/g, ''),
      rate: form.rate.replace(/,/g, ''),
      amountUsd: form.amountUsd.replace(/,/g, ''),
      date: `${recordDate}T12:00:00.000Z`,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    if (editing) {
      await updateExp({ id: editing.id, body }).unwrap()
    } else {
      await createExp(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete expense?',
      description: 'This record will be removed.',
      action: async () => {
        await deleteExp(id).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(id)
          return n
        })
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected?',
      description: `Remove ${ids.length} expense(s)?`,
      action: async () => {
        for (const id of ids) {
          await deleteExp(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  const tableColumns: Column<Expense>[] = useMemo(() => {
    const idCol: Column<Expense> = { key: 'id', header: 'ID' }
    const businessCol: Column<Expense> = {
      key: 'businessId',
      header: 'Business',
      render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
    }
    const middle: Column<Expense>[] = [
      {
        key: 'date',
        header: 'Date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
    ]
    const stationCol: Column<Expense> = {
      key: 'stationId',
      header: 'Station',
      render: (r) => {
        if (r.stationId == null || r.stationId <= 0) return <span className="text-slate-400">—</span>
        return stationNameById.get(r.stationId) ?? r.stationId
      },
    }
    const tail: Column<Expense>[] = [
      { key: 'description', header: 'Description' },
      {
        key: 'currencyId',
        header: 'Currency',
        render: (r) => currencyById.get(r.currencyId)?.code.toUpperCase() ?? `#${r.currencyId}`,
      },
      {
        key: 'Rate',
        header: 'Rate',
        render: (r) => {
          const code = (currencyById.get(r.currencyId)?.code ?? '').trim().toUpperCase()
          const isUsd = code === 'USD'
          if (isUsd) return '----'
          return formatWithCurrencySymbol(
            Number(r.rate),
            currencySymbolByCode.get(code) ??
              expenseCurrencySymbolByBusinessStation.get(`${r.businessId}:${r.stationId}`),
          )
        },
      },
      {
        key: 'localAmount',
        header: 'Local',
        render: (r) => {
          const code = (currencyById.get(r.currencyId)?.code ?? '').trim().toUpperCase()
          const isUsd = code === 'USD'
          const sym =
            currencySymbolByCode.get(code) ??
            expenseCurrencySymbolByBusinessStation.get(`${r.businessId}:${r.stationId}`)
          if (isUsd) return formatWithCurrencySymbol(0, sym)
          return formatWithCurrencySymbol(Number(r.localAmount), sym)
        },
      },
      {
        key: 'amountUsd',
        header: 'USD',
        render: (r) => formatCurrency(Number(r.amountUsd), 'USD'),
      },
      {
        key: 'userId',
        header: 'User',
        render: (r) => userNameById.get(r.userId) ?? `#${r.userId}`,
      },
    ]
    const out: Column<Expense>[] = [idCol]
    if (showBusinessColumnInTables(role)) out.push(businessCol)
    out.push(...middle)
    // Management entries have no station context, so we drop the column entirely on the
    // Management routes to avoid a permanent dash placeholder.
    if (!isManagementSide && showStationColumnInTables(role)) out.push(stationCol)
    out.push(...tail)
    return out
  }, [role, isManagementSide, stationNameById, userNameById, businessNameById, expenseCurrencySymbolByBusinessStation, currencySymbolByCode, currencyById])

  return (
    <>
      {deleteDialog}
      <DataTable<Expense>
        title={pageTitle}
        addLabel={addLabel}
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeleteOne={handleDeleteOne}
        onDeleteSelected={handleDeleteSelected}
        columns={tableColumns}
      />
      <Modal open={open} title={editing ? `Edit ${pageTitle.toLowerCase()}` : addLabel} onClose={() => setOpen(false)} className="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3">
          {formTab === 'expense' && !isCashOrUsdTakenPage && (
            <p className="text-xs text-slate-500">
              Expense entries are saved as regular operating expense rows.
            </p>
          )}
          {isCashOrUsdTakenPage && (
            <p className="text-xs text-slate-500">Cash or USD taken entries are tracked separately from regular expenses.</p>
          )}
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setForm((f) => ({ ...f, stationId: 0 }))
                }}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? 'Select a business to load stations and the active exchange rate.'
                : 'No business assigned to your account.'}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          {showStationPicker && !isManagementSide && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) => setForm((f) => ({ ...f, stationId: o ? Number(o.value) : 0 }))}
                placeholder={needsBusiness ? 'Select business first' : 'Select station'}
                isDisabled={needsBusiness || stationOptionsBase.length === 0}
              />
            </div>
          )}
          {isManagementSide && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Management entries are recorded at the business level — no station is required.
            </p>
          )}
          <DateField value={recordDate} onChange={setRecordDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <FormSelect
              options={currencyOptionsForForm}
              value={currencySel}
              onChange={(o) => setForm((f) => ({ ...f, currencyId: o ? Number(o.value) : 0 }))}
              placeholder="Select currency"
            />
            <p className="mt-1 text-xs text-slate-500">Currencies come from Setup → Currencies (same list for every station).</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Local amount</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={localInputValue}
              onChange={(e) => setForm((f) => ({ ...f, localAmount: sanitizeDecimalTyping(e.target.value) }))}
              onFocus={() => setLocalAmountFocused(true)}
              onBlur={() => {
                setLocalAmountFocused(false)
                setForm((f) => {
                  const n = parseNumericInput(f.localAmount)
                  return { ...f, localAmount: Number.isFinite(n) ? String(n) : '0' }
                })
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
            />
          </div>
          {formTab === 'exchange' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Rate</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={rateInputValue}
                  onChange={(e) => setForm((f) => ({ ...f, rate: sanitizeDecimalTyping(e.target.value) }))}
                  onFocus={() => setRateFocused(true)}
                  onBlur={() => {
                    setRateFocused(false)
                    setForm((f) => {
                      const n = parseNumericInput(f.rate)
                      return { ...f, rate: Number.isFinite(n) ? String(n) : '0' }
                    })
                  }}
                  title="Exchange rate for this entry (manual)."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums text-slate-800"
                />
                {!editing && !needsBusiness && activeRateStr === null && (
                  <p className="mt-1 text-xs text-amber-800">
                    No active rate on file. Enter the rate above, or add one under Rates.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount USD</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={amountUsdInputValue}
                  onChange={(e) => {
                    exchangeUsdManualRef.current = true
                    setForm((f) => ({ ...f, amountUsd: sanitizeDecimalTyping(e.target.value) }))
                  }}
                  onFocus={() => setAmountUsdFocused(true)}
                  onBlur={() => {
                    setAmountUsdFocused(false)
                    setForm((f) => {
                      const n = parseNumericInput(f.amountUsd)
                      return { ...f, amountUsd: Number.isFinite(n) ? String(n) : '0' }
                    })
                  }}
                  title="Defaults to local amount ÷ rate (2 decimals). Edit to override; changing local amount or rate updates again."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right tabular-nums text-slate-800"
                />
              </div>
            </>
          )}
          {formTab === 'expense' && !editing && !needsBusiness && activeRateStr === null && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No active rate for this business. Add a rate under Rates, or use the <span className="font-semibold">Exchange</span> tab to enter
              rate and USD manually.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
