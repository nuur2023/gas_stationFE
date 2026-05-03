import { useMemo, useState } from 'react'
import {
  useCreateSupplierPaymentMutation,
  useGetBusinessesQuery,
  useGetSupplierPaymentsQuery,
  useGetSuppliersQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/ToastProvider'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { SupplierPayment, SupplierPaymentWriteRequest } from '../../types/models'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export function SupplierPaymentsPage() {
  const { canCreate } = usePagePermissionActions()
  const { showSuccess } = useToast()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)

  const [open, setOpen] = useState(false)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const [supplierId, setSupplierId] = useState(0)
  const [referenceNo, setReferenceNo] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data, isFetching } = useGetSupplierPaymentsQuery({
    page,
    pageSize,
    q: debounced || undefined,
    businessId: isSuperAdmin ? (filterBusinessId ?? undefined) : authBusinessId ?? undefined,
  })

  const effectiveFormBusinessId = showBizPicker ? formBusinessId : authBusinessId
  const { data: suppliersAll } = useGetSuppliersQuery(
    { page: 1, pageSize: 5000, q: undefined, businessId: undefined },
    { skip: !isSuperAdmin },
  )
  const { data: suppliersScoped } = useGetSuppliersQuery(
    {
      page: 1,
      pageSize: 5000,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [createPayment, { isLoading: saving }] = useCreateSupplierPaymentMutation()

  const supplierNameById = useMemo(() => {
    const m = new Map<number, string>()
    const items = (isSuperAdmin ? suppliersAll?.items : suppliersScoped?.items) ?? []
    for (const s of items) m.set(s.id, s.name)
    return m
  }, [isSuperAdmin, suppliersAll?.items, suppliersScoped?.items])

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const supplierOptions: SelectOption[] = useMemo(() => {
    const items =
      isSuperAdmin && formBusinessId != null && formBusinessId > 0
        ? (suppliersAll?.items ?? []).filter((s) => s.businessId === formBusinessId)
        : !isSuperAdmin
          ? (suppliersScoped?.items ?? [])
          : []
    return items.map((s) => ({ value: String(s.id), label: s.name }))
  }, [isSuperAdmin, formBusinessId, suppliersAll?.items, suppliersScoped?.items])

  const rows = data?.items ?? []
  const total = data?.totalCount ?? 0

  const columns: Column<SupplierPayment>[] = useMemo(
    () => [
      { key: 'id', header: 'ID' },
      {
        key: 'referenceNo',
        header: 'Reference',
        render: (r) => (r.referenceNo?.trim() ? r.referenceNo : '—'),
      },
      {
        key: 'supplierId',
        header: 'Supplier',
        render: (r) => supplierNameById.get(r.supplierId) ?? `#${r.supplierId}`,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        render: (r) => formatDecimal(r.amount ?? 0),
      },
      {
        key: 'date',
        header: 'Date',
        render: (r) => formatDate(r.date),
      },
      ...(isSuperAdmin
        ? ([
            {
              key: 'businessId' as const,
              header: 'Business',
              render: (r: SupplierPayment) => businessNameById.get(r.businessId) ?? `#${r.businessId}`,
            },
          ] as Column<SupplierPayment>[])
        : []),
    ],
    [isSuperAdmin, supplierNameById, businessNameById],
  )

  function openPaymentModal() {
    setOpen(true)
    setSupplierId(0)
    setReferenceNo('')
    setAmount('')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    if (showBizPicker) {
      setFormBusinessId(filterBusinessId ?? authBusinessId ?? null)
    } else {
      setFormBusinessId(null)
    }
  }

  function closeModal() {
    if (!saving) setOpen(false)
  }

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null
  const amountNum = Number.parseFloat(String(amount).replace(',', '.'))
  const canSubmit =
    !needsBusiness &&
    supplierId > 0 &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    paymentDate.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || saving) return
    const body: SupplierPaymentWriteRequest = {
      supplierId,
      amount: String(amountNum),
      date: new Date(paymentDate + 'T12:00:00').toISOString(),
      referenceNo: referenceNo.trim() || undefined,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }
    try {
      await createPayment(body).unwrap()
      showSuccess('Payment recorded.')
      setOpen(false)
      setPage(1)
    } catch {
      /* RTK error */
    }
  }

  return (
    <div className="space-y-4">
      <DataTable<SupplierPayment>
        title="Supplier payments"
        readOnly
        hideSearch={false}
        rows={rows}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={(q) => {
          setSearch(q)
          setPage(1)
        }}
        columns={columns}
        isLoading={isFetching}
        selectedIds={new Set()}
        onSelectedIdsChange={() => {}}
        onDeleteOne={() => {}}
        onDeleteSelected={() => {}}
        extraToolbar={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {canCreate ? (
              <button
                type="button"
                onClick={openPaymentModal}
                className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 sm:w-auto"
              >
                Payments
              </button>
            ) : null}
            {isSuperAdmin ? (
              <div className="min-w-0 flex-1 sm:min-w-[14rem] sm:max-w-xs lg:w-64 lg:max-w-none">
                <FormSelect
                  options={businessOptions}
                  value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
                  onChange={(o) => {
                    setFilterBusinessId(o ? Number(o.value) : null)
                    setPage(1)
                  }}
                  placeholder="Filter by business"
                  isClearable
                />
              </div>
            ) : null}
          </div>
        }
        emptyMessage="No supplier payments yet. They are created when you save a purchase as Half-paid or Paid with an amount paid, or use Payments to add one."
      />

      <Modal open={open} onClose={closeModal} title="Record supplier payment" className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setSupplierId(0)
                }}
                placeholder="Select business"
              />
            </div>
          )}
          {needsBusiness && (
            <p className="text-sm text-amber-800">{showBizPicker ? 'Select a business to load suppliers.' : 'No business assigned.'}</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Supplier</label>
            <FormSelect
              options={supplierOptions}
              value={supplierOptions.find((o) => o.value === String(supplierId)) ?? null}
              onChange={(o) => setSupplierId(o ? Number(o.value) : 0)}
              placeholder={needsBusiness ? 'Select business first' : 'Select supplier'}
              isDisabled={needsBusiness || supplierOptions.length === 0 || saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reference (optional)</label>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
              placeholder="Invoice or receipt #"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2 disabled:bg-slate-50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
