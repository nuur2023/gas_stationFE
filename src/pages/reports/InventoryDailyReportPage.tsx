import { useEffect, useMemo, useState } from 'react'
import {
  useGetBusinessesQuery,
  useGetDippingsQuery,
  useGetFuelTypesQuery,
  useGetInventoriesQuery,
  useGetNozzlesByBusinessQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessPickerInForms,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { NozzleStationRow } from '../../types/models'

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nozzleStationLabel(n: NozzleStationRow): string {
  const num = n.pumpNumber?.trim()
  const base = num ? `Pump-${num}` : `Nozzle #${n.id}`
  const name = n.name?.trim()
  return name ? `${base} · ${name}` : base
}

export function InventoryDailyReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const effectiveStationId = useEffectiveStationId()

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

  const isAllStationsScope = showStationPicker && (superStationId == null || superStationId <= 0)

  const dateRangeInvalid = Boolean(from && to) && from > to

  const querySkip = effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation

  const { data: inventoriesData, isFetching: loadingInv } = useGetInventoriesQuery(
    {
      page: 1,
      pageSize: 1000,
      q: undefined,
      filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
      filterStationId: apiStationId,
    },
    { skip: querySkip },
  )

  const { data: dippingsData, isFetching: loadingDip } = useGetDippingsQuery(
    {
      page: 1,
      pageSize: 1000,
      q: undefined,
      businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
      filterStationId: apiStationId,
    },
    { skip: querySkip },
  )

  const { data: nozzleRows = [], isFetching: loadingNozzles } = useGetNozzlesByBusinessQuery(effectiveBusinessId, {
    skip: querySkip || effectiveBusinessId <= 0,
  })

  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
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

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])

  const nozzleById = useMemo(() => {
    const m = new Map<number, NozzleStationRow>()
    for (const n of nozzleRows) m.set(n.id, n)
    return m
  }, [nozzleRows])

  const dippingById = useMemo(() => {
    const m = new Map<number, { fuelTypeId: number }>()
    for (const d of dippingsData?.items ?? []) m.set(d.id, { fuelTypeId: d.fuelTypeId })
    return m
  }, [dippingsData?.items])

  type InvRow = {
    id: number
    stationId: number
    fuelTypeName: string
    pumpLabel: string
    opening: number
    closing: number
  }

  const inventoryRows = useMemo((): InvRow[] => {
    if (dateRangeInvalid) return []
    const items = inventoriesData?.items ?? []
    const out: InvRow[] = []
    for (const inv of items) {
      const day = inv.date.slice(0, 10)
      if (from && day < from) continue
      if (to && day > to) continue
      const nozzle = nozzleById.get(inv.nozzleId)
      if (!nozzle) continue
      const dip = dippingById.get(nozzle.dippingId)
      const fuelTypeId = dip?.fuelTypeId
      const fuelTypeName =
        fuelTypeId != null ? (fuelNameById.get(fuelTypeId) ?? `Fuel #${fuelTypeId}`) : '—'
      out.push({
        id: inv.id,
        stationId: inv.stationId,
        fuelTypeName,
        pumpLabel: nozzleStationLabel(nozzle),
        opening: inv.openingLiters,
        closing: inv.closingLiters,
      })
    }
    out.sort((a, b) => {
      const s = a.stationId - b.stationId
      if (s !== 0) return s
      const f = a.fuelTypeName.localeCompare(b.fuelTypeName)
      if (f !== 0) return f
      return a.pumpLabel.localeCompare(b.pumpLabel)
    })
    return out
  }, [inventoriesData?.items, from, to, dateRangeInvalid, nozzleById, dippingById, fuelNameById])

  type DipRow = { stationId: number; fuelTypeId: number; fuelTypeName: string; remained: number }

  const dippingRows = useMemo((): DipRow[] => {
    const items = dippingsData?.items ?? []
    const m = new Map<string, DipRow>()
    for (const d of items) {
      const k = `${d.stationId}-${d.fuelTypeId}`
      const name = fuelNameById.get(d.fuelTypeId) ?? `Fuel #${d.fuelTypeId}`
      const prev = m.get(k)
      const remained = (prev?.remained ?? 0) + d.amountLiter
      m.set(k, { stationId: d.stationId, fuelTypeId: d.fuelTypeId, fuelTypeName: name, remained })
    }
    return Array.from(m.values()).sort((a, b) => {
      const s = a.stationId - b.stationId
      if (s !== 0) return s
      return a.fuelTypeName.localeCompare(b.fuelTypeName)
    })
  }, [dippingsData?.items, fuelNameById])

  const isFetching = loadingInv || loadingDip || loadingNozzles

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inventory daily report</h1>
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
      {dateRangeInvalid && (
        <p className="text-sm text-amber-700">&quot;From&quot; must be on or before &quot;To&quot;.</p>
      )}
      {effectiveBusinessId <= 0 && showBizPicker && (
        <p className="text-sm text-amber-700">Select a business to load the report.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold capitalize text-slate-800">
          Inventory
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {isAllStationsScope && (
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th>
              )}
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Type fuel</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Pump</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Opening</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventoryRows.length === 0 && (
              <tr>
                <td
                  colSpan={isAllStationsScope ? 5 : 4}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {isFetching
                    ? 'Loading…'
                    : querySkip
                      ? '—'
                      : 'No inventory readings in the selected date range.'}
                </td>
              </tr>
            )}
            {inventoryRows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                {isAllStationsScope && (
                  <td className="px-4 py-2 text-slate-700">
                    {stationNameById.get(r.stationId) ?? `#${r.stationId}`}
                  </td>
                )}
                <td className="px-4 py-2 text-slate-800">{r.fuelTypeName}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{r.pumpLabel}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.opening)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
          Dipping
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {isAllStationsScope && (
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th>
              )}
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Type fuel</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Remained</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dippingRows.length === 0 && (
              <tr>
                <td
                  colSpan={isAllStationsScope ? 3 : 2}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {isFetching ? 'Loading…' : querySkip ? '—' : 'No dipping records for this scope.'}
                </td>
              </tr>
            )}
            {dippingRows.map((r) => (
              <tr key={`${r.stationId}-${r.fuelTypeId}`} className="hover:bg-slate-50/70">
                {isAllStationsScope && (
                  <td className="px-4 py-2 text-slate-700">
                    {stationNameById.get(r.stationId) ?? `#${r.stationId}`}
                  </td>
                )}
                <td className="px-4 py-2 text-slate-800">{r.fuelTypeName}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatDecimal(r.remained)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
