import { useMemo, useState } from 'react'
import {
  useCloseAccountingPeriodMutation,
  useCreateAccountingPeriodMutation,
  useGetAccountingPeriodsQuery,
  useGetBusinessesQuery,
  useReopenAccountingPeriodMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { showBusinessPickerInForms } from '../../lib/stationContext'

type PeriodRow = {
  id: number
  businessId: number
  name: string
  periodStart: string
  periodEnd: string
  status: number
  closedAt?: string | null
  closedByUserId?: number | null
  closeJournalEntryId?: number | null
}

function statusLabel(s: number): string {
  if (s === 1) return 'Closed'
  if (s === 2) return 'Locked'
  return 'Open'
}

export function AccountingPeriodsPage() {
  const { canCreate: routeCanCreate } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const isSuperAdmin = role === 'SuperAdmin'

  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)
  const effectiveBusinessId = showBizPicker ? (filterBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: rows = [], isFetching, refetch } = useGetAccountingPeriodsQuery(
    { businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )

  const [createPeriod, { isLoading: creating }] = useCreateAccountingPeriodMutation()
  const [closePeriod, { isLoading: closing }] = useCloseAccountingPeriodMutation()
  const [reopenPeriod, { isLoading: reopening }] = useReopenAccountingPeriodMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [, setSelected] = useState<Set<number>>(new Set())

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businesses?.items ?? []
    if (showBizPicker) return items.map((x) => ({ value: String(x.id), label: x.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businesses?.items, showBizPicker, authBusinessId])

  const formError = useMemo(() => {
    if (!name.trim()) return 'Period name is required.'
    if (periodEnd < periodStart) return 'Period end must be on or after period start.'
    return null
  }, [name, periodStart, periodEnd])

  async function savePeriod() {
    if (formError != null || effectiveBusinessId <= 0) return
    await createPeriod({
      businessId: effectiveBusinessId,
      name: name.trim(),
      periodStart: `${periodStart}T12:00:00.000Z`,
      periodEnd: `${periodEnd}T12:00:00.000Z`,
    }).unwrap()
    setOpen(false)
    setName('')
    setPeriodStart(new Date().toISOString().slice(0, 10))
    setPeriodEnd(new Date().toISOString().slice(0, 10))
    void refetch()
  }

  const cols: Column<PeriodRow>[] = useMemo(
    () => [
      { key: 'name', header: 'Name', render: (r) => r.name },
      { key: 'periodStart', header: 'Start', render: (r) => r.periodStart.slice(0, 10) },
      { key: 'periodEnd', header: 'End', render: (r) => r.periodEnd.slice(0, 10) },
      { key: 'status', header: 'Status', render: (r) => statusLabel(r.status) },
      {
        key: 'closedAt',
        header: 'Closed',
        render: (r) => (r.closedAt ? r.closedAt.slice(0, 19).replace('T', ' ') : '—'),
      },
    ],
    [],
  )

  return (
    <>
      {showBizPicker && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
          <div className="max-w-sm">
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
              onChange={(opt) => setFilterBusinessId(opt ? Number(opt.value) : null)}
              placeholder="Select business"
            />
          </div>
        </div>
      )}
      <DataTable<PeriodRow>
        title="Accounting periods"
        addLabel="New period"
        rows={rows}
        totalCount={rows.length}
        page={1}
        pageSize={Math.max(rows.length, 1)}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        hideSearch={true}
        showRowSelection={false}
        search=""
        onSearchChange={() => {}}
        columns={cols}
        isLoading={isFetching}
        selectedIds={new Set()}
        onSelectedIdsChange={setSelected}
        onAdd={routeCanCreate && effectiveBusinessId > 0 ? () => setOpen(true) : undefined}
        onDeleteOne={() => {}}
        onDeleteSelected={() => {}}
        tableActionPermissions={{ canCreate: routeCanCreate, canUpdate: false, canDelete: false }}
        renderExtraRowActions={(row) => (
          <span className="inline-flex flex-wrap gap-1">
            {row.status === 0 && (
              <button
                type="button"
                disabled={closing}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Posts closing entry and locks the period for new journals"
                onClick={() => {
                  void (async () => {
                    if (!window.confirm(`Close period "${row.name}"? This will post closing entries where configured.`))
                      return
                    await closePeriod(row.id).unwrap()
                    void refetch()
                  })()
                }}
              >
                Close
              </button>
            )}
            {row.status === 1 && isSuperAdmin && (
              <button
                type="button"
                disabled={reopening}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                title="SuperAdmin only — closing journal is not reversed automatically"
                onClick={() => {
                  void (async () => {
                    if (!window.confirm('Reopen this period? Closing entries are not reversed automatically.')) return
                    await reopenPeriod(row.id).unwrap()
                    void refetch()
                  })()
                }}
              >
                Reopen
              </button>
            )}
          </span>
        )}
      />

      {effectiveBusinessId <= 0 && showBizPicker ? (
        <p className="mt-2 text-sm text-amber-800">Select a business to view accounting periods.</p>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="New accounting period" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. March 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period start</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period end</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!!formError || creating || effectiveBusinessId <= 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void savePeriod()}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
