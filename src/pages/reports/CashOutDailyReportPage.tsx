import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  useGetBusinessesQuery,
  useGetCashOutDailyReportQuery,
  useGetCurrenciesQuery,
  useGetFuelPricesQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { FileText } from 'lucide-react'
import { formatCurrency, formatWithCurrencySymbol } from '../../lib/formatNumber'
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

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function CashOutDailyReportPage({
  expenseType,
  title = 'Cash out daily report',
  tableTitle = 'Cash out',
}: {
  expenseType?: 'Expense' | 'Exchange' | 'cashOrUsdTaken'
  title?: string
  tableTitle?: string
} = {}) {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const showStationCol = showStationColumnInTables(role)
  const effectiveStationId = useEffectiveStationId()
  const tableColCount = showStationCol ? 6 : 5

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: currencies = [] } = useGetCurrenciesQuery()

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

  const { data: fuelPrices = [] } = useGetFuelPricesQuery({
    filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
    filterStationId: apiStationId != null && apiStationId > 0 ? apiStationId : undefined,
  })

  const dateRangeInvalid = Boolean(from && to) && from > to

  const { data, isFetching, isError } = useGetCashOutDailyReportQuery(
    {
      businessId: effectiveBusinessId,
      from: !dateRangeInvalid && from ? `${from}T00:00:00` : undefined,
      to: !dateRangeInvalid && to ? `${to}T00:00:00` : undefined,
      expenseType,
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

  const symbolByStationId = useMemo(() => {
    const curById = new Map(currencies.map((c) => [c.id, c.symbol]))
    const m = new Map<number, string>()
    for (const fp of fuelPrices) {
      if (effectiveBusinessId > 0 && fp.businessId !== effectiveBusinessId) continue
      const symbol = curById.get(fp.currencyId)
      if (!symbol) continue
      if (!m.has(fp.stationId)) m.set(fp.stationId, symbol)
    }
    return m
  }, [fuelPrices, currencies, effectiveBusinessId])

  const lines = data?.lines ?? []
  const businessName = useMemo(() => {
    if (effectiveBusinessId <= 0) return 'Business'
    return (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name ?? `#${effectiveBusinessId}`
  }, [businessesData?.items, effectiveBusinessId])

  function handleOpenPdf() {
    if (dateRangeInvalid || lines.length === 0) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 48
    const headerH = 150
    const today = new Date().toLocaleDateString('en-CA')
    let startY = headerH + 54

    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text((businessName || 'Gas Station').toUpperCase(), pageW / 2, 52, { align: 'center' })
    doc.setFontSize(14)
    doc.text('CASH OUT DAILY REPORT', pageW / 2, 80, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(13)
    doc.text('Daily', pageW / 2, 106, { align: 'center' })
    doc.setFontSize(12)
    doc.text(`${from || '…'} ! ${to || '…'}`, pageW / 2, 130, { align: 'center' })

    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
   
    doc.setFont('helvetica', 'normal')
    doc.text(
      apiStationId != null && apiStationId > 0 ? (stationNameById.get(apiStationId) ?? `#${apiStationId}`) : 'All stations',
      margin,
      startY,
    )
    doc.text(today, pageW - margin, startY, { align: 'right' })
    startY += 14

    const head = [['Date', 'Description', 'Amount', 'Rate', 'Amount (USD)', ...(showStationCol ? ['Station'] : [])]]
    const body = lines.map((row) => [
      row.date,
      row.description || '—',
      formatWithCurrencySymbol(row.localAmount, symbolByStationId.get(row.stationId)),
      row.rate > 1e-9 ? formatWithCurrencySymbol(row.rate, symbolByStationId.get(row.stationId)) : '—',
      Math.abs(row.amountUsd) > 1e-9 ? formatCurrency(row.amountUsd, 'USD') : '—',
      ...(showStationCol ? [stationNameById.get(row.stationId) ?? `#${row.stationId}`] : []),
    ])

    autoTable(doc, {
      startY: startY + 8,
      head,
      body,
      foot: [[
        'Total cash out',
        '',
        formatWithCurrencySymbol(
          data?.totalCashOut ?? 0,
          lines[0] ? symbolByStationId.get(lines[0].stationId) : undefined,
        ),
        '',
        formatCurrency(data?.totalCashOutUsd ?? lines.reduce((s, x) => s + x.amountUsd, 0), 'USD'),
        ...(showStationCol ? [''] : []),
      ]],
      showFoot: 'lastPage',
      styles: { fontSize: 10, cellPadding: 5, textColor: [31, 41, 55] },
      headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 78, 59], fontStyle: 'bold' },
      theme: 'striped',
      margin: { left: margin, right: margin, bottom: 60 },
      didDrawPage: (tableData) => {
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
      },
    })

    openPdfInNewTab(doc)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
          {title}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenPdf}
          disabled={lines.length === 0 || dateRangeInvalid || isFetching}
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
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">{tableTitle}</div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Rate</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount (USD)</th>
              {showStationCol ? (
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={tableColCount} className="px-4 py-8 text-center text-slate-500">
                  {isFetching ? 'Loading…' : needsWorkspaceStation ? '—' : 'No rows in this range.'}
                </td>
              </tr>
            )}
            {lines.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 whitespace-nowrap text-slate-800">{row.date}</td>
                <td className="px-4 py-2 text-slate-800">{row.description || '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                  {formatWithCurrencySymbol(row.localAmount, symbolByStationId.get(row.stationId))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {row.rate > 1e-9
                    ? formatWithCurrencySymbol(row.rate, symbolByStationId.get(row.stationId))
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {Math.abs(row.amountUsd) > 1e-9 ? formatCurrency(row.amountUsd, 'USD') : '—'}
                </td>
                {showStationCol ? (
                  <td className="px-4 py-2 text-slate-600">
                    {stationNameById.get(row.stationId) ?? `#${row.stationId}`}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-4 py-2 font-semibold text-slate-900">
                  Total cash out
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                  {formatWithCurrencySymbol(
                    data?.totalCashOut ?? 0,
                    lines[0] ? symbolByStationId.get(lines[0].stationId) : undefined,
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">—</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900">
                  {formatCurrency(
                    data?.totalCashOutUsd ?? lines.reduce((s, x) => s + x.amountUsd, 0),
                    'USD',
                  )}
                </td>
                {showStationCol ? <td className="px-4 py-2" /> : null}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
