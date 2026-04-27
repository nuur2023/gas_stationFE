import { useEffect, useMemo, useState } from 'react'
import {
  useCreateFuelPriceMutation,
  useDeleteFuelPriceMutation,
  useGetBusinessesQuery,
  useGetCurrenciesQuery,
  useGetFuelPricesQuery,
  useGetFuelTypesQuery,
  useGetStationsQuery,
  useUpdateFuelPriceMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import type { FuelPrice } from '../../types/models'
import { formatDecimal } from '../../lib/formatNumber'
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

export function FuelPricesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data: all = [], isFetching } = useGetFuelPricesQuery({
    filterBusinessId: authBusinessId ?? undefined,
    filterStationId: effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : undefined,
  })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: currencies = [] } = useGetCurrenciesQuery()
  const { data: businessesData } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    { skip: !showBizPicker },
  )

  /** All stations (SuperAdmin) — for table name lookup across businesses. */
  const { data: stationsAll } = useGetStationsQuery({ page: 1, pageSize: 5000, q: undefined }, { skip: !showBizPicker })
  const { data: stationsForBusiness } = useGetStationsQuery(
    { page: 1, pageSize: 5000, q: undefined, businessId: authBusinessId ?? undefined },
    { skip: showBizPicker || authBusinessId == null || authBusinessId <= 0 },
  )

  const stationsLookup = useMemo(() => {
    if (showBizPicker) return stationsAll?.items ?? []
    return stationsForBusiness?.items ?? []
  }, [showBizPicker, stationsAll?.items, stationsForBusiness?.items])

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)

  /** Active business in the modal: chosen by SuperAdmin, otherwise JWT business. */
  const modalBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: stationsModalPaged } = useGetStationsQuery(
    { page: 1, pageSize: 5000, q: undefined, businessId: modalBusinessId ?? undefined },
    { skip: modalBusinessId == null || modalBusinessId <= 0 },
  )

  const modalStations = stationsModalPaged?.items ?? []

  const modalFuelTypes = useMemo(() => {
    if (modalBusinessId == null || modalBusinessId <= 0) return []
    return fuelTypes.filter((ft) => ft.businessId === modalBusinessId)
  }, [fuelTypes, modalBusinessId])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const fuelTypeOptions: SelectOption[] = useMemo(
    () => modalFuelTypes.map((x) => ({ value: String(x.id), label: x.fuelName })),
    [modalFuelTypes],
  )
  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) return items.map((b) => ({ value: String(b.id), label: b.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])

  const stationOptions: SelectOption[] = useMemo(
    () => modalStations.map((x) => ({ value: String(x.id), label: x.name })),
    [modalStations],
  )
  const currencyOptions: SelectOption[] = useMemo(
    () => currencies.map((x) => ({ value: String(x.id), label: `${x.code} — ${x.name}` })),
    [currencies],
  )

  const [createRow] = useCreateFuelPriceMutation()
  const [updateRow] = useUpdateFuelPriceMutation()
  const [deleteRow] = useDeleteFuelPriceMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FuelPrice | null>(null)
  const [fuelTypeId, setFuelTypeId] = useState(0)
  const [stationId, setStationId] = useState(0)
  const [currencyId, setCurrencyId] = useState(0)
  const [price, setPrice] = useState('0')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const fuelTypeSel = fuelTypeOptions.find((o) => o.value === String(fuelTypeId)) ?? null
  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const stationSel = stationOptions.find((o) => o.value === String(stationId)) ?? null
  const currencySel = currencyOptions.find((o) => o.value === String(currencyId)) ?? null

  useEffect(() => setPage(1), [debounced])

  useEffect(() => {
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    if (modalStations.length === 0) return
    if (sid > 0 && modalStations.some((s) => s.id === sid)) {
      setStationId(sid)
    } else if (sid <= 0) {
      setStationId(0)
    }
  }, [open, showStationPicker, effectiveStationId, modalStations])

  const filtered = useMemo(() => {
    const scoped = all.filter((r) => {
      if (!isSuperAdmin && authBusinessId != null && authBusinessId > 0 && r.businessId !== authBusinessId) return false
      if (effectiveStationId != null && effectiveStationId > 0 && r.stationId !== effectiveStationId) return false
      return true
    })
    const q = debounced.trim().toLowerCase()
    if (!q) return scoped
    return scoped.filter((r) => {
      const nums = [r.id, r.fuelTypeId, r.stationId, r.currencyId, r.price].some((v) =>
        String(v).toLowerCase().includes(q),
      )
      if (nums) return true
      if (showBizPicker) {
        const bn = businessNameById.get(r.businessId)
        if (bn && bn.toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [all, debounced, showBizPicker, businessNameById, isSuperAdmin, authBusinessId, effectiveStationId])

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function openCreate() {
    setEditing(null)
    setFuelTypeId(0)
    setStationId(0)
    setCurrencyId(0)
    setPrice('0')
    setFormBusinessId(showBizPicker ? null : authBusinessId ?? null)
    setOpen(true)
  }

  function openEdit(row: FuelPrice) {
    setEditing(row)
    setFuelTypeId(row.fuelTypeId)
    setStationId(row.stationId)
    setCurrencyId(row.currencyId)
    setPrice(String(row.price ?? 0))
    setFormBusinessId(showBizPicker ? row.businessId : authBusinessId ?? null)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (modalBusinessId == null || modalBusinessId <= 0) return
    if (!modalFuelTypes.some((ft) => ft.id === fuelTypeId)) return
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    const st = modalStations.find((s) => s.id === resolvedStation)
    const businessId = st?.businessId ?? 0
    if (fuelTypeId <= 0 || resolvedStation <= 0 || currencyId <= 0 || businessId <= 0 || businessId !== modalBusinessId)
      return

    const parsedPrice = Number.parseFloat(String(price).replace(',', '.'))
    const body = {
      fuelTypeId,
      stationId: resolvedStation,
      businessId,
      currencyId,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    }
    if (editing) await updateRow({ id: editing.id, body }).unwrap()
    else await createRow(body).unwrap()
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete fuel price?',
      description: 'Inventory amount calculations for this station/fuel type will be affected.',
      action: async () => {
        await deleteRow(id).unwrap()
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected fuel prices?',
      description: `Remove ${ids.length} fuel price row(s)?`,
      action: async () => {
        for (const id of ids) await deleteRow(id).unwrap()
        setSelected(new Set())
      },
    })
  }

  const tableColumns: Column<FuelPrice>[] = useMemo(() => {
    const cols: Column<FuelPrice>[] = [
      { key: 'id', header: 'ID' },
    ]
    if (showBusinessColumnInTables(role)) {
      cols.push({
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? (r.businessId ? `#${r.businessId}` : '—'),
      })
    }
    cols.push({
      key: 'fuelTypeId',
      header: 'Fuel type',
      render: (r) => fuelTypes.find((x) => x.id === r.fuelTypeId)?.fuelName ?? `#${r.fuelTypeId}`,
    })
    if (showStationColumnInTables(role)) {
      cols.push({
        key: 'stationId',
        header: 'Station',
        render: (r) => stationsLookup.find((x) => x.id === r.stationId)?.name ?? `#${r.stationId}`,
      })
    }
    cols.push(
      {
        key: 'currencyId',
        header: 'Currency',
        render: (r) => currencies.find((x) => x.id === r.currencyId)?.code ?? `#${r.currencyId}`,
      },
      { key: 'price', header: 'Price', render: (r) => formatDecimal(Number(r.price ?? 0)) },
    )
    return cols
  }, [role, businessNameById, fuelTypes, stationsLookup, currencies])

  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)

  return (
    <>
      {deleteDialog}
      <DataTable<FuelPrice>
        title="Fuel prices"
        addLabel="Add fuel price"
        rows={rows}
        totalCount={filtered.length}
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
      <Modal open={open} title={editing ? 'Edit fuel price' : 'Add fuel price'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                aria-label="Business"
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setFuelTypeId(0)
                  setStationId(0)
                }}
                placeholder="Select business first…"
                isClearable
              />
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
              aria-label="Fuel type"
              options={fuelTypeOptions}
              value={fuelTypeSel}
              onChange={(o) => setFuelTypeId(o ? Number(o.value) : 0)}
              placeholder={
                modalBusinessId == null || modalBusinessId <= 0
                  ? showBizPicker
                    ? 'Select a business first…'
                    : 'No business on your account…'
                  : fuelTypeOptions.length === 0
                    ? 'No fuel types for this business'
                    : 'Select fuel type…'
              }
              isDisabled={
                modalBusinessId == null ||
                modalBusinessId <= 0 ||
                fuelTypeOptions.length === 0 ||
                (!showBizPicker && (authBusinessId == null || authBusinessId <= 0))
              }
            />
          </div>
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                aria-label="Station"
                options={stationOptions}
                value={stationSel}
                onChange={(o) => setStationId(o ? Number(o.value) : 0)}
                placeholder={
                  modalBusinessId == null || modalBusinessId <= 0
                    ? 'Select a business first…'
                    : stationOptions.length === 0
                      ? 'No stations for this business'
                      : 'Select station…'
                }
                isDisabled={modalBusinessId == null || modalBusinessId <= 0 || stationOptions.length === 0}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <FormSelect
              aria-label="Currency"
              options={currencyOptions}
              value={currencySel}
              onChange={(o) => setCurrencyId(o ? Number(o.value) : 0)}
              placeholder="Select currency…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Price</label>
            <input
              required
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <p className="text-xs text-slate-500">
            {isSuperAdmin
              ? 'Select a business first. Fuel types and stations are limited to that business. Business is saved on the fuel price row.'
              : 'Fuel types and stations are limited to your business from your account.'}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
