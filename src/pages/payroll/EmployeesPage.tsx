import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetBusinessesQuery,
  useGetEmployeesQuery,
  useGetStationsQuery,
  useUpdateEmployeeMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import { formatDecimal } from '../../lib/formatNumber'
import {
  showBusinessPickerInForms,
  showStationPickerInForms,
} from '../../lib/stationContext'
import type { Employee, EmployeeWriteRequest } from '../../types/models'

export function EmployeesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterStationId, setFilterStationId] = useState<number | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setReportBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [showBizPicker, businessesData?.items])

  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const { data, isFetching } = useGetEmployeesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    businessId: showBizPicker ? (effectiveBusinessId > 0 ? effectiveBusinessId : undefined) : authBusinessId ?? undefined,
    ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
    includeInactive,
  })

  const [createEmployee] = useCreateEmployeeMutation()
  const [updateEmployee] = useUpdateEmployeeMutation()
  const [deleteEmployee] = useDeleteEmployeeMutation()

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) all.push({ value: String(s.id), label: s.name })
    return all
  }, [stationsData?.items])
  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const [form, setForm] = useState<EmployeeWriteRequest>({
    name: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    baseSalary: '0',
    isActive: true,
    stationId: null,
  })

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null
  const canSave = !needsBusiness && form.name.trim().length > 0

  function openCreate() {
    setEditing(null)
    if (showBizPicker) setFormBusinessId(reportBusinessId)
    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      position: '',
      baseSalary: '0',
      isActive: true,
      stationId: null,
    })
    setOpen(true)
  }

  function openEdit(row: Employee) {
    setEditing(row)
    if (showBizPicker) setFormBusinessId(row.businessId)
    setForm({
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      position: row.position,
      baseSalary: String(row.baseSalary ?? 0),
      isActive: row.isActive,
      stationId: row.stationId,
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const body: EmployeeWriteRequest = {
      ...form,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    if (editing) {
      await updateEmployee({ id: editing.id, body }).unwrap()
    } else {
      await createEmployee(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  const columns: Column<Employee>[] = useMemo(() => {
    const base: Column<Employee>[] = [
      {
        key: 'id',
        header: 'ID',
        render: (r) => (
          <Link className="text-emerald-700 hover:underline" to={`/employees/${r.id}`}>
            {r.id}
          </Link>
        ),
      },
      { key: 'name', header: 'Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'position', header: 'Position' },
      {
        key: 'baseSalary',
        header: 'Base salary',
        render: (r) => formatDecimal(r.baseSalary),
      },
      {
        key: 'isActive',
        header: 'Active',
        render: (r) => (r.isActive ? 'Yes' : 'No'),
      },
      {
        key: 'stationId',
        header: 'Station',
        render: (r) =>
          r.stationId != null && r.stationId > 0 ? (stationNameById.get(r.stationId) ?? `#${r.stationId}`) : '—',
      },
    ]
    if (role !== 'SuperAdmin') return base
    return [
      base[0]!,
      {
        key: 'businessId',
        header: 'Business',
        render: (r) => (businessesData?.items ?? []).find((b) => b.id === r.businessId)?.name ?? r.businessId,
      },
      ...base.slice(1),
    ]
  }, [role, stationNameById, businessesData?.items])

  return (
    <>
      {deleteDialog}
      <DataTable<Employee>
        title="Employees"
        addLabel="Register employee"
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={(q) => {
          setSearch(q)
          setPage(1)
        }}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete employee?',
            description: 'This employee will be removed.',
            action: async () => {
              await deleteEmployee(id).unwrap()
              setSelected((prev) => {
                const n = new Set(prev)
                n.delete(id)
                return n
              })
            },
          })
        }
        onDeleteSelected={() =>
          requestDelete({
            title: `Delete ${selected.size} employee(s)?`,
            description: 'Selected employees will be removed.',
            action: async () => {
              for (const id of selected) await deleteEmployee(id).unwrap()
              setSelected(new Set())
            },
          })
        }
        columns={columns}
        extraToolbar={
          <div className="flex flex-wrap items-end gap-3">
            {showBizPicker && (
              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
                  onChange={(o) => {
                    setReportBusinessId(o ? Number(o.value) : null)
                    setFilterStationId(null)
                    setPage(1)
                  }}
                  placeholder="Business"
                />
              </div>
            )}
            {showStationPicker && (
              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-slate-600">Station filter</label>
                <FormSelect
                  options={stationOptions}
                  value={stationOptions.find((o) => o.value === String(filterStationId ?? '')) ?? stationOptions[0] ?? null}
                  onChange={(o) => {
                    setFilterStationId(o && o.value ? Number(o.value) : null)
                    setPage(1)
                  }}
                  placeholder="All stations"
                />
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => {
                  setIncludeInactive(e.target.checked)
                  setPage(1)
                }}
              />
              Show inactive
            </label>
          </div>
        }
      />

      <Modal open={open} title={editing ? 'Edit employee' : 'Register employee'} onClose={() => setOpen(false)} className="max-w-2xl">
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          {showBizPicker && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null}
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.phone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.email ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.position ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Base salary (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.baseSalary}
              onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
            />
          </div>
          {showStationPicker && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Station (optional)</label>
              <FormSelect
                options={stationOptions.filter((o) => o.value !== '')}
                value={
                  form.stationId != null && form.stationId > 0
                    ? stationOptions.find((o) => o.value === String(form.stationId)) ?? null
                    : null
                }
                onChange={(o) => setForm((f) => ({ ...f, stationId: o && o.value ? Number(o.value) : null }))}
                placeholder="Business-level (no station)"
                isClearable
              />
            </div>
          )}
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
