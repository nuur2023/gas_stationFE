import { useEffect, useMemo, useState } from 'react'
import { useGetBusinessesQuery, useGetFuelTypesQuery, useGetOutstandingCustomerFuelGivensQuery, useGetStationsQuery } from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
export function OutstandingCustomersReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const showStationCol = showStationColumnInTables(role)
  const effectiveStationId = useEffectiveStationId()

  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined }, { skip: !showBizPicker })

  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setReportBusinessId((prev) => {
      if (prev != null && items.some((b) => b.id === prev)) return prev
      return items[0].id
    })
  }, [showBizPicker, businessesData?.items])

  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)
  const needsWorkspaceStation = !showStationPicker && (effectiveStationId == null || effectiveStationId <= 0)
  const showSettingsStationHint = adminNeedsSettingsStation(role, effectiveStationId)

  const apiStationId = showStationPicker
    ? superStationId != null && superStationId > 0
      ? superStationId
      : undefined
    : effectiveStationId != null && effectiveStationId > 0
      ? effectiveStationId
      : undefined

  const { data: rows = [], isFetching } = useGetOutstandingCustomerFuelGivensQuery(
    {
      filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
      filterStationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || needsWorkspaceStation },
  )

  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )

  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) {
      all.push({ value: String(s.id), label: s.name })
    }
    return all
  }, [stationsData?.items])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])

  const totalOutstanding = useMemo(() => rows.reduce((s, r) => s + r.balance, 0), [rows])
  const colCount = showStationCol ? 12 : 11

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Outstanding customers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Customer fuel-given lines that still have a positive balance. Fully paid lines are not listed.
        </p>
      </div>

      {needsWorkspaceStation ? (
        <p className="text-sm text-amber-800">
          {showSettingsStationHint
            ? SETTINGS_STATION_HINT
            : 'Your account has no station assigned. Contact an administrator.'}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
              onChange={(o) => setReportBusinessId(o ? Number(o.value) : null)}
              placeholder="Select business"
            />
          </div>
        )}
        {showStationPicker && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(superStationId ?? '')) ?? null}
              onChange={(o) => setSuperStationId(o?.value ? Number(o.value) : null)}
              placeholder="All stations"
              isClearable
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Total outstanding:{' '}
          <span className="font-semibold tabular-nums text-amber-900">{formatDecimal(totalOutstanding)}</span>
          <span className="text-slate-400"> · {rows.length} record(s)</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">ID</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Customer</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
              {showStationCol ? (
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Station</th>
              ) : null}
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Fuel</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Liters</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Price / L</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">USD Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Total due</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Paid</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isFetching && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  {needsWorkspaceStation ? '—' : 'No outstanding balances for this scope.'}
                </td>
              </tr>
            )}
            {!isFetching &&
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-800">{r.id}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-slate-700">{r.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700">{new Date(r.date).toLocaleString()}</td>
                  {showStationCol ? (
                    <td className="px-3 py-2 text-slate-700">{stationNameById.get(r.stationId) ?? `#${r.stationId}`}</td>
                  ) : null}
                  <td className="px-3 py-2 text-slate-700">{fuelNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.givenLiter)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.usdAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatDecimal(r.totalDue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.totalPaid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">{formatDecimal(r.balance)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
