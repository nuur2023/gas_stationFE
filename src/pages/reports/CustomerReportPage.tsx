import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import {
  useGetBusinessesQuery,
  useGetCustomerReportQuery,
  useGetOperationReportCustomersQuery,
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

export function CustomerReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setReportBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [showBizPicker, businessesData?.items])

  const effectiveBusinessId = showBizPicker ? (reportBusinessId ?? 0) : (authBusinessId ?? 0)

  const { data: customers } = useGetOperationReportCustomersQuery(
    { businessId: effectiveBusinessId },
    { skip: effectiveBusinessId <= 0 },
  )

  const customerOptions: SelectOption[] = useMemo(
    () =>
      (customers ?? []).map((c) => ({
        value: String(c.customerId),
        label: c.name,
      })),
    [customers],
  )

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return (customers ?? []).find((c) => c.customerId === selectedCustomerId) ?? null
  }, [selectedCustomerId, customers])

  const report = useGetCustomerReportQuery(
    {
      businessId: effectiveBusinessId,
      customerId: selectedCustomerId ?? 0,
      // yyyy-MM-dd only—avoids ambiguous DateTime timezone handling on the API.
      from: from.trim() ? from.trim() : undefined,
      to: to.trim() ? to.trim() : undefined,
    },
    { skip: effectiveBusinessId <= 0 || !selectedCustomerId },
  )

  const d = report.data
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
    doc.text('CUSTOMER REPORT', pageW / 2, 62, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const customerLabel = selectedCustomer?.name ?? 'Customer'
    doc.text(`${customerLabel}  |  ${d.from} to ${d.to}`, pageW / 2, 86, { align: 'center' })

    const sideMargin = 24
    autoTable(doc, {
      startY: 128,
      head: [
        [
          'Fuel Liters',
          'Type',
          'Fuel Price',
          'Cash Taken',
          'Paid',
          'Balance',
          'Date',
        ],
      ],
      body: d.rows.map((r) => [
        r.liters != null ? `${formatDecimal(r.liters)}` : '-----',
        r.fuelTypeName ?? (r.type === 'Cash' ? '-----' : '-----'),
        r.price != null ? `${formatDecimal(r.price)}` : '------',
        r.cashTaken > 0 ? `${formatDecimal(r.cashTaken)}` : (r.description === 'Payment' ? '-----------' : '0'),
        r.paid > 0 ? `${formatDecimal(r.paid)}` : '0',
        `${(r.balance >= 0 ? '+' : '')}${formatDecimal(r.balance)}`,
        r.date,
      ]),
      foot: [
        [
          { content: `SubTotal — ${formatDecimal(d.totalLiters)} Liters`, styles: { halign: 'left', fontStyle: 'bold' } },
          '',
          '',
          { content: formatDecimal(d.totalCashTaken), styles: { fontStyle: 'bold' } },
          { content: formatDecimal(d.totalPaid), styles: { fontStyle: 'bold' } },
          { content: `${(d.balance >= 0 ? '+' : '')}${formatDecimal(d.balance)}`, styles: { fontStyle: 'bold' } },
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
        <h1 className="text-2xl font-semibold text-slate-900">Customer report</h1>
        <button
          type="button"
          onClick={openPdf}
          disabled={!d || !selectedCustomer}
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
                setSelectedCustomerId(null)
              }}
              placeholder="Select business"
            />
          </div>
        )}
        <div className="min-w-[260px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Customer</label>
          <FormSelect
            options={customerOptions}
              value={customerOptions.find((o) => o.value === String(selectedCustomerId ?? '')) ?? null}
              onChange={(o) => setSelectedCustomerId(o ? Number(o.value) : null)}
            placeholder="Select customer"
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
      {!selectedCustomer && <p className="text-sm text-slate-600">Select a customer to load the report.</p>}

      {selectedCustomer && !dateRangeInvalid && (
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
                  <th className="px-4 py-2 text-right">Fuel Liters</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Fuel Price</th>
                  <th className="px-4 py-2 text-right">Cash Taken</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right text-red-600">Balance</th>
                  <th className="px-4 py-2 text-left">Date</th>
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
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.liters != null ? formatDecimal(r.liters) : '-----'}
                      </td>
                      <td className="px-4 py-2">{r.fuelTypeName ?? (r.type === 'Cash' ? '—' : '-----')}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.price != null ? formatDecimal(r.price) : '------'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.cashTaken > 0
                          ? formatDecimal(r.cashTaken)
                          : r.description === 'Payment'
                            ? '-----------'
                            : '0'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-emerald-700">
                        {r.paid > 0 ? formatDecimal(r.paid) : '0'}
                      </td>
                      <td
                        className={`px-4 py-2 text-right text-lg font-medium tabular-nums ${
                          r.balance >= 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {r.balance >= 0 ? '+' : ''}
                        {formatDecimal(r.balance)}
                      </td>
                      <td className="px-4 py-2">{r.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {d.rows.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">SubTotal</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(d.totalLiters)} Liters</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(d.totalCashTaken)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-800">{formatDecimal(d.totalPaid)}</td>
                    <td
                      className={`px-4 py-3 text-right text-lg tabular-nums ${
                        d.balance >= 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {d.balance >= 0 ? '+' : ''}
                      {formatDecimal(d.balance)}
                    </td>
                    <td className="px-4 py-3" />
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
