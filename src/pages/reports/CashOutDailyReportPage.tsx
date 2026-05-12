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

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)
  type SideFilter = 'all' | 'Operation' | 'Management'
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const sideOptions: SelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'All offices' },
      { value: 'Operation', label: 'Operation office' },
      { value: 'Management', label: 'Management office' },
    ],
    [],
  )
  const isManagementFilter = sideFilter === 'Management'

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

  // Management entries are stored business-wide (StationId = NULL), so we never filter by station
  // when the Management filter is active — otherwise the workspace station scope would hide every
  // row. Operation / All keep the station filter unchanged.
  const queryStationId = isManagementFilter ? undefined : apiStationId
  // We can show the Management report regardless of workspace station assignment (those rows are
  // business-level), so the "no workspace station" gate only blocks Operation / All filters.
  const skipForMissingStation = needsWorkspaceStation && !isManagementFilter

  const { data, isFetching, isError } = useGetCashOutDailyReportQuery(
    {
      businessId: effectiveBusinessId,
      from: !dateRangeInvalid && from ? `${from}T00:00:00` : undefined,
      to: !dateRangeInvalid && to ? `${to}T00:00:00` : undefined,
      expenseType,
      stationId: queryStationId,
      ...(sideFilter !== 'all' ? { sideAction: sideFilter } : {}),
    },
    { skip: effectiveBusinessId <= 0 || dateRangeInvalid || skipForMissingStation },
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

  /** Map currency code (uppercased) → display symbol (e.g. SSP, $). USD is always `$`. */
  const symbolByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of currencies) {
      const code = (c.code ?? '').trim().toUpperCase()
      if (!code) continue
      if (!m.has(code)) m.set(code, c.symbol)
    }
    if (!m.has('USD')) m.set('USD', '$')
    return m
  }, [currencies])

  /** Resolve the symbol to render for a row. Falls back to the station's local symbol. */
  function resolveRowSymbol(row: { currencyCode: string; stationId: number | null }): string {
    const code = (row.currencyCode || '').trim().toUpperCase()
    if (code === 'USD') return '$'
    if (code && symbolByCode.has(code)) return symbolByCode.get(code) ?? code
    if (code) return code
    if (row.stationId == null) return ''
    return symbolByStationId.get(row.stationId) ?? ''
  }

  const lines = data?.lines ?? []
  const businessName = useMemo(() => {
    if (effectiveBusinessId <= 0) return 'Business'
    return (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name ?? `#${effectiveBusinessId}`
  }, [businessesData?.items, effectiveBusinessId])

  /**
   * Total local amount per currency, EXCLUDING USD. The Amount column is a local-currency view;
   * USD amounts live in the dedicated "Amount (USD)" column instead, so we never mix them in.
   */
  const localTotalsByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of lines) {
      const code = ((r.currencyCode || 'USD').trim().toUpperCase()) || 'USD'
      if (code === 'USD') continue
      m.set(code, (m.get(code) ?? 0) + (Number(r.localAmount) || 0))
    }
    return m
  }, [lines])

  /** Sum of every row's USD-equivalent amount. AmountUsd is filled by the backend (USD rows mirror their LocalAmount). */
  const grandTotalUsd = useMemo(
    () => lines.reduce((sum, r) => sum + (Number(r.amountUsd) || 0), 0),
    [lines],
  )

  // Management entries have no station context, so drop the Station column when that filter
  // is active to avoid a permanent dash placeholder (applies to both PDF and HTML render).
  const showStationColInTable = showStationCol && !isManagementFilter
  const renderedColCount = showStationColInTable ? 6 : 5

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
    const sideSubtitle =
      sideFilter === 'Operation'
        ? 'Operation office'
        : sideFilter === 'Management'
          ? 'Management office'
          : 'All offices'
    doc.text(`Daily — ${sideSubtitle}`, pageW / 2, 106, { align: 'center' })
    doc.setFontSize(12)
    doc.text(`${from || '…'} ! ${to || '…'}`, pageW / 2, 130, { align: 'center' })

    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
   
    doc.setFont('helvetica', 'normal')
    const stationLine = isManagementFilter
      ? '—'
      : apiStationId != null && apiStationId > 0
        ? (stationNameById.get(apiStationId) ?? `#${apiStationId}`)
        : 'All stations'
    doc.text(stationLine, margin, startY)
    doc.text(today, pageW - margin, startY, { align: 'right' })
    startY += 14

    const head = [['Date', 'Description', 'Amount', 'Rate', 'Amount (USD)', ...(showStationColInTable ? ['Station'] : [])]]
    const body = lines.map((row) => {
      const code = (row.currencyCode || 'USD').trim().toUpperCase()
      const isUsd = code === 'USD'
      const stationLocalSymbol = row.stationId != null ? symbolByStationId.get(row.stationId) : undefined
      const stationLabel = row.stationId != null ? (stationNameById.get(row.stationId) ?? `#${row.stationId}`) : '—'
      return [
        row.date,
        row.description || '—',
        // USD entries have no local-currency component — render 0 in the station's local symbol
        // so the Amount column stays purely "local-currency".
        isUsd
          ? formatWithCurrencySymbol(0, stationLocalSymbol)
          : formatWithCurrencySymbol(row.localAmount, resolveRowSymbol(row)),
        !isUsd && row.rate > 1e-9 ? formatWithCurrencySymbol(row.rate, resolveRowSymbol(row)) : '—',
        Math.abs(row.amountUsd) > 1e-9 ? formatCurrency(row.amountUsd, 'USD') : '—',
        ...(showStationColInTable ? [stationLabel] : []),
      ]
    })

    const firstStationLocalSymbol = lines.length > 0 && lines[0].stationId != null
      ? symbolByStationId.get(lines[0].stationId)
      : undefined
    const totalAmountCell = localTotalsByCurrency.size === 0
      ? formatWithCurrencySymbol(0, firstStationLocalSymbol)
      : [...localTotalsByCurrency.entries()]
          .map(([code, amount]) => formatWithCurrencySymbol(amount, symbolByCode.get(code) ?? code))
          .join('\n')

    autoTable(doc, {
      startY: startY + 8,
      head,
      body,
      foot: [[
        'Total cash out',
        '',
        totalAmountCell,
        '',
        formatCurrency(data?.totalCashOutUsd ?? grandTotalUsd, 'USD'),
        ...(showStationColInTable ? [''] : []),
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
          <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-base text-slate-600">{title}</p>
        </div>
        <button
          type="button"
          onClick={handleOpenPdf}
          disabled={lines.length === 0 || dateRangeInvalid || isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Open PDF
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Business</label>
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
              onChange={(o) => setReportBusinessId(o ? Number(o.value) : null)}
              placeholder="Select business"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">From</label>
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">To</label>
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-600">Office</label>
          <FormSelect
            options={sideOptions}
            value={sideOptions.find((o) => o.value === sideFilter) ?? sideOptions[0]}
            onChange={(o) => setSideFilter(((o?.value as SideFilter) ?? 'all'))}
            placeholder="All offices"
          />
        </div>
        {showStationPicker && !isManagementFilter && (
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-600">Station</label>
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

      {skipForMissingStation && (
        <p className="text-base text-amber-800">
          {showSettingsStationHint ? SETTINGS_STATION_HINT : 'Your account has no station assigned. Contact an administrator.'}
        </p>
      )}
      {dateRangeInvalid && <p className="text-base text-amber-700">&quot;From&quot; must be on or before &quot;To&quot;.</p>}
      {effectiveBusinessId <= 0 && showBizPicker && (
        <p className="text-base text-amber-700">Select a business to load the report.</p>
      )}
      {isError && <p className="text-base text-red-600">Could not load report.</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">{tableTitle}</div>
        <table className="min-w-full divide-y divide-slate-200 text-base">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Rate</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount (USD)</th>
              {showStationColInTable ? (
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Station</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={renderedColCount} className="px-4 py-8 text-center text-slate-500">
                  {isFetching ? 'Loading…' : skipForMissingStation ? '—' : 'No rows in this range.'}
                </td>
              </tr>
            )}
            {lines.map((row) => {
              const code = (row.currencyCode || 'USD').trim().toUpperCase()
              const isUsd = code === 'USD'
              const rowSymbol = resolveRowSymbol(row)
              const stationLocalSymbol = row.stationId != null ? symbolByStationId.get(row.stationId) : undefined
              return (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-800">{row.date}</td>
                  <td className="px-4 py-3 text-slate-800">{row.description || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {isUsd
                      ? formatWithCurrencySymbol(0, stationLocalSymbol)
                      : formatWithCurrencySymbol(row.localAmount, rowSymbol)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {!isUsd && row.rate > 1e-9
                      ? formatWithCurrencySymbol(row.rate, rowSymbol)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {Math.abs(row.amountUsd) > 1e-9 ? formatCurrency(row.amountUsd, 'USD') : '—'}
                  </td>
                  {showStationColInTable ? (
                    <td className="px-4 py-3 text-slate-600">
                      {row.stationId != null
                        ? (stationNameById.get(row.stationId) ?? `#${row.stationId}`)
                        : '—'}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-semibold text-slate-900">
                  Total cash out
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                  {localTotalsByCurrency.size === 0 ? (
                    formatWithCurrencySymbol(
                      0,
                      lines[0] && lines[0].stationId != null ? symbolByStationId.get(lines[0].stationId) : undefined,
                    )
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      {[...localTotalsByCurrency.entries()].map(([code, amount]) => (
                        <span key={code}>
                          {formatWithCurrencySymbol(amount, symbolByCode.get(code) ?? code)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">—</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                  {formatCurrency(data?.totalCashOutUsd ?? grandTotalUsd, 'USD')}
                </td>
                {showStationColInTable ? <td className="px-4 py-3" /> : null}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
