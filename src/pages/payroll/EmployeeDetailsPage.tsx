import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  useGetEmployeeByIdQuery,
  useGetEmployeePaymentHistoryReportQuery,
} from '../../app/api/apiSlice'
import { formatDecimal } from '../../lib/formatNumber'

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

export function EmployeeDetailsPage() {
  const { id: idParam } = useParams()
  const employeeId = Number(idParam)
  const validId = Number.isFinite(employeeId) && employeeId > 0

  const [from, setFrom] = useState(defaultFromDateISO)
  const [to, setTo] = useState(todayISO)

  const { data: employee, isError: empError, isFetching: empLoading } = useGetEmployeeByIdQuery(employeeId, {
    skip: !validId,
  })

  const businessId = employee?.businessId ?? 0
  const history = useGetEmployeePaymentHistoryReportQuery(
    {
      businessId,
      employeeId,
      ...(from ? { from: `${from}T00:00:00` } : {}),
      ...(to ? { to: `${to}T00:00:00` } : {}),
    },
    { skip: !validId || businessId <= 0 },
  )

  const d = history.data
  const dateRangeInvalid = Boolean(from && to) && from > to

  const subtitle = useMemo(() => {
    if (!d) return ''
    const parts = [d.employeeName]
    if (d.employeePhone?.trim()) parts.push(d.employeePhone)
    if (d.employeePosition?.trim()) parts.push(d.employeePosition)
    return parts.join(' · ')
  }, [d])

  function openPdf() {
    if (!d || !employee) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, 110, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('EMPLOYEE PAYMENT HISTORY', pageW / 2, 38, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(subtitle || d.employeeName, pageW / 2, 62, { align: 'center' })
    const range =
      d.from && d.to ? `${d.from} to ${d.to}` : d.from ? `From ${d.from}` : d.to ? `To ${d.to}` : 'All dates'
    doc.text(range, pageW / 2, 82, { align: 'center' })

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

  if (!validId) {
    return <p className="p-6 text-slate-600">Invalid employee id.</p>
  }

  if (empLoading) {
    return <p className="p-6 text-slate-600">Loading employee…</p>
  }

  if (empError || !employee) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <p className="text-slate-700">Employee not found.</p>
        <Link className="text-emerald-700 hover:underline" to="/employees">
          Back to employees
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link className="text-emerald-700 hover:underline" to="/employees">
              Employees
            </Link>
            <span>/</span>
            <span>#{employeeId}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{employee?.name ?? 'Employee'}</h1>
          {employee && (
            <p className="mt-1 text-sm text-slate-600">
              {[employee.phone, employee.email, employee.position].filter(Boolean).join(' · ') || '—'}
            </p>
          )}
        </div>
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

      {employee && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base salary</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatDecimal(employee.baseSalary)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span
                className={`h-2.5 w-2.5 rounded-full ${employee.isActive ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]' : 'bg-slate-400'}`}
              />
              {employee.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
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

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-50">Payment history</h2>
          <p className="mt-0.5 text-xs text-emerald-100/90">Ledger for the selected date range</p>
        </div>
        {history.isFetching ? (
          <p className="p-6 text-sm text-slate-600">Loading…</p>
        ) : !d ? (
          <p className="p-6 text-sm text-slate-600">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Charged</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {d.rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-emerald-50/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{r.date}</td>
                    <td className="px-4 py-3 text-slate-700">{r.description}</td>
                    <td className="px-4 py-3 text-slate-500">{r.periodLabel?.trim() || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.referenceNo?.trim() || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                      {r.charged > 0 ? formatDecimal(r.charged) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                      {r.paid > 0 ? formatDecimal(r.paid) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-base font-semibold tabular-nums text-emerald-900">
                      {formatDecimal(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/95 font-semibold text-slate-900">
                  <td colSpan={4} className="px-4 py-3">
                    Period subtotals
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(d.totalCharged)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(d.totalPaid)}</td>
                  <td />
                </tr>
                <tr className="bg-gradient-to-r from-slate-50 to-emerald-50/50 text-slate-800">
                  <td colSpan={6} className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                    Outstanding (lifetime)
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-emerald-800">
                    {formatDecimal(d.outstandingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
