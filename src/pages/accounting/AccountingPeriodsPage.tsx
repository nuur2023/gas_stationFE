import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateAccountingPeriodMutation,
  useDeleteAccountingPeriodMutation,
  useGetAccountingPeriodsQuery,
  useGetBusinessesQuery,
  useMarkAccountingPeriodClosedMutation,
  useReopenAccountingPeriodMutation,
  useUpdateAccountingPeriodMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/ToastProvider'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
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
}

function statusLabel(s: number): string {
  if (s === 1) return 'Closed'
  if (s === 2) return 'Locked'
  return 'Open'
}

function mutationErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const d = (err as { data: unknown }).data
    if (typeof d === 'string') return d
    if (d && typeof d === 'object' && 'message' in d && typeof (d as { message: unknown }).message === 'string')
      return (d as { message: string }).message
  }
  return 'Request failed. Try again.'
}

function dateInputFromIso(iso: string): string {
  return iso.slice(0, 10)
}

export function AccountingPeriodsPage() {
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const { canCreate: routeCanCreate, canUpdate: routeCanUpdate, canDelete: routeCanDelete } =
    usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const isSuperAdmin = role === 'SuperAdmin'

  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)
  const effectiveBusinessId = showBizPicker ? (filterBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: rows = [], isFetching, refetch } = useGetAccountingPeriodsQuery(
    { businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )

  const [createPeriod, { isLoading: creating }] = useCreateAccountingPeriodMutation()
  const [updatePeriod, { isLoading: updating }] = useUpdateAccountingPeriodMutation()
  const [deletePeriod] = useDeleteAccountingPeriodMutation()
  const [markPeriodClosed, { isLoading: markingClosed }] = useMarkAccountingPeriodClosedMutation()
  const [reopenPeriod, { isLoading: reopening }] = useReopenAccountingPeriodMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [, setSelected] = useState<Set<number>>(new Set())

  const [editOpen, setEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<PeriodRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editPeriodStart, setEditPeriodStart] = useState('')
  const [editPeriodEnd, setEditPeriodEnd] = useState('')

  const [autoCloseRow, setAutoCloseRow] = useState<PeriodRow | null>(null)
  const [autoCloseError, setAutoCloseError] = useState<string | null>(null)

  const [reopenConfirmRow, setReopenConfirmRow] = useState<PeriodRow | null>(null)
  const [reopenError, setReopenError] = useState<string | null>(null)
  const [periodHint, setPeriodHint] = useState<string | null>(null)
  const { showError, showSuccess } = useToast()

  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
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

  const editFormError = useMemo(() => {
    if (!editName.trim()) return 'Period name is required.'
    if (editPeriodEnd < editPeriodStart) return 'Period end must be on or after period start.'
    return null
  }, [editName, editPeriodStart, editPeriodEnd])

  async function savePeriod() {
    if (formError != null || effectiveBusinessId <= 0) return
    try {
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
      showSuccess('Accounting period created.')
      void refetch()
    } catch (e) {
      showError(mutationErrorMessage(e))
    }
  }

  function openEdit(row: PeriodRow) {
    if (row.status !== 0) {
      setPeriodHint('Only open periods can be edited. Reopen the period first if you need to change it.')
      window.setTimeout(() => setPeriodHint(null), 7000)
      return
    }
    setEditingRow(row)
    setEditName(row.name)
    setEditPeriodStart(dateInputFromIso(row.periodStart))
    setEditPeriodEnd(dateInputFromIso(row.periodEnd))
    setEditOpen(true)
  }

  async function saveEdit() {
    if (editFormError != null || !editingRow) return
    try {
      await updatePeriod({
        id: editingRow.id,
        body: {
          name: editName.trim(),
          periodStart: `${editPeriodStart}T12:00:00.000Z`,
          periodEnd: `${editPeriodEnd}T12:00:00.000Z`,
        },
      }).unwrap()
      setEditOpen(false)
      setEditingRow(null)
      showSuccess('Accounting period updated.')
      void refetch()
    } catch (e) {
      showError(mutationErrorMessage(e))
    }
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete this accounting period?',
      description: 'The period row will be removed. Posted journals are not deleted.',
      action: async () => {
        await deletePeriod(id).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(id)
          return n
        })
        void refetch()
      },
    })
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

  const canReopen = routeCanUpdate || isSuperAdmin

  return (
    <>
      {deleteDialog}
      {periodHint ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{periodHint}</div>
      ) : null}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Period close is manual</p>
        <p className="mt-1 text-slate-700">
          Post your close in{' '}
          <Link to="/accounting/manual-journal-entry" className="font-medium text-emerald-800 underline">
            Manual journal entry
          </Link>{' '}
          first, then click <strong>Auto-close</strong> on the open period. A confirmation dialog explains that only the
          period status is updated (no journal is posted).
        </p>
      </div>

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
        onEdit={routeCanUpdate ? openEdit : undefined}
        onDeleteOne={routeCanDelete ? handleDeleteOne : () => {}}
        onDeleteSelected={() => {}}
        tableActionPermissions={{
          canCreate: routeCanCreate,
          canUpdate: routeCanUpdate,
          canDelete: routeCanDelete,
        }}
        renderExtraRowActions={(row) => (
          <span className="inline-flex flex-wrap gap-1">
            {row.status === 0 && routeCanUpdate && (
              <button
                type="button"
                disabled={markingClosed}
                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                title="Confirm after posting your manual close journal — updates period status only"
                onClick={() => {
                  setAutoCloseError(null)
                  setAutoCloseRow(row)
                }}
              >
                Auto-close
              </button>
            )}
            {row.status === 1 && canReopen && (
              <button
                type="button"
                disabled={reopening}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                title="Reopens the period record only — journals are not reversed"
                onClick={() => {
                  setReopenError(null)
                  setReopenConfirmRow(row)
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

      <Modal
        open={autoCloseRow != null}
        onClose={() => {
          setAutoCloseRow(null)
          setAutoCloseError(null)
        }}
        title="Auto-close this period?"
        className="max-w-md"
      >
        {autoCloseRow ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              You are about to mark <span className="font-semibold text-slate-900">{autoCloseRow.name}</span> as{' '}
              <strong>closed</strong> in the system.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-slate-600">
              <li>
                This does <strong>not</strong> create or post any journal — do that first in{' '}
                <Link to="/accounting/manual-journal-entry" className="font-medium text-emerald-800 underline">
                  Manual journal entry
                </Link>
                .
              </li>
              <li>After you confirm, the period shows Closed and new routine journals in that date range may be blocked.</li>
              <li>You can use <strong>Reopen</strong> later if needed (journals stay as posted).</li>
            </ul>
            {autoCloseError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">{autoCloseError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setAutoCloseRow(null)
                  setAutoCloseError(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={markingClosed}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    if (!autoCloseRow) return
                    setAutoCloseError(null)
                    try {
                      await markPeriodClosed({
                        id: autoCloseRow.id,
                      }).unwrap()
                      setAutoCloseRow(null)
                      void refetch()
                    } catch (e) {
                      setAutoCloseError(mutationErrorMessage(e))
                    }
                  })()
                }}
              >
                {markingClosed ? 'Saving…' : 'Confirm auto-close'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={reopenConfirmRow != null}
        onClose={() => {
          setReopenConfirmRow(null)
          setReopenError(null)
        }}
        title="Reopen period?"
        className="max-w-md"
      >
        {reopenConfirmRow ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Reopen <span className="font-semibold text-slate-900">{reopenConfirmRow.name}</span>? Posted journals are{' '}
              <strong>not</strong> reversed — adjust manually if needed.
            </p>
            {reopenError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">{reopenError}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setReopenConfirmRow(null)
                  setReopenError(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopening}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    if (!reopenConfirmRow) return
                    setReopenError(null)
                    try {
                      await reopenPeriod(reopenConfirmRow.id).unwrap()
                      setReopenConfirmRow(null)
                      void refetch()
                    } catch (e) {
                      setReopenError(mutationErrorMessage(e))
                    }
                  })()
                }}
              >
                {reopening ? 'Reopening…' : 'Reopen'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit accounting period" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period start</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={editPeriodStart}
                onChange={(e) => setEditPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period end</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={editPeriodEnd}
                onChange={(e) => setEditPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          {editFormError ? <p className="text-sm text-rose-600">{editFormError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!!editFormError || updating || !editingRow}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void saveEdit()}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
