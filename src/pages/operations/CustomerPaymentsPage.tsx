import { useEffect, useMemo, useState } from 'react'
import {
  useCreateCustomerPaymentMutation,
  useDeleteCustomerPaymentMutation,
  useGetBusinessesQuery,
  useGetOperationReportCustomersQuery,
  useGetCustomerPaymentPreviewBalanceQuery,
  useGetCustomerPaymentsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import {
  adminNeedsSettingsStation,
  showBusinessPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import { formatDecimal } from '../../lib/formatNumber'
import type { CustomerPayment } from '../../types/models'

export function CustomerPaymentsPage() {
  const { canCreate: routeCanCreate } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const effectiveStationId = useEffectiveStationId()
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)

  const paymentFilterStationId =
    role !== 'SuperAdmin' && effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : undefined

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [businessId, setBusinessId] = useState<number | null>(authBusinessId ?? null)

  const { data, isFetching } = useGetCustomerPaymentsQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(paymentFilterStationId != null ? { filterStationId: paymentFilterStationId } : {}),
  })
  const { data: customers } = useGetOperationReportCustomersQuery(
    { businessId: showBizPicker ? (businessId ?? 0) : (authBusinessId ?? 0) },
    { skip: (showBizPicker ? (businessId ?? 0) : (authBusinessId ?? 0)) <= 0 },
  )
  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createPayment] = useCreateCustomerPaymentMutation()
  const [deletePayment] = useDeleteCustomerPaymentMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState<number | null>(null)
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
  const customersForBusiness = useMemo(() => {
    const items = customers ?? []
    if (!showBizPicker || businessId == null || businessId <= 0) return items
    return items
  }, [customers, showBizPicker, businessId])

  const customerOptions: SelectOption[] = useMemo(
    () => customersForBusiness.map((x) => ({ value: String(x.customerId), label: `${x.name} (${x.phone})` })),
    [customersForBusiness],
  )
  const givenNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of customers ?? []) m.set(g.customerId, g.name)
    return m
  }, [customers])

  const previewBusinessId = showBizPicker ? businessId : authBusinessId
  const { data: previewBalance, isFetching: previewLoading } = useGetCustomerPaymentPreviewBalanceQuery(
    {
      customerId: customerId!,
      businessId: previewBusinessId != null && previewBusinessId > 0 ? previewBusinessId : undefined,
    },
    {
      skip:
        customerId == null ||
        customerId <= 0 ||
        previewBusinessId == null ||
        previewBusinessId <= 0,
    },
  )

  useEffect(() => {
    setCustomerId(null)
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
    { key: 'paymentDate', header: 'Date', render: (r) => new Date(r.paymentDate).toLocaleString() },
    {
      key: 'referenceNo',
      header: 'Reference',
      render: (r) => r.referenceNo?.trim() ?? '—',
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (r) => {
        const name = r.customerName?.trim()
        if (name) return r.customerPhone?.trim() ? `${name} (${r.customerPhone})` : name
        return r.customerId ? givenNameById.get(r.customerId) ?? `#${r.customerId}` : '—'
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => r.description ?? 'Payment',
    },
    { key: 'chargedAmount', header: 'Charged', render: (r) => (r.chargedAmount > 0 ? formatDecimal(r.chargedAmount) : '—') },
    { key: 'amountPaid', header: 'Paid', render: (r) => (r.amountPaid > 0 ? formatDecimal(r.amountPaid) : '—') },
    {
      key: 'balance',
      header: 'Balance',
      render: (r) => formatDecimal(r.balance ?? 0),
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
    if (!routeCanCreate || !customerId || !amountPaid.trim()) return
    await createPayment({
      customerId,
      amountPaid: amountPaid.trim(),
      businessId: showBizPicker ? (businessId ?? undefined) : undefined,
    }).unwrap()
    setOpen(false)
    setCustomerId(null)
    setAmountPaid('')
  }

  return (
    <>
      {needsWorkspaceStation && (
        <div className="mx-auto mb-3 max-w-7xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Choose a working station under Settings to see payments for that station only.
        </div>
      )}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
            <FormSelect
              options={customerOptions}
              value={customerOptions.find((x) => x.value === String(customerId ?? '')) ?? null}
              onChange={(opt) => setCustomerId(opt ? Number(opt.value) : null)}
              placeholder="Select customer"
            />
          </div>
          {customerId != null && customerId > 0 && previewBusinessId != null && previewBusinessId > 0 ? (
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
          <button
            type="button"
            disabled={!routeCanCreate}
            title={!routeCanCreate ? 'No create permission' : undefined}
            onClick={save}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save payment
          </button>
        </div>
      </Modal>
      {deleteDialog}
    </>
  )
}

