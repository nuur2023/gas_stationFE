import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import {
  useGetBusinessesQuery,
  useGetDailyStationReportQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms } from '../../lib/stationContext'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function DailyStationReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [stationId, setStationId] = useState<number | null>(null)
  const [includeFuelPrices, setIncludeFuelPrices] = useState(true)
  const [includeExpenseFromStation, setIncludeExpenseFromStation] = useState(true)
  const [includeFuelReport, setIncludeFuelReport] = useState(true)
  const [includeExchangeFromStation, setIncludeExchangeFromStation] = useState(true)
  const [includeCashTakenFromStation, setIncludeCashTakenFromStation] = useState(true)
  const [includeExpenseFromOffice, setIncludeExpenseFromOffice] = useState(true)
  const [includeExchangeFromOffice, setIncludeExchangeFromOffice] = useState(true)

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

  useEffect(() => {
    const items = stationsData?.items ?? []
    if (items.length === 0) return
    setStationId((prev) => (prev != null && items.some((s) => s.id === prev) ? prev : items[0].id))
  }, [stationsData?.items])

  const report = useGetDailyStationReportQuery(
    {
      businessId: effectiveBusinessId,
      stationId: stationId ?? undefined,
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T00:00:00` : undefined,
    },
    { skip: effectiveBusinessId <= 0 || !stationId },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )

  const d = report.data
  const selectedBusinessName =
    (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name?.trim() || 'GAS STATION'

  function openPdf() {
    if (!d) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, 120, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(32)
    doc.text((selectedBusinessName || 'GAS STATION').toUpperCase(), pageW / 2, 38, { align: 'center' })
    doc.setFontSize(20)
    doc.text((d.stationName || 'STATION').toUpperCase(), pageW / 2, 64, { align: 'center' })
    doc.setFontSize(14)
    doc.text('DAILY STATION REPORT', pageW / 2, 86, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`${d.from} | ${d.to}`, pageW / 2, 108, { align: 'center' })

    let y = 138
    const margin = { left: 36, right: 36 }
    const section = (title: string, head: string[], body: Array<Array<string | number>>) => {
      if (!body.length) return
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(title, 36, y)
      autoTable(doc, {
        startY: y + 8,
        head: [head],
        body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [225, 225, 225], textColor: [15, 23, 42] },
        bodyStyles: { fillColor: [245, 245, 245], textColor: [15, 23, 42] },
        margin,
      })
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 18
    }

    if (includeFuelPrices) {
      section('FUEL PRICES', ['Fuel', 'SSP', 'USD'], [
        ['Petrol', formatDecimal(d.fuelPrices.petrolSsp), formatDecimal(d.fuelPrices.petrolUsd)],
        ['Diesel', formatDecimal(d.fuelPrices.dieselSsp), formatDecimal(d.fuelPrices.dieselUsd)],
      ])
    }
    if (includeExpenseFromStation) {
      section('EXPENSE FROM STATION', ['Amount', 'Description', 'Date'], d.expenseFromStation.map((x) => [formatDecimal(x.amount), x.description || '—', x.date]))
    }
    if (includeFuelReport) {
      section('FUEL REPORT', ['Type', 'Liters sold', 'SSP', 'USD', 'In Dipping', 'Date'], d.fuelReport.map((x) => [x.type, formatDecimal(x.litersSold), formatDecimal(x.ssp), formatDecimal(x.usd), formatDecimal(x.inDipping), x.date]))
    }
    if (includeExchangeFromStation) {
      section('EXCHANGE FROM STATION', ['Amount SSP', 'Rate', 'USD', 'Date'], d.exchangeFromStation.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.rate), formatDecimal(x.usd), x.date]))
    }
    if (includeCashTakenFromStation) {
      section('CASH TAKEN FROM STATION', ['Amount SSP', 'Amount USD', 'Date'], d.cashTakenFromStation.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.amountUsd), x.date]))
    }
    if (includeExpenseFromOffice) {
      section('EXPENSE FROM OFFICE', ['Amount', 'Description', 'Date'], d.expenseFromOffice.map((x) => [formatDecimal(x.amount), x.description || '—', x.date]))
    }
    if (includeExchangeFromOffice) {
      section('EXCHANGE FROM OFFICE', ['Amount SSP', 'Rate', 'USD', 'Date'], d.exchangeFromOffice.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.rate), formatDecimal(x.usd), x.date]))
    }

    openPdfInNewTab(doc)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Daily station report</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!d}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Open PDF
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(reportBusinessId ?? '')) ?? null}
              onChange={(o) => {
                setReportBusinessId(o ? Number(o.value) : null)
                setStationId(null)
              }}
              placeholder="Select business"
            />
          </div>
        )}
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
          <FormSelect
            options={stationOptions}
            value={stationOptions.find((o) => o.value === String(stationId ?? '')) ?? null}
            onChange={(o) => setStationId(o ? Number(o.value) : null)}
            placeholder="Select station"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Include tables in PDF</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeFuelPrices} onChange={(e) => setIncludeFuelPrices(e.target.checked)} /> Fuel Prices</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeExpenseFromStation} onChange={(e) => setIncludeExpenseFromStation(e.target.checked)} /> Expense From Station</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeFuelReport} onChange={(e) => setIncludeFuelReport(e.target.checked)} /> Fuel Report</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeExchangeFromStation} onChange={(e) => setIncludeExchangeFromStation(e.target.checked)} /> Exchange From Station</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeCashTakenFromStation} onChange={(e) => setIncludeCashTakenFromStation(e.target.checked)} /> Cash Taken From Station</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeExpenseFromOffice} onChange={(e) => setIncludeExpenseFromOffice(e.target.checked)} /> Expense From Office</label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeExchangeFromOffice} onChange={(e) => setIncludeExchangeFromOffice(e.target.checked)} /> Exchange From Office</label>
        </div>
      </div>

      {!d && <p className="text-sm text-slate-600">{report.isFetching ? 'Loading…' : 'No data found for selected inputs.'}</p>}

      {d && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Fuel Prices</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">Fuel</th>
                  <th className="px-4 py-2 text-left">SSP</th>
                  <th className="px-4 py-2 text-left">USD</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="px-4 py-2">Petrol</td><td className="px-4 py-2">{formatDecimal(d.fuelPrices.petrolSsp)}</td><td className="px-4 py-2">{formatDecimal(d.fuelPrices.petrolUsd)}</td></tr>
                <tr className="border-t"><td className="px-4 py-2">Diesel</td><td className="px-4 py-2">{formatDecimal(d.fuelPrices.dieselSsp)}</td><td className="px-4 py-2">{formatDecimal(d.fuelPrices.dieselUsd)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Expense From Station</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Amount</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.expenseFromStation.length ? d.expenseFromStation : [{ amount: 0, description: '', date: d.from }]).map((r, i) => <tr key={`efs-${i}`} className="border-t"><td className="px-4 py-2">{formatDecimal(r.amount)}</td><td className="px-4 py-2">{r.description || '—'}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Fuel Report</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Liters sold</th><th className="px-4 py-2 text-left">SSP</th><th className="px-4 py-2 text-left">USD</th><th className="px-4 py-2 text-left">In Dipping</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.fuelReport.length ? d.fuelReport : [{ type: '—', litersSold: 0, ssp: 0, usd: 0, inDipping: 0, date: d.from }]).map((r, i) => <tr key={`fuel-${i}`} className="border-t"><td className="px-4 py-2">{r.type}</td><td className="px-4 py-2">{formatDecimal(r.litersSold)}</td><td className="px-4 py-2">{formatDecimal(r.ssp)}</td><td className="px-4 py-2">{formatDecimal(r.usd)}</td><td className="px-4 py-2">{formatDecimal(r.inDipping)}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Exchange From Station</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Amount SSP</th><th className="px-4 py-2 text-left">Rate</th><th className="px-4 py-2 text-left">USD</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.exchangeFromStation.length ? d.exchangeFromStation : [{ amountSsp: 0, rate: 0, usd: 0, date: d.from }]).map((r, i) => <tr key={`ex-st-${i}`} className="border-t"><td className="px-4 py-2">{formatDecimal(r.amountSsp)}</td><td className="px-4 py-2">{formatDecimal(r.rate)}</td><td className="px-4 py-2">{formatDecimal(r.usd)}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Cash Taken From Station</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Amount SSP</th><th className="px-4 py-2 text-left">Amount USD</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.cashTakenFromStation.length ? d.cashTakenFromStation : [{ amountSsp: 0, amountUsd: 0, date: d.from }]).map((r, i) => <tr key={`cash-st-${i}`} className="border-t"><td className="px-4 py-2">{formatDecimal(r.amountSsp)}</td><td className="px-4 py-2">{formatDecimal(r.amountUsd)}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Expense From Office</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Amount</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.expenseFromOffice.length ? d.expenseFromOffice : [{ amount: 0, description: '', date: d.from }]).map((r, i) => <tr key={`efs-off-${i}`} className="border-t"><td className="px-4 py-2">{formatDecimal(r.amount)}</td><td className="px-4 py-2">{r.description || '—'}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Exchange From Office</div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-2 text-left">Amount SSP</th><th className="px-4 py-2 text-left">Rate</th><th className="px-4 py-2 text-left">USD</th><th className="px-4 py-2 text-left">Date</th></tr></thead>
              <tbody>{(d.exchangeFromOffice.length ? d.exchangeFromOffice : [{ amountSsp: 0, rate: 0, usd: 0, date: d.from }]).map((r, i) => <tr key={`ex-off-${i}`} className="border-t"><td className="px-4 py-2">{formatDecimal(r.amountSsp)}</td><td className="px-4 py-2">{formatDecimal(r.rate)}</td><td className="px-4 py-2">{formatDecimal(r.usd)}</td><td className="px-4 py-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

