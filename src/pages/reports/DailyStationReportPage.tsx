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
  const [includeSalaryPayments, setIncludeSalaryPayments] = useState(true)
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
    doc.setFontSize(10)
    doc.text('DAILY STATION REPORT', pageW / 2, 86, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`${d.from} | ${d.to}`, pageW / 2, 108, { align: 'center' })

    let y = 138
    const margin = { left: 36, right: 36 }
    const section = (
      title: string,
      head: string[],
      body: Array<Array<string | number>>,
      foot?: Array<string | number>,
    ) => {
      if (!body.length) return
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(title, 36, y)
      autoTable(doc, {
        startY: y + 8,
        head: [head],
        body,
        ...(foot ? { foot: [foot] } : {}),
        showFoot: foot ? 'lastPage' : 'never',
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [225, 225, 225], textColor: [15, 23, 42] },
        bodyStyles: { fillColor: [245, 245, 245], textColor: [15, 23, 42] },
        footStyles: { fillColor: [220, 252, 231], textColor: [6, 95, 70], fontStyle: 'bold' },
        margin,
      })
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 18
    }

    // Pre-compute simple per-section totals for PDF subtotal rows.
    const sumBy = <T,>(arr: T[], pick: (t: T) => number) =>
      arr.reduce((a, b) => a + (Number(pick(b)) || 0), 0)

    if (includeFuelPrices) {
      section('FUEL PRICES', ['Fuel', 'SSP', 'USD'], [
        ['Petrol', formatDecimal(d.fuelPrices.petrolSsp), formatDecimal(d.fuelPrices.petrolUsd)],
        ['Diesel', formatDecimal(d.fuelPrices.dieselSsp), formatDecimal(d.fuelPrices.dieselUsd)],
      ])
    }
    if (includeExpenseFromStation) {
      section(
        'EXPENSE FROM STATION',
        ['Amount', 'Description', 'Date'],
        d.expenseFromStation.map((x) => [formatDecimal(x.amount), x.description || '—', x.date]),
        [formatDecimal(sumBy(d.expenseFromStation, (x) => x.amount)), 'Subtotal', ''],
      )
    }
    if (includeFuelReport) {
      section(
        'FUEL REPORT',
        ['Type', 'Liters sold', 'SSP', 'USD', 'In Dipping', 'Date'],
        d.fuelReport.map((x) => [x.type, formatDecimal(x.litersSold), formatDecimal(x.ssp), formatDecimal(x.usd), formatDecimal(x.inDipping), x.date]),
        [
          'Subtotal',
          formatDecimal(sumBy(d.fuelReport, (x) => x.litersSold)),
          formatDecimal(sumBy(d.fuelReport, (x) => x.ssp)),
          formatDecimal(sumBy(d.fuelReport, (x) => x.usd)),
          formatDecimal(sumBy(d.fuelReport, (x) => x.inDipping)),
          '',
        ],
      )
    }
    if (includeExchangeFromStation) {
      section(
        'EXCHANGE FROM STATION',
        ['Amount SSP', 'Rate', 'USD', 'Date'],
        d.exchangeFromStation.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.rate), formatDecimal(x.usd), x.date]),
        [
          formatDecimal(sumBy(d.exchangeFromStation, (x) => x.amountSsp)),
          'Subtotal',
          formatDecimal(sumBy(d.exchangeFromStation, (x) => x.usd)),
          '',
        ],
      )
    }
    if (includeCashTakenFromStation) {
      section(
        'CASH TAKEN FROM STATION',
        ['Amount SSP', 'Amount USD', 'Date'],
        d.cashTakenFromStation.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.amountUsd), x.date]),
        [
          formatDecimal(sumBy(d.cashTakenFromStation, (x) => x.amountSsp)),
          formatDecimal(sumBy(d.cashTakenFromStation, (x) => x.amountUsd)),
          'Subtotal',
        ],
      )
    }
    const sp = d.salaryPayments ?? []
    if (includeSalaryPayments && sp.length > 0) {
      section(
        'SALARY PAYMENTS (BUSINESS-WIDE)',
        ['Employees', 'Amount', 'Recorded by', 'Date'],
        sp.map((x) => [String(x.employees), formatDecimal(x.amount), x.recordedBy || '—', x.date]),
        [
          String(sp.reduce((a, x) => a + (Number(x.employees) || 0), 0)),
          formatDecimal(sp.reduce((a, x) => a + (Number(x.amount) || 0), 0)),
          'Total',
          '',
        ],
      )
    }
    if (includeExpenseFromOffice) {
      section(
        'EXPENSE FROM OFFICE',
        ['Amount', 'Description', 'Date'],
        d.expenseFromOffice.map((x) => [formatDecimal(x.amount), x.description || '—', x.date]),
        [formatDecimal(sumBy(d.expenseFromOffice, (x) => x.amount)), 'Subtotal', ''],
      )
    }
    if (includeExchangeFromOffice) {
      section(
        'EXCHANGE FROM OFFICE',
        ['Amount SSP', 'Rate', 'USD', 'Date'],
        d.exchangeFromOffice.map((x) => [formatDecimal(x.amountSsp), formatDecimal(x.rate), formatDecimal(x.usd), x.date]),
        [
          formatDecimal(sumBy(d.exchangeFromOffice, (x) => x.amountSsp)),
          'Subtotal',
          formatDecimal(sumBy(d.exchangeFromOffice, (x) => x.usd)),
          '',
        ],
      )
    }

    openPdfInNewTab(doc)
  }

  // Subtotals — sum each numeric column once so we can drop them in a tfoot row.
  const totals = useMemo(() => {
    if (!d) return null
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0)
    return {
      expenseFromStation: sum(d.expenseFromStation.map((x) => x.amount)),
      fuelReport: {
        litersSold: sum(d.fuelReport.map((x) => x.litersSold)),
        ssp: sum(d.fuelReport.map((x) => x.ssp)),
        usd: sum(d.fuelReport.map((x) => x.usd)),
        inDipping: sum(d.fuelReport.map((x) => x.inDipping)),
      },
      exchangeFromStation: {
        ssp: sum(d.exchangeFromStation.map((x) => x.amountSsp)),
        usd: sum(d.exchangeFromStation.map((x) => x.usd)),
      },
      cashTakenFromStation: {
        ssp: sum(d.cashTakenFromStation.map((x) => x.amountSsp)),
        usd: sum(d.cashTakenFromStation.map((x) => x.amountUsd)),
      },
      expenseFromOffice: sum(d.expenseFromOffice.map((x) => x.amount)),
      exchangeFromOffice: {
        ssp: sum(d.exchangeFromOffice.map((x) => x.amountSsp)),
        usd: sum(d.exchangeFromOffice.map((x) => x.usd)),
      },
      salaryPayments: (() => {
        const sp = d.salaryPayments ?? []
        return {
          employees: sum(sp.map((x) => x.employees)),
          amount: sum(sp.map((x) => x.amount)),
        }
      })(),
    }
  }, [d])

  // Shared cell classes — bumped to text-base so the report doesn't look small on a desktop.
  const thCls = 'px-4 py-3 text-left font-semibold text-slate-700'
  const tdCls = 'px-4 py-3 text-slate-800'
  const totalRowTdCls = 'px-4 py-3 font-semibold text-slate-900 bg-slate-50'

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">Daily station report</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!d}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Open PDF
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {showBizPicker && (
          <div className="min-w-[220px]">
            <label className="mb-1 block text-sm font-medium text-slate-600">Business</label>
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
          <label className="mb-1 block text-sm font-medium text-slate-600">Station</label>
          <FormSelect
            options={stationOptions}
            value={stationOptions.find((o) => o.value === String(stationId ?? '')) ?? null}
            onChange={(o) => setStationId(o ? Number(o.value) : null)}
            placeholder="Select station"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">From</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">To</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-base" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-base font-semibold text-slate-800">Include tables in PDF</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeFuelPrices} onChange={(e) => setIncludeFuelPrices(e.target.checked)} /> Fuel Prices</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeExpenseFromStation} onChange={(e) => setIncludeExpenseFromStation(e.target.checked)} /> Expense From Station</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeFuelReport} onChange={(e) => setIncludeFuelReport(e.target.checked)} /> Fuel Report</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeExchangeFromStation} onChange={(e) => setIncludeExchangeFromStation(e.target.checked)} /> Exchange From Station</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeCashTakenFromStation} onChange={(e) => setIncludeCashTakenFromStation(e.target.checked)} /> Cash Taken From Station</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeSalaryPayments} onChange={(e) => setIncludeSalaryPayments(e.target.checked)} /> Salary Payments</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeExpenseFromOffice} onChange={(e) => setIncludeExpenseFromOffice(e.target.checked)} /> Expense From Office</label>
          <label className="inline-flex items-center gap-2 text-base text-slate-700"><input type="checkbox" checked={includeExchangeFromOffice} onChange={(e) => setIncludeExchangeFromOffice(e.target.checked)} /> Exchange From Office</label>
        </div>
      </div>

      {!d && <p className="text-base text-slate-600">{report.isFetching ? 'Loading…' : 'No data found for selected inputs.'}</p>}

      {d && totals && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Fuel Prices</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100">
                <tr>
                  <th className={thCls}>Fuel</th>
                  <th className={thCls}>SSP</th>
                  <th className={thCls}>USD</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className={tdCls}>Petrol</td><td className={tdCls}>{formatDecimal(d.fuelPrices.petrolSsp)}</td><td className={tdCls}>{formatDecimal(d.fuelPrices.petrolUsd)}</td></tr>
                <tr className="border-t"><td className={tdCls}>Diesel</td><td className={tdCls}>{formatDecimal(d.fuelPrices.dieselSsp)}</td><td className={tdCls}>{formatDecimal(d.fuelPrices.dieselUsd)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Fuel Report</div>
            <table className="min-w-[820px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Type</th><th className={thCls}>Liters sold</th><th className={thCls}>SSP</th><th className={thCls}>USD</th><th className={thCls}>In Dipping</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.fuelReport.length ? d.fuelReport : [{ type: '—', litersSold: 0, ssp: 0, usd: 0, inDipping: 0, date: d.from }]).map((r, i) => <tr key={`fuel-${i}`} className="border-t"><td className={tdCls}>{r.type}</td><td className={tdCls}>{formatDecimal(r.litersSold)}</td><td className={tdCls}>{formatDecimal(r.ssp)}</td><td className={tdCls}>{formatDecimal(r.usd)}</td><td className={tdCls}>{formatDecimal(r.inDipping)}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.fuelReport.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>Subtotal</td><td className={totalRowTdCls}>{formatDecimal(totals.fuelReport.litersSold)}</td><td className={totalRowTdCls}>{formatDecimal(totals.fuelReport.ssp)}</td><td className={totalRowTdCls}>{formatDecimal(totals.fuelReport.usd)}</td><td className={totalRowTdCls}>{formatDecimal(totals.fuelReport.inDipping)}</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Expense From Station</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Amount</th><th className={thCls}>Description</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.expenseFromStation.length ? d.expenseFromStation : [{ amount: 0, description: '', date: d.from }]).map((r, i) => <tr key={`efs-${i}`} className="border-t"><td className={tdCls}>{formatDecimal(r.amount)}</td><td className={tdCls}>{r.description || '—'}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.expenseFromStation.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{formatDecimal(totals.expenseFromStation)}</td><td className={totalRowTdCls}>Subtotal</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Exchange From Station</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Amount SSP</th><th className={thCls}>Rate</th><th className={thCls}>USD</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.exchangeFromStation.length ? d.exchangeFromStation : [{ amountSsp: 0, rate: 0, usd: 0, date: d.from }]).map((r, i) => <tr key={`ex-st-${i}`} className="border-t"><td className={tdCls}>{formatDecimal(r.amountSsp)}</td><td className={tdCls}>{formatDecimal(r.rate)}</td><td className={tdCls}>{formatDecimal(r.usd)}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.exchangeFromStation.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{formatDecimal(totals.exchangeFromStation.ssp)}</td><td className={totalRowTdCls}>Subtotal</td><td className={totalRowTdCls}>{formatDecimal(totals.exchangeFromStation.usd)}</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Cash Taken From Station</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Amount SSP</th><th className={thCls}>Amount USD</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.cashTakenFromStation.length ? d.cashTakenFromStation : [{ amountSsp: 0, amountUsd: 0, date: d.from }]).map((r, i) => <tr key={`cash-st-${i}`} className="border-t"><td className={tdCls}>{formatDecimal(r.amountSsp)}</td><td className={tdCls}>{formatDecimal(r.amountUsd)}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.cashTakenFromStation.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{formatDecimal(totals.cashTakenFromStation.ssp)}</td><td className={totalRowTdCls}>{formatDecimal(totals.cashTakenFromStation.usd)}</td><td className={totalRowTdCls}>Subtotal</td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">
              Salary Payments 
            </div>
            
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Employees</th><th className={thCls}>Amount</th><th className={thCls}>Recorded by</th><th className={thCls}>Date</th></tr></thead>
              <tbody>
                {((d.salaryPayments ?? []).length ? (d.salaryPayments ?? []) : [{ employees: 0, amount: 0, recordedBy: '', date: d.from }]).map((r, i) => (
                  <tr key={`sal-${i}`} className="border-t">
                    <td className={tdCls}>{r.employees}</td>
                    <td className={tdCls}>{formatDecimal(r.amount)}</td>
                    <td className={tdCls}>{r.recordedBy?.trim() || '—'}</td>
                    <td className={tdCls}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
              {(d.salaryPayments ?? []).length > 0 && totals && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{totals.salaryPayments.employees}</td><td className={totalRowTdCls}>{formatDecimal(totals.salaryPayments.amount)}</td><td className={totalRowTdCls}>Total</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Expense From Office</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Amount</th><th className={thCls}>Description</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.expenseFromOffice.length ? d.expenseFromOffice : [{ amount: 0, description: '', date: d.from }]).map((r, i) => <tr key={`efs-off-${i}`} className="border-t"><td className={tdCls}>{formatDecimal(r.amount)}</td><td className={tdCls}>{r.description || '—'}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.expenseFromOffice.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{formatDecimal(totals.expenseFromOffice)}</td><td className={totalRowTdCls}>Subtotal</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800">Exchange From Office</div>
            <table className="min-w-[640px] w-full text-base">
              <thead className="bg-slate-100"><tr><th className={thCls}>Amount SSP</th><th className={thCls}>Rate</th><th className={thCls}>USD</th><th className={thCls}>Date</th></tr></thead>
              <tbody>{(d.exchangeFromOffice.length ? d.exchangeFromOffice : [{ amountSsp: 0, rate: 0, usd: 0, date: d.from }]).map((r, i) => <tr key={`ex-off-${i}`} className="border-t"><td className={tdCls}>{formatDecimal(r.amountSsp)}</td><td className={tdCls}>{formatDecimal(r.rate)}</td><td className={tdCls}>{formatDecimal(r.usd)}</td><td className={tdCls}>{r.date}</td></tr>)}</tbody>
              {d.exchangeFromOffice.length > 0 && (
                <tfoot className="border-t-2 border-slate-300"><tr><td className={totalRowTdCls}>{formatDecimal(totals.exchangeFromOffice.ssp)}</td><td className={totalRowTdCls}>Subtotal</td><td className={totalRowTdCls}>{formatDecimal(totals.exchangeFromOffice.usd)}</td><td className={totalRowTdCls}></td></tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

