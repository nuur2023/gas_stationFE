import { Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCreateCustomerFuelGivenCustomerMutation,
  useDeleteCustomerFuelGivenCustomerMutation,
  useGetCustomerFuelGivenCustomersQuery,
  useUpdateCustomerFuelGivenCustomerMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatDecimal } from '../../lib/formatNumber'
import { useDebouncedValue } from '../../lib/hooks'
import { useEffectiveStationId } from '../../lib/stationContext'
import type { CustomerFuelGivenCustomer, CustomerIdentityWriteRequest, CustomerWriteRequest } from '../../types/models'

export function CustomerFuelGivensPage() {
  const navigate = useNavigate()
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerFuelGivenCustomer | null>(null)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { data, isFetching } = useGetCustomerFuelGivenCustomersQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0 ? { filterStationId: effectiveStationId } : {}),
  })
  const [createCustomer] = useCreateCustomerFuelGivenCustomerMutation()
  const [updateCustomer] = useUpdateCustomerFuelGivenCustomerMutation()
  const [deleteCustomer] = useDeleteCustomerFuelGivenCustomerMutation()

  const columns: Column<CustomerFuelGivenCustomer>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'balance', header: 'Balance', align: 'right', render: (r) => formatDecimal(r.balance) },
    ],
    [],
  )

  function openCreate() {
    setEditing(null)
    setName('')
    setOpen(true)
  }

  function openEdit(row: CustomerFuelGivenCustomer) {
    setEditing(row)
    setName(row.name)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (editing) {
      const body: CustomerIdentityWriteRequest = { name: name.trim(), phone: editing.phone?.trim() || undefined }
      await updateCustomer({ id: editing.id, body }).unwrap()
    } else {
      const body: CustomerWriteRequest = {
        name: name.trim(),
        stationId: effectiveStationId ?? undefined,
        businessId: authBusinessId ?? undefined,
      }
      await createCustomer(body).unwrap()
    }
    setOpen(false)
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete customer?',
      description: 'Delete this customer and all related transactions?',
      action: async () => {
        await deleteCustomer(id).unwrap()
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected customers?',
      description: `Delete ${ids.length} customer(s) and all related transactions?`,
      action: async () => {
        for (const id of ids) await deleteCustomer(id).unwrap()
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<CustomerFuelGivenCustomer>
        title="Customers"
        addLabel="Add customer"
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
        columns={columns}
        renderExtraRowActions={(row) => (
          <button
            type="button"
            title="View"
            onClick={() => navigate(`/customer-fuel-givens/${row.id}`)}
            className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      />
      <Modal
        open={open}
        title={editing ? 'Edit customer' : 'Add customer'}
        onClose={() => setOpen(false)}
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
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

