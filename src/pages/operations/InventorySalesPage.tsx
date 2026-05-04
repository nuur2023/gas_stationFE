import { useEffect, useMemo, useState } from 'react'
import { Eye, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  useCreateInventoryBatchMutation,
  useGetCurrenciesQuery,
  useGetDippingsQuery,
  useDeleteInventorySaleMutation,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetFuelPricesQuery,
  useGetInventoriesQuery,
  useGetInventoryLatestByNozzleQuery,
  useGetNozzlesByBusinessQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { DateField } from '../../components/DateField'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/ToastProvider'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import {
  resolveFormStationId,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'

/** Backend parses invariant doubles; empty/null must not break batch create. */
function normalizeInventoryLitersField(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t === '' ? '0' : t
}

type InventorySaleRow = {
  id: number
  referenceNumber: string
  recordedDate: string
  userName: string
  businessId: number
  stationId: number
  itemsCount: number
}

export function InventorySalesPage() {
  const { canView: routeCanView, canDelete: routeCanDelete, canCreate: routeCanCreate } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)
  const [selected] = useState<Set<number>>(new Set())
  const [page] = useState(1)
  const [pageSize] = useState(50)

  const { data, isFetching } = useGetInventoriesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0 ? { filterStationId: effectiveStationId } : {}),
  })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stationsData } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })
  const [createInventoryBatch, { isLoading: batchSaving }] = useCreateInventoryBatchMutation()
  const [deleteSale] = useDeleteInventorySaleMutation()
  const { requestDelete, dialog } = useDeleteConfirm()
  const [batchOpen, setBatchOpen] = useState(false)
  const { showError } = useToast()
  const { data: fuelPrices = [] } = useGetFuelPricesQuery()
  const { data: currencies = [] } = useGetCurrenciesQuery()
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveFormBusinessId = showBizPicker ? formBusinessId : authBusinessId
  const { data: stationsForForm } = useGetStationsQuery(
    { page: 1, pageSize: 500, q: undefined, businessId: effectiveFormBusinessId ?? undefined },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [stationId, setStationId] = useState(0)
  const { data: nozzleRows = [] } = useGetNozzlesByBusinessQuery(effectiveFormBusinessId ?? 0, {
    skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0,
  })
  const { data: dippingsForForm } = useGetDippingsQuery(
    {
      page: 1,
      pageSize: 2000,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )
  const nozzlesForForm = useMemo(() => nozzleRows.filter((n) => n.stationId === stationId), [nozzleRows, stationId])
  const [nozzleId, setNozzleId] = useState(0)
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [openingLiters, setOpeningLiters] = useState('0')
  const [closingLiters, setClosingLiters] = useState('0')
  const [sspLiters, setSspLiters] = useState('0')
  const [usdLiters, setUsdLiters] = useState('0')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [latestTouchedNozzle, setLatestTouchedNozzle] = useState(0)
  const { data: latestNozzleData } = useGetInventoryLatestByNozzleQuery(latestTouchedNozzle, {
    skip: latestTouchedNozzle <= 0 || !batchOpen,
  })
  type BatchLine = { key: string; nozzleId: number; openingLiters: string; closingLiters: string; sspLiters: string; usdLiters: string }
  const [batchLines, setBatchLines] = useState<BatchLine[]>([])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) return items.map((b) => ({ value: String(b.id), label: b.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])
  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsForForm?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsForForm?.items],
  )
  const stationSel = stationOptions.find((o) => o.value === String(stationId)) ?? null
  const nozzleOptions: SelectOption[] = useMemo(
    () => nozzlesForForm.map((n) => ({ value: String(n.id), label: `${n.pumpNumber} - ${n.name || `Nozzle ${n.id}`}` })),
    [nozzlesForForm],
  )
  const nozzleSel = nozzleOptions.find((o) => o.value === String(nozzleId)) ?? null

  const usageLiters = useMemo(() => {
    const o = Number(openingLiters)
    const c = Number(closingLiters)
    return Number.isFinite(o) && Number.isFinite(c) ? Math.abs(o - c) : 0
  }, [openingLiters, closingLiters])
  const parsedSspLiters = useMemo(() => Number(sspLiters), [sspLiters])
  const parsedUsdLiters = useMemo(() => Number(usdLiters), [usdLiters])
  const currencyCodeById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currencies) {
      m.set(c.id, (c.code || '').trim().toUpperCase())
    }
    return m
  }, [currencies])
  const selectedNozzle = useMemo(() => nozzleRows.find((n) => n.id === nozzleId) ?? null, [nozzleRows, nozzleId])
  const selectedFuelTypeId = useMemo(() => {
    if (!selectedNozzle) return null
    const dipping = (dippingsForForm?.items ?? []).find((d) => d.id === selectedNozzle.dippingId)
    return dipping?.fuelTypeId ?? null
  }, [selectedNozzle, dippingsForForm?.items])
  const selectedFuelTypeName = useMemo(() => {
    if (selectedFuelTypeId == null) return ''
    return fuelTypes.find((f) => f.id === selectedFuelTypeId)?.fuelName ?? ''
  }, [fuelTypes, selectedFuelTypeId])
  const sspPricePerLiter = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    if (stationId <= 0 || selectedFuelTypeId == null) return null
    const row = fuelPrices.find(
      (fp) =>
        fp.businessId === effectiveFormBusinessId &&
        fp.stationId === stationId &&
        fp.fuelTypeId === selectedFuelTypeId &&
        currencyCodeById.get(fp.currencyId) === 'SSP',
    )
    if (!row) return null
    const n = Number(row.price)
    return Number.isFinite(n) ? n : null
  }, [effectiveFormBusinessId, stationId, selectedFuelTypeId, fuelPrices, currencyCodeById])
  const usdPricePerLiter = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    if (stationId <= 0 || selectedFuelTypeId == null) return null
    const row = fuelPrices.find(
      (fp) =>
        fp.businessId === effectiveFormBusinessId &&
        fp.stationId === stationId &&
        fp.fuelTypeId === selectedFuelTypeId &&
        currencyCodeById.get(fp.currencyId) === 'USD',
    )
    if (!row) return null
    const n = Number(row.price)
    return Number.isFinite(n) ? n : null
  }, [effectiveFormBusinessId, stationId, selectedFuelTypeId, fuelPrices, currencyCodeById])
  const totalSspAmount = useMemo(() => {
    if (!Number.isFinite(parsedSspLiters) || parsedSspLiters < 0 || sspPricePerLiter == null) return null
    return parsedSspLiters * sspPricePerLiter
  }, [parsedSspLiters, sspPricePerLiter])
  const totalUsdAmount = useMemo(() => {
    if (!Number.isFinite(parsedUsdLiters) || parsedUsdLiters < 0 || usdPricePerLiter == null) return null
    return parsedUsdLiters * usdPricePerLiter
  }, [parsedUsdLiters, usdPricePerLiter])
  const splitMatchesUsage = useMemo(() => {
    if (!Number.isFinite(parsedSspLiters) || !Number.isFinite(parsedUsdLiters)) return false
    if (parsedSspLiters < 0 || parsedUsdLiters < 0) return false
    return Math.abs(parsedSspLiters + parsedUsdLiters - usageLiters) <= 0.001
  }, [parsedSspLiters, parsedUsdLiters, usageLiters])
  const duplicateNozzleInBatch = useMemo(
    () => nozzleId > 0 && batchLines.some((x) => x.nozzleId === nozzleId),
    [batchLines, nozzleId],
  )

  useEffect(() => {
    if (!batchOpen || nozzleId <= 0) return
    setLatestTouchedNozzle(nozzleId)
  }, [batchOpen, nozzleId])

  useEffect(() => {
    if (!batchOpen || latestTouchedNozzle !== nozzleId) return
    if (latestNozzleData?.closingLiters != null) setOpeningLiters(String(latestNozzleData.closingLiters))
  }, [batchOpen, latestTouchedNozzle, nozzleId, latestNozzleData])

  useEffect(() => {
    if (!batchOpen) return
    // Default split: all usage goes to SSP first, user can then divide with USD.
    setSspLiters(String(usageLiters))
    setUsdLiters('0')
  }, [batchOpen, usageLiters, nozzleId])

  const sales = useMemo<InventorySaleRow[]>(() => {
    const bySale = new Map<number, InventorySaleRow>()
    for (const row of data?.items ?? []) {
      const saleId = row.inventorySaleId ?? row.id
      const existing = bySale.get(saleId)
      if (existing) {
        existing.itemsCount += 1
        continue
      }
      bySale.set(saleId, {
        id: saleId,
        referenceNumber: row.referenceNumber ?? `SALE-${saleId}`,
        recordedDate: row.date,
        userName: row.userName?.trim() || (row.userId ? `#${row.userId}` : '—'),
        businessId: row.businessId,
        stationId: row.stationId,
        itemsCount: 1,
      })
    }
    return [...bySale.values()].sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime())
  }, [data?.items])

  function openBatchModal() {
    setBatchOpen(true)
    setBatchLines([])
    setEvidenceFile(null)
    setRecordDate(new Date().toISOString().slice(0, 10))
    if (showBizPicker) {
      setFormBusinessId(null)
      setStationId(0)
      setNozzleId(0)
    } else {
      const st = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : stationsForForm?.items?.[0]?.id ?? 0
      setStationId(st)
      setNozzleId(0)
    }
    setOpeningLiters('0')
    setClosingLiters('0')
    setSspLiters('0')
    setUsdLiters('0')
  }

  function addLineToBatch() {
    if (nozzleId <= 0) return
    if (duplicateNozzleInBatch) {
      showError('This nozzle is already added in lines.')
      return
    }
    if (!splitMatchesUsage) {
      showError('SSP liters + USD liters must equal the difference (usage liters) before adding line.')
      return
    }
    setBatchLines((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${nozzleId}`,
        nozzleId,
        openingLiters: normalizeInventoryLitersField(openingLiters),
        closingLiters: normalizeInventoryLitersField(closingLiters),
        sspLiters: normalizeInventoryLitersField(sspLiters),
        usdLiters: normalizeInventoryLitersField(usdLiters),
      },
    ])
    setOpeningLiters(closingLiters)
    setClosingLiters('0')
    setSspLiters('0')
    setUsdLiters('0')
  }

  async function submitBatch() {
    const needsBiz = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    if (needsBiz || resolvedStation <= 0 || batchLines.length === 0) return
    const bid = showBizPicker ? formBusinessId! : authBusinessId!
    const payload = {
      businessId: bid,
      stationId: resolvedStation,
      recordedAt: `${recordDate}T12:00:00.000Z`,
      lines: batchLines.map((l) => ({
        nozzleId: l.nozzleId,
        openingLiters: normalizeInventoryLitersField(l.openingLiters),
        closingLiters: normalizeInventoryLitersField(l.closingLiters),
        sspLiters: normalizeInventoryLitersField(l.sspLiters),
        usdLiters: normalizeInventoryLitersField(l.usdLiters),
      })),
    }
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    if (evidenceFile) {
      fd.append('evidence', evidenceFile)
    }
    await createInventoryBatch(fd).unwrap()
    setBatchOpen(false)
  }

  const columns: Column<InventorySaleRow>[] = useMemo(() => {
    const base: Column<InventorySaleRow>[] = [
      { key: 'id', header: 'ID' },
      { key: 'referenceNumber', header: 'Reference' },
      {
        key: 'recordedDate',
        header: 'Date',
        render: (r) => new Date(r.recordedDate).toLocaleString(),
      },
      { key: 'userName', header: 'User' },
      {
        key: 'stationId',
        header: 'Station',
        render: (r) => stationNameById.get(r.stationId) ?? `#${r.stationId}`,
      },
      {
        key: 'view',
        header: 'Actions',
        align: 'center',
        render: (r) => (
          <div className="inline-flex items-center gap-1">
            {routeCanView ? (
              <Link
                to={`/inventory/${r.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Link>
            ) : (
              <span
                className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-400 opacity-60"
                title="No view permission"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </span>
            )}
            <button
              type="button"
              disabled={!routeCanDelete}
              title={!routeCanDelete ? 'No delete permission' : 'Delete'}
              onClick={() =>
                requestDelete({
                  title: 'Delete inventory sale?',
                  description: 'This will remove the inventory sale and all its line items.',
                  action: async () => {
                    await deleteSale(r.id).unwrap()
                  },
                })
              }
              className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ]
    if (!showBusinessColumnInTables(role)) return base
    return [
      { key: 'id', header: 'ID' },
      {
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? `#${r.businessId}`,
      },
      ...base.slice(1),
    ]
  }, [role, businessNameById, stationNameById, routeCanView, routeCanDelete])

  return (
    <>
      {dialog}
      <DataTable<InventorySaleRow>
        title="Inventory"
        addLabel="Add inventory batch"
        rows={sales}
        totalCount={sales.length}
        page={1}
        pageSize={50}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        search={search}
        onSearchChange={setSearch}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={() => {}}
        onDeleteOne={() => {}}
        onDeleteSelected={() => {}}
        readOnly
        showRowSelection={false}
        showRowActions={false}
        onAdd={openBatchModal}
        columns={columns}
        extraToolbar={
          <button
            type="button"
            disabled={!routeCanCreate}
            title={!routeCanCreate ? 'No create permission' : undefined}
            onClick={openBatchModal}
            className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Add inventory batch
          </button>
        }
      />
      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Add inventory batch" className="max-w-5xl">
        <div className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setStationId(0)
                  setNozzleId(0)
                }}
                placeholder="Select business"
              />
            </div>
          )}
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptions}
                value={stationSel}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                  setNozzleId(0)
                }}
                placeholder="Select station"
              />
            </div>
          )}
          <DateField value={recordDate} onChange={setRecordDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nozzle</label>
            <div className="flex flex-wrap items-stretch gap-3 sm:items-center">
              <div className="min-w-0 flex-1">
                <FormSelect
                  options={nozzleOptions}
                  value={nozzleSel}
                  onChange={(o) => setNozzleId(o ? Number(o.value) : 0)}
                  placeholder="Select nozzle"
                />
              </div>
              <div className="w-full sm:w-56">
                <input
                  type="text"
                  readOnly
                  value={selectedFuelTypeName || '—'}
                  title="Selected nozzle fuel type"
                  className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Opening liters</label>
              <input value={openingLiters} onChange={(e) => setOpeningLiters(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Closing liters</label>
              <input value={closingLiters} onChange={(e) => setClosingLiters(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">SSP liters</label>
              <input
                value={sspLiters}
                onChange={(e) => setSspLiters(e.target.value)}
                onBlur={() => setSspLiters(normalizeInventoryLitersField(sspLiters))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <label className="mb-1 mt-2 block text-sm font-medium text-slate-700">Total SSP amount</label>
              <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <input
                  type="text"
                  readOnly
                  value={totalSspAmount != null ? totalSspAmount.toFixed(2) : '—'}
                  className="min-w-0 flex-1 cursor-default border-0 bg-transparent px-3 py-2 text-right text-slate-800 outline-none"
                />
                <div className="flex min-w-40 items-center justify-end border-l border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                  SSP / L: {sspPricePerLiter != null ? sspPricePerLiter.toFixed(2) : '—'}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">USD liters</label>
              <input
                value={usdLiters}
                onChange={(e) => setUsdLiters(e.target.value)}
                onBlur={() => setUsdLiters(normalizeInventoryLitersField(usdLiters))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <label className="mb-1 mt-2 block text-sm font-medium text-slate-700">Total USD amount</label>
              <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <input
                  type="text"
                  readOnly
                  value={totalUsdAmount != null ? totalUsdAmount.toFixed(2) : '—'}
                  className="min-w-0 flex-1 cursor-default border-0 bg-transparent px-3 py-2 text-right text-slate-800 outline-none"
                />
                <div className="flex min-w-40 items-center justify-end border-l border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                  USD / L: {usdPricePerLiter != null ? usdPricePerLiter.toFixed(2) : '—'}
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">Usage liters: {usageLiters}</div>
          {!splitMatchesUsage ? (
            <div className="text-xs text-amber-700">
              SSP liters + USD liters must equal usage liters ({usageLiters}).
            </div>
          ) : null}
          {duplicateNozzleInBatch ? (
            <div className="text-xs text-amber-700">This nozzle is already in the lines list.</div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addLineToBatch}
              disabled={duplicateNozzleInBatch || !splitMatchesUsage || nozzleId <= 0 || !routeCanCreate}
              title={!routeCanCreate ? 'No create permission' : undefined}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add line
            </button>
          </div>
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch]">
            <table className="w-max min-w-[920px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left">Nozzle</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Opening</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Closing</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">SSP L</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">USD L</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchLines.map((line) => (
                  <tr key={line.key} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2">{nozzleOptions.find((n) => Number(n.value) === line.nozzleId)?.label ?? line.nozzleId}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{line.openingLiters}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{line.closingLiters}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{line.sspLiters}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{line.usdLiters}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={!routeCanCreate}
                        title={!routeCanCreate ? 'No create permission' : 'Remove'}
                        onClick={() => setBatchLines((prev) => prev.filter((x) => x.key !== line.key))}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {batchLines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      No lines added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Evidence file</label>
              <span className="text-xs text-slate-500">Optional</span>
            </div>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  <Upload className="h-4 w-4" />
                  Choose file
                  <input
                    type="file"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                {evidenceFile ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                      <Paperclip className="h-3.5 w-3.5" />
                      {evidenceFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEvidenceFile(null)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">No file chosen</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setBatchOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={batchLines.length === 0 || batchSaving || !routeCanCreate}
              title={!routeCanCreate ? 'No create permission' : undefined}
              onClick={() => void submitBatch()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {batchSaving ? 'Saving...' : 'Save batch'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
