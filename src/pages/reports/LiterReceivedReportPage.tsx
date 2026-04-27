import { useCallback, useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
  useGetStationsQuery,
  useGetLiterReceivedsQuery,
  useLazyGetLiterReceivedsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { useDebouncedValue } from '../../lib/hooks'
import {
  showBusinessColumnInTables,
  showStationColumnInTables,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { LiterFlowType, LiterReceived } from '../../types/models'

function normalizeFlow(raw: string): string {
  const u = raw?.trim()
  if (u === 'Out') return 'Out'
  if (u === 'In') return 'In'
  return u || '—'
}

function normalizeFlowType(raw: string): LiterFlowType {
  const u = raw?.trim()
  if (u === 'Out') return 'Out'
  return 'In'
}

function openPdfInNewTab(doc: jsPDF) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export function LiterReceivedReportPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const isSuperAdmin = role === 'SuperAdmin'

  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: stationsData } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 2000,
      q: undefined,
      ...(!isSuperAdmin && authBusinessId != null && authBusinessId > 0 ? { businessId: authBusinessId } : {}),
    },
    { skip: !isSuperAdmin && (authBusinessId == null || authBusinessId <= 0) },
  )
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [fetchPage] = useLazyGetLiterReceivedsQuery()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dateRangeInvalid =
    Boolean(startDate && endDate) && startDate > endDate

  const queryArg = useMemo(
    () => ({
      page,
      pageSize,
      q: debounced.trim() || undefined,
      from: !dateRangeInvalid && startDate ? startDate : undefined,
      to: !dateRangeInvalid && endDate ? endDate : undefined,
      ...(effectiveStationId != null && effectiveStationId > 0
        ? { filterStationId: effectiveStationId }
        : {}),
    }),
    [page, pageSize, debounced, startDate, endDate, dateRangeInvalid, effectiveStationId],
  )

  const { data, isFetching } = useGetLiterReceivedsQuery(queryArg)

  useEffect(() => {
    setPage(1)
  }, [debounced, startDate, endDate])

  const [loadingPdf, setLoadingPdf] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsData?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsData?.items])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const tableColumns: Column<LiterReceived>[] = useMemo(() => {
    const idCol: Column<LiterReceived> = { key: 'id', header: 'ID' }
    const businessCol: Column<LiterReceived> = {
      key: 'businessId',
      header: 'Business',
      render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
    }
    const middle: Column<LiterReceived>[] = [
      {
        key: 'type',
        header: 'Flow',
        render: (r) => {
          const f = normalizeFlowType(r.type)
          return f === 'Out' ? 'Out' : r.type === 'In' ? 'In' : `${r.type}`
        },
      },
      {
        key: 'fromStationId',
        header: 'From',
        render: (r) =>
          normalizeFlowType(r.type) === 'In' && r.fromStationId
            ? stationNameById.get(r.fromStationId) ?? `#${r.fromStationId}`
            : '—',
      },
      { key: 'targo', header: 'Targo', render: (r) => r.targo || '—' },
      {
        key: 'driverName',
        header: 'Driver',
        render: (r) => r.driverName || r.name || '—',
      },
      {
        key: 'fuelTypeId',
        header: 'Fuel type',
        render: (r) => fuelNameById.get(r.fuelTypeId) ?? r.fuelTypeId,
      },
      {
        key: 'receivedLiter',
        header: 'Liters',
        render: (r) => Number(r.receivedLiter).toFixed(2),
      },
    ]
    const stationCol: Column<LiterReceived> = {
      key: 'stationId',
      header: 'Station / transfer',
      render: (r) => {
        const from = stationNameById.get(r.stationId) ?? `#${r.stationId}`
        if (normalizeFlowType(r.type) === 'Out' && r.toStationId) {
          const to = stationNameById.get(r.toStationId) ?? `#${r.toStationId}`
          return `${from} → ${to}`
        }
        return from
      },
    }
    const tail: Column<LiterReceived>[] = [
      {
        key: 'createdAt',
        header: 'Recorded',
        render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'),
      },
    ]
    const out: Column<LiterReceived>[] = [idCol]
    if (showBusinessColumnInTables(role)) out.push(businessCol)
    out.push(...middle)
    if (showStationColumnInTables(role)) out.push(stationCol)
    out.push(...tail)
    return out
  }, [role, fuelNameById, stationNameById, businessNameById])

  const printPdf = useCallback(async () => {
    if (dateRangeInvalid) {
      setStatus('Fix the date range (start must be on or before end).')
      return
    }
    setLoadingPdf(true)
    setStatus(null)
    const qArg = debounced.trim() || undefined
    const fromArg = startDate || undefined
    const toArg = endDate || undefined
    try {
      const pageSizeFetch = 200
      let p = 1
      const rows: LiterReceived[] = []
      while (true) {
        const res = await fetchPage({
          page: p,
          pageSize: pageSizeFetch,
          q: qArg,
          from: fromArg,
          to: toArg,
          ...(effectiveStationId != null && effectiveStationId > 0
            ? { filterStationId: effectiveStationId }
            : {}),
        }).unwrap()
        rows.push(...res.items)
        if (res.items.length < pageSizeFetch) break
        p += 1
        if (p > 500) break
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 48
      const headerH = 150
      const now = new Date()
      const today = now.toLocaleDateString('en-CA')
      let metaY = headerH + 54

      doc.setFillColor(21, 128, 122)
      doc.rect(0, 0, pageW, headerH, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(28)
      doc.text((businessNameById.get(authBusinessId ?? -1) ?? 'Gas Station').toUpperCase(), pageW / 2, 52, { align: 'center' })
      doc.setFontSize(14)
      doc.text('LITER RECEIVED REPORT', pageW / 2, 80, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(13)
      doc.text('Report', pageW / 2, 106, { align: 'center' })
      doc.setFontSize(12)
      doc.text(`${fromArg || '…'} ! ${toArg || '…'}`, pageW / 2, 130, { align: 'center' })

      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      // doc.text('Station Name', margin, metaY - 16)
      // doc.text('current date', pageW - margin, metaY - 16, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.text(
        effectiveStationId != null && effectiveStationId > 0
          ? (stationNameById.get(effectiveStationId) ?? `#${effectiveStationId}`)
          : 'All stations',
        margin,
        metaY,
      )
      doc.text(today, pageW - margin, metaY, { align: 'right' })
      metaY += 14
      const parts: string[] = []
      if (qArg) parts.push(`Search: ${qArg}`)
      if (fromArg || toArg) {
        parts.push(`Period: ${fromArg || '…'} → ${toArg || '…'}`)
      }
      if (parts.length) {
        doc.text(parts.join(' · '), 40, metaY)
        metaY += 14
      }
      doc.setTextColor(0, 0, 0)

      const head = isSuperAdmin
        ? [
            [
              'Business',
              'Flow',
              'From',
              'Targo',
              'Fuel',
              'Liters',
              'Station / transfer',
              'Recorded',
            ],
          ]
        : [['Flow', 'From', 'Targo', 'Fuel', 'Liters', 'Station / transfer', 'Recorded']]

      const body = rows.map((r) => {
        const flow = normalizeFlow(r.type)
        const recv = stationNameById.get(r.stationId) ?? String(r.stationId)
        const transfer =
          flow === 'Out' && r.toStationId
            ? `${recv} → ${stationNameById.get(r.toStationId) ?? r.toStationId}`
            : recv
        const fromOpt =
          flow === 'In' && r.fromStationId
            ? stationNameById.get(r.fromStationId) ?? String(r.fromStationId)
            : '—'
        const rec = r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'
        if (isSuperAdmin) {
          return [
            businessNameById.get(r.businessId) ?? String(r.businessId),
            flow,
            fromOpt,
            r.targo || '—',
            fuelNameById.get(r.fuelTypeId) ?? String(r.fuelTypeId),
            Number(r.receivedLiter).toFixed(2),
            transfer,
            rec,
          ]
        }
        return [
          flow,
          fromOpt,
          r.targo || '—',
          fuelNameById.get(r.fuelTypeId) ?? String(r.fuelTypeId),
          Number(r.receivedLiter).toFixed(2),
          transfer,
          rec,
        ]
      })

      const startY = metaY + 8
      autoTable(doc, {
        startY,
        head,
        body,
        styles: { fontSize: 10, cellPadding: 5, textColor: [31, 41, 55] },
        headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin, bottom: 60 },
        didDrawPage: (data) => {
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
          doc.text(`Page | ${data.pageNumber}`, pW - margin, lineY + 15, { align: 'right' })
        },
      })

      openPdfInNewTab(doc)
      setStatus(`Opened PDF with ${rows.length} row(s).`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to build PDF.')
    } finally {
      setLoadingPdf(false)
    }
  }, [
    fetchPage,
    fuelNameById,
    stationNameById,
    businessNameById,
    isSuperAdmin,
    authBusinessId,
    debounced,
    startDate,
    endDate,
    dateRangeInvalid,
    effectiveStationId,
  ])

  const selected = useMemo(() => new Set<number>(), [])
  const noopSet = useCallback(() => {}, [])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Liter received report</h1>
        <p className="mt-1 text-sm text-slate-600">
          Received records report.
        </p>
      </div>

      {dateRangeInvalid ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Start date must be on or before end date.
        </div>
      ) : null}

      <DataTable<LiterReceived>
        title="Liter received"
        readOnly
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={noopSet}
        onEdit={() => {}}
        onDeleteOne={() => {}}
        onDeleteSelected={() => {}}
        columns={tableColumns}
        extraToolbar={
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <button
              type="button"
              onClick={() => void printPdf()}
              disabled={loadingPdf || dateRangeInvalid}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loadingPdf ? 'Preparing…' : 'Print PDF'}
            </button>
          </div>
        }
      />

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </div>
  )
}
