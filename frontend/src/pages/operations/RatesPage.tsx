import { useMemo, useState } from 'react'
import {
  useCreateRateMutation,
  useDeleteRateMutation,
  useGetBusinessesQuery,
  useGetRatesQuery,
  useGetUsersQuery,
  useUpdateRateMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatRateNumber } from '../../lib/formatRateNumber'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { Rate, RateWriteRequest } from '../../types/models'

export function RatesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetRatesQuery({ page, pageSize, q: debounced || undefined })
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createRate] = useCreateRateMutation()
  const [updateRate] = useUpdateRateMutation()
  const [deleteRate] = useDeleteRateMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Rate | null>(null)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const [form, setForm] = useState<RateWriteRequest>({ rateNumber: '0', active: true })
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) {
      return items.map((b) => ({ value: String(b.id), label: b.name }))
    }
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

  const userNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usersData?.items ?? []) {
      m.set(u.id, u.name)
    }
    return m
  }, [usersData])

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const canSave = !needsBusiness

  const tableColumns: Column<Rate>[] = useMemo(() => {
    const base: Column<Rate>[] = [
      { key: 'id', header: 'ID' },
      {
        key: 'date',
        header: 'Date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
      {
        key: 'rateNumber',
        header: 'Rate',
        render: (r) => formatRateNumber(r.rateNumber),
      },
      {
        key: 'usersId',
        header: 'User',
        render: (r) => (r.userName?.trim() || userNameById.get(r.usersId)) ?? `#${r.usersId}`,
      },
      {
        key: 'active',
        header: 'Active',
        render: (r) => (r.active ? 'Yes' : 'No'),
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
  }, [isSuperAdmin, userNameById, businessNameById])

  function openCreate() {
    setEditing(null)
    if (showBizPicker) {
      setFormBusinessId(null)
    }
    setForm({ rateNumber: '0', active: true })
    setOpen(true)
  }

  function openEdit(row: Rate) {
    setEditing(row)
    if (showBizPicker) {
      setFormBusinessId(row.businessId)
    }
    setForm({ rateNumber: String(row.rateNumber), active: row.active })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const body: RateWriteRequest = {
      ...form,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    if (editing) {
      await updateRate({ id: editing.id, body }).unwrap()
    } else {
      await createRate(body).unwrap()
    }
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete rate?',
      description: 'This record will be removed.',
      action: async () => {
        await deleteRate(id).unwrap()
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
      title: 'Delete selected?',
      description: `Remove ${ids.length} rate(s)?`,
      action: async () => {
        for (const id of ids) {
          await deleteRate(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<Rate>
        title="Rates"
        addLabel="Add rate"
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
        columns={tableColumns}
      />
      <Modal open={open} title={editing ? 'Edit rate' : 'Add rate'} onClose={() => setOpen(false)} className="max-w-xl">
        <form onSubmit={handleSave} className="space-y-3">
          {showBizPicker && (
            <div>
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker ? 'Select a business for this rate.' : 'No business assigned to your account.'}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Rate number</label>
            <input
              type="text"
              required
              value={form.rateNumber}
              onChange={(e) => setForm((f) => ({ ...f, rateNumber: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
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
