import { useMemo, useState } from 'react'
import {
  useCreateMenuMutation,
  useCreateSubMenuMutation,
  useDeleteMenuMutation,
  useGetMenusQuery,
  useGetSubMenusQuery,
  useLazyGetMenusQuery,
  useLazyGetSubMenusQuery,
  useUpdateMenuMutation,
} from '../../app/api/apiSlice'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { cn } from '../../lib/cn'
import { useDebouncedValue } from '../../lib/hooks'
import type { Menu, PagedResult, SubMenu } from '../../types/models'

const PAGE_SIZE = 2000

async function fetchAllPaged<T>(
  loadPage: (args: { page: number; pageSize: number; q?: string }) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const items: T[] = []
  let page = 1
  for (;;) {
    const res = await loadPage({ page, pageSize: PAGE_SIZE, q: undefined })
    items.push(...res.items)
    if (res.items.length < PAGE_SIZE || items.length >= res.totalCount) break
    page += 1
  }
  return items
}

/** Normalize routes so `/foo`, `/foo/`, and ` /foo ` match. */
function routesEqual(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (x === y) return true
  const strip = (s: string) => {
    if (s === '' || s === '/') return '/'
    return s.replace(/\/+$/, '') || '/'
  }
  return strip(x) === strip(y)
}

type NavBlock = {
  menu: { name: string; route: string }
  submenus: { name: string; route: string }[]
}

function isDefaultNavSatisfied(menus: Menu[], subs: SubMenu[], nav: NavBlock[]): boolean {
  for (const block of nav) {
    const menu = menus.find((m) => routesEqual(m.route, block.menu.route))
    if (!menu) return false
    for (const sm of block.submenus) {
      const exists = subs.some((s) => s.menuId === menu.id && routesEqual(s.route, sm.route))
      if (!exists) return false
    }
  }
  return true
}

const DEFAULT_NAV: NavBlock[] = [
  {
    menu: { name: 'Dashboard', route: '/' },
    submenus: [{ name: 'Dashboard', route: '/' }],
  },
  {
    menu: { name: 'Expenses', route: '/expenses' },
    submenus: [{ name: 'Expenses', route: '/expenses' }],
  },
  {
    menu: { name: 'Inventory', route: '/inventory' },
    submenus: [{ name: 'Inventory', route: '/inventory' }],
  },
  {
    menu: { name: 'Rates', route: '/rates' },
    submenus: [{ name: 'Rates', route: '/rates' }],
  },
  {
    menu: { name: 'Generator usage', route: '/generator-usage' },
    submenus: [{ name: 'Generator usage', route: '/generator-usage' }],
  },
  {
    menu: { name: 'DippingPump', route: '/dipping-pumps' },
    submenus: [{ name: 'DippingPump', route: '/dipping-pumps' }],
  },
  {
    menu: { name: 'Pumps', route: '/pumps' },
    submenus: [
      { name: 'Pumps', route: '/pumps' },
      { name: 'Nozzles', route: '/nozzles' },
    ],
  },
  {
    menu: { name: 'Dipping', route: '/dipping' },
    submenus: [{ name: 'Dipping', route: '/dipping' }],
  },
  {
    menu: { name: 'Liter received', route: '/liter-received' },
    submenus: [{ name: 'Liter received', route: '/liter-received' }],
  },

  // add purchases menu
  {
    menu: { name: 'Purchases', route: '/purchases' },
    submenus: [{ name: 'Purchases', route: '/purchases' }],
  },
  // ad suppliers menu
  {
    menu: { name: 'Suppliers', route: '/suppliers' },
    submenus: [{ name: 'Suppliers', route: '/suppliers' }],
  },
  // addd customers menu
  {
    menu: { name: 'Fuel givens', route: '/customer-fuel-givens' },
    submenus: [{ name: 'Fuel givens', route: '/customer-fuel-givens' }],
  },

  // add payments
  {
    menu: { name: 'Payments', route: '/accounting/customer-payments' },
    submenus: [{ name: 'Payments', route: '/accounting/customer-payments' }],
  },

  // Add accounting menu
  {
    menu: { name: 'Accounting', route: '/accounting' },
    submenus: [
      { name: 'Accounts', route: '/accounting/accounts' },
      { name: 'Charts of accounts', route: '/accounting/charts-of-accounts' },
      { name: 'Manual journal entry', route: '/accounting/manual-journal-entry' },
    ],
  },
  // add financial reports menu
  {
    menu: { name: 'Financial reports', route: '/financial-reports' },
    submenus: [
      { name: 'General Ledger', route: '/financial-reports/general-ledger' },
      { name: 'Trial balance', route: '/financial-reports/trial-balance' },
      { name: 'Profit and loss', route: '/financial-reports/profit-and-loss' },
      { name: 'Balance sheet', route: '/financial-reports/balance-sheet' },
      { name: 'Customer balances', route: '/financial-reports/customer-balances' },
      { name: 'Supplier balances', route: '/financial-reports/supplier-balances' },
      { name: 'Daily cash flow report', route: '/financial-reports/daily-cash-flow' },
    ],
  },
  // Reports
  {
    menu: { name: 'Reports', route: '/reports' },
    submenus: [
      { name: 'Liter received', route: '/reports/liter-received' },
      { name: 'Daily cash sales report', route: '/reports/daily-cash-sales' },
      { name: 'Cash out daily (expenses)', route: '/reports/cash-out-daily' },
      { name: 'Daily given fuel', route: '/reports/daily-fuel-given' },
      { name: 'Generator usage report', route: '/reports/generator-usage' },
      { name: 'General daily report', route: '/reports/general-daily' },
      { name: 'Inventory daily', route: '/reports/inventory-daily' },
      { name: 'Outstanding customers', route: '/reports/outstanding-customers' },
    ],
  },
  {
    menu: { name: 'Main setup', route: '/setup' },
    submenus: [
      { name: 'Roles', route: '/setup/roles' },
      { name: 'Users', route: '/setup/users' },
      { name: 'Assigning Station', route: '/setup/business-users' },
      { name: 'Businesses', route: '/setup/businesses' },
      { name: 'Stations', route: '/stations' },
      { name: 'Menus', route: '/setup/menus' },
      { name: 'Submenus', route: '/setup/submenus' },
      { name: 'Permissions', route: '/setup/permissions' },
      { name: 'Fuel types', route: '/setup/fuel-types' },
      { name: 'Currencies', route: '/setup/currencies' },
      { name: 'Fuel prices', route: '/setup/fuel-prices' },
      { name: 'Settings', route: '/setup/settings' },
    ],
  },
 
]

