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
import { Modal } from '../../components/Modal'
import { cn } from '../../lib/cn'
import {
  openCashSalesReportPdf,
  type CashSalesPdfFuelScope,
  type CashSalesPdfPeriod,
  type CashSalesReportRowPdf,
} from '../../lib/cashSalesReportPdf'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms, useEffectiveStationId } from '../../lib/stationContext'

type FuelKind = 'petrol' | 'diesel'

type DailyCashRow = {
  day: string
  dieselUsage: number
  dieselTotal: number
  dieselTotalUsd: number
  petrolUsage: number
  petrolTotal: number
  petrolTotalUsd: number
}

type CashSalesRow = {
  periodKey: string
  periodLabel: string
  dieselUsage: number
  dieselTotal: number
  dieselTotalUsd: number
  petrolUsage: number
  petrolTotal: number
  petrolTotalUsd: number
}

type PeriodTab = 'daily' | 'weekly' | 'monthly'

function detectFuelKind(name: string): FuelKind | null {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return null
  // Diesel synonyms (check before generic "gas" patterns where relevant)
  if (n.includes('diesel') || n.includes('gasoil') || n.includes('ago') || /\bd2\b/.test(n)) return 'diesel'
  // Petrol / gasoline synonyms (PMS = premium motor spirit, common in some regions)
  if (
    n.includes('petrol') ||
    n.includes('gasoline') ||
    n.includes('pms') ||
    n.includes('mogas') ||
    n.includes('benzene') ||
    n.includes('unleaded') ||
    n.includes('super') ||
    n === 'gas' ||
    /\bgas\b/.test(n)
  ) {
    return 'petrol'
  }
  return null
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayDateKey(isoDay: string): string {
  const d = new Date(isoDay + 'T12:00:00')
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const m = new Date(d)
  m.setFullYear(d.getFullYear(), d.getMonth(), d.getDate() + offset)
  const y = m.getFullYear()
  const mo = String(m.getMonth() + 1).padStart(2, '0')
  const da = String(m.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function monthKey(isoDay: string): string {
  return isoDay.slice(0, 7)
}

function formatWeekPeriodLabel(mondayIso: string): string {
  const d = new Date(mondayIso + 'T12:00:00')
  return `Week of ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
}

function formatMonthPeriodLabel(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1))
}

async function openInventorySaleEvidence(saleId: number) {
  const raw = localStorage.getItem('gas-auth')
  const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
  if (!token) return
  const baseUrl = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const url = `${baseUrl}/api/Inventories/sales/${saleId}/evidence`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
}

function emptySums(): Omit<CashSalesRow, 'periodKey' | 'periodLabel'> {
  return {
    dieselUsage: 0,
    dieselTotal: 0,
    dieselTotalUsd: 0,
    petrolUsage: 0,
    petrolTotal: 0,
    petrolTotalUsd: 0,
  }
}

function addDailyInto(target: Omit<CashSalesRow, 'periodKey' | 'periodLabel'>, d: DailyCashRow) {
  target.dieselUsage += d.dieselUsage
  target.dieselTotal += d.dieselTotal
  target.dieselTotalUsd += d.dieselTotalUsd
  target.petrolUsage += d.petrolUsage
  target.petrolTotal += d.petrolTotal
  target.petrolTotalUsd += d.petrolTotalUsd
}

function aggregateByPeriod(daily: DailyCashRow[], mode: PeriodTab): CashSalesRow[] {
  if (mode === 'daily') {
    return daily
      .map((d) => ({
        periodKey: d.day,
        periodLabel: d.day,
        dieselUsage: d.dieselUsage,
        dieselTotal: d.dieselTotal,
        dieselTotalUsd: d.dieselTotalUsd,
        petrolUsage: d.petrolUsage,
        petrolTotal: d.petrolTotal,
        petrolTotalUsd: d.petrolTotalUsd,
      }))
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
  }

  const map = new Map<string, Omit<CashSalesRow, 'periodLabel'>>()
  for (const d of daily) {
    const key = mode === 'weekly' ? mondayDateKey(d.day) : monthKey(d.day)
    const cur = map.get(key) ?? { periodKey: key, ...emptySums() }
    addDailyInto(cur, d)
    map.set(key, cur)
  }

  return [...map.values()]
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
    .map((v) => ({
      ...v,
      periodLabel:
        mode === 'weekly' ? formatWeekPeriodLabel(v.periodKey) : formatMonthPeriodLabel(v.periodKey),
    }))
}

export function DailyCashSalesReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const showBizPicker = showBusinessPickerInForms(role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [periodTab, setPeriodTab] = useState<PeriodTab>('daily')
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfFuelScope, setPdfFuelScope] = useState<CashSalesPdfFuelScope>('all')

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)
  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const { data: stationsData } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 2000,
      q: undefined,
      ...(effectiveBusinessId > 0 ? { businessId: effectiveBusinessId } : {}),
    },
    { skip: effectiveBusinessId <= 0 },
  )
  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    if (reportBusinessId != null && items.some((b) => b.id === reportBusinessId)) return
    setReportBusinessId(items[0].id)
  }, [showBizPicker, businessesData?.items, reportBusinessId])
  const businessName =
    effectiveBusinessId > 0
      ? (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name ?? 'Business'
      : 'Business'
  const stationName =
    effectiveStationId != null && effectiveStationId > 0
      ? (stationsData?.items ?? []).find((s) => s.id === effectiveStationId)?.name ?? `#${effectiveStationId}`
      : 'All stations'

  const { data: inventories, isFetching } = useGetInventoriesQuery({
    page: 1,
    pageSize: 5000,
    q: undefined,
    filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
    filterStationId: effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : undefined,
  })
  const { data: nozzleRows = [] } = useGetNozzlesByBusinessQuery(effectiveBusinessId, {
    skip: effectiveBusinessId <= 0,
  })
  const { data: dippingsData } = useGetDippingsQuery({
    page: 1,
    pageSize: 5000,
    q: undefined,
    businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
    filterStationId: effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : undefined,
  })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const fuelTypeKindById = useMemo(() => {
    const m = new Map<number, FuelKind>()
    for (const f of fuelTypes) {
      const k = detectFuelKind(f.fuelName)
      if (k) m.set(f.id, k)
    }
    return m
  }, [fuelTypes])

  const dippingFuelTypeById = useMemo(() => {
    const m = new Map<number, number>()
    for (const d of dippingsData?.items ?? []) m.set(d.id, d.fuelTypeId)
    return m
  }, [dippingsData?.items])

  const nozzleFuelKindById = useMemo(() => {
    const m = new Map<number, FuelKind>()
    for (const n of nozzleRows) {
      const ftid = dippingFuelTypeById.get(n.dippingId)
      const primaryKind = ftid ? fuelTypeKindById.get(ftid) : null
      if (primaryKind) {
        m.set(n.id, primaryKind)
        continue
      }

      const dippingName = dippingsData?.items.find((d) => d.id === n.dippingId)?.name ?? ''
      const fallback =
        detectFuelKind(dippingName) ??
        detectFuelKind(n.name ?? '') ??
        detectFuelKind(n.pumpNumber ?? '')
      if (fallback) m.set(n.id, fallback)
    }
    return m
  }, [nozzleRows, dippingFuelTypeById, fuelTypeKindById, dippingsData?.items])

  const inventoryCount = inventories?.items.length ?? 0
  const loadedNozzleIdSet = useMemo(() => new Set(nozzleRows.map((n) => n.id)), [nozzleRows])
  const inventoriesMissingLoadedNozzle = useMemo(() => {
    let c = 0
    for (const inv of inventories?.items ?? []) {
      if (!loadedNozzleIdSet.has(inv.nozzleId)) c += 1
    }
    return c
  }, [inventories?.items, loadedNozzleIdSet])
  const classifiedCount = useMemo(() => {
    let c = 0
    for (const inv of inventories?.items ?? []) {
      if (nozzleFuelKindById.get(inv.nozzleId)) c += 1
    }
    return c
  }, [inventories?.items, nozzleFuelKindById])

  const dateRangeInvalid = Boolean(from && to) && from > to

  const dailyRows = useMemo<DailyCashRow[]>(() => {
    if (dateRangeInvalid) return []
    const items = inventories?.items ?? []
    const byDay = new Map<string, DailyCashRow>()
    for (const inv of items) {
      const kind = nozzleFuelKindById.get(inv.nozzleId)
      if (!kind) continue
      const day = inv.date.slice(0, 10)
      if (from && day < from) continue
      if (to && day > to) continue
      const row = byDay.get(day) ?? {
        day,
        dieselUsage: 0,
        dieselTotal: 0,
        dieselTotalUsd: 0,
        petrolUsage: 0,
        petrolTotal: 0,
        petrolTotalUsd: 0,
      }
      const usage = Number(inv.usageLiters) || 0
      const amt = Number(inv.sspAmount) || 0
      const usd = Number(inv.usdAmount) || 0
      if (kind === 'diesel') {
        row.dieselUsage += usage
        row.dieselTotal += amt
        row.dieselTotalUsd += usd
      } else {
        row.petrolUsage += usage
        row.petrolTotal += amt
        row.petrolTotalUsd += usd
      }
      byDay.set(day, row)
    }
    return Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day))
  }, [inventories?.items, nozzleFuelKindById, from, to, dateRangeInvalid])

  const rows = useMemo(() => aggregateByPeriod(dailyRows, periodTab), [dailyRows, periodTab])

  const periodTitle =
    periodTab === 'daily' ? 'Daily' : periodTab === 'weekly' ? 'Weekly' : 'Monthly'

  const reportTitle = `${periodTitle} cash sales report`

  function handleDownloadPdf() {
    const pdfRows: CashSalesReportRowPdf[] = compactRows.map((r) => ({
      periodLabel: r.periodLabel,
      name: r.name,
      sspFuelPrice: r.sspFuelPrice,
      usdFuelPrice: r.usdFuelPrice,
      sspLiters: r.sspLiters,
      usdLiters: r.usdLiters,
      sspAmount: r.sspAmount,
      usdAmount: r.usdAmount,
      rateLabel: r.rateLabel,
      sspToUsd: r.sspToUsd,
      finalUsd: r.finalUsd,
    }))
    openCashSalesReportPdf({
      reportTitle,
      businessName,
      stationName,
      period: periodTab as CashSalesPdfPeriod,
      fuelScope: pdfFuelScope,
      from,
      to,
      rows: pdfRows,
    })
    setPdfOpen(false)
  }

  const tabBtn = (id: PeriodTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setPeriodTab(id)}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        periodTab === id
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      )}
    >
      {label}
    </button>
  )

  const compactRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        periodLabel: string
        name: 'Petrol' | 'Diesel'
        sspFuelPrice: number
        usdFuelPrice: number
        sspLiters: number
        usdLiters: number
        sspAmount: number
        usdAmount: number
        sspToUsd: number
        finalUsd: number
        rates: Set<number>
        saleIds: number[]
      }
    >()

    for (const inv of inventories?.items ?? []) {
      const kind = nozzleFuelKindById.get(inv.nozzleId)
      if (!kind) continue
      const day = inv.date.slice(0, 10)
      if (from && day < from) continue
      if (to && day > to) continue

      const periodKey =
        periodTab === 'daily' ? day : periodTab === 'weekly' ? mondayDateKey(day) : monthKey(day)
      const periodLabel =
        periodTab === 'daily'
          ? day
          : periodTab === 'weekly'
            ? formatWeekPeriodLabel(periodKey)
            : formatMonthPeriodLabel(periodKey)
      const name: 'Petrol' | 'Diesel' = kind === 'diesel' ? 'Diesel' : 'Petrol'
      const sspFuelPrice = Number(inv.sspFuelPrice) || 0
      const usdFuelPrice = Number(inv.usdFuelPrice) || 0
      const sspLiters = Number(inv.sspLiters) || 0
      const usdLiters = Number(inv.usdLiters) || 0
      const sspAmount = Number(inv.sspAmount) || 0
      const usdAmount = Number(inv.usdAmount) || 0
      const rate = Number(inv.exchangeRate) || 0
      const finalUsd = usdAmount + (rate > 0 ? sspAmount / rate : 0)

      const key = `${periodKey}|${name}|${sspFuelPrice}|${usdFuelPrice}`
      const saleId = inv.inventorySaleId ?? inv.id
      const row = grouped.get(key) ?? {
        periodLabel,
        name,
        sspFuelPrice,
        usdFuelPrice,
        sspLiters: 0,
        usdLiters: 0,
        sspAmount: 0,
        usdAmount: 0,
        sspToUsd: 0,
        finalUsd: 0,
        rates: new Set<number>(),
        saleIds: [] as number[],
      }
      if (!row.saleIds.includes(saleId)) row.saleIds.push(saleId)
      row.sspLiters += sspLiters
      row.usdLiters += usdLiters
      row.sspAmount += sspAmount
      row.usdAmount += usdAmount
      row.sspToUsd += rate > 0 ? sspAmount / rate : 0
      row.finalUsd += finalUsd
      if (rate > 0) row.rates.add(rate)
      grouped.set(key, row)
    }

    const out = [...grouped.entries()].map(([compositeKey, row]) => {
      const rates = [...row.rates]
      const pipe = compositeKey.indexOf('|')
      const reportPeriodKey = pipe === -1 ? compositeKey : compositeKey.slice(0, pipe)
      return {
        periodKey: reportPeriodKey,
        rowCompositeKey: compositeKey,
        periodLabel: row.periodLabel,
        name: row.name,
        sspFuelPrice: row.sspFuelPrice,
        usdFuelPrice: row.usdFuelPrice,
        sspLiters: row.sspLiters,
        usdLiters: row.usdLiters,
        sspAmount: row.sspAmount,
        usdAmount: row.usdAmount,
        sspToUsd: row.sspToUsd,
        finalUsd: row.finalUsd,
        rateLabel:
          rates.length === 0
            ? '—'
            : rates.length === 1
              ? `${formatDecimal(rates[0])} SSP/USD`
              : 'Mixed rates',
        saleIds: row.saleIds,
      }
    })

    out.sort((a, b) => {
      const pk = b.periodKey.localeCompare(a.periodKey)
      if (pk !== 0) return pk
      const rank = (n: 'Petrol' | 'Diesel') => (n === 'Petrol' ? 0 : 1)
      return rank(a.name) - rank(b.name)
    })
    return out
  }, [inventories?.items, nozzleFuelKindById, from, to, periodTab])

  /** Last data row per calendar period (`periodKey` = day / week / month) shows merged evidence (not on Subtotal). */
  const cashSalesEvidenceLayout = useMemo(() => {
    const lastIndexByPeriod = new Map<string, number>()
    const saleIdsByPeriod = new Map<string, number[]>()
    for (let i = 0; i < compactRows.length; i++) {
      const r = compactRows[i]
      lastIndexByPeriod.set(r.periodKey, i)
      const merged = saleIdsByPeriod.get(r.periodKey) ?? []
      for (const id of r.saleIds) {
        if (!merged.includes(id)) merged.push(id)
      }
      saleIdsByPeriod.set(r.periodKey, merged)
    }
    return { lastIndexByPeriod, saleIdsByPeriod }
  }, [compactRows])

  const totals = useMemo(() => {
    let sspLiters = 0
    let usdLiters = 0
    let sspAmount = 0
    let usdAmount = 0
    let sspToUsd = 0
    let finalUsd = 0
    for (const r of compactRows) {
      sspLiters += r.sspLiters
      usdLiters += r.usdLiters
      sspAmount += r.sspAmount
      usdAmount += r.usdAmount
      sspToUsd += r.sspToUsd
      finalUsd += r.finalUsd
    }
    return { sspLiters, usdLiters, sspAmount, usdAmount, sspToUsd, finalUsd }
  }, [compactRows])

  const colCount = 12

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cash sales report</h1>
          <p className="mt-1 text-sm text-slate-500">{periodTitle} view · inventory-based totals</p>
        </div>
        <button
          type="button"
          onClick={() => setPdfOpen(true)}
          disabled={rows.length === 0 || dateRangeInvalid}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {tabBtn('daily', 'Daily')}
        {tabBtn('weekly', 'Weekly')}
        {tabBtn('monthly', 'Monthly')}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[14rem] max-w-xs">
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
      </div>

      {dateRangeInvalid && (
        <p className="text-sm text-amber-700">&quot;From&quot; must be on or before &quot;To&quot;.</p>
      )}

      <div className="max-w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        {inventoryCount > 0 && classifiedCount === 0 ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 space-y-1">
            <p>
              Inventory rows were returned, but none could be classified as Petrol or Diesel for this report
              (nozzle → dipping → fuel type).
            </p>
            {inventoriesMissingLoadedNozzle > 0 ? (
              <p>
                <span className="font-semibold">Likely cause:</span> {inventoriesMissingLoadedNozzle} row(s) reference
                nozzles that are not in the current nozzle list for this business. Confirm Settings station matches the
                data you expect, then refresh.
              </p>
            ) : (
              <p>
                Check fuel type names (e.g. include &quot;Petrol&quot; or &quot;Diesel&quot;), and that each nozzle is
                linked to a dipping whose fuel type matches.
              </p>
            )}
          </div>
        ) : null}
        <div className="w-full self-start overflow-x-auto overscroll-x-contain">
        <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">
                {periodTab === 'daily' ? 'Date' : 'Period'}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">SSP Price</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">USD Price</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">SSP Liters</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">USD Liters</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">SSP Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">USD Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Rate</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">SspToUsd</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Final USD</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Reference evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {compactRows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-500">
                  {isFetching
                    ? 'Loading…'
                    : dateRangeInvalid
                      ? '—'
                      : inventoryCount === 0
                        ? 'No inventory rows to build the report.'
                        : classifiedCount === 0
                          ? 'No Petrol/Diesel rows in this date range after mapping (see notice above if shown).'
                          : 'No inventory rows in the selected date range.'}
                </td>
              </tr>
            )}
            {compactRows.map((r, rowIdx) => {
              const isLastForPeriod = cashSalesEvidenceLayout.lastIndexByPeriod.get(r.periodKey) === rowIdx
              const evidenceIds = isLastForPeriod ? (cashSalesEvidenceLayout.saleIdsByPeriod.get(r.periodKey) ?? []) : []
              return (
                <tr key={r.rowCompositeKey} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-800">{r.periodLabel}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.sspFuelPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.usdFuelPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.sspLiters)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.usdLiters)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatDecimal(r.sspAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">${formatDecimal(r.usdAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.rateLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">${formatDecimal(r.sspToUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">${formatDecimal(r.finalUsd)}</td>
                  <td className="px-3 py-2 text-left">
                    {evidenceIds.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {evidenceIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => void openInventorySaleEvidence(id)}
                            className="text-sm font-medium text-emerald-700 underline decoration-emerald-600/60 hover:text-emerald-800"
                          >
                            View
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {compactRows.length > 0 && (
            <tfoot className="border-t border-slate-300 bg-emerald-50/60">
              <tr>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 font-semibold text-slate-800">Subtotal</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800">
                  {formatDecimal(totals.sspLiters)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800">
                  {formatDecimal(totals.usdLiters)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-800">
                  {formatDecimal(totals.sspAmount)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-800">
                  ${formatDecimal(totals.usdAmount)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-600">—</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-800">
                  ${formatDecimal(totals.sspToUsd)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-800">
                  ${formatDecimal(totals.finalUsd)}
                </td>
                <td className="px-3 py-2 text-slate-500">—</td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      <Modal open={pdfOpen} title="Open PDF" onClose={() => setPdfOpen(false)} className="max-w-md">
        <p className="mb-3 text-sm text-slate-600">
          Choose which fuel types to include. The PDF uses the current tab ({periodTitle}) and date range ({from} → {to}
          ).
        </p>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Include</legend>
          {(
            [
              ['all', 'All (Diesel + Petrol)'],
              ['petrol', 'Petrol only'],
              ['diesel', 'Diesel only'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <input
                type="radio"
                name="pdfFuel"
                checked={pdfFuelScope === value}
                onChange={() => setPdfFuelScope(value)}
              />
              <span className="text-sm text-slate-800">{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            onClick={() => setPdfOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={handleDownloadPdf} 
          >
            Open
          </button>
        </div>
      </Modal>
    </div>
  )
}
