import { useState } from 'react'
import {
  useCreateBusinessMutation,
  useDeleteBusinessMutation,
  useGetBusinessesQuery,
  useUpdateBusinessMutation,
} from '../../app/api/apiSlice'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import type { Business } from '../../types/models'

export function BusinessesPage() {
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetBusinessesQuery({ page, pageSize, q: debounced || undefined })
  const [createBusiness] = useCreateBusinessMutation()
  const [updateBusiness] = useUpdateBusinessMutation()
  const [deleteBusiness] = useDeleteBusinessMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Business | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function openCreate() {
    setEditing(null)
    setName('')
    setAddress('')
    setPhoneNumber('')
    setOpen(true)
  }

  function openEdit(row: Business) {
    setEditing(row)
    setName(row.name)
    setAddress(row.address ?? '')
    setPhoneNumber(row.phoneNumber ?? '')
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await updateBusiness({ id: editing.id, body: { ...editing, name, address, phoneNumber } }).unwrap()
    } else {
      await createBusiness({ name, address, phoneNumber }).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this business?',
      description: 'This business record will be removed.',
      action: async () => {
        await deleteBusiness(id).unwrap()
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
      description: 'Selected businesses will be permanently removed.',
      action: async () => {
        for (const id of ids) {
          await deleteBusiness(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<Business>
        title="Businesses"
        addLabel="Add business"
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
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'address', header: 'Address' },
          { key: 'phoneNumber', header: 'Phone' },
        ]}
      />
      <Modal open={open} title={editing ? 'Edit business' : 'Add business'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div className="flex justify-end gap-2">
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
