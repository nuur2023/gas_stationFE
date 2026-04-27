import { useEffect, useMemo, useState } from 'react'
import {
  useCreateCustomerPaymentMutation,
  useDeleteCustomerPaymentMutation,
  useGetBusinessesQuery,
  useGetCustomerFuelGivensQuery,
  useGetCustomerPaymentPreviewBalanceQuery,
  useGetCustomerPaymentsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import { formatDecimal } from '../../lib/formatNumber'
import type { CustomerPayment } from '../../types/models'

export function CustomerPaymentsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [businessId, setBusinessId] = useState<number | null>(authBusinessId ?? null)

  const { data, isFetching } = useGetCustomerPaymentsQuery({ page, pageSize, q: debounced || undefined })
  const { data: givens } = useGetCustomerFuelGivensQuery({ page: 1, pageSize: 500 })
  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createPayment] = useCreateCustomerPaymentMutation()
  const [deletePayment] = useDeleteCustomerPaymentMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState(false)
  const [customerFuelGivenId, setCustomerFuelGivenId] = useState<number | null>(null)
  const [amountPaid, setAmountPaid] = useState('')

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businesses?.items ?? []
    if (showBizPicker) return items.map((x) => ({ value: String(x.id), label: x.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businesses?.items, showBizPicker, authBusinessId])
  const givensForBusiness = useMemo(() => {
    const items = givens?.items ?? []
    if (!showBizPicker || businessId == null || businessId <= 0) return items
    return items.filter((g) => g.businessId === businessId)
  }, [givens?.items, showBizPicker, businessId])

  const givenOptions: SelectOption[] = useMemo(
    () => givensForBusiness.map((x) => ({ value: String(x.id), label: `${x.name} (${x.phone}) - #${x.id}` })),
    [givensForBusiness],
  )
  const givenNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of givens?.items ?? []) m.set(g.id, g.name)
    return m
  }, [givens?.items])

  const previewBusinessId = showBizPicker ? businessId : authBusinessId
  const { data: previewBalance, isFetching: previewLoading } = useGetCustomerPaymentPreviewBalanceQuery(
    {
      customerFuelGivenId: customerFuelGivenId!,
      businessId: previewBusinessId != null && previewBusinessId > 0 ? previewBusinessId : undefined,
    },
    {
      skip:
        customerFuelGivenId == null ||
        customerFuelGivenId <= 0 ||
        previewBusinessId == null ||
        previewBusinessId <= 0,
    },
  )

  useEffect(() => {
    setCustomerFuelGivenId(null)
  }, [businessId])

  function paymentStatusBadge(status: string | null | undefined) {
    const s = status ?? '—'
    const cls =
      s === 'Paid'
        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
        : s === 'Half-paid'
          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
          : s === 'Unpaid'
            ? 'bg-red-100 text-red-800 ring-1 ring-red-200'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{s}</span>
  }

  const cols: Column<CustomerPayment>[] = [
    { key: 'paymentDate', header: 'Payment Date', render: (r) => new Date(r.paymentDate).toLocaleString() },
    { key: 'customerFuelGivenId', header: 'Customer', render: (r) => givenNameById.get(r.customerFuelGivenId) ?? `#${r.customerFuelGivenId}` },
    { key: 'amountPaid', header: 'Amount Paid', render: (r) => formatDecimal(r.amountPaid) },
    {
      key: 'remainingBalance',
      header: 'Balance',
      render: (r) => (r.remainingBalance == null ? '—' : formatDecimal(r.remainingBalance)),
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      render: (r) => paymentStatusBadge(r.paymentStatus),
    },
    {
      key: 'userId',
      header: 'Recorded by',
      render: (r) => r.userName?.trim() || `User #${r.userId}`,
    },
  ]

  async function save() {
    if (!customerFuelGivenId || !amountPaid.trim()) return
    await createPayment({
      customerFuelGivenId,
      amountPaid: amountPaid.trim(),
      businessId: showBizPicker ? (businessId ?? undefined) : undefined,
    }).unwrap()
    setOpen(false)
    setCustomerFuelGivenId(null)
    setAmountPaid('')
  }

  return (
    <>
      <DataTable<CustomerPayment>
        title="Customer Payments"
        addLabel="Add Payment"
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
        columns={cols}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={() => setOpen(true)}
        onEdit={() => setOpen(true)}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete payment?',
            description: 'This payment will be soft-deleted.',
            action: async () => {
              await deletePayment(id).unwrap()
              setSelected((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            },
          })
        }
        onDeleteSelected={() =>
          requestDelete({
            title: 'Delete selected payments?',
            description: `Delete ${selected.size} payment row(s).`,
            action: async () => {
              await Promise.all(Array.from(selected).map((id) => deletePayment(id).unwrap()))
              setSelected(new Set())
            },
          })
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Add customer payment">
        <div className="grid grid-cols-1 gap-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((x) => x.value === String(businessId ?? '')) ?? null}
                onChange={(opt) => setBusinessId(opt ? Number(opt.value) : null)}
                placeholder="Select business"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer fuel given</label>
            <FormSelect
              options={givenOptions}
              value={givenOptions.find((x) => x.value === String(customerFuelGivenId ?? '')) ?? null}
              onChange={(opt) => setCustomerFuelGivenId(opt ? Number(opt.value) : null)}
              placeholder="Select customer fuel given"
            />
          </div>
          {customerFuelGivenId != null && customerFuelGivenId > 0 && previewBusinessId != null && previewBusinessId > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer</p>
              {previewLoading ? (
                <p className="mt-1 text-sm text-slate-600">Loading balance…</p>
              ) : previewBalance ? (
                <>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{previewBalance.name}</p>
                  <p className="text-sm text-slate-600">{previewBalance.phone}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Total due</dt>
                      <dd className="font-medium tabular-nums text-slate-900">{formatDecimal(previewBalance.totalDue)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Already paid</dt>
                      <dd className="font-medium tabular-nums text-slate-900">{formatDecimal(previewBalance.totalPaid)}</dd>
                    </div>
                    <div className="col-span-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-emerald-200/60">
                      <dt className="text-xs font-medium text-emerald-800">Outstanding balance</dt>
                      <dd className="text-xl font-bold tabular-nums text-emerald-900">{formatDecimal(previewBalance.balance)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Could not load balance.</p>
              )}
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount paid</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Save payment</button>
        </div>
      </Modal>
      {deleteDialog}
    </>
  )
}

