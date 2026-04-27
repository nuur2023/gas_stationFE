import { useState } from 'react'
import {
  useCreateSubMenuMutation,
  useDeleteSubMenuMutation,
  useGetMenusQuery,
  useGetSubMenusQuery,
  useUpdateSubMenuMutation,
} from '../../app/api/apiSlice'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import type { SubMenu } from '../../types/models'

export function SubMenusPage() {
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetSubMenusQuery({ page, pageSize, q: debounced || undefined })
  const { data: menusData } = useGetMenusQuery({ page: 1, pageSize: 200, q: undefined })
  const [createSubMenu] = useCreateSubMenuMutation()
  const [updateSubMenu] = useUpdateSubMenuMutation()
  const [deleteSubMenu] = useDeleteSubMenuMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubMenu | null>(null)
  const [menuId, setMenuId] = useState(1)
  const [name, setName] = useState('')
  const [route, setRoute] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const menuLabel = (id: number) => menusData?.items.find((m) => m.id === id)?.name ?? id

  function openCreate() {
    setEditing(null)
    setMenuId(menusData?.items[0]?.id ?? 1)
    setName('')
    setRoute('')
    setOpen(true)
  }

  function openEdit(row: SubMenu) {
    setEditing(row)
    setMenuId(row.menuId)
    setName(row.name)
    setRoute(row.route)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await updateSubMenu({ id: editing.id, body: { ...editing, menuId, name, route } }).unwrap()
    } else {
      await createSubMenu({ menuId, name, route }).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this submenu?',
      description: 'This submenu entry will be removed.',
      action: async () => {
        await deleteSubMenu(id).unwrap()
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
      description: 'Selected submenus will be permanently removed.',
      action: async () => {
        for (const id of ids) {
          await deleteSubMenu(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<SubMenu>
        title="Submenus"
        addLabel="Add submenu"
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
          {
            key: 'menuId',
            header: 'Menu',
            render: (row) => menuLabel(row.menuId),
          },
          { key: 'name', header: 'Name' },
          { key: 'route', header: 'Route' },
        ]}
      />
      <Modal open={open} title={editing ? 'Edit submenu' : 'Add submenu'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Parent menu</label>
            <select
              value={menuId}
              onChange={(e) => setMenuId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            >
              {(menusData?.items ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Route</label>
            <input
              required
              value={route}
              onChange={(e) => setRoute(e.target.value)}
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
