import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileText } from 'lucide-react'
import { useGetBusinessesQuery, useGetOutstandingCustomerFuelGivensQuery, useGetStationsQuery } from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { formatDecimal } from '../../lib/formatNumber'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'

function openPdfInNewTab(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function OutstandingCustomersReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const showStationCol = showStationColumnInTables(role)
  const effectiveStationId = useEffectiveStationId()

  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined }, { skip: !showBizPicker })

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

  const { data: rows = [], isFetching } = useGetOutstandingCustomerFuelGivensQuery(
    {
      filterBusinessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined,
      filterStationId: apiStationId,
    },
    { skip: effectiveBusinessId <= 0 || needsWorkspaceStation },
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

  const totalOutstanding = useMemo(() => rows.reduce((s, r) => s + r.balance, 0), [rows])
  const colCount = showStationCol ? 5 : 4

  const pdfHeaderStationName = useMemo(() => {
    const scopedStationId = showStationPicker
      ? superStationId != null && superStationId > 0
        ? superStationId
        : null
      : effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : null

    if (scopedStationId != null) {
      return stationNameById.get(scopedStationId)?.trim() || `Station #${scopedStationId}`
    }

    const stationIds = [...new Set(rows.map((r) => r.stationId).filter((id) => id > 0))]
    if (stationIds.length === 1) {
      return stationNameById.get(stationIds[0]!)?.trim() || `Station #${stationIds[0]}`
    }
    if (stationIds.length > 1) return 'All stations'
    return 'Station'
  }, [showStationPicker, superStationId, effectiveStationId, stationNameById, rows])

  function downloadPdf() {
    if (rows.length === 0) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, 110, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.text(pdfHeaderStationName.toUpperCase(), pageW / 2, 36, { align: 'center' })
    doc.setFontSize(14)
    doc.text('OUTSTANDING CUSTOMERS', pageW / 2, 62, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`As of ${new Date().toLocaleDateString()}`, pageW / 2, 86, { align: 'center' })

    const head = showStationCol
      ? ['#', 'Customer', 'Phone', 'Station', 'Balance']
      : ['#', 'Customer', 'Phone', 'Balance']
    const body = rows.map((r, i) =>
      showStationCol
        ? [
            String(i + 1),
            r.name,
            r.phone,
            r.stationId > 0 ? stationNameById.get(r.stationId) ?? `#${r.stationId}` : '—',
            formatDecimal(r.balance),
          ]
        : [String(i + 1), r.name, r.phone, formatDecimal(r.balance)],
    )

    const sideMargin = 24
    autoTable(doc, {
      startY: 128,
      head: [head],
      body,
      foot: [
        showStationCol
          ? [
              { content: 'Total outstanding', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
              { content: formatDecimal(totalOutstanding), styles: { fontStyle: 'bold', halign: 'right' } },
            ]
          : [
              { content: 'Total outstanding', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
              { content: formatDecimal(totalOutstanding), styles: { fontStyle: 'bold', halign: 'right' } },
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

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900">Outstanding customers</h1>

      {needsWorkspaceStation ? (
        <p className="text-sm text-amber-800">
          {showSettingsStationHint
            ? SETTINGS_STATION_HINT
            : 'Your account has no station assigned. Contact an administrator.'}
        </p>
      ) : null}

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
        {showStationPicker && (
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(superStationId ?? '')) ?? null}
              onChange={(o) => setSuperStationId(o?.value ? Number(o.value) : null)}
              placeholder="All stations"
              isClearable
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Total outstanding</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">{formatDecimal(totalOutstanding)}</div>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={rows.length === 0 || isFetching}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">#</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Customer</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Phone</th>
              {showStationCol ? (
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Station</th>
              ) : null}
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isFetching && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-slate-500">
                  {needsWorkspaceStation ? '—' : 'No outstanding balances for this scope.'}
                </td>
              </tr>
            )}
            {!isFetching &&
              rows.map((r, idx) => (
                <tr key={r.customerId} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 tabular-nums text-slate-600">{idx + 1}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-slate-700">{r.phone}</td>
                  {showStationCol ? (
                    <td className="px-3 py-2 text-slate-700">
                      {r.stationId > 0 ? stationNameById.get(r.stationId) ?? `#${r.stationId}` : '—'}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">{formatDecimal(r.balance)}</td>
                </tr>
              ))}
          </tbody>
          {!isFetching && rows.length > 0 ? (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <tr>
                <td
                  colSpan={showStationCol ? 4 : 3}
                  className="px-3 py-3 text-right text-slate-700"
                >
                  Total outstanding
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-900">{formatDecimal(totalOutstanding)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
