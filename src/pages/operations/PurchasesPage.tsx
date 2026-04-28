import { useMemo, useRef, useState } from 'react'
import { Eye, Printer, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCreatePurchaseMutation,
  useDeletePurchaseMutation,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetPurchasesQuery,
  useGetSuppliersQuery,
  useLazyGetPurchaseQuery,
  useUpdatePurchaseMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import { openPurchaseInvoicePdf } from '../../lib/purchaseInvoicePdf'
import type { Purchase, PurchaseHeaderWriteRequest, PurchaseLineWrite, PurchaseWriteRequest } from '../../types/models'

type FormLine = PurchaseLineWrite & { rid: number }
type PurchaseStatus = 'Paid' | 'Half-paid' | 'Unpaid'

function stripLine(l: FormLine): PurchaseLineWrite {
  const { rid: _r, ...rest } = l
  return rest
}

function emptyLine(rid: number): FormLine {
  return { rid, fuelTypeId: 0, liters: '', pricePerLiter: '', totalAmount: '0' }
}

function recalcLine(line: PurchaseLineWrite): PurchaseLineWrite {
  const L = Number.parseFloat(String(line.liters).replace(',', '.'))
  const p = Number.parseFloat(String(line.pricePerLiter).replace(',', '.'))
  if (!Number.isFinite(L) || !Number.isFinite(p) || L < 0 || p < 0) {
    return { ...line, totalAmount: '0' }
  }
  return { ...line, totalAmount: (L * p).toFixed(2) }
}

function isLineComplete(l: PurchaseLineWrite): boolean {
  const L = Number.parseFloat(String(l.liters).replace(',', '.'))
  const p = Number.parseFloat(String(l.pricePerLiter).replace(',', '.'))
  return l.fuelTypeId > 0 && Number.isFinite(L) && L > 0 && Number.isFinite(p) && p >= 0
}

function withTrailingEmptyRow(lines: FormLine[], nextRid: () => number): FormLine[] {
  const mapped = lines.map((x) => ({ ...x, ...recalcLine(stripLine(x)) }))
  if (mapped.length === 0) return [emptyLine(nextRid())]
  const last = mapped[mapped.length - 1]
  if (isLineComplete(stripLine(last))) {
    return [...mapped, emptyLine(nextRid())]
  }
  return mapped
}

export function PurchasesPage() {
  const { canView: routeCanView } = usePagePermissionActions()
  const navigate = useNavigate()
  const lineRidRef = useRef(0)
  const nextLineRid = () => {
    lineRidRef.current += 1
    return lineRidRef.current
  }

  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetPurchasesQuery({ page, pageSize, q: debounced || undefined })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveFormBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: suppliersForTable } = useGetSuppliersQuery(
    {
      page: 1,
      pageSize: 1000,
      q: undefined,
      businessId: showBizPicker ? undefined : authBusinessId ?? undefined,
    },
    { skip: !showBizPicker && (authBusinessId == null || authBusinessId <= 0) },
  )

  const { data: suppliersData } = useGetSuppliersQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [createPurchase, { isLoading: isCreating }] = useCreatePurchaseMutation()
  const [updatePurchase, { isLoading: isUpdating }] = useUpdatePurchaseMutation()
  const [deletePurchase] = useDeletePurchaseMutation()
  const [loadPurchase] = useLazyGetPurchaseQuery()
  const saving = isCreating || isUpdating

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) return items.map((b) => ({ value: String(b.id), label: b.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])

  const supplierOptions: SelectOption[] = useMemo(
    () => (suppliersData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [suppliersData?.items],
  )

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypes],
  )

  const fuelName = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return (id: number) => m.get(id) ?? String(id)
  }, [fuelTypes])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const supplierNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of suppliersForTable?.items ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersForTable?.items])

  const supplierPhoneById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of suppliersForTable?.items ?? []) {
      const p = s.phone?.trim()
      if (p) m.set(s.id, p)
    }
    return m
  }, [suppliersForTable?.items])

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [supplierId, setSupplierId] = useState(0)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [status, setStatus] = useState<PurchaseStatus>('Unpaid')
  const [amountPaid, setAmountPaid] = useState('0')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<FormLine[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const supplierSel = supplierOptions.find((o) => o.value === String(supplierId)) ?? null
  const statusOptions: SelectOption[] = useMemo(
    () => [
      { value: 'Unpaid', label: 'Unpaid' },
      { value: 'Half-paid', label: 'Half-paid' },
      { value: 'Paid', label: 'Paid' },
    ],
    [],
  )
  const statusSel = statusOptions.find((o) => o.value === status) ?? null

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null

  const linesSubtotal = useMemo(
    () =>
      lines
        .filter((l) => isLineComplete(stripLine(l)))
        .reduce((s, l) => s + Number.parseFloat(recalcLine(stripLine(l)).totalAmount || '0'), 0),
    [lines],
  )

  const headerOk = !needsBusiness && supplierId > 0 && invoiceNo.trim().length > 0
  const hasCompleteLine = lines.some((l) => isLineComplete(stripLine(l)))
  const canSaveCreate = headerOk && hasCompleteLine && fuelTypes.length > 0
  const canSaveEdit = headerOk
  const canSave = editing ? canSaveEdit : canSaveCreate

  function openCreate() {
    setEditing(null)
    if (showBizPicker) setFormBusinessId(null)
    setSupplierId(0)
    setInvoiceNo('')
    setStatus('Unpaid')
    setAmountPaid('0')
    setPurchaseDate(new Date().toISOString().slice(0, 10))
    setLines([emptyLine(nextLineRid())])
    setOpen(true)
  }

  function openEdit(row: Purchase) {
    setEditing(row)
    if (showBizPicker) setFormBusinessId(row.businessId)
    setSupplierId(row.supplierId)
    setInvoiceNo(row.invoiceNo)
    setStatus((row.status || 'Unpaid') as PurchaseStatus)
    setAmountPaid(String(row.amountPaid ?? 0))
    setPurchaseDate(row.purchaseDate ? row.purchaseDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setLines([])
    setOpen(true)
  }

  function patchLineRow(idx: number, patch: Partial<PurchaseLineWrite>) {
    setLines((prev) => {
      const next = prev.map((x, j) =>
        j === idx ? { ...x, ...recalcLine({ ...stripLine(x), ...patch }) } : x,
      )
      return withTrailingEmptyRow(next, nextLineRid)
    })
  }

  function removeLineRow(idx: number) {
    setLines((prev) => {
      const filtered = prev.filter((_, j) => j !== idx)
      const base = filtered.length === 0 ? [emptyLine(nextLineRid())] : filtered
      return withTrailingEmptyRow(base, nextLineRid)
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || saving) return
    const header: PurchaseHeaderWriteRequest = {
      supplierId,
      invoiceNo: invoiceNo.trim(),
      purchaseDate: new Date(purchaseDate + 'T12:00:00').toISOString(),
      status,
      amountPaid,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    try {
      if (editing) {
        await updatePurchase({ id: editing.id, body: header }).unwrap()
        setOpen(false)
      } else {
        const itemsPayload = lines
          .filter((l) => isLineComplete(stripLine(l)))
          .map((l) => recalcLine(stripLine(l)))
        const body: PurchaseWriteRequest = { ...header, items: itemsPayload }
        await createPurchase(body).unwrap()
        setOpen(false)
        navigate('/purchases')
      }
      setSelected(new Set())
    } catch {
      /* RTK surfaces error; keep modal open */
    }
  }

  async function handlePrintInvoice(row: Purchase) {
    try {
      const detail = await loadPurchase(row.id).unwrap()
      const phone = supplierPhoneById.get(detail.supplierId)
      openPurchaseInvoicePdf(detail, {
        supplierName: supplierNameById.get(detail.supplierId) ?? `#${detail.supplierId}`,
        supplierPhone: phone || undefined,
        businessName: businessNameById.get(detail.businessId) ?? `#${detail.businessId}`,
        fuelName,
      })
    } catch {
      /* ignore */
    }
  }

  const columns: Column<Purchase>[] = useMemo(() => {
    const base: Column<Purchase>[] = [
      { key: 'id', header: 'ID' },
      {
        key: 'supplierId',
        header: 'Supplier',
        render: (r) => supplierNameById.get(r.supplierId) ?? `#${r.supplierId}`,
      },
      { key: 'invoiceNo', header: 'Invoice #' },
      {
        key: 'purchaseDate',
        header: 'Date',
        render: (r) => (r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString() : '—'),
      },
      { key: 'status', header: 'Status' },
      {
        key: 'amountPaid',
        header: 'Amount paid',
        render: (r) => Number(r.amountPaid ?? 0).toFixed(2),
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
  }, [isSuperAdmin, businessNameById, supplierNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<Purchase>
        title="Purchases"
        addLabel="Add purchase"
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
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete purchase?',
            description: 'This purchase and all of its line items will be removed.',
            action: async () => {
              await deletePurchase(id).unwrap()
              setSelected((prev) => {
                const n = new Set(prev)
                n.delete(id)
                return n
              })
            },
          })
        }
        onDeleteSelected={() => {
          const ids = [...selected]
          requestDelete({
            title: `Delete ${ids.length} purchase(s)?`,
            description: 'Selected purchases and their line items will be removed.',
            action: async () => {
              for (const id of ids) await deletePurchase(id).unwrap()
              setSelected(new Set())
            },
          })
        }}
        renderExtraRowActions={(row) => (
          <>
            {routeCanView ? (
              <Link
                to={`/purchases/${row.id}`}
                className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
                title="View line items"
              >
                <Eye className="h-4 w-4" />
              </Link>
            ) : (
              <span
                className="mr-1 inline-flex cursor-not-allowed rounded p-1.5 text-slate-400 opacity-50"
                title="No view permission"
              >
                <Eye className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              onClick={() => void handlePrintInvoice(row)}
              className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
              title="Print invoice (PDF)"
            >
              <Printer className="h-4 w-4" />
            </button>
          </>
        )}
        columns={columns}
      />
      <Modal
        open={open}
        title={editing ? 'Edit purchase' : 'Add purchase'}
        onClose={() => !saving && setOpen(false)}
        className={
          editing ? 'max-w-lg' : 'max-w-[96vw] sm:max-w-3xl'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setSupplierId(0)
                }}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}
          {needsBusiness && (
            <p className="text-sm text-amber-800">
              {showBizPicker ? 'Select a business to load suppliers.' : 'No business assigned.'}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Supplier</label>
              <FormSelect
                options={supplierOptions}
                value={supplierSel}
                onChange={(o) => setSupplierId(o ? Number(o.value) : 0)}
                placeholder={needsBusiness ? 'Select business first' : 'Select supplier'}
                isDisabled={needsBusiness || supplierOptions.length === 0 || saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Invoice number</label>
              <input
                required
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <FormSelect
                options={statusOptions}
                value={statusSel}
                onChange={(o) => setStatus((o?.value as PurchaseStatus) ?? 'Unpaid')}
                placeholder="Select status"
                isDisabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount paid</label>
              <input
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Purchase date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
            />
          </div>

          {!editing && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Line items</span>
                {fuelTypes.length === 0 && (
                  <span className="text-sm text-amber-700">Add fuel types before line items.</span>
                )}
              </div>
              <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[42rem] divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Fuel type</th>
                      <th className="w-28 px-3 py-2.5 text-right font-semibold text-slate-600">Liters</th>
                      <th className="w-32 px-3 py-2.5 text-right font-semibold text-slate-600">Price / L</th>
                      <th className="w-32 px-3 py-2.5 text-right font-semibold text-slate-600">Total</th>
                      <th className="w-12 px-2 py-2.5 text-center font-semibold text-slate-600" aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => {
                      const calc = recalcLine(stripLine(line))
                      return (
                        <tr key={line.rid} className="bg-white">
                          <td className="px-3 py-2 align-top">
                            <FormSelect
                              options={fuelOptions}
                              value={fuelOptions.find((o) => o.value === String(line.fuelTypeId)) ?? null}
                              onChange={(o) =>
                                patchLineRow(idx, { fuelTypeId: o ? Number(o.value) : 0 })
                              }
                              placeholder="Fuel"
                              isDisabled={saving}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={line.liters}
                              onChange={(e) => patchLineRow(idx, { liters: e.target.value })}
                              disabled={saving}
                              inputMode="decimal"
                              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-right text-sm tabular-nums disabled:bg-slate-50"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={line.pricePerLiter}
                              onChange={(e) => patchLineRow(idx, { pricePerLiter: e.target.value })}
                              disabled={saving}
                              inputMode="decimal"
                              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-right text-sm tabular-nums disabled:bg-slate-50"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-right text-sm font-medium tabular-nums text-slate-900">
                              {calc.totalAmount}
                            </div>
                          </td>
                          <td className="px-1 py-2 align-middle text-center">
                            <button
                              type="button"
                              onClick={() => removeLineRow(idx)}
                              disabled={lines.length <= 1 || saving}
                              className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                              title="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <div className="text-sm">
                  <span className="text-slate-600">Subtotal </span>
                  <span className="font-semibold tabular-nums text-slate-900">{linesSubtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className="inline-flex min-w-28 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
