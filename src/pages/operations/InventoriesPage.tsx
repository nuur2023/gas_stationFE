import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react'
import {
  useCreateInventoryBatchMutation,
  useDeleteInventoryMutation,
  useGetBusinessesQuery,
  useGetCurrenciesQuery,
  useGetDippingsQuery,
  useGetFuelPricesQuery,
  useGetFuelTypesQuery,
  useGetInventoriesQuery,
  useGetInventoryLatestByNozzleQuery,
  useGetNozzlesByBusinessQuery,
  useGetPermissionContextUsersQuery,
  useGetRatesQuery,
  useGetStationsQuery,
  useGetUsersQuery,
  useUpdateInventoryMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DateField } from '../../components/DateField'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { classifyPetrolDiesel } from '../../lib/fuelTypeCategory'
import { formatCurrency, formatDecimal, formatWithCurrencySymbol, parseNumericInput } from '../../lib/formatNumber'
import { formatRateNumber } from '../../lib/formatRateNumber'
import { useDebouncedValue } from '../../lib/hooks'
import {
  adminNeedsSettingsStation,
  resolveFormStationId,
  SETTINGS_STATION_HINT,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { Inventory, InventoryWriteRequest } from '../../types/models'

function sanitizeDecimalTyping(raw: string): string {
  let v = raw.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = v.indexOf('.')
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  }
  return v
}

