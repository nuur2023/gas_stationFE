import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import {
  useGetBusinessesQuery,
  useGetCashOutDailyReportQuery,
  useGetCurrenciesQuery,
  useGetDailyFuelGivenReportQuery,
  useGetDailySummaryReportQuery,
  useGetDippingsQuery,
  useGetFuelPricesQuery,
  useGetFuelTypesQuery,
  useGetGeneratorUsagesQuery,
  useGetInventoriesQuery,
  useGetNozzlesByBusinessQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import type { DailySummaryReportDto } from '../../types/models'
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

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
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

function pumpLabel(pumpNumber: string, nozzle?: string | null): string {
  return `${pumpNumber}${nozzle ? ` · ${nozzle}` : ''}`
}

const EMPTY_DAILY_SUMMARY: DailySummaryReportDto = {
  salesLocal: 0,
  salesSspToUsd: 0,
  salesUsd: 0,
  periodFinalUsd: 0,
  previousBalanceLocal: 0,
  previousBalanceUsd: 0,
  previousBalanceSspToUsd: 0,
  totalLocal: 0,
  totalSspToUsd: 0,
  totalUsd: 0,
  outLocal: 0,
  outUsd: 0,
  outAsUsd: 0,
  balanceLocal: 0,
  balanceUsd: 0,
  finalBalanceUsd: 0,
  periodCashOut: { lines: [], totalCashOut: 0, totalCashOutUsd: 0 },
}

function detectFuelKind(name: string): 'petrol' | 'diesel' | null {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return null
  if (n.includes('diesel') || n.includes('gasoil') || n.includes('ago') || /\bd2\b/.test(n)) return 'diesel'
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

export function GeneralDailyReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const effectiveStationId = useEffectiveStationId()

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)
  /** Sections included when generating PDF (user can turn off tables they do not want printed). */
  const [pdfIncludeCashSales, setPdfIncludeCashSales] = useState(true)
  const [pdfIncludeDailySummary, setPdfIncludeDailySummary] = useState(true)
  const [pdfIncludeInventory, setPdfIncludeInventory] = useState(true)
  const [pdfIncludeCustomerGiven, setPdfIncludeCustomerGiven] = useState(true)
  const [pdfIncludeGenerator, setPdfIncludeGenerator] = useState(true)
  const [pdfIncludeDipping, setPdfIncludeDipping] = useState(true)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
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
  const dateRangeInvalid = Boolean(from && to) && from > to

  const apiStationId = showStationPicker
    ? superStationId != null && superStationId > 0
      ? superStationId
      : undefined
    : effectiveStationId != null && effectiveStationId > 0
      ? effectiveStationId
      : undefined

  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const { data: cashOutData, isFetching: cashOutLoading } = useGetCashOutDailyReportQuery(
    {
      businessId: effectiveBusinessId,
      from: !dateRangeInvalid && from ? `${from}T00:00:00` : undefined,
      to: !dateRangeInvalid && to ? `${to}T00:00:00` : undefined,
      stationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )

  const { data: dailyGivenRows = [], isFetching: givenLoading } = useGetDailyFuelGivenReportQuery(
    {
      businessId: effectiveBusinessId,
      from: !dateRangeInvalid && from ? `${from}T00:00:00` : undefined,
      to: !dateRangeInvalid && to ? `${to}T00:00:00` : undefined,
      stationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )
  const { data: generatorData, isFetching: generatorLoading } = useGetGeneratorUsagesQuery(
    {
      page: 1,
      pageSize: 5000,
      q: undefined,
      ...(apiStationId != null && apiStationId > 0 ? { filterStationId: apiStationId } : {}),
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )

  const cashOutLines = cashOutData?.lines ?? []

  const { data: dailySummaryRaw, isFetching: dailySummaryLoading } = useGetDailySummaryReportQuery(
    {
      businessId: effectiveBusinessId,
      from: from ?? '',
      to: to ?? '',
      stationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation || !from || !to },
  )
  const dailySummary = dailySummaryRaw ?? EMPTY_DAILY_SUMMARY
  const dailySummaryCashOutLines = dailySummaryRaw?.periodCashOut?.lines ?? cashOutLines

  const { data: inventoriesData } = useGetInventoriesQuery(
    {
      page: 1,
      pageSize: 5000,
      q: undefined,
      ...(effectiveBusinessId > 0 ? { filterBusinessId: effectiveBusinessId } : {}),
      ...(apiStationId != null && apiStationId > 0 ? { filterStationId: apiStationId } : {}),
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )
  const { data: nozzleRows = [] } = useGetNozzlesByBusinessQuery(effectiveBusinessId, {
    skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation,
  })
  const { data: dippingsData } = useGetDippingsQuery(
    {
      page: 1,
      pageSize: 5000,
      q: undefined,
      businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
      filterStationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || needsWorkspaceStation },
  )
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: currenciesData } = useGetCurrenciesQuery()
  const { data: fuelPricesData } = useGetFuelPricesQuery({
    filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
    filterStationId: apiStationId != null && apiStationId > 0 ? apiStationId : undefined,
  })

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])
  const nozzleById = useMemo(() => {
    const m = new Map<number, { pumpNumber: string; name: string; dippingId: number }>()
    for (const n of nozzleRows) m.set(n.id, { pumpNumber: n.pumpNumber, name: n.name, dippingId: n.dippingId })
    return m
  }, [nozzleRows])
  const dippingFuelTypeById = useMemo(() => {
    const m = new Map<number, number>()
    for (const d of dippingsData?.items ?? []) m.set(d.id, d.fuelTypeId)
    return m
  }, [dippingsData?.items])
  const currencySymbolById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currenciesData ?? []) m.set(c.id, c.symbol)
    return m
  }, [currenciesData])
  const localCurrencySymbol = useMemo(() => {
    const current = (fuelPricesData ?? []).find((x) => {
      if (x.currencyId == null) return false
      if (effectiveBusinessId > 0 && x.businessId !== effectiveBusinessId) return false
      if (apiStationId != null && apiStationId > 0 && x.stationId !== apiStationId) return false
      return true
    })
    if (!current?.currencyId) return ''
    return currencySymbolById.get(current.currencyId) ?? ''
  }, [fuelPricesData, effectiveBusinessId, apiStationId, currencySymbolById])
  const currencyCodeById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currenciesData ?? []) m.set(c.id, c.code.toUpperCase())
    return m
  }, [currenciesData])
  const localCurrencyCode = useMemo(() => {
    const current = (fuelPricesData ?? []).find((x) => {
      if (x.currencyId == null) return false
      if (effectiveBusinessId > 0 && x.businessId !== effectiveBusinessId) return false
      if (apiStationId != null && apiStationId > 0 && x.stationId !== apiStationId) return false
      return true
    })
    if (!current?.currencyId) return 'SSP'
    return currencyCodeById.get(current.currencyId) ?? 'SSP'
  }, [fuelPricesData, effectiveBusinessId, apiStationId, currencyCodeById])

  const inventoryRows = useMemo(() => {
    const out: Array<{ fuelType: string; pump: string; opening: number; closing: number }> = []
    for (const inv of inventoriesData?.items ?? []) {
      const day = inv.date.slice(0, 10)
      if (from && day < from) continue
      if (to && day > to) continue
      const nozzle = nozzleById.get(inv.nozzleId)
      if (!nozzle) continue
      const fuelTypeId = dippingFuelTypeById.get(nozzle.dippingId)
      out.push({
        fuelType: fuelTypeId != null ? (fuelNameById.get(fuelTypeId) ?? `Fuel #${fuelTypeId}`) : '—',
        pump: pumpLabel(nozzle.pumpNumber, nozzle.name),
        opening: Number(inv.openingLiters) || 0,
        closing: Number(inv.closingLiters) || 0,
      })
    }
    out.sort((a, b) => a.fuelType.localeCompare(b.fuelType) || a.pump.localeCompare(b.pump))
    return out
  }, [inventoriesData?.items, from, to, nozzleById, dippingFuelTypeById, fuelNameById])

  const dailyCashRows = useMemo(() => {
    const byDayFuel = new Map<
      string,
      {
        date: string
        name: 'Petrol' | 'Diesel'
        sspFuelPrice: number
        usdFuelPrice: number
        sspLiters: number
        usdLiters: number
        sspAmount: number
        usdAmount: number
        sspToUsd: number
        finalUsd: number
        rateLabel: string
        saleIds: number[]
      }
    >()
    for (const inv of inventoriesData?.items ?? []) {
      const day = inv.date.slice(0, 10)
      if (from && day < from) continue
      if (to && day > to) continue
      const nozzle = nozzleById.get(inv.nozzleId)
      if (!nozzle) continue
      const ftid = dippingFuelTypeById.get(nozzle.dippingId)
      const fuelName = ftid != null ? (fuelNameById.get(ftid) ?? '') : ''
      const kind = detectFuelKind(fuelName)
      if (!kind) continue
      const name = kind === 'petrol' ? 'Petrol' : 'Diesel'
      const sspFuelPrice = Number(inv.sspFuelPrice) || 0
      const usdFuelPrice = Number(inv.usdFuelPrice) || 0
      const key = `${day}::${name}::${sspFuelPrice}::${usdFuelPrice}`
      const rate = Number(inv.exchangeRate) || 0
      const sspAmount = Number(inv.sspAmount) || 0
      const usdAmount = Number(inv.usdAmount) || 0
      const sspToUsd = rate > 0 ? sspAmount / rate : 0
      const saleId = inv.inventorySaleId ?? inv.id
      const row = byDayFuel.get(key) ?? {
        date: day,
        name,
        sspFuelPrice,
        usdFuelPrice,
        sspLiters: 0,
        usdLiters: 0,
        sspAmount: 0,
        usdAmount: 0,
        sspToUsd: 0,
        finalUsd: 0,
        rateLabel: rate > 0 ? `${formatDecimal(rate)} SSP/USD` : '—',
        saleIds: [],
      }
      if (!row.saleIds.includes(saleId)) row.saleIds.push(saleId)
      row.sspLiters += Number(inv.sspLiters) || 0
      row.usdLiters += Number(inv.usdLiters) || 0
      row.sspAmount += sspAmount
      row.usdAmount += usdAmount
      row.sspToUsd += sspToUsd
      row.finalUsd += usdAmount + sspToUsd
      if (rate > 0 && row.rateLabel !== `${formatDecimal(rate)} SSP/USD`) {
        row.rateLabel = 'Mixed rates'
      }
      byDayFuel.set(key, row)
    }
    return [...byDayFuel.values()].sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return a.name.localeCompare(b.name)
    })
  }, [inventoriesData?.items, from, to, nozzleById, dippingFuelTypeById, fuelNameById])

  /** Last data row per calendar date shows merged evidence sale ids for that day. */
  const dailyCashSalesEvidenceLayout = useMemo(() => {
    const lastIndexByDate = new Map<string, number>()
    const saleIdsByDate = new Map<string, number[]>()
    for (let i = 0; i < dailyCashRows.length; i++) {
      const r = dailyCashRows[i]
      lastIndexByDate.set(r.date, i)
      const merged = saleIdsByDate.get(r.date) ?? []
      for (const id of r.saleIds) {
        if (!merged.includes(id)) merged.push(id)
      }
      saleIdsByDate.set(r.date, merged)
    }
    return { lastIndexByDate, saleIdsByDate }
  }, [dailyCashRows])

  const dailyCashGrand = useMemo(() => {
    let sspLiters = 0
    let usdLiters = 0
    let subtotalLocal = 0
    let totalDollar = 0
    let sspToUsd = 0
    let finalUsd = 0
    for (const r of dailyCashRows) {
      sspLiters += r.sspLiters
      usdLiters += r.usdLiters
      subtotalLocal += r.sspAmount
      totalDollar += r.usdAmount
      sspToUsd += r.sspToUsd
      finalUsd += r.finalUsd
    }
    return { sspLiters, usdLiters, subtotalLocal, totalDollar, sspToUsd, finalUsd }
  }, [dailyCashRows])
  const customerGivenGrand = useMemo(() => {
    let liters = 0
    let amount = 0
    let usd = 0
    for (const r of dailyGivenRows) {
      liters += r.totalLiters
      amount += r.totalAmount
      usd += r.usdAmount
    }
    return { liters, amount, usd }
  }, [dailyGivenRows])

  const cashOutTotals = useMemo(() => {
    const lines = cashOutData?.lines ?? []
    let localNonUsd = 0
    let usdCurrencyOnly = 0
    let nonUsdAsUsd = 0
    for (const r of lines) {
      const code = (r.currencyCode || '').trim().toUpperCase()
      if (code === 'USD') {
        const usdVal = Number(r.localAmount) || 0
        usdCurrencyOnly += usdVal
      } else {
        localNonUsd += Number(r.localAmount) || 0
        nonUsdAsUsd += Number(r.amountUsd) || 0
      }
    }
    return { local: localNonUsd, usdCurrencyOnly, nonUsdAsUsd }
  }, [cashOutData?.lines])
  const generatorRows = useMemo(() => {
    const rows = (generatorData?.items ?? []).filter((r) => {
      const day = r.date.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      if (effectiveBusinessId > 0 && r.businessId !== effectiveBusinessId) return false
      return true
    })
    rows.sort((a, b) => a.date.localeCompare(b.date))
    return rows
  }, [generatorData?.items, from, to, effectiveBusinessId])
  const generatorGrandLiters = useMemo(
    () => generatorRows.reduce((sum, r) => sum + (Number(r.ltrUsage) || 0), 0),
    [generatorRows],
  )
  const dippingDailyRows = useMemo(() => {
    const byNameFuel = new Map<string, { name: string; fuelType: string; liters: number }>()
    for (const d of dippingsData?.items ?? []) {
      if (effectiveBusinessId > 0 && d.businessId !== effectiveBusinessId) continue
      if (apiStationId != null && apiStationId > 0 && d.stationId !== apiStationId) continue
      const fuelType = fuelNameById.get(d.fuelTypeId) ?? `#${d.fuelTypeId}`
      const key = `${d.name}::${fuelType}`
      const row = byNameFuel.get(key) ?? { name: d.name || 'Dipping', fuelType, liters: 0 }
      row.liters += Number(d.amountLiter) || 0
      byNameFuel.set(key, row)
    }
    return [...byNameFuel.values()].sort((a, b) => a.name.localeCompare(b.name) || a.fuelType.localeCompare(b.fuelType))
  }, [dippingsData?.items, effectiveBusinessId, apiStationId, fuelNameById])
  const hasAnyReportData =
    dailyCashRows.length > 0 ||
    cashOutLines.length > 0 ||
    dailyGivenRows.length > 0 ||
    generatorRows.length > 0 ||
    inventoryRows.length > 0 ||
    dippingDailyRows.length > 0

  const businessName =
    effectiveBusinessId > 0
      ? (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name ?? `#${effectiveBusinessId}`
      : 'Business'

  const stationOptions: SelectOption[] = useMemo(() => {
    const out: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) out.push({ value: String(s.id), label: s.name })
    return out
  }, [stationsData?.items])

  function handleOpenPdf() {
    if (dateRangeInvalid) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 48
    const headerH = 150
    const today = new Date().toLocaleDateString('en-CA')

    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.text((businessName || 'Gas Station').toUpperCase(), pageW / 2, 52, { align: 'center' })
    doc.setFontSize(14)
    doc.text('GENERAL DAILY REPORT', pageW / 2, 80, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`${from || '…'} ! ${to || '…'}`, pageW / 2, 125, { align: 'center' })

    let y = headerH + 38
    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    // doc.text('Station Name', margin, y)
    // doc.text('current date', pageW - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 14
    doc.text(
      apiStationId != null && apiStationId > 0 ? (stationNameById.get(apiStationId) ?? `#${apiStationId}`) : 'All stations',
      margin,
      y,
    )
    doc.text(today, pageW - margin, y, { align: 'right' })
    // add here line
    y += 10 
    doc.line(margin, y, pageW - margin, y)

    const drawFooter = (tableData: { pageNumber: number }) => {
      const pW = doc.internal.pageSize.getWidth()
      const pH = doc.internal.pageSize.getHeight()
      const lineY = pH - 34
      doc.setDrawColor(21, 128, 122)
      doc.setLineWidth(1)
      doc.line(margin, lineY, pW - margin, lineY)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('Powered by abaalsoftware', margin, lineY + 15)
      doc.text(`Page | ${tableData.pageNumber}`, pW - margin, lineY + 15, { align: 'right' })
    }
    const afterLastTable = (fallback: number) =>
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback) + 24
    const ensureSectionStart = (requiredSpace = 44) => {
      const pageH = doc.internal.pageSize.getHeight()
      const safeBottom = pageH - 70
      if (y + requiredSpace > safeBottom) {
        doc.addPage()
        y = margin
      }
    }

    y += 18
    // border to table head and foot
    if (pdfIncludeCashSales && dailyCashRows.length > 0) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.text('Daily Cash Sales', margin, y, { align: 'left' })
      autoTable(doc, {
        startY: y + 6,
        head: [['Name', 'SSP Price', 'USD Price', 'SSP Liters', 'USD Liters', 'SSP Amount', 'USD Amount', 'Rate', 'SspToUsd', 'Final USD']],
        body: dailyCashRows.map((r) => [
          r.name,
          formatDecimal(r.sspFuelPrice),
          formatDecimal(r.usdFuelPrice),
          formatDecimal(r.sspLiters),
          formatDecimal(r.usdLiters),
          `${localCurrencySymbol}${formatDecimal(r.sspAmount)}`,
          `$${formatDecimal(r.usdAmount)}`,
          r.rateLabel,
          `$${formatDecimal(r.sspToUsd)}`,
          `$${formatDecimal(r.finalUsd)}`,
        ]),
        foot: [
          [
            'Subtotal',
            '',
            '',
            formatDecimal(dailyCashGrand.sspLiters),
            formatDecimal(dailyCashGrand.usdLiters),
            `${localCurrencySymbol}${formatDecimal(dailyCashGrand.subtotalLocal)}`,
            `$${formatDecimal(dailyCashGrand.totalDollar)}`,
            '—',
            `$${formatDecimal(dailyCashGrand.sspToUsd)}`,
            `$${formatDecimal(dailyCashGrand.finalUsd)}`,
          ],
        ],
        showFoot: 'lastPage',
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        footStyles: { fillColor: false, textColor: [6, 78, 59], fontStyle: 'bold', lineColor: [203, 213, 225], lineWidth: 0.6 },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
      })
      y = afterLastTable(y + 110)
    }

    if (
      pdfIncludeDailySummary &&
      (dailyCashRows.length > 0 ||
        cashOutLines.length > 0 ||
        Math.abs(dailySummary.previousBalanceLocal) > 1e-9 ||
        Math.abs(dailySummary.previousBalanceUsd) > 1e-9)
    ) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('Daily Summary', margin, y, { align: 'left' })
      const summaryBody: unknown[][] = [
        [
          'Previous Balance',
          localCurrencyCode,
          formatDecimal(dailySummary.previousBalanceLocal),
          'USD',
          formatDecimal(dailySummary.previousBalanceUsd),
          'SSP to USD',
          'Liter Sold (USD)',
        ],
        [
          `Total Daily Cash Sales (${localCurrencyCode})`,
          { content: formatDecimal(dailySummary.salesLocal), colSpan: 3, styles: { halign: 'left' } },
          '—',
          `$${formatDecimal(dailySummary.salesSspToUsd)}`,
          `$${formatDecimal(dailySummary.salesUsd)}`,
        ],
        [
          `Total Sales (${localCurrencyCode})`,
          { content: formatDecimal(dailySummary.salesLocal), colSpan: 2, styles: { halign: 'left' } },
          '—',
          '—',
          `$${formatDecimal(dailySummary.salesSspToUsd)}`,
          `$${formatDecimal(dailySummary.salesUsd)}`,
        ],
        [{ content: 'Cash Out', colSpan: 7, styles: { fontStyle: 'bold', halign: 'left' } }],
        ['Description', 'Currency', 'Amount', 'Rate', 'USD', '', ''],
      ]
      if (dailySummaryCashOutLines.length === 0) {
        summaryBody.push([{ content: 'No cash out rows.', colSpan: 7, styles: { halign: 'center', textColor: [100, 116, 139] } }])
      } else {
        for (const r of dailySummaryCashOutLines) {
          const code = (r.currencyCode || 'USD').toUpperCase()
          const isUsd = code === 'USD'
          summaryBody.push([
            r.description || '—',
            code,
            formatDecimal(r.localAmount),
            isUsd ? '------' : r.rate > 1e-9 ? formatDecimal(r.rate) : '------',
            isUsd ? `$${formatDecimal(r.localAmount)}` : `$${formatDecimal(r.amountUsd)}`,
            '',
            '',
          ])
        }
      }
      summaryBody.push([
        'Total Cash Out',
        { content: formatDecimal(dailySummary.outLocal), colSpan: 2, styles: { halign: 'right' } },
        { content: 'Total Cash Out As USD', colSpan: 2, styles: { halign: 'left' } },
        { content: `$${formatDecimal(dailySummary.outAsUsd)}`, colSpan: 2, styles: { halign: 'right' } },
      ])
      summaryBody.push([
        { content: `Total Cash Balance (${localCurrencyCode})`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Total Dollar Balance (USD)', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center' } },
      ])
      summaryBody.push([
        'Total Sales',
        { content: formatDecimal(dailySummary.salesLocal), colSpan: 3, styles: { halign: 'right' } },
        '',
        { content: `$${formatDecimal(dailySummary.salesUsd)}`, colSpan: 2, styles: { halign: 'right' } },
      ])
      summaryBody.push([
        'Total Cash Out',
        { content: formatDecimal(dailySummary.outLocal), colSpan: 3, styles: { halign: 'right' } },
        'Total Dollar Out',
        { content: `$${formatDecimal(dailySummary.outUsd)}`, colSpan: 2, styles: { halign: 'right' } },
      ])
      summaryBody.push([
        'Total Cash Balance',
        { content: formatDecimal(dailySummary.balanceLocal), colSpan: 3, styles: { halign: 'right' } },
        'Total Balance',
        { content: `$${formatDecimal(dailySummary.balanceUsd)}`, colSpan: 2, styles: { halign: 'right' } },
      ])

      autoTable(doc, {
        startY: y + 6,
        body: summaryBody as never[],
        showHead: 'never',
        showFoot: 'never',
        styles: { fontSize: 8, cellPadding: 3, textColor: [31, 41, 55] },
        bodyStyles: { fontStyle: 'normal' },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const idx = data.row.index
          if (idx === 0) {
            if (data.column.index === 2 || data.column.index === 4) {
              data.cell.styles.textColor = [185, 28, 28]
              data.cell.styles.fontStyle = 'bold'
            }
          }
          if (idx === 1 || idx === 2) {
            data.cell.styles.fontStyle = 'bold'
          }
          if (idx === 3 || idx === 4) {
            data.cell.styles.fontStyle = 'bold'
          }
          if (idx === summaryBody.length - 1) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
      y = afterLastTable(y + 110)
    }

    if (pdfIncludeCustomerGiven && dailyGivenRows.length > 0) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('Customer Given Fuel', margin, y, { align: 'left' })
      autoTable(doc, {
        startY: y + 6,
        head: [['Date', 'Name', 'Fuel type', 'Price', 'Liters', 'Amount', 'USD']],
        body: dailyGivenRows.map((r) => [
          r.date,
          r.name || '—',
          r.fuelTypeName,
          formatDecimal(r.price),
          formatDecimal(r.totalLiters),
          formatDecimal(r.totalAmount),
          formatDecimal(r.usdAmount),
        ]),
        foot: [
          [
            'Subtotal',
            '',
            '',
            '',
            formatDecimal(customerGivenGrand.liters),
            formatDecimal(customerGivenGrand.amount),
            formatDecimal(customerGivenGrand.usd),
          ],
        ],
        showFoot: 'lastPage',
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        footStyles: { fillColor: false, textColor: [6, 78, 59], fontStyle: 'bold', lineColor: [203, 213, 225], lineWidth: 0.6 },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
      })
      y = afterLastTable(y + 110)
    }

    if (pdfIncludeGenerator && generatorRows.length > 0) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('Generator Usage', margin, y, { align: 'left' })
      autoTable(doc, {
        startY: y + 6,
        head: [['Date', 'Fuel type', 'Station', 'Liters']],
        body: generatorRows.map((r) => [
          new Date(r.date).toLocaleString(),
          r.fuelTypeId != null ? (fuelNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`) : '—',
          stationNameById.get(r.stationId) ?? `#${r.stationId}`,
          formatDecimal(Number(r.ltrUsage)),
        ]),
        foot: [['Total', '', '', formatDecimal(generatorGrandLiters)]],
        showFoot: 'lastPage',
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        footStyles: { fillColor: false, textColor: [6, 78, 59], fontStyle: 'bold', lineColor: [203, 213, 225], lineWidth: 0.6 },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
      })
      y = afterLastTable(y + 110)
    }

    if (pdfIncludeInventory && inventoryRows.length > 0) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('Inventory', margin, y, { align: 'left' })
      autoTable(doc, {
        startY: y + 6,
        head: [['Type fuel', 'Pump', 'Opening', 'Closing']],
        body: inventoryRows.map((r) => [r.fuelType, r.pump, formatDecimal(r.opening), formatDecimal(r.closing)]),
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
      })
      y = afterLastTable(y + 110)
    }

    if (pdfIncludeDipping && dippingDailyRows.length > 0) {
      ensureSectionStart()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('Dipping Daily Report', margin, y, { align: 'left' })
      autoTable(doc, {
        startY: y + 6,
        head: [['Name', 'Fuel type', 'Liters']],
        body: dippingDailyRows.map((r) => [r.name, r.fuelType, formatDecimal(r.liters)]),
        // foot: [['Total', '', formatDecimal(dippingDailyGrandLiters)]],
        showFoot: 'lastPage',
        styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        // footStyles: { fillColor: false, textColor: [6, 78, 59], fontStyle: 'bold', lineColor: [203, 213, 225], lineWidth: 0.6 },
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: drawFooter,
      })
    }
    openPdfInNewTab(doc)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">General daily report</h1>
          <p className="mt-1 text-sm text-slate-600">
            Includes customer given fuel. Cash out details are inside Daily summary.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenPdf}
          disabled={dateRangeInvalid || !hasAnyReportData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Open PDF
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
            <FormSelect
              options={(businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
              value={(businessesData?.items ?? [])
                .map((b) => ({ value: String(b.id), label: b.name }))
                .find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
              onChange={(o) => setReportBusinessId(o ? Number(o.value) : null)}
              placeholder="Select business"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {showStationPicker && (
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(superStationId ?? '')) ?? stationOptions[0] ?? null}
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

      <div className="max-w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">Daily cash sales</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={pdfIncludeCashSales}
              onChange={(e) => setPdfIncludeCashSales(e.target.checked)}
            />
            Include in PDF
          </label>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[1180px] w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">SSP Price</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">USD Price</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">SSP Liters</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">USD Liters</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">SSP Amount</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">USD Amount</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Rate</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">SspToUsd</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Final USD</th>
              <th className="whitespace-nowrap px-4 py-2 text-left font-semibold text-slate-700">Reference evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dailyCashRows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-slate-500">
                  No daily cash sales rows.
                </td>
              </tr>
            )}
            {dailyCashRows.map((r, rowIdx) => {
              const isLastForDate = dailyCashSalesEvidenceLayout.lastIndexByDate.get(r.date) === rowIdx
              const evidenceIds = isLastForDate ? (dailyCashSalesEvidenceLayout.saleIdsByDate.get(r.date) ?? []) : []
              return (
                <tr key={`${r.date}-${r.name}-${r.sspFuelPrice}-${r.usdFuelPrice}`}>
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.sspFuelPrice)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.usdFuelPrice)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.sspLiters)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.usdLiters)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {localCurrencySymbol}
                    {formatDecimal(r.sspAmount)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">${formatDecimal(r.usdAmount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.rateLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">${formatDecimal(r.sspToUsd)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-700">${formatDecimal(r.finalUsd)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-left">
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
          {dailyCashRows.length > 0 && (
            <tfoot className="border-t border-slate-300 bg-emerald-50/50">
              <tr>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 font-semibold text-slate-900">Subtotal</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                  {formatDecimal(dailyCashGrand.sspLiters)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                  {formatDecimal(dailyCashGrand.usdLiters)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {localCurrencySymbol}
                  {formatDecimal(dailyCashGrand.subtotalLocal)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  ${formatDecimal(dailyCashGrand.totalDollar)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-600">—</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  ${formatDecimal(dailyCashGrand.sspToUsd)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  ${formatDecimal(dailyCashGrand.finalUsd)}
                </td>
                <td className="px-4 py-2 text-slate-500">—</td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {(dailyCashRows.length > 0 ||
        cashOutLines.length > 0 ||
        Math.abs(dailySummary.previousBalanceLocal) > 1e-9 ||
        Math.abs(dailySummary.previousBalanceUsd) > 1e-9) && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-800">Daily summary</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={pdfIncludeDailySummary}
                onChange={(e) => setPdfIncludeDailySummary(e.target.checked)}
              />
              Include in PDF
            </label>
          </div>
          <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="bg-white">
                <th className="border border-slate-300 px-4 py-2 text-left text-base font-medium text-slate-900">
                  Previous Balance
                </th>
                <td className="border border-slate-300 px-4 py-2 text-center text-base font-medium tabular-nums text-slate-900">
                  {localCurrencyCode}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-xl font-medium tabular-nums text-red-600">
                  {formatDecimal(dailySummary.previousBalanceLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-base font-medium tabular-nums text-slate-900">
                  USD
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-xl font-medium tabular-nums text-red-600">
                  {formatDecimal(dailySummary.previousBalanceUsd)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">
                  SSP to USD
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">
                  Liter Sold (USD)
                </td>
              </tr>
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-base text-slate-900">Total Daily Cash Sales ({localCurrencyCode})</td>
                <td colSpan={3} className="border border-slate-300 px-4 py-2 text-left text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.salesLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-center text-base font-medium tabular-nums text-slate-900">—</td>
                <td className="border border-slate-300 px-4 py-2 text-right text-xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.salesSspToUsd)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-right text-xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.salesUsd)}
                </td>
              </tr>
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-base text-slate-900">Total Sales ({localCurrencyCode})</td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-left text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.salesLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-right tabular-nums text-slate-900">—</td>
                <td className="border border-slate-300 px-4 py-2 text-right tabular-nums text-slate-900">—</td>
                <td className="border border-slate-300 px-4 py-2 text-right tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.salesSspToUsd)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-right text-xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.salesUsd)}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="border border-slate-300 px-4 py-2 text-lg font-medium text-slate-900">
                  Cash Out
                </td>
              </tr>
              <tr className="bg-white">
                <th className="border border-slate-300 px-4 py-2 text-left text-base font-medium text-slate-900">Description</th>
                <th className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">Currency</th>
                <th className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">Amount</th>
                <th className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">Rate</th>
                <th colSpan={3} className="border border-slate-300 px-4 py-2 text-center text-base font-medium text-slate-900">
                  USD
                </th>
              </tr>
              {dailySummaryCashOutLines.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-slate-300 px-4 py-5 text-center text-slate-500">
                    {cashOutLoading || dailySummaryLoading ? 'Loading…' : 'No cash out rows.'}
                  </td>
                </tr>
              )}
              {dailySummaryCashOutLines.map((r) => (
                <tr key={r.id}>
                  <td className="border border-slate-300 px-4 py-2 text-base text-slate-900">{r.description || '—'}</td>
                  <td className="border border-slate-300 px-4 py-2 text-right text-lg tabular-nums text-slate-900">
                    {(r.currencyCode || 'USD').toUpperCase()}
                  </td>
                  <td className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                    {formatDecimal(r.localAmount)}
                  </td>
                  <td className="border border-slate-300 px-4 py-2 text-right text-lg tabular-nums text-slate-900">
                    {(r.currencyCode || '').trim().toUpperCase() === 'USD'
                      ? '------'
                      : r.rate > 1e-9
                        ? formatDecimal(r.rate)
                        : '------'}
                  </td>
                  <td colSpan={3} className="border border-slate-300 px-4 py-2 text-right text-lg tabular-nums text-slate-900">
                    {(r.currencyCode || '').trim().toUpperCase() === 'USD'
                      ? `$${formatDecimal(r.localAmount)}`
                      : `$${formatDecimal(r.amountUsd)}`}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Cash Out</td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.outLocal)}
                </td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Cash Out As USD</td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.outAsUsd)}
                </td>
              </tr>
              <tr>
                <th colSpan={4} className="border border-slate-300 px-4 py-2 text-center text-2xl font-medium text-slate-900">
                  Total Cash Balance ({localCurrencyCode})
                </th>
                <th colSpan={3} className="border border-slate-300 px-4 py-2 text-center text-2xl font-medium text-slate-900">
                  Total Dollar Balance (USD)
                </th>
              </tr>
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Sales</td>
                <td colSpan={3} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.salesLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2" />
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.salesUsd)}
                </td>
              </tr>
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Cash Out</td>
                <td colSpan={3} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.outLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Dollar Out</td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.outUsd)}
                </td>
              </tr>
              <tr className="font-medium">
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Cash Balance</td>
                <td colSpan={3} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  {formatDecimal(dailySummary.balanceLocal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-2xl text-slate-900">Total Balance</td>
                <td colSpan={2} className="border border-slate-300 px-4 py-2 text-right text-2xl tabular-nums text-slate-900">
                  ${formatDecimal(dailySummary.balanceUsd)}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <div className="hidden border-t border-slate-200 px-4 py-3">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Currency</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Rate</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashOutLines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-5 text-center text-slate-500">
                      {cashOutLoading ? 'Loading…' : 'No cash out rows.'}
                    </td>
                  </tr>
                )}
                {cashOutLines.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.description || '—'}</td>
                    <td className="px-4 py-2">{(r.currencyCode || 'USD').toUpperCase()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.localAmount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.rate > 1e-9 ? formatDecimal(r.rate) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.amountUsd > 1e-9 ? `$${formatDecimal(r.amountUsd)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {cashOutLines.length > 0 && (
                <tfoot className="border-t border-slate-300 bg-slate-100/80">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-semibold text-slate-900">
                      Total Cash Out
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                      {formatDecimal(cashOutTotals.local)}
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                      ${formatDecimal(cashOutTotals.usdCurrencyOnly)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">Inventory</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={pdfIncludeInventory}
              onChange={(e) => setPdfIncludeInventory(e.target.checked)}
            />
            Include in PDF
          </label>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[760px] w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Type fuel</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Pump</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Opening</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventoryRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No inventory rows.
                </td>
              </tr>
            )}
            {inventoryRows.map((r, idx) => (
              <tr key={`${r.fuelType}-${r.pump}-${idx}`}>
                <td className="px-4 py-2">{r.fuelType}</td>
                <td className="px-4 py-2">{r.pump}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.opening)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">Customer given fuel</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={pdfIncludeCustomerGiven}
              onChange={(e) => setPdfIncludeCustomerGiven(e.target.checked)}
            />
            Include in PDF
          </label>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[980px] w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Fuel type</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Price</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Liters</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Usd amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dailyGivenRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {givenLoading ? 'Loading…' : 'No customer given fuel rows.'}
                </td>
              </tr>
            )}
            {dailyGivenRows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2">{r.name?.trim() ? r.name : '—'}</td>
                <td className="px-4 py-2">{r.fuelTypeName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.price)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.totalLiters)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.totalAmount)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(r.usdAmount)}</td>
              </tr>
            ))}
          </tbody>
          {dailyGivenRows.length > 0 && (
            <tfoot className="border-t border-slate-300 bg-emerald-50/50">
              <tr>
                <td colSpan={5} className="px-4 py-2 font-semibold text-slate-900">
                  Subtotal
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {formatDecimal(customerGivenGrand.amount)}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {formatDecimal(customerGivenGrand.usd)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">Generator usage</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={pdfIncludeGenerator}
              onChange={(e) => setPdfIncludeGenerator(e.target.checked)}
            />
            Include in PDF
          </label>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[760px] w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Fuel type</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Liters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {generatorRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  {generatorLoading ? 'Loading…' : 'No generator usage rows.'}
                </td>
              </tr>
            )}
            {generatorRows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{new Date(r.date).toLocaleString()}</td>
                <td className="px-4 py-2">
                  {r.fuelTypeId != null ? (fuelNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`) : '—'}
                </td>
                <td className="px-4 py-2">{stationNameById.get(r.stationId) ?? `#${r.stationId}`}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(Number(r.ltrUsage))}</td>
              </tr>
            ))}
          </tbody>
          {generatorRows.length > 0 && (
            <tfoot className="border-t border-slate-300 bg-emerald-50/50">
              <tr>
                <td colSpan={3} className="px-4 py-2 font-semibold text-slate-900">Total</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">
                  {formatDecimal(generatorGrandLiters)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold text-slate-800">Dipping daily report</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={pdfIncludeDipping}
              onChange={(e) => setPdfIncludeDipping(e.target.checked)}
            />
            Include in PDF
          </label>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[760px] w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Fuel type</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Liters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dippingDailyRows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No depping daily rows.
                </td>
              </tr>
            )}
            {dippingDailyRows.map((r, idx) => (
              <tr key={`${r.name}-${r.fuelType}-${idx}`}>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.fuelType}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-900">{formatDecimal(r.liters)}</td>
              </tr>
            ))}
          </tbody>
         
        </table>
        </div>
      </div>
    </div>
  )
}
