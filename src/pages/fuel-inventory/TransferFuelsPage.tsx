import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateBusinessFuelInventoryTransferMutation,
  useDeleteBusinessFuelInventoryTransferMutation,
  useGetBusinessFuelInventoryTransfersQuery,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetStationsQuery,
  useUpdateBusinessFuelInventoryTransferMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { DateField } from '../../components/DateField'
import { useToast } from '../../components/ToastProvider'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { TransferInventory } from '../../types/models'

function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'string' && data.trim()) return data
  }
  return 'Request failed.'
}

export function TransferFuelsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const { showError, showSuccess } = useToast()

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: businessesData } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    { skip: !showBizPicker },
  )

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const { data: transfersPaged, isFetching } = useGetBusinessFuelInventoryTransfersQuery(
    { businessId: effectiveBusinessId ?? undefined, page, pageSize },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )

  const { data: fuelTypesAll = [] } = useGetFuelTypesQuery()
  const fuelTypesForBusiness = useMemo(() => {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0) return []
    return fuelTypesAll.filter((f) => f.businessId === effectiveBusinessId)
  }, [fuelTypesAll, effectiveBusinessId])

  const { data: stationsData } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 2000,
      q: undefined,
      businessId: effectiveBusinessId ?? undefined,
    },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )
  const stations = useMemo(
    () => (stationsData?.items ?? []).filter((s) => s.businessId === effectiveBusinessId),
    [stationsData?.items, effectiveBusinessId],
  )

  const businessOptions: SelectOption[] = useMemo(
    () =>
      (businessesData?.items ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [businessesData?.items],
  )

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypesForBusiness.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypesForBusiness],
  )
  const stationOptions: SelectOption[] = useMemo(
    () => stations.map((s) => ({ value: String(s.id), label: s.name })),
    [stations],
  )

  const businessSelectValue = useMemo(
    () => businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null,
    [businessOptions, formBusinessId],
  )

  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setFormBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [showBizPicker, businessesData?.items])

  useEffect(() => {
    setSelectedIds(new Set())
    setPage(1)
  }, [effectiveBusinessId])

  const [createOpen, setCreateOpen] = useState(false)
  const [tFuelId, setTFuelId] = useState<string | null>(null)
  const [tStationId, setTStationId] = useState<string | null>(null)
  const [tLiters, setTLiters] = useState('')
  const [tDate, setTDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tNote, setTNote] = useState('')
  const [createTransfer, { isLoading: creating }] = useCreateBusinessFuelInventoryTransferMutation()

  const tFuelSelectValue = useMemo(
    () => (tFuelId ? fuelOptions.find((o) => o.value === tFuelId) ?? null : null),
    [fuelOptions, tFuelId],
  )
  const tStationSelectValue = useMemo(
    () => (tStationId ? stationOptions.find((o) => o.value === tStationId) ?? null : null),
    [stationOptions, tStationId],
  )

  const [editRow, setEditRow] = useState<TransferInventory | null>(null)
  const [eStationId, setEStationId] = useState('')
  const [eLiters, setELiters] = useState('')
  const [eDate, setEDate] = useState('')
  const [eNote, setENote] = useState('')
  const [eReason, setEReason] = useState('')
  const [updateTransfer, { isLoading: updating }] = useUpdateBusinessFuelInventoryTransferMutation()

  const eStationSelectValue = useMemo(
    () => (eStationId ? stationOptions.find((o) => o.value === eStationId) ?? null : null),
    [stationOptions, eStationId],
  )

  const [deleteRow, setDeleteRow] = useState<TransferInventory | null>(null)
  const [delReason, setDelReason] = useState('')
  const [deleteTransfer, { isLoading: deleting }] = useDeleteBusinessFuelInventoryTransferMutation()
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDelReason, setBulkDelReason] = useState('')

  async function submitCreate() {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0) return
    const fid = tFuelId ? Number(tFuelId) : 0
    const sid = tStationId ? Number(tStationId) : 0
    if (!fid || !sid) {
      showError('Select fuel type and station.')
      return
    }
    try {
      await createTransfer({
        businessId: effectiveBusinessId,
        fuelTypeId: fid,
        toStationId: sid,
        liters: tLiters.trim() || '0',
        date: new Date(tDate + 'T12:00:00').toISOString(),
        note: tNote.trim() || undefined,
      }).unwrap()
      showSuccess('Transfer recorded.')
      setCreateOpen(false)
      setTFuelId(null)
      setTStationId(null)
      setTLiters('')
      setTNote('')
    } catch (e) {
      showError(getApiErrorMessage(e))
    }
  }

  async function submitEdit() {
    if (!editRow || effectiveBusinessId == null) return
    if (!eReason.trim()) {
      showError('Reason is required for audit.')
      return
    }
    try {
      await updateTransfer({
        id: editRow.id,
        businessId: effectiveBusinessId,
        toStationId: Number(eStationId),
        liters: eLiters.trim(),
        date: new Date(eDate + 'T12:00:00').toISOString(),
        note: eNote.trim() || undefined,
        reason: eReason.trim(),
      }).unwrap()
      showSuccess('Transfer updated.')
      setEditRow(null)
      setEReason('')
    } catch (e) {
      showError(getApiErrorMessage(e))
    }
  }

  async function submitDelete() {
    if (!deleteRow || effectiveBusinessId == null) return
    if (!delReason.trim()) {
      showError('Reason is required.')
      return
    }
    try {
      await deleteTransfer({ id: deleteRow.id, businessId: effectiveBusinessId, reason: delReason.trim() }).unwrap()
      showSuccess('Transfer removed; pool liters restored.')
      setDeleteRow(null)
      setDelReason('')
    } catch (e) {
      showError(getApiErrorMessage(e))
    }
  }

  function openEdit(row: TransferInventory) {
    setEditRow(row)
    setEStationId(String(row.toStationId))
    setELiters(String(row.liters))
    setEDate(new Date(row.date).toISOString().slice(0, 10))
    setENote(row.note ?? '')
    setEReason('')
  }

  const filteredTransfers = useMemo(() => {
    const rows = transfersPaged?.items ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.fuelName.toLowerCase().includes(q) ||
        r.stationName.toLowerCase().includes(q) ||
        (r.creatorName ?? '').toLowerCase().includes(q),
    )
  }, [transfersPaged?.items, search])

  function transferStatusLabel(row: TransferInventory): string {
    const s = String(row.status ?? 'pending').toLowerCase()
    return s === 'received' ? 'Received' : 'Pending'
  }

  const transferColumns: Column<TransferInventory>[] = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleString() },
    { key: 'fuelName', header: 'Fuel' },
    { key: 'stationName', header: 'Station' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s = String(row.status ?? 'pending').toLowerCase()
        const isReceived = s === 'received'
        return (
          <span
            className={
              isReceived
                ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
                : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900'
            }
          >
            {transferStatusLabel(row)}
          </span>
        )
      },
    },
    { key: 'liters', header: 'Liters', align: 'right', render: (row) => formatDecimal(row.liters) },
  ]

  const hasBusinessContext = effectiveBusinessId != null && effectiveBusinessId > 0
  const showFuelTables = showBizPicker || hasBusinessContext

  async function submitBulkDelete() {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0 || selectedIds.size === 0) return
    if (!bulkDelReason.trim()) {
      showError('Reason is required.')
      return
    }
    try {
      for (const id of selectedIds) {
        await deleteTransfer({ id, businessId: effectiveBusinessId, reason: bulkDelReason.trim() }).unwrap()
      }
      showSuccess('Selected transfers deleted; pool liters restored.')
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      setBulkDelReason('')
    } catch (e) {
      showError(getApiErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transfer fuels to station</h1>
        <p className="mt-1 text-slate-600">
          Move liters from the <strong>business pool</strong> to a station for distribution tracking. Requires
          sufficient pool balance (credit the pool first).
        </p>
      </div>

      {showBizPicker ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
          <div className="max-w-md">
            <FormSelect
              value={businessSelectValue}
              onChange={(o) => setFormBusinessId(o ? Number(o.value) : null)}
              options={businessOptions}
              placeholder="Select business"
            />
          </div>
          {!hasBusinessContext && businessOptions.length === 0 ? (
            <p className="mt-3 text-sm text-amber-900">
              No businesses exist yet.{' '}
              <Link to="/setup/businesses" className="font-medium text-emerald-700 underline hover:text-emerald-800">
                Create a business
              </Link>{' '}
              under Main setup, then return here.
            </p>
          ) : !hasBusinessContext ? (
            <p className="mt-2 text-sm text-slate-600">Choose a business to load transfers and stations.</p>
          ) : null}
        </div>
      ) : !hasBusinessContext ? (
        <p className="text-slate-600">No business assigned.</p>
      ) : null}

      {showFuelTables ? (
        <DataTable
          title="Transfer records"
          addLabel="New transfer"
          rows={hasBusinessContext ? filteredTransfers : []}
          totalCount={hasBusinessContext ? (transfersPaged?.totalCount ?? 0) : 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          search={search}
          onSearchChange={(q) => {
            setSearch(q)
            setPage(1)
          }}
          columns={transferColumns}
          isLoading={hasBusinessContext && isFetching}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onAdd={() => setCreateOpen(true)}
          onEdit={openEdit}
          onDeleteOne={(id) => {
            const row = (transfersPaged?.items ?? []).find((t) => t.id === id)
            if (row) setDeleteRow(row)
          }}
          onDeleteSelected={() => setBulkDeleteOpen(true)}
          emptyMessage={
            !hasBusinessContext && showBizPicker
              ? businessOptions.length === 0
                ? 'Add a business above to use this table.'
                : 'Select a business above to load transfers.'
              : undefined
          }
          tableActionPermissions={
            !hasBusinessContext && showBizPicker
              ? { canCreate: false, canUpdate: false, canDelete: false }
              : undefined
          }
        />
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New transfer">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fuel type (from pool)</label>
            <FormSelect
              value={tFuelSelectValue}
              onChange={(o) => setTFuelId(o?.value ?? null)}
              options={fuelOptions}
              placeholder="Select fuel"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">To station</label>
            <FormSelect
              value={tStationSelectValue}
              onChange={(o) => setTStationId(o?.value ?? null)}
              options={stationOptions}
              placeholder="Select station"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Liters</label>
            <input
              type="text"
              inputMode="decimal"
              value={tLiters}
              onChange={(e) => setTLiters(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <DateField label="Date" value={tDate} onChange={setTDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea value={tNote} onChange={(e) => setTNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void submitCreate()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editRow != null} onClose={() => setEditRow(null)} title="Edit transfer">
        {editRow ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Fuel: <strong>{editRow.fuelName}</strong> (pool row cannot be changed here)
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">To station</label>
              <FormSelect
                value={eStationSelectValue}
                onChange={(o) => setEStationId(o?.value ?? '')}
                options={stationOptions}
                placeholder="Station"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Liters</label>
              <input
                type="text"
                inputMode="decimal"
                value={eLiters}
                onChange={(e) => setELiters(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <DateField label="Date" value={eDate} onChange={setEDate} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
              <textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason for change (audit)</label>
              <input
                type="text"
                value={eReason}
                onChange={(e) => setEReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Required"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => void submitEdit()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={deleteRow != null} onClose={() => setDeleteRow(null)} title="Delete transfer">
        {deleteRow ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              This restores <strong>{formatDecimal(deleteRow.liters)}</strong> L to the business pool for {deleteRow.fuelName}.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason (required)</label>
              <input
                type="text"
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={() => setDeleteRow(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void submitDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete selected transfers">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            This will delete <strong>{selectedIds.size}</strong> transfer row(s) and restore their liters back to the
            business pool.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason (required)</label>
            <input
              type="text"
              value={bulkDelReason}
              onChange={(e) => setBulkDelReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
              onClick={() => setBulkDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting || selectedIds.size === 0}
              onClick={() => void submitBulkDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