export function InventoriesPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const isSuperAdmin = role === 'SuperAdmin'
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const page = 1
  const pageSize = 50
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetInventoriesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0
      ? { filterStationId: effectiveStationId }
      : {}),
  })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stationsForTable } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveFormBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: stationsForForm } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: effectiveFormBusinessId ?? undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )

  const [stationId, setStationId] = useState(0)
  const { data: nozzleRows = [] } = useGetNozzlesByBusinessQuery(effectiveFormBusinessId ?? 0, {
    skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0,
  })

  const nozzlesForForm = useMemo(
    () => nozzleRows.filter((n) => n.stationId === stationId),
    [nozzleRows, stationId],
  )

  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: fuelPrices = [] } = useGetFuelPricesQuery()
  const { data: ratesData } = useGetRatesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: currencies = [] } = useGetCurrenciesQuery()
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  /** Users list omits Admin/SuperAdmin for non–SuperAdmin; context-users includes everyone linked to the business. */
  const { data: permissionContextUsers } = useGetPermissionContextUsersQuery(
    {},
    { skip: isSuperAdmin || authBusinessId == null || authBusinessId <= 0 },
  )
  const { data: dippingsForForm } = useGetDippingsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: showBizPicker ? (effectiveFormBusinessId ?? undefined) : undefined,
    },
    { skip: effectiveFormBusinessId == null || effectiveFormBusinessId <= 0 },
  )
  /** Resolve pump → fuel price → currency for table rows (all dippings visible to the user). */
  const { data: dippingsLookup } = useGetDippingsQuery({ page: 1, pageSize: 5000, q: undefined })

  const [createInventoryBatch, { isLoading: batchSaving }] = useCreateInventoryBatchMutation()
  const [updateInv] = useUpdateInventoryMutation()
  const [deleteInv] = useDeleteInventoryMutation()

  const [open, setOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [editing, setEditing] = useState<Inventory | null>(null)
  type BatchDraftLine = {
    key: string
    nozzleId: number
    openingLiters: string
    closingLiters: string
    sspLiters: string
    usdLiters: string
  }
  const [batchDraft, setBatchDraft] = useState<BatchDraftLine[]>([])
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [nozzleId, setNozzleId] = useState(0)
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [openingLiters, setOpeningLiters] = useState('0')
  const [closingLiters, setClosingLiters] = useState('0')
  const [sspLitersStr, setSspLitersStr] = useState('0')
  const [usdLitersStr, setUsdLitersStr] = useState('0')
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<number>>(new Set())
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null)
  const [evidencePreviewTitle, setEvidencePreviewTitle] = useState('')
  const [evidencePreviewKind, setEvidencePreviewKind] = useState<'image' | 'pdf' | 'other'>('other')

  const { data: latestForNozzle, isFetching: latestNozzleLoading } = useGetInventoryLatestByNozzleQuery(nozzleId, {
    skip: nozzleId <= 0 || (!batchOpen && (!open || editing != null)),
  })

  useEffect(() => {
    return () => {
      if (evidencePreviewUrl) URL.revokeObjectURL(evidencePreviewUrl)
    }
  }, [evidencePreviewUrl])

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) {
      return items.map((b) => ({ value: String(b.id), label: b.name }))
    }
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])

  const stationOptionsBase: SelectOption[] = useMemo(
    () => (stationsForForm?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsForForm?.items],
  )

  const nozzleOptions: SelectOption[] = useMemo(
    () =>
      nozzlesForForm.map((n) => ({
        value: String(n.id),
        label: `${n.pumpNumber}${n.name ? ` · ${n.name}` : ''}`,
      })),
    [nozzlesForForm],
  )

  const businessSel = businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null
  const stationSel = stationOptionsBase.find((o) => o.value === String(stationId)) ?? null
  const nozzleSel = nozzleOptions.find((o) => o.value === String(nozzleId)) ?? null

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsForTable?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsForTable?.items])

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const nozzleLabelById = useMemo(() => {
    const m = new Map<number, string>()
    for (const n of nozzleRows) {
      m.set(n.id, `${n.pumpNumber}`)
      // ${n.name ?` · ${n.name}` : ''}
    }
    return m
  }, [nozzleRows])

  const fuelNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of fuelTypes) m.set(f.id, f.fuelName)
    return m
  }, [fuelTypes])

  const selectedPumpFuelLabel = useMemo(() => {
    if (nozzleId <= 0) return null
    const nozzle = nozzlesForForm.find((n) => n.id === nozzleId) ?? nozzleRows.find((n) => n.id === nozzleId)
    if (!nozzle) return null
    const dipping = (dippingsForForm?.items ?? []).find((d) => d.id === nozzle.dippingId)
    if (!dipping) return null
    return fuelNameById.get(dipping.fuelTypeId) ?? `Fuel #${dipping.fuelTypeId}`
  }, [nozzleId, nozzlesForForm, nozzleRows, dippingsForForm?.items, fuelNameById])

  useEffect(() => {
    if ((!open && !batchOpen) || !showStationPicker || formBusinessId == null || formBusinessId <= 0) return
    const items = stationsForForm?.items ?? []
    if (items.length === 0) return
    setStationId((sid) => {
      if (items.some((s) => s.id === sid)) return sid
      return items[0].id
    })
  }, [open, batchOpen, showStationPicker, formBusinessId, stationsForForm?.items])

  useEffect(() => {
    if ((!open && !batchOpen) || showStationPicker) return
    const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
    setStationId((s) => (s === sid ? s : sid))
  }, [open, batchOpen, showStationPicker, effectiveStationId])

  useEffect(() => {
    if ((!open && !batchOpen) || stationId <= 0 || nozzlesForForm.length === 0) return
    setNozzleId((pid) => {
      if (nozzlesForForm.some((p) => p.id === pid)) return pid
      return nozzlesForForm[0].id
    })
  }, [open, batchOpen, stationId, nozzlesForForm])

  useEffect(() => {
    if (!batchOpen || nozzleId <= 0 || latestNozzleLoading) return
    if (latestForNozzle?.closingLiters != null) {
      setOpeningLiters(String(latestForNozzle.closingLiters))
    } else {
      setOpeningLiters('0')
    }
    setClosingLiters('0')
  }, [batchOpen, nozzleId, latestNozzleLoading, latestForNozzle])

  const computedUsageLiters = useMemo(() => {
    const o = Number.parseFloat(String(openingLiters).replace(',', '.'))
    const c = Number.parseFloat(String(closingLiters).replace(',', '.'))
    if (!Number.isFinite(o) || !Number.isFinite(c)) return 0
    return Math.abs(o - c)
  }, [openingLiters, closingLiters])

  const computedUsageDisplay = useMemo(() => formatDecimal(computedUsageLiters), [computedUsageLiters])

  const selectedPumpFuelTypeId = useMemo(() => {
    if (nozzleId <= 0) return null
    const nozzle = nozzlesForForm.find((n) => n.id === nozzleId) ?? nozzleRows.find((n) => n.id === nozzleId)
    if (!nozzle) return null
    const dipping = (dippingsForForm?.items ?? []).find((d) => d.id === nozzle.dippingId)
    return dipping?.fuelTypeId ?? null
  }, [nozzleId, nozzlesForForm, nozzleRows, dippingsForForm?.items])

  const currencyCodeById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currencies) {
      m.set(c.id, (c.code || '').trim().toUpperCase())
    }
    return m
  }, [currencies])

  const resolvedFuelPriceSsp = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    if (stationId <= 0 || selectedPumpFuelTypeId == null) return null
    return (
      fuelPrices.find(
        (fp) =>
          fp.businessId === effectiveFormBusinessId &&
          fp.stationId === stationId &&
          fp.fuelTypeId === selectedPumpFuelTypeId &&
          currencyCodeById.get(fp.currencyId) === 'SSP',
      ) ?? null
    )
  }, [fuelPrices, effectiveFormBusinessId, stationId, selectedPumpFuelTypeId, currencyCodeById])

  const resolvedFuelPriceUsd = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    if (stationId <= 0 || selectedPumpFuelTypeId == null) return null
    return (
      fuelPrices.find(
        (fp) =>
          fp.businessId === effectiveFormBusinessId &&
          fp.stationId === stationId &&
          fp.fuelTypeId === selectedPumpFuelTypeId &&
          currencyCodeById.get(fp.currencyId) === 'USD',
      ) ?? null
    )
  }, [fuelPrices, effectiveFormBusinessId, stationId, selectedPumpFuelTypeId, currencyCodeById])

  const sspPricePerLiter =
    resolvedFuelPriceSsp != null ? Number(resolvedFuelPriceSsp.price) : null
  const usdPricePerLiter =
    resolvedFuelPriceUsd != null ? Number(resolvedFuelPriceUsd.price) : null

  const sspCurrencySymbol = useMemo(() => {
    if (resolvedFuelPriceSsp == null) return undefined
    return currencies.find((c) => c.id === resolvedFuelPriceSsp.currencyId)?.symbol
  }, [resolvedFuelPriceSsp, currencies])

  const usdCurrencySymbol = useMemo(() => {
    if (resolvedFuelPriceUsd == null) return undefined
    return currencies.find((c) => c.id === resolvedFuelPriceUsd.currencyId)?.symbol
  }, [resolvedFuelPriceUsd, currencies])

  const parsedSspLitersForm = useMemo(
    () => parseNumericInput(sspLitersStr.replace(/,/g, '')),
    [sspLitersStr],
  )
  const parsedUsdLitersForm = useMemo(
    () => parseNumericInput(usdLitersStr.replace(/,/g, '')),
    [usdLitersStr],
  )

  const literSplitMatchesUsage = useMemo(() => {
    if (!Number.isFinite(parsedSspLitersForm) || !Number.isFinite(parsedUsdLitersForm)) return false
    if (parsedSspLitersForm < -1e-9 || parsedUsdLitersForm < -1e-9) return false
    const sum = parsedSspLitersForm + parsedUsdLitersForm
    const tol = 0.001 + 1e-9 * Math.max(Math.abs(computedUsageLiters), Math.abs(sum))
    return Math.abs(sum - computedUsageLiters) <= tol
  }, [parsedSspLitersForm, parsedUsdLitersForm, computedUsageLiters])

  const computedSspAmountDisplay = useMemo(() => {
    if (sspPricePerLiter == null || !Number.isFinite(sspPricePerLiter)) return '—'
    const amt = (Number.isFinite(parsedSspLitersForm) ? parsedSspLitersForm : 0) * sspPricePerLiter
    return formatWithCurrencySymbol(amt, sspCurrencySymbol)
  }, [parsedSspLitersForm, sspPricePerLiter, sspCurrencySymbol])

  const computedUsdAmountDisplay = useMemo(() => {
    if (usdPricePerLiter == null || !Number.isFinite(usdPricePerLiter)) return '—'
    const amt = (Number.isFinite(parsedUsdLitersForm) ? parsedUsdLitersForm : 0) * usdPricePerLiter
    return formatWithCurrencySymbol(amt, usdCurrencySymbol ?? 'USD')
  }, [parsedUsdLitersForm, usdPricePerLiter, usdCurrencySymbol])

  const activeRateStr = useMemo(() => {
    if (effectiveFormBusinessId == null || effectiveFormBusinessId <= 0) return null
    const items = ratesData?.items ?? []
    const active = items.filter((r) => r.active && r.businessId === effectiveFormBusinessId)
    if (active.length === 0) return null
    active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return formatRateNumber(active[0].rateNumber)
  }, [ratesData, effectiveFormBusinessId])

  const activeRateNum = useMemo(() => parseNumericInput(activeRateStr ?? '0'), [activeRateStr])

  const hasActiveExchangeRate = Number.isFinite(activeRateNum) && activeRateNum > 0

  /** Default liter split: all usage in SSP lane when usage or context changes (batch line flow). */
  useEffect(() => {
    if (!batchOpen) return
    const u = computedUsageLiters
    if (!Number.isFinite(u) || u < 0) return
    setSspLitersStr(String(u))
    setUsdLitersStr('0')
  }, [batchOpen, computedUsageLiters, nozzleId, stationId])

  /** Pump → dipping → fuel type name → Petrol / Diesel (same nozzle map as amount resolution). */
  const resolveInventoryFuelCategory = useMemo(() => {
    const dippingById = new Map((dippingsLookup?.items ?? []).map((d) => [d.id, d]))
    return (r: Inventory) => {
      const nozzle = nozzleRows.find((n) => n.id === r.nozzleId)
      if (!nozzle || nozzle.dippingId <= 0) return '—'
      const dip = dippingById.get(nozzle.dippingId)
      if (!dip) return '—'
      const name = fuelNameById.get(dip.fuelTypeId) ?? ''
      return classifyPetrolDiesel(name)
    }
  }, [dippingsLookup?.items, nozzleRows, fuelNameById])

  const userNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usersData?.items ?? []) m.set(u.id, u.name)
    for (const u of permissionContextUsers ?? []) m.set(u.id, u.name)
    return m
  }, [usersData?.items, permissionContextUsers])

  function openBatchModal() {
    setEditing(null)
    setBatchDraft([])
    setEvidenceFile(null)
    if (showBizPicker) {
      setFormBusinessId(null)
      setStationId(0)
      setNozzleId(0)
    } else {
      const st =
        effectiveStationId != null && effectiveStationId > 0
          ? effectiveStationId
          : stationsForForm?.items[0]?.id ?? 0
      setStationId(st)
      setNozzleId(0)
    }
    setOpeningLiters('0')
    setClosingLiters('0')
    setSspLitersStr('0')
    setUsdLitersStr('0')
    setRecordDate(new Date().toISOString().slice(0, 10))
    setBatchOpen(true)
  }

  function addCurrentLineToBatch() {
    if (!canSave) return
    if (batchDraft.some((l) => l.nozzleId === nozzleId)) {
      return
    }
    const key = `${Date.now()}-${nozzleId}`
    setBatchDraft((d) => [
      ...d,
      {
        key,
        nozzleId,
        openingLiters,
        closingLiters,
        sspLiters: sspLitersStr.replace(/,/g, ''),
        usdLiters: usdLitersStr.replace(/,/g, ''),
      },
    ])
    setOpeningLiters(closingLiters)
    setClosingLiters('0')
    setSspLitersStr('0')
    setUsdLitersStr('0')
  }

  async function submitInventoryBatch() {
    const needsBiz = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    if (needsBiz || resolvedStation <= 0 || batchDraft.length === 0 || !evidenceFile) return

    const bid = showBizPicker ? formBusinessId! : authBusinessId!
    const payload = {
      businessId: bid,
      stationId: resolvedStation,
      recordedAt: `${recordDate}T12:00:00.000Z`,
      lines: batchDraft.map((l) => ({
        nozzleId: l.nozzleId,
        openingLiters: l.openingLiters,
        closingLiters: l.closingLiters,
        sspLiters: l.sspLiters,
        usdLiters: l.usdLiters,
      })),
    }
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('evidence', evidenceFile)
    await createInventoryBatch(fd).unwrap()
    setBatchOpen(false)
    setBatchDraft([])
    setEvidenceFile(null)
  }

  function openEdit(row: Inventory) {
    setBatchOpen(false)
    setEditing(row)
    if (showBizPicker) {
      setFormBusinessId(row.businessId)
    }
    setStationId(row.stationId)
    setNozzleId(row.nozzleId)
    setOpeningLiters(String(row.openingLiters))
    setClosingLiters(String(row.closingLiters))
    setSspLitersStr(String(row.sspLiters ?? 0))
    setUsdLitersStr(String(row.usdLiters ?? 0))
    setRecordDate(row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const needsBiz = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
    const resolvedStation = resolveFormStationId(role, stationId, effectiveStationId)
    if (needsBiz || resolvedStation <= 0 || nozzleId <= 0) return

    const body: InventoryWriteRequest = {
      nozzleId,
      stationId: resolvedStation,
      openingLiters,
      closingLiters,
      sspLiters: sspLitersStr.replace(/,/g, ''),
      usdLiters: usdLitersStr.replace(/,/g, ''),
      recordedAt: `${recordDate}T12:00:00.000Z`,
      ...(showBizPicker && formBusinessId != null ? { businessId: formBusinessId } : {}),
    }

    if (!editing) return
    await updateInv({ id: editing.id, body }).unwrap()
    setOpen(false)
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete inventory row?',
      description: 'This record will be removed.',
      action: async () => {
        await deleteInv(id).unwrap()
      },
    })
  }

  const needsBusiness = showBizPicker ? formBusinessId == null || formBusinessId <= 0 : authBusinessId == null || authBusinessId <= 0
  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const resolvedStationForUi = resolveFormStationId(role, stationId, effectiveStationId)
  const sspL = parsedSspLitersForm
  const usdL = parsedUsdLitersForm
  const needSspPrice = Number.isFinite(sspL) && sspL > 1e-9
  const needUsdPrice = Number.isFinite(usdL) && usdL > 1e-9
  const pricesOk =
    (!needSspPrice || (sspPricePerLiter != null && Number.isFinite(sspPricePerLiter) && sspPricePerLiter > 0)) &&
    (!needUsdPrice || (usdPricePerLiter != null && Number.isFinite(usdPricePerLiter) && usdPricePerLiter > 0))
  const canSave =
    !needsBusiness &&
    !needsWorkspaceStation &&
    resolvedStationForUi > 0 &&
    nozzleId > 0 &&
    literSplitMatchesUsage &&
    pricesOk

  const duplicateNozzleInBatch = batchDraft.some((l) => l.nozzleId === nozzleId)

  const canSubmitBatch =
    !needsBusiness &&
    !needsWorkspaceStation &&
    resolveFormStationId(role, stationId, effectiveStationId) > 0 &&
    batchDraft.length > 0 &&
    evidenceFile != null &&
    !batchSaving

  const sales = useMemo(() => {
    type SaleGroup = {
      saleId: number
      referenceNumber: string
      date: string
      userName: string
      businessId: number
      stationId: number
      evidenceFilePath: string | null
      items: Inventory[]
    }
    const map = new Map<number, SaleGroup>()
    for (const row of data?.items ?? []) {
      const sid = row.inventorySaleId ?? row.id
      const ex = map.get(sid)
      if (ex) {
        ex.items.push(row)
      } else {
        map.set(sid, {
          saleId: sid,
          referenceNumber: row.referenceNumber ?? `SALE-${sid}`,
          date: row.date,
          userName: row.userName?.trim() || userNameById.get(row.userId) || (row.userId ? `#${row.userId}` : '—'),
          businessId: row.businessId,
          stationId: row.stationId,
          evidenceFilePath: row.evidenceFilePath ?? null,
          items: [row],
        })
      }
    }
    return [...map.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [data?.items, userNameById])

  async function openEvidence(saleId: number, fileLabel?: string | null) {
    const raw = localStorage.getItem('gas-auth')
    const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
    if (!token) return
    const baseUrl = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const url = `${baseUrl}/api/Inventories/sales/${saleId}/evidence`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const blob = await res.blob()
    if (evidencePreviewUrl) URL.revokeObjectURL(evidencePreviewUrl)
    const objectUrl = URL.createObjectURL(blob)
    const type = (blob.type || '').toLowerCase()
    const kind = type.startsWith('image/') ? 'image' : type.includes('pdf') ? 'pdf' : 'other'
    setEvidencePreviewUrl(objectUrl)
    setEvidencePreviewTitle(fileLabel || `Evidence #${saleId}`)
    setEvidencePreviewKind(kind)
  }

  return (
    <>
      {deleteDialog}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 md:p-5 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
            />
            <button
              type="button"
              onClick={openBatchModal}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add inventory batch
            </button>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {isFetching && <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-slate-500">Loading…</div>}
          {!isFetching && sales.length === 0 && (
            <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-slate-500">No rows found.</div>
          )}
          {!isFetching &&
            sales.map((sale) => {
              const expanded = expandedSaleIds.has(sale.saleId)
              const totals = sale.items.reduce(
                (acc, row) => {
                  acc.opening += Number(row.openingLiters || 0)
                  acc.closing += Number(row.closingLiters || 0)
                  acc.usage += Number(row.usageLiters || 0)
                  acc.sspLiters += Number(row.sspLiters || 0)
                  acc.usdLiters += Number(row.usdLiters || 0)
                  acc.sspAmount += Number(row.sspAmount || 0)
                  acc.usdAmount += Number(row.usdAmount || 0)
                  return acc
                },
                { opening: 0, closing: 0, usage: 0, sspLiters: 0, usdLiters: 0, sspAmount: 0, usdAmount: 0 },
              )
              return (
                <div key={sale.saleId} className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 bg-linear-to-r from-slate-50 to-emerald-50/40 px-4 py-3 text-left hover:from-slate-100 hover:to-emerald-100/40"
                    onClick={() =>
                      setExpandedSaleIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(sale.saleId)) next.delete(sale.saleId)
                        else next.add(sale.saleId)
                        return next
                      })
                    }
                  >
                    <div className="grid flex-1 grid-cols-2 gap-2 text-sm md:grid-cols-5 md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Reference</p>
                        <span className="font-mono text-xs text-slate-800">{sale.referenceNumber}</span>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Date</p>
                        <span className="font-medium text-slate-700">{new Date(sale.date).toLocaleString()}</span>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">User</p>
                        <span className="font-medium text-slate-700">{sale.userName}</span>
                      </div>
                      {showBusinessColumnInTables(role) ? (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Business</p>
                          <span className="font-medium text-slate-700">{businessNameById.get(sale.businessId) ?? sale.businessId}</span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Station</p>
                          <span className="font-medium text-slate-700">{stationNameById.get(sale.stationId) ?? sale.stationId}</span>
                        </div>
                      )}
                      <span className="md:justify-self-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void openEvidence(sale.saleId, sale.referenceNumber)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View evidence
                        </button>
                      </span>
                    </div>
                    {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </button>
                  {expanded && (
                    <div className="overflow-x-auto">
                      <table className="w-max min-w-full text-sm">
                        <thead className="bg-white">
                          <tr className="border-t border-slate-200 text-slate-600">
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Nozzle</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Opening L</th>
                            <th className="px-3 py-2 text-right">Closing L</th>
                            <th className="px-3 py-2 text-right">Usage L</th>
                            <th className="px-3 py-2 text-right">SSP L</th>
                            <th className="px-3 py-2 text-right">USD L</th>
                            <th className="px-3 py-2 text-right">SSP amount</th>
                            <th className="px-3 py-2 text-right">USD amount</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((row) => (
                            <tr key={row.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{row.id}</td>
                              <td className="px-3 py-2">{nozzleLabelById.get(row.nozzleId) ?? `#${row.nozzleId}`}</td>
                              <td className="px-3 py-2">{resolveInventoryFuelCategory(row)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.openingLiters))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.closingLiters))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.usageLiters))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.sspLiters))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.usdLiters))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(row.sspAmount ?? 0))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(row.usdAmount ?? 0), 'USD')}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {Number(row.exchangeRate) > 1e-9 ? `${formatRateNumber(Number(row.exchangeRate))} SSP/USD` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOne(row.id)}
                                  className="inline-flex rounded p-1.5 text-rose-600 hover:bg-rose-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                            <td className="px-3 py-2" colSpan={3}>
                              Totals
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.opening)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.closing)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.usage)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.sspLiters)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.usdLiters)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(totals.sspAmount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.usdAmount, 'USD')}</td>
                            <td className="px-3 py-2 text-right tabular-nums">—</td>
                            <td className="px-3 py-2 text-right tabular-nums">—</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      <Modal
        open={evidencePreviewUrl != null}
        title={evidencePreviewTitle || 'Evidence'}
        onClose={() => {
          if (evidencePreviewUrl) URL.revokeObjectURL(evidencePreviewUrl)
          setEvidencePreviewUrl(null)
          setEvidencePreviewTitle('')
          setEvidencePreviewKind('other')
        }}
        className="max-w-6xl"
      >
        <div className="h-[78vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          {evidencePreviewUrl ? (
            evidencePreviewKind === 'image' ? (
              <img src={evidencePreviewUrl} alt="Inventory evidence" className="mx-auto h-auto max-w-full rounded-md object-contain" />
            ) : (
              <iframe src={evidencePreviewUrl} title="Inventory evidence" className="h-[74vh] w-full rounded-md bg-white" />
            )
          ) : null}
        </div>
      </Modal>
      <Modal
        open={open && editing != null}
        title="Edit inventory"
        onClose={() => setOpen(false)}
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setStationId(0)
                  setNozzleId(0)
                }}
                placeholder="Select business"
                isDisabled={!!editing}
              />
            </div>
          )}
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? 'Select a business to load stations and nozzles.'
                : 'No business assigned to your account.'}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                  setNozzleId(0)
                }}
                placeholder={needsBusiness ? 'Select business first' : 'Select station'}
                isDisabled={needsBusiness || stationOptionsBase.length === 0}
              />
            </div>
          )}
          <DateField value={recordDate} onChange={setRecordDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nozzle</label>
            <div className="flex flex-wrap items-stretch gap-3 sm:items-center">
              <div className="min-w-0 flex-1">
                <FormSelect
                  options={nozzleOptions}
                  value={nozzleSel}
                  onChange={(o) => setNozzleId(o ? Number(o.value) : 0)}
                  placeholder={stationId <= 0 ? 'Select station first' : 'Select nozzle'}
                  isDisabled={needsBusiness || stationId <= 0 || nozzleOptions.length === 0}
                />
              </div>
              <div
                className="flex min-h-[42px] min-w-28 flex-1 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 sm:max-w-48 sm:flex-none"
                title="Fuel type from this nozzle's dipping"
              >
                {selectedPumpFuelLabel ?? (
                  <span className="text-slate-400">{nozzleId > 0 ? '…' : '—'}</span>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Opening liters</label>
              <input
                type="text"
                required
                value={openingLiters}
                onChange={(e) => setOpeningLiters(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Closing liters</label>
              <input
                type="text"
                required
                value={closingLiters}
                onChange={(e) => setClosingLiters(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Usage liters <span className="font-normal text-slate-500">(always ≥ 0)</span>
            </label>
            <input
              type="text"
              readOnly
              value={computedUsageDisplay}
              title="Calculated from opening minus closing liters"
              className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Liters (SSP){' '}
                <span className="font-normal text-slate-500">(priced in SSP / L)</span>
              </label>
              <input
                type="text"
                required
                value={sspLitersStr}
                onChange={(e) => setSspLitersStr(sanitizeDecimalTyping(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Liters (USD){' '}
                <span className="font-normal text-slate-500">(priced in USD / L)</span>
              </label>
              <input
                type="text"
                required
                value={usdLitersStr}
                onChange={(e) => setUsdLitersStr(sanitizeDecimalTyping(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          {!literSplitMatchesUsage ? (
            <p className="text-xs text-amber-800">
              SSP liters + USD liters must equal usage liters ({formatDecimal(computedUsageLiters)} L).
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              SSP amount <span className="font-normal text-slate-500">(SSP liters × SSP fuel price)</span>
            </label>
            <div
              className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm ring-emerald-500/20 focus-within:ring-2"
              title="SSP liters × latest SSP fuel price row for this station and fuel type."
            >
              <input
                type="text"
                readOnly
                value={computedSspAmountDisplay}
                className="min-w-0 flex-1 cursor-default border-0 bg-transparent px-3 py-2.5 text-right tabular-nums text-slate-800 outline-none"
              />
              <div
                className="flex min-w-30 shrink-0 flex-col items-end justify-center border-l border-slate-200 bg-slate-100 px-3 py-2 text-right"
                title="SSP per liter from Setup → Fuel prices (currency SSP)"
              >
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">SSP / L</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {sspPricePerLiter != null && Number.isFinite(sspPricePerLiter)
                    ? formatWithCurrencySymbol(sspPricePerLiter, sspCurrencySymbol)
                    : '—'}
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              USD amount <span className="font-normal text-slate-500">(USD liters × USD fuel price)</span>
            </label>
            <div
              className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm ring-slate-500/20 focus-within:ring-2"
              title="USD liters × latest USD fuel price row for this station and fuel type."
            >
              <input
                type="text"
                readOnly
                value={computedUsdAmountDisplay}
                className="min-w-0 flex-1 cursor-default border-0 bg-transparent px-3 py-2.5 text-right tabular-nums text-slate-800 outline-none"
              />
              <div
                className="flex min-w-30 shrink-0 flex-col items-end justify-center border-l border-slate-200 bg-slate-100 px-3 py-2 text-right"
                title="USD per liter from Setup → Fuel prices (currency USD)"
              >
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">USD / L</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {usdPricePerLiter != null && Number.isFinite(usdPricePerLiter)
                    ? formatWithCurrencySymbol(usdPricePerLiter, usdCurrencySymbol ?? 'USD')
                    : '—'}
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Exchange rate <span className="font-normal text-slate-500">(stored for reporting only)</span>
            </label>
            <input
              type="text"
              readOnly
              value={hasActiveExchangeRate && activeRateStr != null ? `${activeRateStr} SSP/USD` : '— (no active rate)'}
              title="Saved on the record when an active rate exists; not used to derive amounts."
              className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
            />
          </div>
          {nozzleId > 0 && selectedPumpFuelTypeId == null ? (
            <p className="mt-1 text-xs text-amber-800">No fuel type on this nozzle's dipping.</p>
          ) : null}
          {nozzleId > 0 && selectedPumpFuelTypeId != null && !needsBusiness && resolvedFuelPriceSsp == null && needSspPrice ? (
            <p className="mt-1 text-xs text-amber-800">
              Add an SSP fuel price (currency code SSP) for this station and fuel type under Setup → Fuel prices.
            </p>
          ) : null}
          {nozzleId > 0 && selectedPumpFuelTypeId != null && !needsBusiness && resolvedFuelPriceUsd == null && needUsdPrice ? (
            <p className="mt-1 text-xs text-amber-800">
              Add a USD fuel price (currency code USD) for this station and fuel type under Setup → Fuel prices.
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={batchOpen}
        title="Add inventory batch"
        onClose={() => {
          setBatchOpen(false)
          setBatchDraft([])
          setEvidenceFile(null)
        }}
        className="max-h-[92vh] max-w-5xl overflow-y-auto"
      >
        <div className="space-y-4 text-base">
          <p className="text-sm text-slate-600">
            Add each nozzle reading to the list, then attach one evidence file. All lines save together with one
            reference number for this station.
          </p>
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setFormBusinessId(o ? Number(o.value) : null)
                  setStationId(0)
                  setNozzleId(0)
                }}
                placeholder="Select business"
              />
            </div>
          )}
          {needsBusiness && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {showBizPicker
                ? 'Select a business to load stations and nozzles.'
                : 'No business assigned to your account.'}
            </div>
          )}
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Station</label>
              <FormSelect
                options={stationOptionsBase}
                value={stationSel}
                onChange={(o) => {
                  setStationId(o ? Number(o.value) : 0)
                  setNozzleId(0)
                }}
                placeholder={needsBusiness ? 'Select business first' : 'Select station'}
                isDisabled={needsBusiness || stationOptionsBase.length === 0}
              />
            </div>
          )}
          <DateField value={recordDate} onChange={setRecordDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nozzle</label>
            <div className="flex flex-wrap items-stretch gap-3 sm:items-center">
              <div className="min-w-0 flex-1">
                <FormSelect
                  options={nozzleOptions}
                  value={nozzleSel}
                  onChange={(o) => setNozzleId(o ? Number(o.value) : 0)}
                  placeholder={stationId <= 0 ? 'Select station first' : 'Select nozzle'}
                  isDisabled={needsBusiness || stationId <= 0 || nozzleOptions.length === 0}
                />
              </div>
              <div className="flex min-h-[42px] min-w-28 flex-1 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 sm:max-w-48 sm:flex-none">
                {selectedPumpFuelLabel ?? <span className="text-slate-400">{nozzleId > 0 ? '…' : '—'}</span>}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Opening liters</label>
              <input
                type="text"
                value={openingLiters}
                onChange={(e) => setOpeningLiters(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Closing liters</label>
              <input
                type="text"
                value={closingLiters}
                onChange={(e) => setClosingLiters(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Usage liters</label>
            <input
              type="text"
              readOnly
              value={computedUsageDisplay}
              className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Liters (SSP)</label>
              <input
                type="text"
                value={sspLitersStr}
                onChange={(e) => setSspLitersStr(sanitizeDecimalTyping(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Liters (USD)</label>
              <input
                type="text"
                value={usdLitersStr}
                onChange={(e) => setUsdLitersStr(sanitizeDecimalTyping(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          {!literSplitMatchesUsage ? (
            <p className="text-xs text-amber-800">
              SSP liters + USD liters must equal usage liters ({formatDecimal(computedUsageLiters)} L).
            </p>
          ) : null}
          {duplicateNozzleInBatch ? (
            <p className="text-xs text-amber-800">This nozzle is already in the batch list.</p>
          ) : null}
          <button
            type="button"
            onClick={addCurrentLineToBatch}
            disabled={!canSave || duplicateNozzleInBatch}
            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 sm:w-auto"
          >
            Add nozzle line to batch
          </button>
          {batchDraft.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                Lines to save ({batchDraft.length})
              </p>
              <table className="w-max min-w-full text-sm">
                <thead className="bg-white">
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-2 text-left">Nozzle</th>
                    <th className="px-3 py-2 text-right">Opening L</th>
                    <th className="px-3 py-2 text-right">Closing L</th>
                    <th className="px-3 py-2 text-right">SSP L</th>
                    <th className="px-3 py-2 text-right">USD L</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchDraft.map((l) => (
                    <tr key={l.key} className="border-b border-slate-100 text-[15px]">
                      <td className="px-3 py-2 font-medium">{nozzleLabelById.get(l.nozzleId) ?? `#${l.nozzleId}`}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(l.openingLiters || 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(l.closingLiters || 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(l.sspLiters || 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(Number(l.usdLiters || 0))}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-rose-600 hover:underline"
                          onClick={() => setBatchDraft((d) => d.filter((x) => x.key !== l.key))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Evidence file (required)</label>
            <input
              type="file"
              className="block w-full text-sm text-slate-600"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            />
            {evidenceFile ? <p className="mt-1 text-xs text-slate-500">Selected: {evidenceFile.name}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setBatchOpen(false)
                setBatchDraft([])
                setEvidenceFile(null)
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmitBatch}
              onClick={() => void submitInventoryBatch()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {batchSaving ? 'Saving…' : 'Save batch'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
