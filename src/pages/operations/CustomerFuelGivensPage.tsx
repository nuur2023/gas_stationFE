import { useEffect, useMemo, useState } from 'react'
import {
  useCreateCustomerFuelGivenMutation,
  useDeleteCustomerFuelGivenMutation,
  useGetBusinessesQuery,
  useGetCustomerFuelGivensQuery,
  useGetDippingsQuery,
  useGetFuelPricesQuery,
  useGetFuelTypesQuery,
  useGetRatesQuery,
  useGetStationsQuery,
  useUpdateCustomerFuelGivenMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatCurrency, formatDecimal, parseNumericInput } from '../../lib/formatNumber'
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
import type { CustomerFuelGiven, CustomerFuelGivenWriteRequest } from '../../types/models'

export function CustomerFuelGivensPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetCustomerFuelGivensQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: fuelPrices = [] } = useGetFuelPricesQuery()
  const { data: ratesData } = useGetRatesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })

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
  const { data: stationsForTable } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })
  const { data: dippingsForForm } = useGetDippingsQuery(
    { page: 1, pageSize: 2000, q: undefined, businessId: effectiveFormBusinessId ?? undefined },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [createRow] = useCreateCustomerFuelGivenMutation()
  const [updateRow] = useUpdateCustomerFuelGivenMutation()
  const [deleteRow] = useDeleteCustomerFuelGivenMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerFuelGiven | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fuelTypeId, setFuelTypeId] = useState(0)
  const [givenLiter, setGivenLiter] = useState('0')
  const [price, setPrice] = useState('0')
  const [amountUsd, setAmountUsd] = useState('0')
  const [remark, setRemark] = useState('')
  const [stationId, setStationId] = useState(0)
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const fuelTypeOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((x) => ({ value: String(x.id), label: x.fuelName })),
    [fuelTypes],
  )
  const stationOptionsBase: SelectOption[] = useMemo(
    () => (stationsForForm?.items ?? []).map((x) => ({ value: String(x.id), label: x.name })),
    [stationsForForm?.items],
  )
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

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsForTable?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsForTable?.items])
  const fuelTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])
  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const stationSel = stationOptionsBase.find((o) => o.value === String(stationId)) ?? null
  const fuelTypeSel = fuelTypeOptions.find((o) => o.value === String(fuelTypeId)) ?? null

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setFuelTypeId(0)
    setGivenLiter('0')
    setPrice('0')
    setAmountUsd('0')
    setRemark('')
    setStationId(0)
    setDate(new Date().toISOString().slice(0, 10))
    setFormBusinessId(showBizPicker ? null : authBusinessId ?? null)
    setOpen(true)
  }

  function openEdit(row: CustomerFuelGiven) {
    setEditing(row)
    setName(row.name)
    setPhone(row.phone)
    setFuelTypeId(row.fuelTypeId)
    setGivenLiter(String(row.givenLiter))
    setPrice(String(row.price))
    setAmountUsd(String(row.usdAmount ?? 0))
    setRemark(row.remark ?? '')
    setStationId(row.stationId)
    setDate(row.date.slice(0, 10))
    setFormBusinessId(showBizPicker ? row.businessId : authBusinessId ?? null)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const bid = showBizPicker ? formBusinessId : authBusinessId
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    if (bid == null || bid <= 0 || resolvedStation <= 0 || fuelTypeId <= 0 || !name.trim()) return

    const body: CustomerFuelGivenWriteRequest = {
      name: name.trim(),
      phone: phone.trim(),
      fuelTypeId,
      givenLiter,
      price,
      amountUsd,
      remark: remark.trim() || undefined,
      stationId: resolvedStation,
      date: date ? new Date(date).toISOString() : undefined,
      ...(showBizPicker ? { businessId: bid } : { businessId: authBusinessId ?? undefined }),
    }
    if (editing) await updateRow({ id: editing.id, body }).unwrap()
    else await createRow(body).unwrap()
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete customer fuel given?',
      description: 'This will restore liters back to dipping.',
      action: async () => {
        await deleteRow(id).unwrap()
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected?',
      description: `Remove ${ids.length} row(s)?`,
      action: async () => {
        for (const id of ids) await deleteRow(id).unwrap()
        setSelected(new Set())
      },
    })
  }

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const resolvedStationUi = resolveFormStationId(role, stationId, effectiveStationId)
  const litersRequested = useMemo(() => {
    const n = Number.parseFloat(String(givenLiter).replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }, [givenLiter])
  const dippingAvailableLiters = useMemo(() => {
    if (resolvedStationUi <= 0 || fuelTypeId <= 0) return 0
    const dipping = (dippingsForForm?.items ?? []).find(
      (d) => d.stationId === resolvedStationUi && d.fuelTypeId === fuelTypeId,
    )
    return dipping?.amountLiter ?? 0
  }, [dippingsForForm?.items, resolvedStationUi, fuelTypeId])
  const availableForSave = useMemo(() => {
    if (!editing) return dippingAvailableLiters
    // Editing restores previous row liters first, then subtracts new value.
    if (editing.stationId === resolvedStationUi && editing.fuelTypeId === fuelTypeId)
      return dippingAvailableLiters + editing.givenLiter
    return dippingAvailableLiters
  }, [editing, resolvedStationUi, fuelTypeId, dippingAvailableLiters])
  const hasEnoughDipping = litersRequested > 0 && litersRequested <= availableForSave
  const canSave =
    !needsBusiness &&
    !needsWorkspaceStation &&
    resolvedStationUi > 0 &&
    fuelTypeId > 0 &&
    name.trim().length > 0 &&
    hasEnoughDipping
  const selectedFuelPrice = useMemo(() => {
    if (resolvedStationUi <= 0 || fuelTypeId <= 0) return null
    const p = fuelPrices.find((x) => x.stationId === resolvedStationUi && x.fuelTypeId === fuelTypeId)
    return p?.price ?? null
  }, [fuelPrices, resolvedStationUi, fuelTypeId])

  const localAmountNumeric = useMemo(() => {
    const liters = parseNumericInput(givenLiter)
    const unitPrice = parseNumericInput(price)
    if (!Number.isFinite(liters) || !Number.isFinite(unitPrice)) return null
    return liters * unitPrice
  }, [givenLiter, price])

  const activeRateStr = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    const items = ratesData?.items ?? []
    const active = items.filter((r) => r.active && r.businessId === effectiveFormBusinessId)
    if (active.length === 0) return null
    active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return formatRateNumber(active[0].rateNumber)
  }, [ratesData, effectiveFormBusinessId])

  const activeRateNum = useMemo(() => parseNumericInput(activeRateStr ?? '0'), [activeRateStr])
  const hasActiveExchangeRate = Number.isFinite(activeRateNum) && activeRateNum > 0

  const computedAmountUsdNumeric = useMemo(() => {
    if (!hasActiveExchangeRate) return null
    if (localAmountNumeric == null || !Number.isFinite(localAmountNumeric)) return null
    return localAmountNumeric / activeRateNum
  }, [hasActiveExchangeRate, localAmountNumeric, activeRateNum])

  const computedAmountUsdDisplay = useMemo(() => {
    if (computedAmountUsdNumeric == null || !Number.isFinite(computedAmountUsdNumeric)) return '—'
    return formatCurrency(Math.round(computedAmountUsdNumeric * 100) / 100, 'USD')
  }, [computedAmountUsdNumeric])

  useEffect(() => {
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setStationId((s) => (s === sid ? s : sid))
  }, [open, showStationPicker, effectiveStationId])

  useEffect(() => {
    if (!open) return
    if (selectedFuelPrice == null) return
    setPrice(String(selectedFuelPrice))
  }, [open, selectedFuelPrice])

  useEffect(() => {
    if (!open) return
    if (!hasActiveExchangeRate) return
    if (computedAmountUsdNumeric == null || !Number.isFinite(computedAmountUsdNumeric)) {
      setAmountUsd('0')
      return
    }
    setAmountUsd(String(Math.round(computedAmountUsdNumeric * 100) / 100))
  }, [open, hasActiveExchangeRate, computedAmountUsdNumeric])

  const columns: Column<CustomerFuelGiven>[] = useMemo(() => {
    const idCol: Column<CustomerFuelGiven> = { key: 'id', header: 'ID' }
    const businessCol: Column<CustomerFuelGiven> = {
      key: 'businessId',
      header: 'Business',
      render: (r) => businessNameById.get(r.businessId) ?? `#${r.businessId}`,
    }
    const middle: Column<CustomerFuelGiven>[] = [
      { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleString() },
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone' },
      {
        key: 'fuelTypeId',
        header: 'Fuel type',
        render: (r) => fuelTypeNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`,
      },
      { key: 'givenLiter', header: 'Given L', render: (r) => formatDecimal(Number(r.givenLiter)) },
      { key: 'price', header: 'Price', render: (r) => formatDecimal(Number(r.price)) },
      { key: 'usdAmount', header: 'Amount USD', render: (r) => formatDecimal(Number(r.usdAmount ?? 0)) },
      { key: 'remark', header: 'Remark', render: (r) => r.remark || '—' },
    ]
    const stationCol: Column<CustomerFuelGiven> = {
      key: 'stationId',
      header: 'Station',
      render: (r) => stationNameById.get(r.stationId) ?? `#${r.stationId}`,
    }
    const out: Column<CustomerFuelGiven>[] = [idCol]
    if (showBusinessColumnInTables(role)) out.push(businessCol)
    out.push(...middle)
    if (showStationColumnInTables(role)) out.push(stationCol)
    return out
  }, [role, businessNameById, fuelTypeNameById, stationNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<CustomerFuelGiven>
        title="Customer fuel givens"
        addLabel="Add customer"
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
        columns={columns}
      />
      <Modal
        open={open}
        title={editing ? 'Edit customer fuel given' : 'Add customer fuel given'}
        onClose={() => setOpen(false)}
        className="max-w-5xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {showBizPicker && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessSel}
                  onChange={(o) => {
                    setFormBusinessId(o ? Number(o.value) : null)
                    setStationId(0)
                  }}
                  placeholder="Select business"
                />
              </div>
            )}
            {showStationPicker && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
                <FormSelect
                  options={stationOptionsBase}
                  value={stationSel}
                  onChange={(o) => setStationId(o ? Number(o.value) : 0)}
                  placeholder={needsBusiness ? 'Select business first' : 'Select station'}
                  isDisabled={needsBusiness}
                />
              </div>
            )}
          </div>
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? 'Select a business to load stations and dippings.'
                : 'No business assigned to your account.'}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fuel type</label>
            <FormSelect
              options={fuelTypeOptions}
              value={fuelTypeSel}
              onChange={(o) => setFuelTypeId(o ? Number(o.value) : 0)}
              placeholder="Select fuel type"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Given liter</label>
              <input
                required
                type="text"
                value={givenLiter}
                onChange={(e) => setGivenLiter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                Available in dipping: {formatDecimal(availableForSave)} L
              </p>
              {!hasEnoughDipping && (
                <p className="mt-1 text-xs text-rose-700">
                  Not enough dipping liters for this station/fuel type.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Price</label>
              <input
                required
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                readOnly={selectedFuelPrice != null}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              {selectedFuelPrice != null && (
                <p className="mt-1 text-xs text-slate-500">
                  Auto-filled from fuel price setup for selected station/fuel type.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount USD (enter manually if no rate)</label>
            <div className="relative">
              <input
                type="text"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                readOnly={hasActiveExchangeRate}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-28"
              />
              {hasActiveExchangeRate && activeRateStr && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
                  Rate: {activeRateStr}
                </span>
              )}
            </div>
            {hasActiveExchangeRate ? (
              <p className="mt-1 text-xs text-slate-500">
                Auto-computed from local amount ({formatDecimal(localAmountNumeric ?? 0)}) / active rate ({activeRateStr}):{' '}
                {computedAmountUsdDisplay}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">No active exchange rate for this business. Enter USD amount manually.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remark (optional)</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              rows={3}
            />
          </div>
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

