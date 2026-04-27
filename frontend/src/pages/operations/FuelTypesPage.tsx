import { useEffect, useMemo, useState } from 'react'
import {
  useGetBusinessesQuery,
  useCreateFuelTypeMutation,
  useDeleteFuelTypeMutation,
  useGetFuelTypesQuery,
  useUpdateFuelTypeMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { FuelType, FuelTypeWriteRequest } from '../../types/models'

export function FuelTypesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data: all = [], isFetching } = useGetFuelTypesQuery()
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createFt] = useCreateFuelTypeMutation()
  const [updateFt] = useUpdateFuelTypeMutation()
  const [deleteFt] = useDeleteFuelTypeMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FuelType | null>(null)
  const [fuelName, setFuelName] = useState('')
  const [businessId, setBusinessId] = useState('0')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) return items.map((b) => ({ value: String(b.id), label: b.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])
  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])
  const businessSel = businessOptions.find((o) => o.value === businessId) ?? null

  useEffect(() => {
    setPage(1)
  }, [debounced])

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return all
    return all.filter((r) => {
      if (r.fuelName.toLowerCase().includes(q) || String(r.id).includes(q)) return true
      if (showBizPicker) {
        const bn = businessNameById.get(r.businessId)
        if (bn && bn.toLowerCase().includes(q)) return true
        if (String(r.businessId ?? 0).includes(q)) return true
      }
      return false
    })
  }, [all, debounced, showBizPicker, businessNameById])

  const totalCount = filtered.length
  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function openCreate() {
    setEditing(null)
    setFuelName('')
    setBusinessId(String(showBizPicker ? 0 : authBusinessId ?? 0))
    setOpen(true)
  }

  function openEdit(row: FuelType) {
    setEditing(row)
    setFuelName(row.fuelName)
    setBusinessId(String(row.businessId ?? 0))
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const name = fuelName.trim()
    if (!name) return
    const bid = Number.parseInt(businessId, 10)
    const businessIdNum = showBizPicker ? (Number.isFinite(bid) ? bid : 0) : (authBusinessId ?? 0)
    if (editing) {
      await updateFt({
        id: editing.id,
        body: { fuelName: name, businessId: businessIdNum > 0 ? businessIdNum : undefined },
      }).unwrap()
    } else {
      const body: FuelTypeWriteRequest = { fuelName: name, businessId: businessIdNum > 0 ? businessIdNum : undefined }
      await createFt(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete fuel type?',
      description: 'Pumps and sales referencing this type may be affected.',
      action: async () => {
        await deleteFt(id).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(id)
          return n
        })
      },
    })
  }

  const tableColumns: Column<FuelType>[] = useMemo(() => {
    const cols: Column<FuelType>[] = [
      { key: 'id', header: 'ID' },
      { key: 'fuelName', header: 'Name' },
    ]
    if (showBizPicker) {
      cols.push({
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? (r.businessId ? `#${r.businessId}` : '—'),
      })
    }
    return cols
  }, [showBizPicker, businessNameById])

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected?',
      description: `Remove ${ids.length} fuel type(s)?`,
      action: async () => {
        for (const id of ids) {
          await deleteFt(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<FuelType>
        title="Fuel types"
        addLabel="Add fuel type"
        rows={rows}
        totalCount={totalCount}
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
      <Modal open={open} title={editing ? 'Edit fuel type' : 'Add fuel type'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fuel name</label>
            <input
              required
              value={fuelName}
              onChange={(e) => setFuelName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business (optional)</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => setBusinessId(o ? o.value : '0')}
                isClearable
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
