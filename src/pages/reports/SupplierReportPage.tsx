import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  useGetBusinessesQuery,
  useGetSupplierReportQuery,
  useGetSuppliersQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
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

export function SupplierReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [supplierId, setSupplierId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setReportBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [showBizPicker, businessesData?.items])

  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: suppliersData } = useGetSuppliersQuery(
    { page: 1, pageSize: 5000, q: undefined, businessId: effectiveBusinessId || undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const supplierOptions: SelectOption[] = useMemo(
    () => (suppliersData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [suppliersData?.items],
  )

  const report = useGetSupplierReportQuery(
    {
      businessId: effectiveBusinessId,
      supplierId: supplierId ?? 0,
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T00:00:00` : undefined,
    },
    { skip: effectiveBusinessId <= 0 || !supplierId || supplierId <= 0 },
  )

  const d = report.data
  const selectedSupplierName =
    supplierOptions.find((o) => o.value === String(supplierId ?? ''))?.label ?? 'Supplier'
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
    doc.setFontSize(26)
    doc.text((selectedBusinessName || 'BUSINESS').toUpperCase(), pageW / 2, 36, { align: 'center' })
    doc.setFontSize(14)
    doc.text('SUPPLIER REPORT', pageW / 2, 62, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`${selectedSupplierName}  |  ${d.from} to ${d.to}`, pageW / 2, 86, { align: 'center' })

    const sideMargin = 36
    autoTable(doc, {
      startY: 128,
      head: [['Description', 'Liters', 'Charged', 'Paid', 'Balance', 'Date', 'Action']],
      body: d.rows.map((r) => [
        r.description,
        r.liters != null ? formatDecimal(r.liters) : '—',
        r.amount > 0 ? formatDecimal(r.amount) : '—',
        r.paid > 0 ? `$${formatDecimal(r.paid)}` : '—',
        `$${formatDecimal(r.balance)}`,
        r.date,
        r.purchaseId != null ? 'View purchase' : '—',
      ]),
      foot: [
        [
          { content: 'Balance', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
          formatDecimal(d.totalCharged),
          `$${formatDecimal(d.totalPaid)}`,
          `$${formatDecimal(d.balance)}`,
          '',
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

  const dateRangeInvalid = Boolean(from && to) && from > to

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Supplier report</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!d || !supplierId}
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
              options={(businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
              value={
                (businessesData?.items ?? [])
                  .map((b) => ({ value: String(b.id), label: b.name }))
                  .find((o) => o.value === String(reportBusinessId ?? '')) ?? null
              }
              onChange={(o) => {
                setReportBusinessId(o ? Number(o.value) : null)
                setSupplierId(null)
              }}
              placeholder="Select business"
            />
          </div>
        )}
        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Supplier</label>
          <FormSelect
            options={supplierOptions}
            value={supplierOptions.find((o) => o.value === String(supplierId ?? '')) ?? null}
            onChange={(o) => setSupplierId(o ? Number(o.value) : null)}
            placeholder="Select supplier"
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
      {!supplierId && <p className="text-sm text-slate-600">Select a supplier to load the report.</p>}

      {supplierId && !dateRangeInvalid && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
            Ledger
          </div>
          {report.isFetching ? (
            <p className="p-4 text-sm text-slate-600">Loading…</p>
          ) : !d ? (
            <p className="p-4 text-sm text-slate-600">No data.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-right">Liters</th>
                  <th className="px-4 py-2 text-right">Charged</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right text-red-600">Balance</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border-t px-4 py-6 text-center text-slate-500">
                      No rows in this date range.
                    </td>
                  </tr>
                ) : (
                  d.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 capitalize">{r.description}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.liters != null ? formatDecimal(r.liters) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.amount > 0 ? formatDecimal(r.amount) : '—'}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-emerald-700">
                        {r.paid > 0 ? `$${formatDecimal(r.paid)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-lg font-medium tabular-nums text-red-600">
                        ${formatDecimal(r.balance)}
                      </td>
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">
                        {r.purchaseId != null ? (
                          <Link
                            to={`/purchases/${r.purchaseId}`}
                            className="font-medium text-emerald-700 underline decoration-emerald-600/60 hover:text-emerald-800"
                          >
                            View link purchase
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {d.rows.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Totals / ending balance
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(d.totalCharged)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-800">${formatDecimal(d.totalPaid)}</td>
                    <td className="px-4 py-3 text-right text-lg tabular-nums text-red-600">${formatDecimal(d.balance)}</td>
                    <td colSpan={2} className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  )
}
