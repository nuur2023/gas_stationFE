import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetGeneratorUsagesQuery,
  useGetPermissionContextUsersQuery,
  useGetStationsQuery,
  useGetUsersQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { FileText } from 'lucide-react'
import { formatDecimal } from '../../lib/formatNumber'
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

export function GeneratorUsageReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const showStationCol = showStationColumnInTables(role)
  const effectiveStationId = useEffectiveStationId()

  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [reportBusinessId, setReportBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [superStationId, setSuperStationId] = useState<number | null>(null)

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: permissionContextUsers } = useGetPermissionContextUsersQuery(
    {},
    { skip: isSuperAdmin || authBusinessId == null || authBusinessId <= 0 },
  )
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()

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

  const { data: stationsData } = useGetStationsQuery({
    page: 1,
    pageSize: 2000,
    q: undefined,
    ...(effectiveBusinessId > 0 ? { businessId: effectiveBusinessId } : {}),
  })

  const needsWorkspaceStation = !showStationPicker && (effectiveStationId == null || effectiveStationId <= 0)
  const showSettingsStationHint = adminNeedsSettingsStation(role, effectiveStationId)
  const dateRangeInvalid = Boolean(from && to) && from > to

  const apiStationId = showStationPicker
    ? superStationId != null && superStationId > 0
      ? superStationId
      : undefined
    : effectiveStationId != null && effectiveStationId > 0
      ? effectiveStationId
      : undefined

  const { data: rawData, isFetching, isError } = useGetGeneratorUsagesQuery(
    {
      page: 1,
      pageSize: 5000,
      q: undefined,
      ...(apiStationId != null && apiStationId > 0 ? { filterStationId: apiStationId } : {}),
    },
    { skip: dateRangeInvalid || needsWorkspaceStation },
  )

  const userNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usersData?.items ?? []) m.set(u.id, u.name)
    for (const u of permissionContextUsers ?? []) m.set(u.id, u.name)
    return m
  }, [usersData?.items, permissionContextUsers])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const fuelTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const ft of fuelTypes) m.set(ft.id, ft.fuelName)
    return m
  }, [fuelTypes])

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(() => {
    const all: SelectOption[] = [{ value: '', label: 'All stations' }]
    for (const s of stationsData?.items ?? []) all.push({ value: String(s.id), label: s.name })
    return all
  }, [stationsData?.items])

  const rows = useMemo(() => {
    const all = rawData?.items ?? []
    return all.filter((r) => {
      const day = r.date.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      if (effectiveBusinessId > 0 && r.businessId !== effectiveBusinessId) return false
      return true
    })
  }, [rawData?.items, from, to, effectiveBusinessId])

  const totalLiters = useMemo(() => rows.reduce((s, r) => s + Number(r.ltrUsage || 0), 0), [rows])

  function handleOpenPdf() {
    if (rows.length === 0 || dateRangeInvalid) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 48
    const headerH = 150
    const today = new Date().toLocaleDateString('en-CA')
    let startY = headerH + 54

    const businessName =
      effectiveBusinessId > 0
        ? (businessesData?.items ?? []).find((b) => b.id === effectiveBusinessId)?.name ?? `#${effectiveBusinessId}`
        : 'Business'

    doc.setFillColor(21, 128, 122)
    doc.rect(0, 0, pageW, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text((businessName || 'Gas Station').toUpperCase(), pageW / 2, 52, { align: 'center' })
    doc.setFontSize(14)
    doc.text('GENERATOR USAGE REPORT', pageW / 2, 80, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`${from || '…'} ! ${to || '…'}`, pageW / 2, 130, { align: 'center' })

    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.text('Station Name', margin, startY - 16)
    doc.text('current date', pageW - margin, startY - 16, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(
      apiStationId != null && apiStationId > 0 ? (stationNameById.get(apiStationId) ?? `#${apiStationId}`) : 'All stations',
      margin,
      startY,
    )
    doc.text(today, pageW - margin, startY, { align: 'right' })

    autoTable(doc, {
      startY: startY + 12,
      head: [['Date', 'Fuel type', 'Liters', 'User', ...(showStationCol ? ['Station'] : [])]],
      body: rows.map((r) => [
        new Date(r.date).toLocaleString(),
        r.fuelTypeId != null ? (fuelTypeNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`) : '—',
        formatDecimal(Number(r.ltrUsage)),
        userNameById.get(r.usersId) ?? `#${r.usersId}`,
        ...(showStationCol ? [stationNameById.get(r.stationId) ?? `#${r.stationId}`] : []),
      ]),
      foot: [['Total', '', formatDecimal(totalLiters), '', ...(showStationCol ? [''] : [])]],
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
          <h1 className="text-2xl font-semibold text-slate-900">Generator usage report</h1>
        </div>
        <button
          type="button"
          onClick={handleOpenPdf}
          disabled={rows.length === 0 || dateRangeInvalid || isFetching}
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
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {showStationPicker && (
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Station</label>
            <FormSelect
              options={stationOptions}
              value={stationOptions.find((o) => o.value === String(superStationId ?? '')) ?? stationOptions[0] ?? null}
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
      {isError && <p className="text-sm text-red-600">Could not load report.</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Fuel type</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Liters</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">User</th>
              {showStationCol ? <th className="px-4 py-2 text-left font-semibold text-slate-700">Station</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showStationCol ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                  {isFetching ? 'Loading…' : 'No generator usage rows in this range.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 text-slate-800">{new Date(r.date).toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-800">
                  {r.fuelTypeId != null ? (fuelTypeNameById.get(r.fuelTypeId) ?? `#${r.fuelTypeId}`) : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatDecimal(Number(r.ltrUsage))}</td>
                <td className="px-4 py-2 text-slate-700">{userNameById.get(r.usersId) ?? `#${r.usersId}`}</td>
                {showStationCol ? <td className="px-4 py-2 text-slate-700">{stationNameById.get(r.stationId) ?? `#${r.stationId}`}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
