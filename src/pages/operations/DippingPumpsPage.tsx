import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useCreateDippingPumpMutation,
  useGetBusinessesQuery,
  useGetDippingPumpsByBusinessQuery,
  useGetDippingsQuery,
  useGetFuelTypesQuery,
  useGetNozzlesByBusinessQuery,
  useGetPumpsQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { adminNeedsSettingsStation, SETTINGS_STATION_HINT, showBusinessPickerInForms, useEffectiveStationId } from '../../lib/stationContext'
import type { DippingPump } from '../../types/models'

export function DippingPumpsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [businessId, setBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const effectiveBusinessId = showBizPicker ? (businessId ?? 0) : (authBusinessId ?? 0)
  const effectiveListBusinessId = isSuperAdmin ? (filterBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: nozzles = [] } = useGetNozzlesByBusinessQuery(effectiveBusinessId, {
    skip: effectiveBusinessId <= 0,
  })
  const { data: listNozzles = [] } = useGetNozzlesByBusinessQuery(effectiveListBusinessId, {
    skip: effectiveListBusinessId <= 0,
  })
  const { data: links = [], isFetching } = useGetDippingPumpsByBusinessQuery(effectiveListBusinessId, {
    skip: effectiveListBusinessId <= 0,
  })
  const { data: dippingsData } = useGetDippingsQuery(
    { page: 1, pageSize: 5000, q: undefined, businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, q: undefined, businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: pumps = [] } = useGetPumpsQuery(
    { businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  useEffect(() => {
    if (!isSuperAdmin) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setFilterBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
    setBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [isSuperAdmin, businessesData?.items])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])
  const dippingNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const d of dippingsData?.items ?? []) m.set(d.id, d.name?.trim() || `Dipping #${d.id}`)
    return m
  }, [dippingsData?.items])
  const fuelTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const ft of fuelTypes) m.set(ft.id, ft.fuelName)
    return m
  }, [fuelTypes])
  const dippingFuelTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const d of dippingsData?.items ?? []) {
      m.set(d.id, fuelTypeNameById.get(d.fuelTypeId) ?? `Fuel #${d.fuelTypeId}`)
    }
    return m
  }, [dippingsData?.items, fuelTypeNameById])
  const nozzleById = useMemo(() => {
    const m = new Map<number, (typeof nozzles)[number]>()
    for (const n of listNozzles) m.set(n.id, n)
    return m
  }, [listNozzles])

  const [createDippingPump] = useCreateDippingPumpMutation()
  const [open, setOpen] = useState(false)
  const [stationId, setStationId] = useState(0)
  const [pumpId, setPumpId] = useState(0)
  const [nozzleId, setNozzleId] = useState(0)
  const [dippingId, setDippingId] = useState(0)
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )
  const pumpsAtStation = useMemo(() => pumps.filter((p) => p.stationId === stationId), [pumps, stationId])
  const pumpOptions: SelectOption[] = useMemo(
    () => pumpsAtStation.map((p) => ({ value: String(p.id), label: p.pumpNumber })),
    [pumpsAtStation],
  )
  const nozzlesAtStation = useMemo(() => nozzles.filter((n) => n.stationId === stationId), [nozzles, stationId])
  const nozzlesAtPump = useMemo(
    () => (pumpId > 0 ? nozzlesAtStation.filter((n) => n.pumpId === pumpId) : nozzlesAtStation),
    [nozzlesAtStation, pumpId],
  )
  const dippingsAtStation = useMemo(
    () => (dippingsData?.items ?? []).filter((d) => d.stationId === stationId),
    [dippingsData?.items, stationId],
  )
  const nozzleOptions: SelectOption[] = useMemo(
    () => nozzlesAtPump.map((n) => ({ value: String(n.id), label: `${n.pumpNumber} · ${n.name || `Nozzle #${n.id}`}` })),
    [nozzlesAtPump],
  )
  const dippingOptions: SelectOption[] = useMemo(
    () =>
      dippingsAtStation.map((d) => {
        const name = d.name?.trim() || `Dipping #${d.id}`
        const fuel = fuelTypeNameById.get(d.fuelTypeId) ?? `Fuel #${d.fuelTypeId}`
        return { value: String(d.id), label: `${name} · ${fuel}` }
      }),
    [dippingsAtStation, fuelTypeNameById],
  )
  const showStationFieldInModal = isSuperAdmin
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return links
    return links.filter((l) => {
      const n = nozzleById.get(l.nozzleId)
      const station = stationNameById.get(l.stationId) ?? `#${l.stationId}`
      const dip = dippingNameById.get(l.dippingId) ?? `#${l.dippingId}`
      const fuel = dippingFuelTypeNameById.get(l.dippingId) ?? ''
      return (
        String(l.nozzleId).includes(q) ||
        (n?.pumpNumber ?? '').toLowerCase().includes(q) ||
        (n?.name ?? '').toLowerCase().includes(q) ||
        station.toLowerCase().includes(q) ||
        dip.toLowerCase().includes(q) ||
        fuel.toLowerCase().includes(q)
      )
    })
  }, [links, search, nozzleById, stationNameById, dippingNameById, dippingFuelTypeNameById])
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  )
  const columns: Column<DippingPump>[] = useMemo(
    () => [
      { key: 'nozzleId', header: 'Nozzle ID' },
      { key: 'pumpNumber', header: 'Pump #', render: (r) => nozzleById.get(r.nozzleId)?.pumpNumber ?? '—' },
      { key: 'nozzle', header: 'Nozzle', render: (r) => nozzleById.get(r.nozzleId)?.name || '—' },
      { key: 'dippingId', header: 'Dipping', render: (r) => dippingNameById.get(r.dippingId) ?? `#${r.dippingId}` },
      { key: 'fuelType', header: 'Fuel type', render: (r) => dippingFuelTypeNameById.get(r.dippingId) ?? '—' },
      { key: 'stationId', header: 'Station', render: (r) => stationNameById.get(r.stationId) ?? `#${r.stationId}` },
    ],
    [nozzleById, dippingNameById, dippingFuelTypeNameById, stationNameById],
  )

  async function saveLink(e: React.FormEvent) {
    e.preventDefault()
    const resolvedStation = showStationFieldInModal
      ? stationId
      : effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : 0
    if (effectiveBusinessId <= 0 || resolvedStation <= 0 || nozzleId <= 0 || dippingId <= 0) return
    await createDippingPump({
      stationId: resolvedStation,
      nozzleId,
      dippingId,
      ...(showBizPicker ? { businessId: effectiveBusinessId } : {}),
    }).unwrap()
    setOpen(false)
    setStationId(0)
    setPumpId(0)
    setNozzleId(0)
    setDippingId(0)
  }

  function openCreateModal() {
    setOpen(true)
    setPumpId(0)
    setNozzleId(0)
    setDippingId(0)
    if (showStationFieldInModal) {
      setStationId(0)
    } else {
      const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
      setStationId(sid)
    }
    if (isSuperAdmin) {
      const first = businessesData?.items?.[0]?.id
      setBusinessId((prev) => prev ?? first ?? null)
    }
  }

  return (
    <div className="space-y-4">
      <DataTable<DippingPump>
        title="DippingPump"
        addLabel="Add DippingPump"
        rows={pagedRows}
        totalCount={filteredRows.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={(q) => {
          setSearch(q)
          setPage(1)
        }}
        columns={columns}
        isLoading={isFetching}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onAdd={openCreateModal}
        onDeleteOne={() => {}}
        onDeleteSelected={() => {}}
        showRowSelection={false}
        showRowActions={false}
        extraToolbar={
          isSuperAdmin ? (
            <div className="w-full min-w-0 sm:min-w-[14rem] sm:max-w-xs lg:w-64 lg:max-w-none">
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
                onChange={(o) => {
                  setFilterBusinessId(o ? Number(o.value) : null)
                  setPage(1)
                }}
                placeholder="Filter by business"
              />
            </div>
          ) : null
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Add DippingPump" className="max-w-xl">
        <form onSubmit={saveLink} className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(businessId ?? '')) ?? null}
                onChange={(o) => {
                  setBusinessId(o ? Number(o.value) : null)
                  setStationId(0)
                  setPumpId(0)
                  setNozzleId(0)
                  setDippingId(0)
                }}
              />
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          {showStationFieldInModal && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptions}
                value={stationOptions.find((o) => o.value === String(stationId)) ?? null}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                  setPumpId(0)
                  setNozzleId(0)
                  setDippingId(0)
                }}
                placeholder="Select station"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pump</label>
            <FormSelect
              options={pumpOptions}
              value={pumpOptions.find((o) => o.value === String(pumpId)) ?? null}
              onChange={(o) => {
                setPumpId(o ? Number(o.value) : 0)
                setNozzleId(0)
              }}
              placeholder={stationId > 0 ? 'Select pump' : 'Select station first'}
              isDisabled={stationId <= 0 || needsWorkspaceStation}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nozzle</label>
            <FormSelect
              options={nozzleOptions}
              value={nozzleOptions.find((o) => o.value === String(nozzleId)) ?? null}
              onChange={(o) => setNozzleId(o ? Number(o.value) : 0)}
              placeholder={pumpId > 0 ? 'Select nozzle' : 'Select pump first'}
              isDisabled={stationId <= 0 || pumpId <= 0 || needsWorkspaceStation}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Dipping</label>
            <FormSelect
              options={dippingOptions}
              value={dippingOptions.find((o) => o.value === String(dippingId)) ?? null}
              onChange={(o) => setDippingId(o ? Number(o.value) : 0)}
              placeholder={stationId > 0 ? 'Select dipping' : 'Select station first'}
              isDisabled={stationId <= 0 || needsWorkspaceStation}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={effectiveBusinessId <= 0 || stationId <= 0 || nozzleId <= 0 || dippingId <= 0 || needsWorkspaceStation}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Save
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
