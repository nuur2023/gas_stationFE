import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  useGetBusinessesQuery,
  useGetEmployeePaymentHistoryReportQuery,
  useGetOperationReportEmployeesQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms, showStationPickerInForms } from '../../lib/stationContext'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultFromDateISO(): string {
  const past = new Date()
  past.setMonth(past.getMonth() - 3)
  return `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
}

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function EmployeePaymentHistoryReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [filterStationId, setFilterStationId] = useState<number | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [from, setFrom] = useState(defaultFromDateISO)
  const [to, setTo] = useState(todayISO)

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

  const { data: employees = [] } = useGetOperationReportEmployeesQuery(
    {
      businessId: effectiveBusinessId,
      ...(filterStationId != null && filterStationId > 0 ? { stationId: filterStationId } : {}),
    },
    { skip: effectiveBusinessId <= 0 },
  )

  useEffect(() => {
    setEmployeeId(null)
  }, [effectiveBusinessId, filterStationId])

  const employeeOptions: SelectOption[] = useMemo(
    () => employees.map((e) => ({ value: String(e.id), label: `${e.name} (#${e.id})` })),
    [employees],
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

  const report = useGetEmployeePaymentHistoryReportQuery(
    {
      businessId: effectiveBusinessId,
      employeeId: employeeId!,
      ...(from ? { from: `${from}T00:00:00` } : {}),
      ...(to ? { to: `${to}T00:00:00` } : {}),
    },
    { skip: effectiveBusinessId <= 0 || employeeId == null || employeeId <= 0 },
  )

  const d = report.data
  const dateRangeInvalid = Boolean(from && to) && from > to

  const selectedBusinessName =
    (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name?.trim() || 'Business'

  function openPdf() {
    if (!d) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, 110, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text((selectedBusinessName || 'BUSINESS').toUpperCase(), pageW / 2, 32, { align: 'center' })
    doc.setFontSize(14)
    doc.text('EMPLOYEE PAYMENT HISTORY', pageW / 2, 56, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const sub = [d.employeeName, d.employeePhone?.trim(), d.employeePosition?.trim()].filter(Boolean).join(' · ')
    doc.text(sub, pageW / 2, 76, { align: 'center' })
    const range = d.from && d.to ? `${d.from} to ${d.to}` : 'Date range'
    doc.text(range, pageW / 2, 94, { align: 'center' })

    const sideMargin = 24
    autoTable(doc, {
      startY: 118,
      head: [['Date', 'Description', 'Period', 'Reference', 'Charged', 'Paid', 'Balance']],
      body: d.rows.map((r) => [
        r.date,
        r.description,
        r.periodLabel?.trim() || '—',
        r.referenceNo?.trim() || '—',
        r.charged > 0 ? formatDecimal(r.charged) : '—',
        r.paid > 0 ? formatDecimal(r.paid) : '—',
        formatDecimal(r.balance),
      ]),
      foot: [
        [
          { content: 'Period subtotals', colSpan: 4, styles: { fontStyle: 'bold' } },
          { content: formatDecimal(d.totalCharged), styles: { fontStyle: 'bold' } },
          { content: formatDecimal(d.totalPaid), styles: { fontStyle: 'bold' } },
          '',
        ],
      ],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [225, 225, 225], textColor: [15, 23, 42] },
      margin: { left: sideMargin, right: sideMargin, bottom: 72 },
      didDrawPage: (tableData) => {
        const pW = doc.internal.pageSize.getWidth()
        const pH = doc.internal.pageSize.getHeight()
        const lineY = pH - 44
        doc.setDrawColor(21, 128, 122)
        doc.setLineWidth(1)
        doc.line(sideMargin, lineY, pW - sideMargin, lineY)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
        doc.text(`Outstanding (lifetime): ${formatDecimal(d.outstandingBalance)}`, sideMargin, lineY + 16)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text('Powered by abaalsoftware', sideMargin, lineY + 32)
        doc.text(`Page | ${tableData.pageNumber}`, pW - sideMargin, lineY + 32, { align: 'right' })
      },
    })
    openPdfInNewTab(doc)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Employee payment history</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!d || dateRangeInvalid}
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Station (picker)</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(filterStationId ?? '')) ?? stationOptions[0] ?? null}
              onChange={(o) => setFilterStationId(o && o.value ? Number(o.value) : null)}
              placeholder="All stations"
            />
          </div>
        )}
        <div className="min-w-[260px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Employee</label>
          <FormSelect
            options={employeeOptions}
            value={employeeOptions.find((o) => o.value === String(employeeId ?? '')) ?? null}
            onChange={(o) => setEmployeeId(o ? Number(o.value) : null)}
            placeholder="Select employee"
            isDisabled={effectiveBusinessId <= 0}
          />
        </div>
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

      {dateRangeInvalid && <p className="text-sm text-amber-700">&quot;From&quot; must be on or before &quot;To&quot;.</p>}
      {!employeeId && <p className="text-sm text-slate-600">Select an employee to load the report.</p>}

      {employeeId != null && employeeId > 0 && !dateRangeInvalid && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-800">Ledger</span>
            <Link className="text-sm text-emerald-700 hover:underline" to={`/employees/${employeeId}`}>
              Employee profile
            </Link>
          </div>
          {report.isFetching ? (
            <p className="p-4 text-sm text-slate-600">Loading…</p>
          ) : !d ? (
            <p className="p-4 text-sm text-slate-600">No data.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Period</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Reference</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Charged</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Paid</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.date}</td>
                    <td className="px-3 py-2 text-slate-800">{r.description}</td>
                    <td className="px-3 py-2 text-slate-600">{r.periodLabel?.trim() || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.referenceNo?.trim() || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-slate-800">
                      {r.charged > 0 ? formatDecimal(r.charged) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-slate-800">
                      {r.paid > 0 ? formatDecimal(r.paid) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-900">
                      {formatDecimal(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-slate-800">
                    Period subtotals
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatDecimal(d.totalCharged)}</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatDecimal(d.totalPaid)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-600">
                    Outstanding (lifetime)
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-900">{formatDecimal(d.outstandingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