export function MenusPage() {
  const { requestDelete, dialog: confirmDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetMenusQuery({ page, pageSize, q: debounced || undefined })
  const { data: menusForGen } = useGetMenusQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    q: undefined,
  })
  const { data: subMenusForGen } = useGetSubMenusQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    q: undefined,
  })
  const [fetchMenusPage] = useLazyGetMenusQuery()
  const [fetchSubMenusPage] = useLazyGetSubMenusQuery()
  const [createMenu] = useCreateMenuMutation()
  const [updateMenu] = useUpdateMenuMutation()
  const [deleteMenu] = useDeleteMenuMutation()
  const [createSubMenu] = useCreateSubMenuMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [name, setName] = useState('')
  const [route, setRoute] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const defaultNavComplete = useMemo(
    () => isDefaultNavSatisfied(menusForGen?.items ?? [], subMenusForGen?.items ?? [], DEFAULT_NAV),
    [menusForGen?.items, subMenusForGen?.items],
  )

  function handleGenerate() {
    if (defaultNavComplete) return
    requestDelete({
      title: 'Generate default navigation?',
      description:
        'Creates menu and submenu rows to mirror this app’s routes. Any route that already exists is skipped (including after a fresh load from the server).',
      variant: 'neutral',
      confirmLabel: 'Generate',
      action: async () => {
        const existingMenus = await fetchAllPaged((args) => fetchMenusPage(args).unwrap())
        let existingSubs = await fetchAllPaged((args) => fetchSubMenusPage(args).unwrap())

        for (const block of DEFAULT_NAV) {
          let menu = existingMenus.find((x) => routesEqual(x.route, block.menu.route))
          if (!menu) {
            menu = await createMenu({ name: block.menu.name, route: block.menu.route.trim() }).unwrap()
            existingMenus.push(menu)
          }

          for (const sm of block.submenus) {
            const exists = existingSubs.some(
              (s) => s.menuId === menu.id && routesEqual(s.route, sm.route),
            )
            if (!exists) {
              const created = await createSubMenu({
                menuId: menu.id,
                name: sm.name,
                route: sm.route.trim(),
              }).unwrap()
              existingSubs.push(created)
            }
          }
        }
      },
    })
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setRoute('')
    setOpen(true)
  }

  function openEdit(row: Menu) {
    setEditing(row)
    setName(row.name)
    setRoute(row.route)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await updateMenu({ id: editing.id, body: { ...editing, name, route } }).unwrap()
    } else {
      await createMenu({ name, route }).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this menu?',
      description: 'Submenus in the database may still reference this menu.',
      action: async () => {
        await deleteMenu(id).unwrap()
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
      description: 'Selected menus will be permanently removed.',
      action: async () => {
        for (const id of ids) {
          await deleteMenu(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {confirmDialog}
      <DataTable<Menu>
        title="Menus"
        addLabel="Add menu"
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
        extraToolbar={
          <button
            type="button"
            onClick={handleGenerate}
            disabled={defaultNavComplete}
            title={
              defaultNavComplete
                ? 'Default menus and submenus are already present'
                : 'Add any missing default menu and submenu rows'
            }
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium',
              defaultNavComplete
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
            )}
          >
            {defaultNavComplete ? 'Default navigation ready' : 'Generate default'}
          </button>
        }
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'route', header: 'Route' },
        ]}
      />
      <Modal open={open} title={editing ? 'Edit menu' : 'Add menu'} onClose={() => setOpen(false)}>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Route</label>
            <input
              required
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/example"
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
