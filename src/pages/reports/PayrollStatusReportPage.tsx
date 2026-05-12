import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useGetBusinessesQuery, useGetPayrollStatusReportQuery, useGetStationsQuery } from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms, showStationPickerInForms } from '../../lib/stationContext'
import type { PayrollEmployeeStatusRow } from '../../types/models'

function currentPeriodYYYYMM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

export type PayrollStatusMode = 'paid' | 'unpaid'

export function PayrollStatusReportPage({ mode }: { mode: PayrollStatusMode }) {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterStationId, setFilterStationId] = useState<number | null>(null)
  const [period, setPeriod] = useState(currentPeriodYYYYMM)

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

  const report = useGetPayrollStatusReportQuery(
    {
      businessId: effectiveBusinessId,
      period: period.trim() || currentPeriodYYYYMM(),
      ...(filterStationId != null && filterStationId > 0 ? { stationId: filterStationId } : {}),
    },
    { skip: effectiveBusinessId <= 0 || !period.trim() },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) all.push({ value: String(s.id), label: s.name })
    return all
  }, [stationsData?.items])

  const rows: PayrollEmployeeStatusRow[] = mode === 'paid' ? (report.data?.paid ?? []) : (report.data?.unpaid ?? [])
  const title = mode === 'paid' ? 'Paid employees (period)' : 'Unpaid employees (period)'
  const pdfTitle = mode === 'paid' ? 'PAYROLL — PAID' : 'PAYROLL — UNPAID'

  const selectedBusinessName =
    (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name?.trim() || 'Business'

  function openPdf() {
    if (!report.data) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, 100, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text((selectedBusinessName || 'BUSINESS').toUpperCase(), pageW / 2, 34, { align: 'center' })
    doc.setFontSize(14)
    doc.text(pdfTitle, pageW / 2, 58, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Period ${report.data.period}`, pageW / 2, 78, { align: 'center' })

    const sideMargin = 24
    autoTable(doc, {
      startY: 112,
      head: [['Employee', 'Phone', 'Position', 'Period charged', 'Period paid', 'Outstanding', 'Last pay']],
      body: rows.map((r) => [
        r.name,
        r.phone?.trim() || '—',
        r.position?.trim() || '—',
        formatDecimal(r.totalCharged),
        formatDecimal(r.totalPaid),
        formatDecimal(r.balance),
        r.lastPaymentDate?.trim() || '—',
      ]),
      foot: [
        [
          { content: 'Totals', colSpan: 3, styles: { fontStyle: 'bold' } },
          { content: formatDecimal(rows.reduce((a, x) => a + x.totalCharged, 0)), styles: { fontStyle: 'bold' } },
          { content: formatDecimal(rows.reduce((a, x) => a + x.totalPaid, 0)), styles: { fontStyle: 'bold' } },
          { content: formatDecimal(rows.reduce((a, x) => a + x.balance, 0)), styles: { fontStyle: 'bold' } },
          '',
        ],
      ],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [225, 225, 225], textColor: [15, 23, 42] },
      margin: { left: sideMargin, right: sideMargin, bottom: 60 },
      didDrawPage: (tableData) => {
        const pW = doc.internal.pageSize.getWidth()
        const pH = doc.internal.pageSize.getHeight()
        const lineY = pH - 34
        doc.setDrawColor(21, 128, 122)
        doc.setLineWidth(1)
        doc.line(sideMargin, lineY, pW - sideMargin, lineY)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text('Powered by abaalsoftware', sideMargin, lineY + 15)
        doc.text(`Page | ${tableData.pageNumber}`, pW - sideMargin, lineY + 15, { align: 'right' })
      },
    })
    openPdfInNewTab(doc)
  }

  const totalCharged = rows.reduce((a, x) => a + x.totalCharged, 0)
  const totalPaid = rows.reduce((a, x) => a + x.totalPaid, 0)
  const totalOutstanding = rows.reduce((a, x) => a + x.balance, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!report.data || rows.length === 0}
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
                setFilterStationId(null)
              }}
              placeholder="Select business"
            />
          </div>
        )}
        {showStationPicker && (
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(filterStationId ?? '')) ?? stationOptions[0] ?? null}
              onChange={(o) => setFilterStationId(o && o.value ? Number(o.value) : null)}
              placeholder="All stations"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Period</label>
          <input
            type="month"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={period.length >= 7 ? period.slice(0, 7) : period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {report.isFetching ? (
          <p className="p-4 text-sm text-slate-600">Loading…</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employee</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Phone</th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">Period charged</th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">Period paid</th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">Outstanding</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Last pay</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.employeeId} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="px-3 py-2 text-slate-700">{r.phone?.trim() || '—'}</td>
                  <td className="px-3 py-2 text-right">{formatDecimal(r.totalCharged)}</td>
                  <td className="px-3 py-2 text-right">{formatDecimal(r.totalPaid)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatDecimal(r.balance)}</td>
                  <td className="px-3 py-2 text-slate-700">{r.lastPaymentDate?.trim() || '—'}</td>
                  <td className="px-3 py-2">
                    <Link className="text-emerald-700 hover:underline" to={`/employees/${r.employeeId}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-slate-800">
                  Totals ({rows.length})
                </td>
                <td className="px-3 py-2 text-right text-slate-900">{formatDecimal(totalCharged)}</td>
                <td className="px-3 py-2 text-right text-slate-900">{formatDecimal(totalPaid)}</td>
                <td className="px-3 py-2 text-right text-slate-900">{formatDecimal(totalOutstanding)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
