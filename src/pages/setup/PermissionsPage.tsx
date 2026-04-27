import { useEffect, useMemo, useState } from 'react'
import {
  useGetBusinessesQuery,
  useGetMenuTreeQuery,
  useGetPermissionContextUsersQuery,
  useGetPermissionsByUserQuery,
  useSavePermissionsBulkMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { cn } from '../../lib/cn'
import type { BulkPermissionItem, Menu, Permission, SubMenu } from '../../types/models'

/** Stable fallbacks so hooks that depend on array identity do not re-run every render when RTK `data` is undefined. */
const EMPTY_MENUS: Menu[] = []
const EMPTY_CONTEXT_USERS: { id: number; name: string; email: string; roleId?: number; roleName?: string | null }[] = []
const EMPTY_PERMS: Permission[] = []

type Flags = {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

const emptyF = (): Flags => ({
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
})

const fullF = (): Flags => ({
  canView: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
})

function flagsFromPermission(p: Permission | undefined): Flags {
  if (!p) return emptyF()
  return {
    canView: p.canView,
    canCreate: p.canCreate,
    canUpdate: p.canUpdate,
    canDelete: p.canDelete,
  }
}

function buildFlagsFromServer(tree: Menu[], perms: Permission[]): Record<string, Flags> {
  const out: Record<string, Flags> = {}
  for (const m of tree) {
    const mp = perms.find((x) => x.menuId === m.id && x.subMenuId == null)
    out[`m:${m.id}`] = flagsFromPermission(mp)
    const subs = m.subMenus ?? []
    for (const sm of subs) {
      const sp = perms.find((x) => x.subMenuId === sm.id)
      out[`s:${sm.id}`] = flagsFromPermission(sp)
    }
  }
  return out
}

function mapAll(tree: Menu[], fn: () => Flags): Record<string, Flags> {
  const o: Record<string, Flags> = {}
  for (const m of tree) {
    o[`m:${m.id}`] = fn()
    for (const sm of m.subMenus ?? []) {
      o[`s:${sm.id}`] = fn()
    }
  }
  return o
}

function flattenItems(tree: Menu[], flags: Record<string, Flags>): BulkPermissionItem[] {
  const items: BulkPermissionItem[] = []
  for (const m of tree) {
    const mf = flags[`m:${m.id}`] ?? emptyF()
    items.push({
      menuId: m.id,
      subMenuId: null,
      ...mf,
    })
    for (const sm of m.subMenus ?? []) {
      const sf = flags[`s:${sm.id}`] ?? emptyF()
      items.push({
        menuId: m.id,
        subMenuId: sm.id,
        ...sf,
      })
    }
  }
  return items
}

function isFull(f: Flags) {
  return f.canView && f.canCreate && f.canUpdate && f.canDelete
}

function hasAny(f: Flags) {
  return f.canView || f.canCreate || f.canUpdate || f.canDelete
}

function isEverythingChecked(tree: Menu[], flags: Record<string, Flags>): boolean {
  if (!tree.length) return true
  for (const m of tree) {
    if (!isFull(flags[`m:${m.id}`] ?? emptyF())) return false
    for (const sm of m.subMenus ?? []) {
      if (!isFull(flags[`s:${sm.id}`] ?? emptyF())) return false
    }
  }
  return true
}

function filterGrantedTreeForNonSuperAdmin(tree: Menu[], flags: Record<string, Flags>): Menu[] {
  const out: Menu[] = []
  for (const m of tree) {
    const menuGranted = hasAny(flags[`m:${m.id}`] ?? emptyF())
    const grantedSubs = (m.subMenus ?? []).filter((sm) => hasAny(flags[`s:${sm.id}`] ?? emptyF()))
    if (!menuGranted && grantedSubs.length === 0) continue
    out.push({
      ...m,
      subMenus: grantedSubs,
    })
  }
  return out
}

/** Submenu routes SuperAdmin must not assign to Admin users (matches seed sidebar / accounting menus). */
const ADMIN_GRANT_BLOCKED_SUBMENU_PATHS = new Set([
  '/accounting/charts-of-accounts',
  '/setup/roles',
  '/setup/businesses',
  '/stations',
  '/setup/menus',
  '/setup/submenus',
  '/setup/currencies',
])

/** Menu routes SuperAdmin must not assign to Admin users. */
const ADMIN_GRANT_BLOCKED_MENU_PATHS = new Set([
  '/accounting/charts-of-accounts',
  '/setup/roles',
  '/setup/businesses',
  '/stations',
  '/setup/menus',
  '/setup/submenus',
  '/setup/currencies',
])

/** Submenu routes an Admin must not show or delegate (matches seed Permissions under Setup). */
const ADMIN_DELEGATE_BLOCKED_SUBMENU_PATHS = new Set(['/setup/permissions', '/setup/business-users'])

/** Menu routes an Admin must not show or delegate. */
const ADMIN_DELEGATE_BLOCKED_MENU_PATHS = new Set(['/setup/permissions'])

function submenuPathOnly(sm: Pick<SubMenu, 'route'>): string {
  const r = (sm.route ?? '').trim()
  const q = r.indexOf('?')
  return q >= 0 ? r.slice(0, q) : r
}

function menuPathOnly(m: Pick<Menu, 'route'>): string {
  const r = (m.route ?? '').trim()
  const q = r.indexOf('?')
  return q >= 0 ? r.slice(0, q) : r
}

function isAdminGrantBlockedMenu(m: Pick<Menu, 'route'>): boolean {
  const p = menuPathOnly(m).toLowerCase()
  return ADMIN_GRANT_BLOCKED_MENU_PATHS.has(p)
}

function isAdminGrantBlockedSubmenu(sm: Pick<SubMenu, 'route'>): boolean {
  const p = submenuPathOnly(sm).toLowerCase()
  return ADMIN_GRANT_BLOCKED_SUBMENU_PATHS.has(p)
}

function isAdminDelegateBlockedMenu(m: Pick<Menu, 'route'>): boolean {
  const p = menuPathOnly(m).toLowerCase()
  return ADMIN_DELEGATE_BLOCKED_MENU_PATHS.has(p)
}

function isAdminDelegateBlockedSubmenu(sm: Pick<SubMenu, 'route'>): boolean {
  const p = submenuPathOnly(sm).toLowerCase()
  return ADMIN_DELEGATE_BLOCKED_SUBMENU_PATHS.has(p)
}

/** Full tree minus blocked submenus — used when SuperAdmin assigns permissions to an Admin user. */
function filterAdminGrantExcludedSubmenus(tree: Menu[]): Menu[] {
  const out: Menu[] = []
  for (const m of tree) {
    if (isAdminGrantBlockedMenu(m)) continue
    const subs = (m.subMenus ?? []).filter((sm) => !isAdminGrantBlockedSubmenu(sm))
    out.push({
      ...m,
      subMenus: subs,
    })
  }
  return out
}

/** Granted tree minus submenus Admins cannot delegate (e.g. Permissions management). */
function filterAdminDelegateExcludedSubmenus(tree: Menu[]): Menu[] {
  const out: Menu[] = []
  for (const m of tree) {
    if (isAdminDelegateBlockedMenu(m)) continue
    const subs = (m.subMenus ?? []).filter((sm) => !isAdminDelegateBlockedSubmenu(sm))
    out.push({
      ...m,
      subMenus: subs,
    })
  }
  return out
}

export function PermissionsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const authUserId = useAppSelector((s) => s.auth.userId)
  const isSuperAdmin = role === 'SuperAdmin'
  const isAdmin = role === 'Admin'

  const { data: businesses } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    { skip: !isSuperAdmin },
  )

  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(null)
  const [targetUserId, setTargetUserId] = useState<number | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) return
    const items = businesses?.items ?? []
    if (items.length === 0) return
    setFilterBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [isSuperAdmin, businesses?.items])

  const effectiveBusinessId = isSuperAdmin ? (filterBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: contextUsersRaw, isFetching: usersLoading } = useGetPermissionContextUsersQuery(
    { businessId: isSuperAdmin ? (effectiveBusinessId > 0 ? effectiveBusinessId : undefined) : undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const contextUsers = contextUsersRaw ?? EMPTY_CONTEXT_USERS
  const filteredContextUsers = useMemo(() => {
    return contextUsers.filter((u) => {
      if (authUserId != null && u.id === authUserId) return false
      const rn = (u.roleName ?? '').trim().toLowerCase()
      if (rn === 'superadmin') return false
      if (isAdmin && rn === 'admin') return false
      return true
    })
  }, [contextUsers, isAdmin, authUserId])

  useEffect(() => {
    if (effectiveBusinessId <= 0) {
      setTargetUserId(null)
      return
    }
    setTargetUserId((prev) => {
      if (filteredContextUsers.length === 0) return null
      if (prev != null && filteredContextUsers.some((u) => u.id === prev)) return prev
      return filteredContextUsers[0].id
    })
  }, [effectiveBusinessId, filteredContextUsers])

  const { data: treeRaw, isFetching: treeLoading } = useGetMenuTreeQuery()
  const tree = treeRaw ?? EMPTY_MENUS

  const { data: permsRaw, isFetching: permsLoading } = useGetPermissionsByUserQuery(
    { userId: targetUserId!, businessId: effectiveBusinessId },
    { skip: targetUserId == null || effectiveBusinessId <= 0 },
  )
  const perms = permsRaw ?? EMPTY_PERMS

  const { data: actorPermsRaw } = useGetPermissionsByUserQuery(
    { userId: authUserId!, businessId: effectiveBusinessId },
    { skip: isSuperAdmin || authUserId == null || effectiveBusinessId <= 0 },
  )
  const actorPerms = actorPermsRaw ?? EMPTY_PERMS

  const targetUserRow = useMemo(
    () => contextUsers.find((u) => u.id === targetUserId) ?? null,
    [contextUsers, targetUserId],
  )
  const targetIsAdmin = (targetUserRow?.roleName ?? '').trim().toLowerCase() === 'admin'

  const [flags, setFlags] = useState<Record<string, Flags>>({})
  const actorFlags = useMemo(
    () => (isSuperAdmin ? mapAll(tree, fullF) : buildFlagsFromServer(tree, actorPerms)),
    [isSuperAdmin, tree, actorPerms],
  )

  useEffect(() => {
    if (!tree.length || targetUserId == null || effectiveBusinessId <= 0) return
    setFlags(buildFlagsFromServer(tree, perms))
  }, [tree, perms, targetUserId, effectiveBusinessId])

  const [saveBulk, { isLoading: saving }] = useSavePermissionsBulkMutation()

  const grantTree = useMemo(() => {
    if (isSuperAdmin && targetIsAdmin) return filterAdminGrantExcludedSubmenus(tree)
    if (isSuperAdmin) return tree
    const granted = filterGrantedTreeForNonSuperAdmin(tree, actorFlags)
    if (isAdmin) return filterAdminDelegateExcludedSubmenus(granted)
    return granted
  }, [isSuperAdmin, targetIsAdmin, tree, actorFlags, isAdmin])

  const businessOptions: SelectOption[] = useMemo(
    () => (businesses?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businesses?.items],
  )

  const userOptions: SelectOption[] = useMemo(
    () => filteredContextUsers.map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })),
    [filteredContextUsers],
  )

  const userSelectValue = useMemo(
    () => userOptions.find((o) => Number(o.value) === targetUserId) ?? null,
    [userOptions, targetUserId],
  )

  const allPermissionsChecked = useMemo(() => isEverythingChecked(grantTree, flags), [grantTree, flags])

  function setMenuAccess(menuId: number, on: boolean) {
    setFlags((prev) => {
      const next = { ...prev }
      next[`m:${menuId}`] = on ? fullF() : emptyF()
      const menu = grantTree.find((m) => m.id === menuId)
      for (const sm of menu?.subMenus ?? []) {
        next[`s:${sm.id}`] = on ? fullF() : emptyF()
      }
      return next
    })
  }

  function setSubAccess(_menuId: number, subMenuId: number, on: boolean) {
    setFlags((prev) => {
      const next = { ...prev }
      next[`s:${subMenuId}`] = on ? fullF() : emptyF()
      if (on) {
        const menu = grantTree.find((m) => (m.subMenus ?? []).some((sm) => sm.id === subMenuId))
        if (menu) {
          const mk = `m:${menu.id}`
          const mf = next[mk] ?? emptyF()
          next[mk] = { ...mf, canView: true }
        }
      }
      return next
    })
  }

  function toggleFlag(key: string, field: keyof Flags, menuId?: number, subMenuId?: number) {
    setFlags((prev) => {
      const current = prev[key] ?? emptyF()
      const nextVal = !current[field]
      const nextFlags: Flags = {
        ...current,
        [field]: nextVal,
      }
      if (nextVal && field !== 'canView') {
        nextFlags.canView = true
      }

      const next = {
        ...prev,
        [key]: nextFlags,
      }

      if (nextVal && subMenuId != null) {
        const mk = `m:${menuId}`
        const mf = next[mk] ?? emptyF()
        next[mk] = { ...mf, canView: true }
      }
      return next
    })
  }

  function checkAll() {
    setFlags((prev) => {
      const patch = mapAll(grantTree, fullF)
      return { ...prev, ...patch }
    })
  }

  function uncheckAll() {
    setFlags((prev) => {
      const patch = mapAll(grantTree, emptyF)
      return { ...prev, ...patch }
    })
  }

  async function handleSave() {
    if (targetUserId == null || effectiveBusinessId <= 0 || !grantTree.length) return
    await saveBulk({
      userId: targetUserId,
      businessId: effectiveBusinessId,
      items: flattenItems(grantTree, flags),
    }).unwrap()
  }

  const loading =
    treeLoading ||
    usersLoading ||
    (targetUserId != null && effectiveBusinessId > 0 && permsLoading)

  const canSave = targetUserId != null && effectiveBusinessId > 0 && grantTree.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {isSuperAdmin && (
            <div className="min-w-[12rem] max-w-md flex-1">
              <label htmlFor="permissions-business" className="mb-1 block text-sm font-medium text-slate-700">
                Business
              </label>
              <FormSelect
                inputId="permissions-business"
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
                onChange={(opt) => {
                  setFilterBusinessId(opt ? Number(opt.value) : null)
                }}
                placeholder="Select business…"
                isDisabled={businessOptions.length === 0}
              />
            </div>
          )}
          <div className="min-w-[12rem] max-w-md flex-1">
            <label htmlFor="permissions-user" className="mb-1 block text-sm font-medium text-slate-700">
              User
            </label>
            <FormSelect
              inputId="permissions-user"
              options={userOptions}
              value={userSelectValue}
              onChange={(opt) => {
                if (opt) setTargetUserId(Number(opt.value))
              }}
              placeholder="Select user…"
              isDisabled={userOptions.length === 0 || effectiveBusinessId <= 0}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (allPermissionsChecked ? uncheckAll() : checkAll())}
            disabled={!grantTree.length}
            title={allPermissionsChecked ? 'Clear all permission checkboxes' : 'Select all permission checkboxes'}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              allPermissionsChecked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
            )}
          >
            {allPermissionsChecked ? 'Uncheck all' : 'Check all'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canSave || loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      </div>

      {effectiveBusinessId <= 0 && !isSuperAdmin && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account has no business assigned. Permissions can only be managed for users in a business.
        </p>
      )}

      {isSuperAdmin && filterBusinessId == null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a business to list users and assign permissions.
        </p>
      )}

      {effectiveBusinessId > 0 && !usersLoading && filteredContextUsers.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No users are linked to this business yet. Add them under <strong>Business users</strong> first.
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {isSuperAdmin && targetIsAdmin && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Assigning to an <strong>Admin</strong>: global setup items (charts of accounts, roles, businesses, stations,
          menus, submenus, currencies) are hidden and cannot be granted. Business users remains available but is
          limited to the Admin&apos;s own business scope.
        </p>
      )}

      {!isSuperAdmin && isAdmin && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          You can only grant access you already have. The <strong>Permissions</strong> and <strong>Assigning Station</strong> submenus are not shown here and
          cannot be assigned to other users.
        </p>
      )}

      <div className="space-y-4">
        {grantTree.map((menu) => {
          const mk = `m:${menu.id}`
          const mf = flags[mk] ?? emptyF()
          const subs = menu.subMenus ?? []
          return (
            <div key={menu.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-4 flex cursor-pointer items-center gap-3 font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={hasAny(mf)}
                  onChange={(e) => setMenuAccess(menu.id, e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300"
                />
                <span className="text-2xl leading-none">Access {menu.name} menu</span>
              </label>

              {subs.map((sm) => {
                const sk = `s:${sm.id}`
                const sf = flags[sk] ?? emptyF()
                return (
                  <div key={sm.id} className="mb-4 ml-7 rounded-xl border border-slate-200 bg-white p-4">
                    <label className="mb-3 flex cursor-pointer items-center gap-3 text-xl font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={hasAny(sf)}
                        onChange={(e) => setSubAccess(menu.id, sm.id, e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300"
                      />
                      <span>Access {sm.name} submenu</span>
                    </label>

                    <div className="ml-8 rounded-xl bg-slate-100 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {(['canView', 'canCreate', 'canUpdate', 'canDelete'] as const).map((field) => (
                          <label key={field} className="flex cursor-pointer items-center gap-2 text-base text-slate-800">
                            <input
                              type="checkbox"
                              checked={sf[field]}
                              onChange={() => toggleFlag(sk, field, menu.id, sm.id)}
                              className="h-5 w-5 rounded border-slate-300"
                            />
                            <span className="leading-none">
                              {field === 'canView'
                                ? 'View'
                                : field === 'canCreate'
                                  ? 'Create'
                                  : field === 'canUpdate'
                                    ? 'Update'
                                    : 'Delete'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              {!subs.length && (
                <div className="mb-4 ml-7 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="ml-8 rounded-xl bg-slate-100 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      {(['canView', 'canCreate', 'canUpdate', 'canDelete'] as const).map((field) => (
                        <label key={field} className="flex cursor-pointer items-center gap-2 text-base text-slate-800">
                          <input
                            type="checkbox"
                            checked={mf[field]}
                            onChange={() => toggleFlag(mk, field, menu.id)}
                            className="h-5 w-5 rounded border-slate-300"
                          />
                          <span className="leading-none">
                            {field === 'canView'
                              ? 'View'
                              : field === 'canCreate'
                                ? 'Create'
                                : field === 'canUpdate'
                                  ? 'Update'
                                  : 'Delete'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && !grantTree.length && (
        <p className="text-sm text-slate-500">No menus found. Add menus under Setup → Menus.</p>
      )}
    </div>
  )
}
