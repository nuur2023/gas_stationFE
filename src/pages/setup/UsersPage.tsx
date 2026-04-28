import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  useCreateBusinessUserMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetBusinessUsersQuery,
  useGetRolesQuery,
  useGetStationsQuery,
  useGetUsersQuery,
  useUpdateBusinessUserMutation,
  useUpdateUserMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { sha256HexUpper } from '../../lib/hash'
import { useDebouncedValue } from '../../lib/hooks'
import type { User } from '../../types/models'

function userToUpdateBody(
  editing: User,
  name: string,
  email: string,
  phone: string,
  roleId: number,
  passwordHash: string,
): User {
  return {
    id: editing.id,
    name,
    email,
    phone,
    passwordHash,
    roleId,
    createdAt: editing.createdAt,
    updatedAt: editing.updatedAt,
    isDeleted: editing.isDeleted ?? false,
  }
}

export function UsersPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isAdmin = role === 'Admin'
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetUsersQuery({ page, pageSize, q: debounced || undefined })
  const { data: rolesData } = useGetRolesQuery({ page: 1, pageSize: 200, q: undefined })
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, q: undefined, businessId: authBusinessId ?? undefined },
    { skip: !isAdmin || authBusinessId == null || authBusinessId <= 0 },
  )
  const { data: businessUsersData } = useGetBusinessUsersQuery(
    { page: 1, pageSize: 2000, q: undefined },
    { skip: !isAdmin },
  )
  const [createUser] = useCreateUserMutation()
  const [createBusinessUser] = useCreateBusinessUserMutation()
  const [updateBusinessUser] = useUpdateBusinessUserMutation()
  const [updateUser] = useUpdateUserMutation()
  const [deleteUser] = useDeleteUserMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [roleId, setRoleId] = useState(1)
  const [stationId, setStationId] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)

  const roleOptions: SelectOption[] = useMemo(
    () =>
      (rolesData?.items ?? [])
        .filter((r) => (isAdmin ? r.name !== 'SuperAdmin' && r.name !== 'Admin' : true))
        .map((r) => ({ value: String(r.id), label: r.name })),
    [rolesData?.items, isAdmin],
  )

  const roleSelectValue = useMemo(
    () => roleOptions.find((o) => Number(o.value) === roleId) ?? null,
    [roleOptions, roleId],
  )

  const roleName = (id: number) => rolesData?.items.find((r) => r.id === id)?.name ?? id
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )
  const stationSelectValue = stationOptions.find((o) => Number(o.value) === stationId) ?? null

  function openCreate() {
    setEditing(null)
    setName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setShowPassword(false)
    setFormError(null)
    setRoleId(roleOptions[0] ? Number(roleOptions[0].value) : 1)
    setStationId(0)
    setOpen(true)
  }

  function openEdit(row: User) {
    setEditing(row)
    setName(row.name)
    setEmail(row.email ?? '')
    setPhone(row.phone ?? '')
    setPassword('')
    setShowPassword(false)
    setFormError(null)
    setRoleId(row.roleId)
    if (isAdmin) {
      const linked = (businessUsersData?.items ?? []).find((bu) => bu.userId === row.id)
      setStationId(linked?.stationId ?? 0)
    } else {
      setStationId(0)
    }
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setFormError(null)
    setShowPassword(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    try {
      if (isAdmin && (authBusinessId == null || authBusinessId <= 0)) {
        setFormError('Admin user has no business context.')
        return
      }
      if (editing) {
        if (isAdmin && stationId <= 0) {
          setFormError('Please select a station.')
          return
        }
        let passwordHash = editing.passwordHash
        if (password.trim()) {
          passwordHash = await sha256HexUpper(password)
        }
        const body = userToUpdateBody(editing, name, email.trim(), phone.trim(), roleId, passwordHash)
        await updateUser({ id: editing.id, body }).unwrap()
        if (isAdmin && authBusinessId != null && authBusinessId > 0) {
          const existingLink = (businessUsersData?.items ?? []).find((bu) => bu.userId === editing.id)
          if (existingLink) {
            await updateBusinessUser({
              id: existingLink.id,
              body: { userId: editing.id, businessId: authBusinessId, stationId },
            }).unwrap()
          } else {
            await createBusinessUser({ userId: editing.id, businessId: authBusinessId, stationId }).unwrap()
          }
        }
      } else {
        const passwordHash = await sha256HexUpper(password)
        await createUser({
          name,
          email: email.trim(),
          phone: phone.trim(),
          roleId,
          passwordHash,
        }).unwrap()
      }
      closeModal()
      setEditing(null)
      setPassword('')
      setSelected(new Set())
    } catch {
      setFormError('Could not save user. Check the data and try again.')
    }
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this user?',
      description: 'This user account will be removed.',
      action: async () => {
        await deleteUser(id).unwrap()
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
      title: `Delete ${ids.length} user(s)?`,
      description: 'Selected users will be permanently removed.',
      action: async () => {
        for (const id of ids) {
          await deleteUser(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<User>
        title="Users"
        addLabel="Add user"
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
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Phone' },
          {
            key: 'roleId',
            header: 'Role',
            render: (row) => roleName(row.roleId),
          },
        ]}
      />
      <Modal open={open} title={editing ? 'Edit user' : 'Add user'} onClose={closeModal}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional for login"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editing}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? 'Leave blank to keep current' : ''}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-11 outline-none ring-emerald-500/30 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="user-form-role" className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </label>
            <FormSelect
              inputId="user-form-role"
              options={roleOptions}
              value={roleSelectValue}
              onChange={(opt) => {
                if (opt) setRoleId(Number(opt.value))
              }}
              placeholder="Select role…"
              isDisabled={roleOptions.length === 0}
            />
          </div>
          {isAdmin && editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptions}
                value={stationSelectValue}
                onChange={(opt) => setStationId(opt ? Number(opt.value) : 0)}
                placeholder="Select station"
                isDisabled={stationOptions.length === 0}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
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
