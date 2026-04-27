import { useEffect, useMemo, useState } from 'react'
import {
  useCreateGeneratorUsageMutation,
  useDeleteGeneratorUsageMutation,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetGeneratorUsagesQuery,
  useGetPermissionContextUsersQuery,
  useGetStationsQuery,
  useGetUsersQuery,
  useUpdateGeneratorUsageMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { DateField } from '../../components/DateField'
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
import type { GeneratorUsage, GeneratorUsageWriteRequest } from '../../types/models'

export function GeneratorUsagePage() {
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
  const { data, isFetching } = useGetGeneratorUsagesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  })
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  /** Users list omits Admin/SuperAdmin for non–SuperAdmin; context-users includes all linked users. */
  const { data: permissionContextUsers } = useGetPermissionContextUsersQuery(
    {},
    { skip: isSuperAdmin || authBusinessId == null || authBusinessId <= 0 },
  )
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
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

  const [createGu] = useCreateGeneratorUsageMutation()
  const [updateGu] = useUpdateGeneratorUsageMutation()
  const [deleteGu] = useDeleteGeneratorUsageMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GeneratorUsage | null>(null)
  const [ltrUsage, setLtrUsage] = useState('0')
  const [fuelTypeId, setFuelTypeId] = useState(0)
  const [stationId, setStationId] = useState(0)
  const [usageDate, setUsageDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState<Set<number>>(new Set())

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

  const modalFuelTypes = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return []
    return fuelTypes.filter((ft) => ft.businessId === effectiveFormBusinessId)
  }, [fuelTypes, effectiveFormBusinessId])

  const fuelTypeOptions: SelectOption[] = useMemo(
    () => modalFuelTypes.map((x) => ({ value: String(x.id), label: x.fuelName })),
    [modalFuelTypes],
  )

  const stationOptionsBase: SelectOption[] = useMemo(
    () => (stationsForForm?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsForForm?.items],
  )

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const fuelTypeSel = fuelTypeOptions.find((o) => o.value === String(fuelTypeId)) ?? null
  const stationSel = stationOptionsBase.find((o) => o.value === String(stationId)) ?? null

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

  const fuelTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const ft of fuelTypes) m.set(ft.id, ft.fuelName)
    return m
  }, [fuelTypes])

  useEffect(() => {
    if (!open || !showBizPicker || formBusinessId == null || formBusinessId <= 0) return
    const fts = fuelTypes.filter((ft) => ft.businessId === formBusinessId)
    if (fts.length === 0) return
    setFuelTypeId((fid) => {
      if (fts.some((ft) => ft.id === fid)) return fid
      return fts[0]!.id
    })
  }, [open, showBizPicker, formBusinessId, fuelTypes])

  useEffect(() => {
    if (!open || !showStationPicker || formBusinessId == null || formBusinessId <= 0) return
    const items = stationsForForm?.items ?? []
    if (items.length === 0) return
    setStationId((sid) => {
      if (items.some((s) => s.id === sid)) return sid
      return items[0].id
    })
  }, [open, showStationPicker, formBusinessId, stationsForForm?.items])

  useEffect(() => {
    if (!open || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setStationId((s) => (s === sid ? s : sid))
  }, [open, showStationPicker, effectiveStationId])

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const resolvedStationUi = resolveFormStationId(role, stationId, effectiveStationId)
  const canSave = !needsBusiness && !needsWorkspaceStation && fuelTypeId > 0 && resolvedStationUi > 0

  function openCreate() {
    setEditing(null)
    if (showBizPicker) {
      setFormBusinessId(null)
      setFuelTypeId(0)
      setStationId(0)
    } else {
      const bid = authBusinessId ?? 0
      const fts = bid ? fuelTypes.filter((ft) => ft.businessId === bid) : []
      setFuelTypeId(fts[0]?.id ?? 0)
      const st =
        effectiveStationId != null && effectiveStationId > 0
          ? effectiveStationId
          : stationsForForm?.items[0]?.id ?? 0
      setStationId(st)
    }
    setLtrUsage('0')
    setUsageDate(new Date().toISOString().slice(0, 10))
    setOpen(true)
  }

  function openEdit(row: GeneratorUsage) {
    setEditing(row)
    if (showBizPicker) {
      setFormBusinessId(row.businessId)
    }
    setFuelTypeId(row.fuelTypeId ?? 0)
    setStationId(row.stationId)
    setLtrUsage(String(row.ltrUsage))
    setUsageDate(row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const body: GeneratorUsageWriteRequest = {
      ltrUsage,
      stationId: resolveFormStationId(role, stationId, effectiveStationId),
      fuelTypeId,
      date: `${usageDate}T12:00:00.000Z`,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    if (editing) {
      await updateGu({ id: editing.id, body }).unwrap()
    } else {
      await createGu(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete generator usage?',
      description: 'This record will be removed.',
      action: async () => {
        await deleteGu(id).unwrap()
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
      description: `Remove ${ids.length} record(s)?`,
      action: async () => {
        for (const id of ids) {
          await deleteGu(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  const tableColumns: Column<GeneratorUsage>[] = useMemo(() => {
    const idCol: Column<GeneratorUsage> = { key: 'id', header: 'ID' }
    const businessCol: Column<GeneratorUsage> = {
      key: 'businessId',
      header: 'Business',
      render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
    }
    const middle: Column<GeneratorUsage>[] = [
      {
        key: 'date',
        header: 'Date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
      {
        key: 'fuelTypeId',
        header: 'Fuel type',
        render: (r) =>
          r.fuelTypeId != null && r.fuelTypeId > 0
            ? (fuelTypeNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`)
            : '—',
      },
    ]
    const stationCol: Column<GeneratorUsage> = {
      key: 'stationId',
      header: 'Station',
      render: (r) => stationNameById.get(r.stationId) ?? r.stationId,
    }
    const tail: Column<GeneratorUsage>[] = [
      {
        key: 'ltrUsage',
        header: 'Liters',
        render: (r) => Number(r.ltrUsage).toFixed(2),
      },
      {
        key: 'usersId',
        header: 'User',
        render: (r) => userNameById.get(r.usersId) ?? `#${r.usersId}`,
      },
    ]
    const out: Column<GeneratorUsage>[] = [idCol]
    if (showBusinessColumnInTables(role)) out.push(businessCol)
    out.push(...middle)
    if (showStationColumnInTables(role)) out.push(stationCol)
    out.push(...tail)
    return out
  }, [role, stationNameById, userNameById, businessNameById, fuelTypeNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<GeneratorUsage>
        title="Generator usage"
        addLabel="Add usage"
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
      <Modal
        open={open}
        title={editing ? 'Edit generator usage' : 'Add generator usage'}
        onClose={() => setOpen(false)}
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setFuelTypeId(0)
                  setStationId(0)
                }}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? 'Select a business to load fuel types and stations.'
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
              aria-label="Fuel type"
              options={fuelTypeOptions}
              value={fuelTypeSel}
              onChange={(o) => setFuelTypeId(o ? Number(o.value) : 0)}
              placeholder={
                needsBusiness
                  ? 'Select business first'
                  : fuelTypeOptions.length === 0
                    ? 'No fuel types for this business'
                    : 'Select fuel type'
              }
              isDisabled={needsBusiness || fuelTypeOptions.length === 0}
            />
          </div>
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                aria-label="Station"
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) => setStationId(o ? Number(o.value) : 0)}
                placeholder={needsBusiness ? 'Select business first' : 'Select station'}
                isDisabled={needsBusiness || stationOptionsBase.length === 0}
              />
            </div>
          )}
          <DateField value={usageDate} onChange={setUsageDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Liters usage</label>
            <input
              type="text"
              required
              value={ltrUsage}
              onChange={(e) => setLtrUsage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
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
