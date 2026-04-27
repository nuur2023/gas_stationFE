import { useMemo, useState } from 'react'
import {
  useCreateSupplierMutation,
  useDeleteSupplierMutation,
  useGetBusinessesQuery,
  useGetSuppliersQuery,
  useUpdateSupplierMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { Supplier, SupplierWriteRequest } from '../../types/models'

export function SuppliersPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetSuppliersQuery({
    page,
    pageSize,
    q: debounced || undefined,
    businessId: showBizPicker ? undefined : authBusinessId ?? undefined,
  })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })

  const [createSupplier] = useCreateSupplierMutation()
  const [updateSupplier] = useUpdateSupplierMutation()
  const [deleteSupplier] = useDeleteSupplierMutation()

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)

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

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierWriteRequest>({
    name: '',
    phone: '',
    address: '',
    email: '',
  })
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null
  const canSave = !needsBusiness && form.name.trim().length > 0

  function openCreate() {
    setEditing(null)
    if (showBizPicker) setFormBusinessId(null)
    setForm({ name: '', phone: '', address: '', email: '' })
    setOpen(true)
  }

  function openEdit(row: Supplier) {
    setEditing(row)
    if (showBizPicker) setFormBusinessId(row.businessId)
    setForm({
      name: row.name,
      phone: row.phone,
      address: row.address,
      email: row.email,
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const body: SupplierWriteRequest = {
      ...form,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    if (editing) {
      await updateSupplier({ id: editing.id, body }).unwrap()
    } else {
      await createSupplier(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete supplier?',
      description: 'This supplier will be removed.',
      action: async () => {
        await deleteSupplier(id).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(id)
          return n
        })
      },
    })
  }

  const columns: Column<Supplier>[] = useMemo(() => {
    const base: Column<Supplier>[] = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'email', header: 'Email' },
      {
        key: 'address',
        header: 'Address',
        render: (r) => <span className="line-clamp-2 max-w-xs">{r.address}</span>,
      },
    ]
    if (!isSuperAdmin) return base
    return [
      { key: 'id', header: 'ID' },
      {
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
      },
      ...base.slice(1),
    ]
  }, [isSuperAdmin, businessNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<Supplier>
        title="Suppliers"
        addLabel="Add supplier"
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
        onDeleteSelected={() => {
          const ids = [...selected]
          requestDelete({
            title: `Delete ${ids.length} supplier(s)?`,
            description: 'Selected suppliers will be removed.',
            action: async () => {
              for (const id of ids) await deleteSupplier(id).unwrap()
              setSelected(new Set())
            },
          })
        }}
        columns={columns}
      />
      <Modal open={open} title={editing ? 'Edit supplier' : 'Add supplier'} onClose={() => setOpen(false)} className="max-w-2xl">
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          {showBizPicker && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => setFormBusinessId(o ? Number(o.value) : null)}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}
          {needsBusiness && (
            <p className="md:col-span-2 text-sm text-amber-800">
              {showBizPicker ? 'Select a business.' : 'No business assigned to your account.'}
            </p>
          )}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
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
