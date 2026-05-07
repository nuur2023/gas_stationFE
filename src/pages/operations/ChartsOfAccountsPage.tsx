import { useState } from 'react'
import {
  useCreateChartsOfAccountsMutation,
  useDeleteChartsOfAccountsMutation,
  useGetChartsOfAccountsQuery,
  useUpdateChartsOfAccountsMutation,
} from '../../app/api/apiSlice'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'

type ChartsRow = {
  id: number
  type: string
}

export function ChartsOfAccountsPage() {
  const { canCreate: routeCanCreate, canUpdate: routeCanUpdate } = usePagePermissionActions()
  const { data: rowsData, isFetching } = useGetChartsOfAccountsQuery({ businessId: undefined })
  const [createChart, { isLoading: creating }] = useCreateChartsOfAccountsMutation()
  const [updateChart, { isLoading: updating }] = useUpdateChartsOfAccountsMutation()
  const [deleteChart] = useDeleteChartsOfAccountsMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ChartsRow | null>(null)
  const [type, setType] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const rows: ChartsRow[] = rowsData ?? []
  const cols: Column<ChartsRow>[] = [
    { key: 'id', header: 'ID' },
    { key: 'type', header: 'Type' },
  ]

  function openCreate() {
    setEditing(null)
    setType('')
    setOpen(true)
  }

  function openEdit(row: ChartsRow) {
    setEditing(row)
    setType(row.type)
    setOpen(true)
  }

  async function save() {
    const payload = type.trim()
    if (!payload) return
    if (editing) {
      await updateChart({ id: editing.id, body: { type: payload } }).unwrap()
    } else {
      await createChart({ type: payload }).unwrap()
    }
    setOpen(false)
  }

  return (
    <>
      <DataTable<ChartsRow>
        title="Charts of Accounts"
        addLabel="Add Type"
        rows={rows}
        totalCount={rows.length}
        page={1}
        pageSize={rows.length || 10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        search=""
        onSearchChange={() => {}}
        columns={cols}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete chart type?',
            description: 'This chart-of-accounts type will be removed if no account uses it.',
            action: async () => {
              await deleteChart(id).unwrap()
              setSelected((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            },
          })
        }
        onDeleteSelected={() =>
          requestDelete({
            title: 'Delete selected chart types?',
            description: `Delete ${selected.size} selected row(s).`,
            action: async () => {
              await Promise.all(Array.from(selected).map((id) => deleteChart(id).unwrap()))
              setSelected(new Set())
            },
          })
        }
      />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit chart type' : 'Add chart type'} className="max-w-md">
        <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="e.g. Expense"
          className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!type.trim() || creating || updating || (editing ? !routeCanUpdate : !routeCanCreate)}
            title={editing ? (!routeCanUpdate ? 'No update permission' : undefined) : !routeCanCreate ? 'No create permission' : undefined}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      </Modal>
      {deleteDialog}
    </>
  )
}

