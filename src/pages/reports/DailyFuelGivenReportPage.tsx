import { useEffect, useMemo, useState } from 'react'
import { useGetBusinessesQuery, useGetDailyFuelGivenReportQuery, useGetStationsQuery } from '../../app/api/apiSlice'
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

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DailyFuelGivenReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const showStationCol = showStationColumnInTables(role)
  const effectiveStationId = useEffectiveStationId()
  const tableColCount = showStationCol ? 8 : 7

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
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

  const dateRangeInvalid = Boolean(from && to) && from > to

  const { data: rows = [], isFetching, isError } = useGetDailyFuelGivenReportQuery(
    {
      businessId: effectiveBusinessId,
      from: !dateRangeInvalid && from ? `${from}T00:00:00` : undefined,
      to: !dateRangeInvalid && to ? `${to}T00:00:00` : undefined,
      stationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )

  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )

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

  const grand = useMemo(() => {
    let liters = 0
    let amount = 0
    let usd = 0
    for (const r of rows) {
      liters += r.totalLiters
      amount += r.totalAmount
      usd += r.usdAmount
    }
    return { liters, amount, usd }
  }, [rows])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Daily given fuel report</h1>
      </div>

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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {showStationPicker && (
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={
                stationOptions.find((o) => o.value === String(superStationId ?? '')) ?? stationOptions[0] ?? null
              }
              onChange={(o) => setSuperStationId(o && o.value ? Number(o.value) : null)}
              placeholder="All stations"
            />
          </div>
        )}
      </div>

      {needsWorkspaceStation && (
        <p className="text-sm text-amber-800">
          {showSettingsStationHint ? SETTINGS_STATION_HINT : 'Your account has no station assigned. Contact an administrator.'}
        </p>
      )}
      {dateRangeInvalid && <p className="text-sm text-amber-700">&quot;From&quot; must be on or before &quot;To&quot;.</p>}
      {effectiveBusinessId <= 0 && showBizPicker && (
        <p className="text-sm text-amber-700">Select a business to load the report.</p>
      )}
      {isError && <p className="text-sm text-red-600">Could not load report.</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              {showStationCol ? (
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th>
              ) : null}
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Fuel type</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Price</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Liters</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Usd amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={tableColCount} className="px-4 py-8 text-center text-slate-500">
                  {isFetching ? 'Loading…' : needsWorkspaceStation ? '—' : 'No fuel given records in this range.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 whitespace-nowrap text-slate-800">{r.date}</td>
                {showStationCol ? (
                  <td className="px-4 py-2 text-slate-700">
                    {stationNameById.get(r.stationId) ?? `#${r.stationId}`}
                  </td>
                ) : null}
                <td className="px-4 py-2 text-slate-800">{r.name?.trim() ? r.name : '—'}</td>
                <td className="px-4 py-2 text-slate-800">{r.fuelTypeName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.price)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.totalLiters)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">
                  {formatDecimal(r.totalAmount)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">
                  {formatDecimal(r.usdAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-slate-300 bg-emerald-50/50">
              <tr>
                <td colSpan={showStationCol ? 5 : 4} className="px-4 py-2 font-semibold text-slate-900">
                  Subtotal
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatDecimal(grand.liters)}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {formatDecimal(grand.amount)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {formatDecimal(grand.usd)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
