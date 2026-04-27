import { useMemo, useState } from 'react'
import {
  useCreateStationMutation,
  useDeleteStationMutation,
  useGetBusinessesQuery,
  useGetStationsQuery,
  useUpdateStationMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessColumnInTables, showBusinessPickerInForms } from '../../lib/stationContext'
import type { Station, StationWriteRequest } from '../../types/models'

export function StationsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetStationsQuery({ page, pageSize, q: debounced || undefined })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createStation] = useCreateStationMutation()
  const [updateStation] = useUpdateStationMutation()
  const [deleteStation] = useDeleteStationMutation()

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) {
      m.set(b.id, b.name)
    }
    return m
  }, [businessesData?.items])

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

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Station | null>(null)
  const [form, setForm] = useState<StationWriteRequest>({
    name: '',
    address: '',
    isActive: true,
    businessId: 0,
  })
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const businessSelectValue =
    businessOptions.find((o) => o.value === String(form.businessId ?? 0)) ??
    (businessOptions.length === 1 ? businessOptions[0]! : null)

  function openCreate() {
    setEditing(null)
    const defaultBiz = showBizPicker ? 0 : authBusinessId ?? 0
    setForm({ name: '', address: '', isActive: true, businessId: defaultBiz })
    setOpen(true)
  }

  function openEdit(row: Station) {
    setEditing(row)
    setForm({
      name: row.name,
      address: row.address,
      isActive: row.isActive,
      businessId: row.businessId,
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (showBizPicker && (!form.businessId || form.businessId <= 0)) {
      return
    }
    const body: StationWriteRequest = {
      name: form.name,
      address: form.address,
      isActive: form.isActive,
      ...(showBizPicker ? { businessId: form.businessId } : { businessId: authBusinessId ?? undefined }),
    }
    if (editing) {
      await updateStation({ id: editing.id, body }).unwrap()
    } else {
      await createStation(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this station?',
      description: 'This station will be removed.',
      action: async () => {
        await deleteStation(id).unwrap()
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
      title: `Delete ${ids.length} row(s)?`,
      description: 'Selected stations will be permanently removed.',
      action: async () => {
        for (const id of ids) {
          await deleteStation(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  const stationColumns: Column<Station>[] = useMemo(() => {
    const cols: Column<Station>[] = [{ key: 'id', header: 'ID' }]
    if (showBusinessColumnInTables(role)) {
      cols.push({
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
      })
    }
    cols.push(
      { key: 'name', header: 'Name' },
      { key: 'address', header: 'Address' },
      {
        key: 'isActive',
        header: 'Active',
        render: (r) => (r.isActive ? 'Yes' : 'No'),
      },
    )
    return cols
  }, [role, businessNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<Station>
        title="Stations"
        addLabel="Add station"
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
        columns={stationColumns}
      />
      <Modal open={open} title={editing ? 'Edit station' : 'Add station'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSelectValue}
                onChange={(o) => setForm((f) => ({ ...f, businessId: o ? Number(o.value) : 0 }))}
                placeholder="Select business"
              />
            </div>
          )}
          {!showBizPicker && businessOptions.length === 0 ? (
            <p className="text-xs text-amber-700">No business on your account. Link a business first.</p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={showBizPicker ? !form.businessId || form.businessId <= 0 : !authBusinessId}
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
