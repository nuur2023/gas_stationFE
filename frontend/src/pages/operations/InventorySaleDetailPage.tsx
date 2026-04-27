import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useDeleteInventoryMutation, useGetInventorySaleDetailQuery, useGetNozzlesByBusinessQuery, useUpdateInventoryMutation, useUpdateInventorySaleEvidenceMutation } from '../../app/api/apiSlice'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/ToastProvider'
import { formatDecimal } from '../../lib/formatNumber'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import type { Inventory, InventoryWriteRequest } from '../../types/models'

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string') {
      return (data as { message: string }).message
    }
  }
  return fallback
}

export function InventorySaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>()
  const id = Number(saleId)
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lineModalOpen, setLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<Inventory | null>(null)
  const [openingLiters, setOpeningLiters] = useState('0')
  const [closingLiters, setClosingLiters] = useState('0')
  const [sspLiters, setSspLiters] = useState('0')
  const [usdLiters, setUsdLiters] = useState('0')
  const [recordDate, setRecordDate] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const { showError, showSuccess } = useToast()
  const { requestDelete, dialog } = useDeleteConfirm()
  const { data, isLoading, isError } = useGetInventorySaleDetailQuery(id, { skip: !Number.isFinite(id) || id <= 0 })
  const { data: nozzles = [] } = useGetNozzlesByBusinessQuery(data?.businessId ?? 0, {
    skip: (data?.businessId ?? 0) <= 0,
  })
  const [updateEvidence, { isLoading: isUpdatingEvidence }] = useUpdateInventorySaleEvidenceMutation()
  const [updateInventory, { isLoading: isUpdatingLine }] = useUpdateInventoryMutation()
  const [deleteInventory] = useDeleteInventoryMutation()

  const nozzleLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const n of nozzles) {
      const nozzleName = n.name?.trim() ? n.name.trim() : `Nozzle ${n.id}`
      map.set(n.id, `${n.pumpNumber} - ${nozzleName}`)
    }
    return map
  }, [nozzles])

  const columns: Column<Inventory>[] = useMemo(
    () => [
      { key: 'id', header: 'ID' },
      {
        key: 'nozzleId',
        header: 'Nozzle',
        render: (r) => nozzleLabelById.get(r.nozzleId) ?? `Nozzle #${r.nozzleId}`,
      },
      { key: 'openingLiters', header: 'Opening', render: (r) => formatDecimal(r.openingLiters) },
      { key: 'closingLiters', header: 'Closing', render: (r) => formatDecimal(r.closingLiters) },
      { key: 'usageLiters', header: 'Usage', render: (r) => formatDecimal(r.usageLiters) },
      { key: 'sspLiters', header: 'SSP L', render: (r) => formatDecimal(r.sspLiters) },
      { key: 'usdLiters', header: 'USD L', render: (r) => formatDecimal(r.usdLiters) },
      { key: 'sspAmount', header: 'SSP Amount', render: (r) => formatDecimal(r.sspAmount) },
      { key: 'usdAmount', header: 'USD Amount', render: (r) => formatDecimal(r.usdAmount) },
    ],
    [nozzleLabelById],
  )

  const totals = useMemo(() => {
    const rows = data?.items ?? []
    return rows.reduce(
      (acc, r) => ({
        usage: acc.usage + Number(r.usageLiters || 0),
        ssp: acc.ssp + Number(r.sspAmount || 0),
        usd: acc.usd + Number(r.usdAmount || 0),
      }),
      { usage: 0, ssp: 0, usd: 0 },
    )
  }, [data?.items])

  const evidenceUrl = useMemo(() => {
    if (!Number.isFinite(id) || id <= 0) return ''
    const base = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    return `${base}/api/Inventories/sales/${id}/evidence`
  }, [id])

  async function handleDownloadEvidence() {
    try {
      const raw = localStorage.getItem('gas-auth')
      const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
      if (!token) {
        showError('You are not authenticated.')
        return
      }
      const res = await fetch(evidenceUrl, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        showError('Failed to download evidence file.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data?.originalFileName || `inventory-evidence-${id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showError('Failed to download evidence file.')
    }
  }

  async function handleUpdateEvidence() {
    if (!file || !Number.isFinite(id) || id <= 0) return
    const fd = new FormData()
    fd.append('evidence', file)
    try {
      await updateEvidence({ saleId: id, formData: fd }).unwrap()
      setFile(null)
      setFileInputKey((k) => k + 1)
      showSuccess('Evidence file updated.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to update evidence file.'))
    }
  }

  function openEditLine(row: Inventory) {
    setEditingLine(row)
    setOpeningLiters(String(row.openingLiters))
    setClosingLiters(String(row.closingLiters))
    setSspLiters(String(row.sspLiters))
    setUsdLiters(String(row.usdLiters))
    setRecordDate(row.date.slice(0, 10))
    setLineModalOpen(true)
  }

  async function handleSaveLine() {
    if (!editingLine) return
    const body: InventoryWriteRequest = {
      businessId: editingLine.businessId,
      stationId: editingLine.stationId,
      nozzleId: editingLine.nozzleId,
      openingLiters,
      closingLiters,
      sspLiters,
      usdLiters,
      recordedAt: `${recordDate}T12:00:00.000Z`,
    }
    try {
      await updateInventory({ id: editingLine.id, body }).unwrap()
      showSuccess('Inventory line updated.')
      setLineModalOpen(false)
      setEditingLine(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to update inventory line.'))
    }
  }

  function confirmDeleteLine(itemId: number) {
    requestDelete({
      title: 'Delete inventory line item?',
      description: 'This line item will be removed.',
      action: async () => {
        await deleteInventory(itemId).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(itemId)
          return n
        })
      },
    })
  }

  async function handleViewEvidence() {
    try {
      const raw = localStorage.getItem('gas-auth')
      const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
      if (!token) {
        showError('You are not authenticated.')
        return
      }
      const res = await fetch(evidenceUrl, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        showError('Failed to open evidence file.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch {
      showError('Failed to open evidence file.')
    }
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Invalid inventory sale link. <Link to="/inventory" className="font-semibold underline">Back to inventory</Link>
      </div>
    )
  }
  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        Inventory sale not found. <Link to="/inventory" className="font-semibold underline">Back to inventory</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {dialog}
      <Link
        to="/inventory"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Inventory
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs text-slate-500">Reference</p><p className="font-semibold">{data?.referenceNumber ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Date</p><p className="font-semibold">{data ? new Date(data.recordedDate).toLocaleString() : '—'}</p></div>
          <div><p className="text-xs text-slate-500">User</p><p className="font-semibold">{data?.userName || (data?.userId ? `#${data.userId}` : '—')}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleViewEvidence}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            View evidence
          </button>
          <button
            type="button"
            onClick={handleDownloadEvidence}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download evidence
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Choose file
            <input
              key={fileInputKey}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <span className="max-w-xs truncate text-sm text-slate-600">{file?.name ?? 'No file chosen'}</span>
          <button
            type="button"
            disabled={!file || isUpdatingEvidence}
            onClick={handleUpdateEvidence}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Update evidence
          </button>
        </div>
      </div>

      <DataTable<Inventory>
        title="Inventory line items"
        rows={data?.items ?? []}
        totalCount={data?.items?.length ?? 0}
        page={1}
        pageSize={50}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        search=""
        onSearchChange={() => {}}
        isLoading={isLoading}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onEdit={openEditLine}
        onDeleteOne={confirmDeleteLine}
        onDeleteSelected={() => {
          const ids = [...selected]
          if (ids.length === 0) return
          requestDelete({
            title: `Delete ${ids.length} inventory line(s)?`,
            description: 'Selected lines will be removed.',
            action: async () => {
              for (const itemId of ids) {
                await deleteInventory(itemId).unwrap()
              }
              setSelected(new Set())
            },
          })
        }}
        columns={columns}
        belowTable={
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="overflow-x-auto">
              <table className="min-w-md border border-slate-300 bg-white text-sm">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-56 border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Total Usage Liters</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">{formatDecimal(totals.usage)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Total Usage SSP Liters</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">
                      {formatDecimal((data?.items ?? []).reduce((sum, row) => sum + Number(row.sspLiters || 0), 0))}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Total Usage USD Liters</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">
                      {formatDecimal((data?.items ?? []).reduce((sum, row) => sum + Number(row.usdLiters || 0), 0))}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Total SSP Amount</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">{formatDecimal(totals.ssp)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-800">Total USD Amount</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">${formatDecimal(totals.usd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        }
      />

      <Modal
        open={lineModalOpen}
        onClose={() => {
          if (isUpdatingLine) return
          setLineModalOpen(false)
          setEditingLine(null)
        }}
        title="Edit inventory line"
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Opening liters</span>
            <input value={openingLiters} onChange={(e) => setOpeningLiters(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Closing liters</span>
            <input value={closingLiters} onChange={(e) => setClosingLiters(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">SSP liters</span>
            <input value={sspLiters} onChange={(e) => setSspLiters(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">USD liters</span>
            <input value={usdLiters} onChange={(e) => setUsdLiters(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Date</span>
            <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLineModalOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancel</button>
            <button
              type="button"
              onClick={handleSaveLine}
              disabled={isUpdatingLine}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
