import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useCreateNozzleMutation,
  useGetBusinessesQuery,
  useGetNozzlesByBusinessQuery,
  useGetPumpsQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import {
  adminNeedsSettingsStation,
  resolveFormStationId,
  SETTINGS_STATION_HINT,
  showBusinessPickerInForms,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { NozzleStationRow } from '../../types/models'

export function NozzlesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [businessId, setBusinessId] = useState<number | null>(authBusinessId ?? null)
  const effectiveBusinessId = showBizPicker ? (businessId ?? 0) : (authBusinessId ?? 0)

  const { data: nozzleRows = [], isFetching } = useGetNozzlesByBusinessQuery(effectiveBusinessId, {
    skip: effectiveBusinessId <= 0,
  })
  const { data: pumps = [] } = useGetPumpsQuery(
    { businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, q: undefined, businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const [createNozzle] = useCreateNozzleMutation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [stationId, setStationId] = useState(0)
  const [pumpId, setPumpId] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  useEffect(() => {
    if (!isSuperAdmin) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [isSuperAdmin, businessesData?.items])
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )
  const resolvedStationUi = resolveFormStationId(role, stationId, effectiveStationId)
  const pumpsAtStation = useMemo(
    () => pumps.filter((p) => p.stationId === resolvedStationUi),
    [pumps, resolvedStationUi],
  )
  const pumpOptions: SelectOption[] = useMemo(
    () => pumpsAtStation.map((p) => ({ value: String(p.id), label: p.pumpNumber })),
    [pumpsAtStation],
  )
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return nozzleRows
    return nozzleRows.filter((n) => {
      const station = stationNameById.get(n.stationId) ?? `#${n.stationId}`
      return (
        String(n.id).includes(q) ||
        (n.pumpNumber ?? '').toLowerCase().includes(q) ||
        (n.name ?? '').toLowerCase().includes(q) ||
        station.toLowerCase().includes(q)
      )
    })
  }, [nozzleRows, search, stationNameById])
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  )
  const columns: Column<NozzleStationRow>[] = useMemo(
    () => [
      { key: 'id', header: 'ID' },
      { key: 'pumpNumber', header: 'Pump #' },
      { key: 'name', header: 'Nozzle', render: (r) => r.name || '—' },
      { key: 'stationId', header: 'Station', render: (r) => stationNameById.get(r.stationId) ?? `#${r.stationId}` },
    ],
    [stationNameById],
  )

  async function saveNozzle(e: React.FormEvent) {
    e.preventDefault()
    const resolvedStationId = resolveFormStationId(role, stationId, effectiveStationId)
    if (effectiveBusinessId <= 0 || resolvedStationId <= 0 || pumpId <= 0) return
    await createNozzle({
      name: name.trim(),
      pumpId,
      stationId: resolvedStationId,
      ...(showBizPicker ? { businessId: effectiveBusinessId } : {}),
    }).unwrap()
    setOpen(false)
    setName('')
    setStationId(0)
    setPumpId(0)
  }

  function openCreateModal() {
    setOpen(true)
    setName('')
    setStationId(showStationPicker ? 0 : (effectiveStationId ?? 0))
    setPumpId(0)
    if (isSuperAdmin) {
      const first = businessesData?.items?.[0]?.id
      setBusinessId((prev) => prev ?? first ?? null)
    }
  }

  useEffect(() => {
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setStationId((prev) => (prev === sid ? prev : sid))
    setPumpId(0)
  }, [open, showStationPicker, effectiveStationId])

  return (
    <div className="space-y-4">
      <DataTable<NozzleStationRow>
        title="Nozzles"
        addLabel="Add nozzle"
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
                value={businessOptions.find((o) => o.value === String(businessId ?? '')) ?? null}
                onChange={(o) => {
                  setBusinessId(o ? Number(o.value) : null)
                  setPage(1)
                }}
                placeholder="Filter by business"
              />
            </div>
          ) : null
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Add nozzle" className="max-w-xl">
        <form onSubmit={saveNozzle} className="space-y-3">
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
                }}
              />
            </div>
          )}
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptions}
                value={stationOptions.find((o) => o.value === String(stationId)) ?? null}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                  setPumpId(0)
                }}
                placeholder="Select station"
              />
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pump</label>
            <FormSelect
              options={pumpOptions}
              value={pumpOptions.find((o) => o.value === String(pumpId)) ?? null}
              onChange={(o) => setPumpId(o ? Number(o.value) : 0)}
              placeholder={resolvedStationUi > 0 ? 'Select pump' : 'Select station first'}
              isDisabled={resolvedStationUi <= 0}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nozzle name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="e.g. A, B, North-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={effectiveBusinessId <= 0 || resolvedStationUi <= 0 || pumpId <= 0}
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
