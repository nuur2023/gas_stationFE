import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useGetBusinessesQuery,
  useGetOperationReportEmployeesQuery,
  useGetStationsQuery,
  useRunPayrollMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import {
  adminNeedsSettingsStation,
  showBusinessPickerInForms,
  showPayrollStationScopePicker,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { EmployeeOption, PayrollRunItem, PayrollRunWriteRequest } from '../../types/models'

function currentPeriodYYYYMM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PayrollRunsPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationScope = showPayrollStationScopePicker(role)
  const effectiveStationId = useEffectiveStationId()

  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterStationId, setFilterStationId] = useState<number | null>(null)
  const [period, setPeriod] = useState(currentPeriodYYYYMM)
  const [paymentDateLocal, setPaymentDateLocal] = useState(() => toDatetimeLocalValue(new Date()))
  const [items, setItems] = useState<PayrollRunItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  useEffect(() => {
    if (!showBizPicker) return
    const itemsB = businessesData?.items ?? []
    if (itemsB.length === 0) return
    setReportBusinessId((prev) => (prev != null && itemsB.some((b) => b.id === prev) ? prev : itemsB[0].id))
  }, [showBizPicker, businessesData?.items])

  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)

  /** Default station scope: workspace station (Admin) or unset until user picks (SuperAdmin). */
  useEffect(() => {
    if (!showStationScope) return
    if (showBizPicker) return
    if (effectiveStationId != null && effectiveStationId > 0) {
      setFilterStationId((prev) => (prev != null && prev > 0 ? prev : effectiveStationId))
    }
  }, [showStationScope, showBizPicker, effectiveStationId])

  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)

  const { data: employees = [], isFetching: employeesLoading } = useGetOperationReportEmployeesQuery(
    {
      businessId: effectiveBusinessId,
      period: period.trim(),
      ...(filterStationId != null && filterStationId > 0 ? { stationId: filterStationId } : {}),
    },
    { skip: effectiveBusinessId <= 0 || needsWorkspaceStation },
  )

  const [runPayroll, { isLoading: running }] = useRunPayrollMutation()

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) all.push({ value: String(s.id), label: s.name })
    return all
  }, [stationsData?.items])

  const syncItemsFromEmployees = useCallback((list: EmployeeOption[]) => {
    setItems(
      list.map((e) => ({
        employeeId: e.id,
        chargedAmount: String(e.baseSalary ?? 0),
        amountPaid: String(e.baseSalary ?? 0),
        excluded: Boolean(e.hasSalaryForPeriod),
      })),
    )
  }, [])

  useEffect(() => {
    if (employeesLoading) return
    syncItemsFromEmployees(employees)
  }, [employees, employeesLoading, syncItemsFromEmployees])

  function patchItem(employeeId: number, patch: Partial<PayrollRunItem>) {
    setItems((prev) => prev.map((row) => (row.employeeId === employeeId ? { ...row, ...patch } : row)))
  }

  async function submit() {
    setSummary(null)
    if (effectiveBusinessId <= 0 || !period.trim()) return
    if (needsWorkspaceStation) {
      setSummary('Choose a working station under Settings before running payroll.')
      return
    }
    const paymentIso = paymentDateLocal ? new Date(paymentDateLocal).toISOString() : undefined
    const body: PayrollRunWriteRequest = {
      period: period.trim(),
      businessId: effectiveBusinessId,
      ...(paymentIso ? { paymentDate: paymentIso } : {}),
      ...(showStationScope && filterStationId != null && filterStationId > 0 ? { stationId: filterStationId } : {}),
      items,
    }
    try {
      const res = await runPayroll(body).unwrap()
      const skipped =
        res.skippedEmployeeCount && res.skippedEmployeeCount > 0
          ? ` Skipped ${res.skippedEmployeeCount} duplicate(s) for this period.`
          : ''
      setSummary(
        `Created ${res.createdRowCount} ledger row(s) for ${res.paidEmployeeCount} employee(s). Charged ${formatDecimal(res.totalCharged)}, paid ${formatDecimal(res.totalPaid)}.${skipped}`,
      )
      syncItemsFromEmployees(employees)
    } catch (e: unknown) {
      const r = e as { data?: string | { message?: string } }
      const msg =
        typeof r.data === 'string' ? r.data : typeof r.data === 'object' && r.data?.message ? r.data.message : 'Payroll run failed.'
      setSummary(msg)
    }
  }

  const includedCount = items.filter((i) => !i.excluded).length

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Payroll runs</h1>
      <p className="text-sm text-slate-600">
        Accrue salary and record payments for the period. Employees who already have salary for the period are excluded
        automatically. Use Exclude to skip others.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
              onChange={(o) => {
                setReportBusinessId(o ? Number(o.value) : null)
                setFilterStationId(null)
              }}
              placeholder="Business"
            />
          </div>
        )}
        {showStationScope && (
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station filter</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(filterStationId ?? '')) ?? stationOptions[0] ?? null}
              onChange={(o) => {
                setFilterStationId(o && o.value ? Number(o.value) : null)
              }}
              placeholder="All stations"
            />
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              {role === 'Admin'
                ? 'Defaults to your working station from Settings; change to list another station’s employees.'
                : 'Optional — restrict the employee list to one station.'}
            </p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Period (YYYY-MM)</label>
          <input
            type="month"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={period.length >= 7 ? period.slice(0, 7) : period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Payment date</label>
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={paymentDateLocal}
            onChange={(e) => setPaymentDateLocal(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={running || effectiveBusinessId <= 0 || includedCount === 0 || needsWorkspaceStation}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          {running ? 'Running…' : 'Run payroll'}
        </button>
      </div>

      {needsWorkspaceStation && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Choose a working station under Settings (Workspace) to load employees and run payroll.
        </p>
      )}

      {summary && <p className="text-sm text-slate-800">{summary}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Employee</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Base salary</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Charged</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Paid</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Exclude</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeesLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-600">
                  Loading employees…
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-600">
                  No active employees for this scope.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const row = items.find((i) => i.employeeId === emp.id)
                const locked = Boolean(emp.hasSalaryForPeriod)
                return (
                  <tr key={emp.id} className={locked ? 'bg-slate-100/80' : 'hover:bg-slate-50/80'}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{emp.name}</div>
                      {locked && (
                        <div className="text-xs font-medium text-amber-800">Salary already recorded for this period</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatDecimal(emp.baseSalary)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                        disabled={row?.excluded || locked}
                        value={row?.chargedAmount ?? ''}
                        onChange={(e) => patchItem(emp.id, { chargedAmount: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                        disabled={row?.excluded || locked}
                        value={row?.amountPaid ?? ''}
                        onChange={(e) => patchItem(emp.id, { amountPaid: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row?.excluded ?? false}
                        disabled={locked}
                        title={locked ? 'Salary already exists for this period' : undefined}
                        onChange={(e) => patchItem(emp.id, { excluded: e.target.checked })}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
