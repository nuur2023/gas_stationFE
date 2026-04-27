import { useEffect, useMemo, useState } from 'react'
import {
  useCreatePumpMutation,
  useDeletePumpMutation,
  useGetBusinessesQuery,
  useGetPumpsPagedQuery,
  useGetStationsQuery,
  useUpdatePumpMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
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
import type { Pump, PumpWriteRequest } from '../../types/models'

export function PumpsPage() {
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
  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(null)
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetPumpsPagedQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(isSuperAdmin && filterBusinessId != null && filterBusinessId > 0
      ? { filterBusinessId }
      : {}),
    ...(effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  })

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stationsForTable } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })

  const [createPump] = useCreatePumpMutation()
  const [updatePump] = useUpdatePumpMutation()
  const [deletePump] = useDeletePumpMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Pump | null>(null)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const [stationId, setStationId] = useState(0)
  const [pumpNumber, setPumpNumber] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

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


  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsForTable?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsForTable?.items])

  useEffect(() => {
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setStationId((s) => (s === sid ? s : sid))
  }, [open, showStationPicker, effectiveStationId])

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const businessTableSel = businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null
  const stationSel = stationOptionsBase.find((o) => o.value === String(stationId)) ?? null

  useEffect(() => {
    if (!isSuperAdmin) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setFilterBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [isSuperAdmin, businessesData?.items])

  function openCreate() {
    setEditing(null)
    if (showBizPicker) {
      setFormBusinessId(isSuperAdmin ? filterBusinessId : null)
    }
    setStationId(0)
    setPumpNumber('')
    setOpen(true)
  }

  function openEdit(row: Pump) {
    setEditing(row)
    if (showBizPicker) {
      setFormBusinessId(row.businessId)
    }
    setStationId(row.stationId)
    setPumpNumber(row.pumpNumber)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const bid = showBizPicker ? formBusinessId : authBusinessId
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    if (bid == null || bid <= 0 || resolvedStation <= 0 || !pumpNumber.trim()) return

    const body: PumpWriteRequest = {
      pumpNumber: pumpNumber.trim(),
      stationId: resolvedStation,
      ...(showBizPicker ? { businessId: bid } : { businessId: authBusinessId ?? undefined }),
    }

    if (editing) {
      await updatePump({ id: editing.id, body }).unwrap()
    } else {
      await createPump(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete pump?',
      description: 'This pump will be removed.',
      action: async () => {
        await deletePump(id).unwrap()
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
      description: `Remove ${ids.length} pump(s)?`,
      action: async () => {
        for (const id of ids) {
          await deletePump(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const resolvedStationUi = resolveFormStationId(role, stationId, effectiveStationId)
  const canSave =
    !needsBusiness &&
    !needsWorkspaceStation &&
    resolvedStationUi > 0 &&
    pumpNumber.trim().length > 0

  const pumpColumns: Column<Pump>[] = useMemo(() => {
    const cols: Column<Pump>[] = [{ key: 'id', header: 'ID' }]
    if (showBusinessColumnInTables(role)) {
      cols.push({
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
      })
    }
    if (showStationColumnInTables(role)) {
      cols.push({
        key: 'stationId',
        header: 'Station',
        render: (r) => stationNameById.get(r.stationId) ?? `#${r.stationId}`,
      })
    }
    cols.push({ key: 'pumpNumber', header: 'Pump #' })
    return cols
  }, [role, businessNameById, stationNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<Pump>
        title="Pump creation"
        addLabel="Add pump"
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
        columns={pumpColumns}
        extraToolbar={
          isSuperAdmin ? (
            <div className="w-full min-w-0 sm:min-w-[14rem] sm:max-w-xs lg:w-64 lg:max-w-none">
              <FormSelect
                options={businessOptions}
                value={businessTableSel}
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
      <Modal open={open} title={editing ? 'Edit pump' : 'Add pump'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          {!isSuperAdmin && !authBusinessId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Assign a business to your account first.
            </div>
          )}

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

          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}

          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                }}
                placeholder={
                  effectiveFormBusinessId == null || effectiveFormBusinessId <= 0
                    ? 'Select a business first'
                    : 'Select station'
                }
                isDisabled={effectiveFormBusinessId == null || effectiveFormBusinessId <= 0}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pump number</label>
            <input
              required
              value={pumpNumber}
              onChange={(e) => setPumpNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="e.g. Pump 1"
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
