import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateEmployeePaymentMutation,
  useDeleteEmployeePaymentMutation,
  useGetBusinessesQuery,
  useGetEmployeePaymentBalanceQuery,
  useGetEmployeePaymentsQuery,
  useGetEmployeesQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms, showStationPickerInForms } from '../../lib/stationContext'
import type { EmployeePayment, EmployeePaymentWriteRequest } from '../../types/models'

const DESCRIPTION_OPTIONS = ['Payment', 'Salary', 'Advance', 'Bonus'] as const

export function EmployeePaymentsPage() {
  const { canCreate: routeCanCreate } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterStationId, setFilterStationId] = useState<number | null>(null)
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | null>(null)

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

  const { data: employeesPaged } = useGetEmployeesQuery(
    {
      page: 1,
      pageSize: 500,
      businessId: showBizPicker ? (effectiveBusinessId > 0 ? effectiveBusinessId : undefined) : authBusinessId ?? undefined,
      ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
      includeInactive: false,
    },
    { skip: effectiveBusinessId <= 0 },
  )

  const { data, isFetching } = useGetEmployeePaymentsQuery({
    page,
    pageSize,
    q: debounced || undefined,
    businessId: showBizPicker ? (effectiveBusinessId > 0 ? effectiveBusinessId : undefined) : authBusinessId ?? undefined,
    ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
    ...(filterEmployeeId != null && filterEmployeeId > 0 ? { employeeId: filterEmployeeId } : {}),
  })

  const [createPayment] = useCreateEmployeePaymentMutation()
  const [deletePayment] = useDeleteEmployeePaymentMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState(false)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [description, setDescription] = useState<string>('Payment')
  const [amountPaid, setAmountPaid] = useState('')
  const [chargedAmount, setChargedAmount] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [formStationId, setFormStationId] = useState<number | null>(null)

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) all.push({ value: String(s.id), label: s.name })
    return all
  }, [stationsData?.items])
  const stationOptionsNoAll: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )

  const employeeOptions: SelectOption[] = useMemo(
    () => (employeesPaged?.items ?? []).map((e) => ({ value: String(e.id), label: `${e.name} (#${e.id})` })),
    [employeesPaged?.items],
  )

  const filterEmployeeOptions = useMemo(
    () => [{ value: '', label: 'All employees' }, ...employeeOptions],
    [employeeOptions],
  )

  const previewBusinessId = showBizPicker ? formBusinessId ?? effectiveBusinessId : authBusinessId
  const { data: previewBalance, isFetching: previewLoading } = useGetEmployeePaymentBalanceQuery(
    {
      employeeId: employeeId!,
      businessId: previewBusinessId != null && previewBusinessId > 0 ? previewBusinessId : undefined,
    },
    {
      skip: employeeId == null || employeeId <= 0 || previewBusinessId == null || previewBusinessId <= 0,
    },
  )

  useEffect(() => {
    if (open && showBizPicker) setFormBusinessId(effectiveBusinessId > 0 ? effectiveBusinessId : null)
  }, [open, showBizPicker, effectiveBusinessId])

  useEffect(() => {
    setEmployeeId(null)
    setFormStationId(null)
  }, [formBusinessId, effectiveBusinessId])

  function openCreate() {
    setEmployeeId(null)
    setDescription('Payment')
    setAmountPaid('')
    setChargedAmount('')
    setPeriodLabel('')
    setPaymentDate('')
    setFormStationId(null)
    if (showBizPicker) setFormBusinessId(effectiveBusinessId > 0 ? effectiveBusinessId : null)
    setOpen(true)
  }

  const cols: Column<EmployeePayment>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Date',
        render: (r) => new Date(r.paymentDate).toLocaleString(),
      },
      {
        key: 'employeeId',
        header: 'Employee',
        render: (r) => (
          <Link className="text-emerald-700 hover:underline" to={`/employees/${r.employeeId}`}>
            {r.employeeName?.trim() || `#${r.employeeId}`}
          </Link>
        ),
      },
      { key: 'referenceNo', header: 'Reference', render: (r) => r.referenceNo?.trim() ?? '—' },
      { key: 'description', header: 'Type', render: (r) => r.description ?? '—' },
      {
        key: 'chargedAmount',
        header: 'Charged',
        render: (r) => (r.chargedAmount > 0 ? formatDecimal(r.chargedAmount) : '—'),
      },
      { key: 'paidAmount', header: 'Paid', render: (r) => (r.paidAmount > 0 ? formatDecimal(r.paidAmount) : '—') },
      { key: 'balance', header: 'Balance', render: (r) => formatDecimal(r.balance ?? 0) },
      {
        key: 'userId',
        header: 'Recorded by',
        render: (r) => r.userName?.trim() || `User #${r.userId}`,
      },
    ],
    [],
  )

  async function save() {
    const bid = showBizPicker ? formBusinessId : authBusinessId
    if (!routeCanCreate || !employeeId || bid == null || bid <= 0) return
    const paid = amountPaid.trim()
    const charged = chargedAmount.trim()
    if (!paid && !charged) return

    const body: EmployeePaymentWriteRequest = {
      employeeId,
      description,
      amountPaid: paid || '0',
      ...(charged ? { chargedAmount: charged } : {}),
      ...(periodLabel.trim() ? { periodLabel: periodLabel.trim() } : {}),
      ...(paymentDate ? { paymentDate: new Date(paymentDate).toISOString() } : {}),
      businessId: bid,
      ...(formStationId != null && formStationId > 0 ? { stationId: formStationId } : {}),
    }
    await createPayment(body).unwrap()
    setOpen(false)
    setEmployeeId(null)
    setAmountPaid('')
    setChargedAmount('')
    setPeriodLabel('')
    setPaymentDate('')
  }

  const canSave =
    routeCanCreate &&
    employeeId != null &&
    employeeId > 0 &&
    (amountPaid.trim().length > 0 || chargedAmount.trim().length > 0) &&
    (showBizPicker ? formBusinessId != null && formBusinessId > 0 : authBusinessId != null)

  return (
    <>
      {deleteDialog}
      <DataTable<EmployeePayment>
        title="Employee payments"
        addLabel="Record payment"
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
        onAdd={openCreate}
        onEdit={openCreate}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete payment?',
            description: 'This ledger row will be removed.',
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
            description: `Delete ${selected.size} row(s).`,
            action: async () => {
              await Promise.all(Array.from(selected).map((i) => deletePayment(i).unwrap()))
              setSelected(new Set())
            },
          })
        }
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
                    setFilterEmployeeId(null)
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
                    setFilterEmployeeId(null)
                    setPage(1)
                  }}
                  placeholder="All stations"
                />
              </div>
            )}
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Employee filter</label>
              <FormSelect
                options={filterEmployeeOptions}
                value={
                  filterEmployeeId != null && filterEmployeeId > 0
                    ? employeeOptions.find((o) => o.value === String(filterEmployeeId)) ?? null
                    : filterEmployeeOptions[0] ?? null
                }
                onChange={(o) => {
                  setFilterEmployeeId(o && o.value ? Number(o.value) : null)
                  setPage(1)
                }}
                placeholder="All employees"
                isDisabled={effectiveBusinessId <= 0}
              />
            </div>
          </div>
        }
      />

      <Modal open={open} title="Record employee payment" onClose={() => setOpen(false)} className="max-w-lg">
        <div className="grid gap-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50/90 p-3 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">How to use</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-slate-700">
              <li>
                <strong>Paying the employee</strong> — choose <strong>Type: Payment</strong>, enter <strong>Amount paid</strong>{' '}
                (cash or transfer to them), set <strong>Payment date</strong>, then Save. That reduces their outstanding balance.
              </li>
              <li>
                <strong>Monthly accrual</strong> — prefer <strong>Payrolls → Payroll runs</strong> so salary and payment lines stay
                paired for the period. Use this form for one-off advances, bonuses, or manual fixes.
              </li>
              <li>
                <strong>Charged (optional)</strong> — only if you need a salary charge on the <em>same</em> ledger row as a payment;
                usually leave blank and use Payroll runs for charges.
              </li>
              <li>
                <strong>Period label</strong> — optional tag (e.g. <code className="rounded bg-white px-1">2026-05</code>) so reports
                can group the row by month.
              </li>
            </ul>
          </div>
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null}
                onChange={(o) => setFormBusinessId(o ? Number(o.value) : null)}
                placeholder="Select business"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
            <FormSelect
              options={employeeOptions}
              value={employeeOptions.find((o) => o.value === String(employeeId ?? '')) ?? null}
              onChange={(o) => setEmployeeId(o ? Number(o.value) : null)}
              placeholder="Select employee"
              isDisabled={effectiveBusinessId <= 0}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            >
              {DESCRIPTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount paid</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Charged (optional)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={chargedAmount}
                onChange={(e) => setChargedAmount(e.target.value)}
                placeholder="Accrual on same row"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period label (optional)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="e.g. 2026-05"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payment date</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          {showStationPicker && stationOptionsNoAll.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station (optional)</label>
              <FormSelect
                options={stationOptionsNoAll}
                value={
                  formStationId != null && formStationId > 0
                    ? stationOptionsNoAll.find((o) => o.value === String(formStationId)) ?? null
                    : null
                }
                onChange={(o) => setFormStationId(o && o.value ? Number(o.value) : null)}
                placeholder="Default from employee"
                isClearable
              />
            </div>
          )}

          {employeeId != null && employeeId > 0 && previewBusinessId != null && previewBusinessId > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-800">Balance preview</div>
              {previewLoading ? (
                <p className="mt-1 text-slate-600">Loading…</p>
              ) : previewBalance ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-slate-700">
                  <dt>Total due</dt>
                  <dd className="text-right font-medium">{formatDecimal(previewBalance.totalDue)}</dd>
                  <dt>Total paid</dt>
                  <dd className="text-right font-medium">{formatDecimal(previewBalance.totalPaid)}</dd>
                  <dt>Outstanding</dt>
                  <dd className="text-right font-semibold text-emerald-900">{formatDecimal(previewBalance.balance)}</dd>
                </dl>
              ) : null}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => void save()}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
