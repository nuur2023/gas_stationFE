import { useMemo } from 'react'
import { Droplets, Flame, Table2 } from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  useGetDippingsQuery,
  useGetFuelTypesQuery,
  useGetGeneratorUsagesQuery,
  useGetInventoriesQuery,
  useGetNozzlesByBusinessQuery,
} from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
import { useNavAccess } from '../hooks/useNavAccess'
import { formatDecimal } from '../lib/formatNumber'

type FuelKind = 'petrol' | 'diesel'

function detectFuelKind(name: string): FuelKind | null {
  const n = name.toLowerCase()
  if (n.includes('petrol') || n.includes('gasoline')) return 'petrol'
  if (n.includes('diesel')) return 'diesel'
  return null
}

/** Local calendar yyyy-mm-dd (not UTC) so chart days and filters match the user’s date. */
function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function DashboardWelcome({ userName }: { userName: string | null }) {
  const display = userName?.trim() || '—'
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -left-6 -top-4 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl md:h-72 md:w-72"
        aria-hidden
      />
      <div className="relative max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Welcome back</h1>
        <p className="mt-3 text-xl font-semibold text-slate-800 md:text-2xl">{display}</p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
          Choose a section from the menu to get started.
        </p>
        <div
          className="mt-8 h-1 w-16 rounded-full bg-linear-to-r from-emerald-500 to-emerald-400/40"
          aria-hidden
        />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const userName = useAppSelector((s) => s.auth.name)
  const { canViewDashboard } = useNavAccess()

  if (!canViewDashboard) {
    return <DashboardWelcome userName={userName} />
  }

  return <DashboardContent />
}

function DashboardContent() {
  const PIE_COLORS = ['#22c55e', '#0f766e', '#334155', '#64748b', '#94a3b8', '#cbd5e1']
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const { data: inventories } = useGetInventoriesQuery({
    page: 1,
    pageSize: 500,
    q: undefined,
  })
  const { data: nozzleRows = [] } = useGetNozzlesByBusinessQuery(authBusinessId ?? 0, {
    skip: authBusinessId == null || authBusinessId <= 0,
  })
  const { data: dippingsData } = useGetDippingsQuery({
    page: 1,
    pageSize: 1000,
    q: undefined,
    businessId: undefined,
  })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: generatorUsages } = useGetGeneratorUsagesQuery({
    page: 1,
    pageSize: 1000,
    q: undefined,
  })

  /** Inventory rows from the last three local calendar days, newest first. */
  const recentInventoryRows = useMemo(() => {
    const items = inventories?.items ?? []
    const now = new Date()
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oldest = new Date(todayLocal)
    oldest.setDate(todayLocal.getDate() - 2)
    const fromKey = localYmd(oldest)

    const rows = items.filter((inv) => {
      const key = localYmd(new Date(inv.date))
      return key >= fromKey
    })
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return rows
  }, [inventories?.items])

  const fuelTypeKindById = useMemo(() => {
    const m = new Map<number, FuelKind>()
    for (const f of fuelTypes) {
      const k = detectFuelKind(f.fuelName)
      if (k) m.set(f.id, k)
    }
    return m
  }, [fuelTypes])

  const dippings = dippingsData?.items ?? []

  const nozzleLabelById = useMemo(() => {
    const m = new Map<number, string>()
    for (const n of nozzleRows) {
      m.set(n.id, `${n.pumpNumber}${n.name?.trim() ? ` · ${n.name}` : ''}`)
    }
    return m
  }, [nozzleRows])

  const fuelKindByNozzleId = useMemo(() => {
    const dippingFuelTypeById = new Map<number, number>()
    for (const d of dippings) dippingFuelTypeById.set(d.id, d.fuelTypeId)
    const m = new Map<number, FuelKind>()
    for (const n of nozzleRows) {
      const ftid = dippingFuelTypeById.get(n.dippingId)
      if (!ftid) continue
      const k = fuelTypeKindById.get(ftid)
      if (k) m.set(n.id, k)
    }
    return m
  }, [nozzleRows, dippings, fuelTypeKindById])

  /** Seven consecutive local days ending today: oldest → newest (left → right on chart). */
  const chartData = useMemo(() => {
    const items = inventories?.items ?? []
    const byDay = new Map<string, { petrol: number; diesel: number }>()
    for (const inv of items) {
      const day = localYmd(new Date(inv.date))
      const kind = fuelKindByNozzleId.get(inv.nozzleId)
      if (!kind) continue
      const current = byDay.get(day) ?? { petrol: 0, diesel: 0 }
      if (kind === 'petrol') current.petrol += Number(inv.usageLiters) || 0
      if (kind === 'diesel') current.diesel += Number(inv.usageLiters) || 0
      byDay.set(day, current)
    }

    const now = new Date()
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const keys: string[] = []
    for (let back = 6; back >= 0; back--) {
      const d = new Date(todayLocal)
      d.setDate(todayLocal.getDate() - back)
      keys.push(localYmd(d))
    }

    return keys.map((date) => ({
      date,
      petrol: byDay.get(date)?.petrol ?? 0,
      diesel: byDay.get(date)?.diesel ?? 0,
    }))
  }, [inventories?.items, fuelKindByNozzleId])

  const currentDippingByKind = useMemo(() => {
    let petrol = 0
    let diesel = 0
    for (const d of dippings) {
      const k = fuelTypeKindById.get(d.fuelTypeId)
      if (k === 'petrol') petrol += Number(d.amountLiter) || 0
      if (k === 'diesel') diesel += Number(d.amountLiter) || 0
    }
    return { petrol, diesel }
  }, [dippings, fuelTypeKindById])

  const recentInventoryPieData = useMemo(() => {
    const byNozzle = new Map<string, number>()
    for (const row of recentInventoryRows) {
      const label = nozzleLabelById.get(row.nozzleId) ?? `Nozzle #${row.nozzleId}`
      const usage = Number(row.usageLiters) || 0
      byNozzle.set(label, (byNozzle.get(label) ?? 0) + usage)
    }
    return Array.from(byNozzle.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [recentInventoryRows, nozzleLabelById])

  const recentInventoryTotalUsage = useMemo(
    () => recentInventoryPieData.reduce((sum, row) => sum + row.value, 0),
    [recentInventoryPieData],
  )

  const todayUsageByKind = useMemo(() => {
    const rows = inventories?.items ?? []
    const today = new Date().toISOString().slice(0, 10)
    let petrol = 0
    let diesel = 0
    for (const r of rows) {
      if (!r.date.startsWith(today)) continue
      const k = fuelKindByNozzleId.get(r.nozzleId)
      if (k === 'petrol') petrol += Number(r.usageLiters) || 0
      if (k === 'diesel') diesel += Number(r.usageLiters) || 0
    }
    return { petrol, diesel }
  }, [inventories?.items, fuelKindByNozzleId])

  /** Petrol generator liters recorded for the current local calendar day only. */
  const todayPetrolGeneratorLiters = useMemo(() => {
    const today = localYmd(new Date())
    const items = generatorUsages?.items ?? []
    let sum = 0
    for (const g of items) {
      if (g.fuelTypeId == null) continue
      const k = fuelTypeKindById.get(g.fuelTypeId)
      if (k !== 'petrol') continue
      const day = localYmd(new Date(g.date))
      if (day !== today) continue
      sum += Number(g.ltrUsage) || 0
    }
    return sum
  }, [generatorUsages?.items, fuelTypeKindById])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">Inventory amounts (usage × fuel price) and recent records.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Petrol Dipping Liter</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatDecimal(currentDippingByKind.petrol)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Latest total from Dipping rows</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Droplets className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Diesel Dipping Liter</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatDecimal(currentDippingByKind.diesel)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Latest total from Dipping rows</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Droplets className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Generator Usage Liter</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatDecimal(todayPetrolGeneratorLiters)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today&apos;s petrol generator usage (liters)</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
              <Flame className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Today&apos;s Petrol Liter Usage
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatDecimal(todayUsageByKind.petrol)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today usage from Inventory (after closing calculation)</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Table2 className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Today&apos;s Diesel Liter Usage
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatDecimal(todayUsageByKind.diesel)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today usage from Inventory (after closing calculation)</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Table2 className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Today&apos;s Total Fuel Sold
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {formatDecimal(todayUsageByKind.petrol + todayUsageByKind.diesel)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today&apos;s Petrol + Diesel usage from Inventory</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Droplets className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Usage trend (Petrol vs Diesel)</h2>
        <p className="mb-4 text-sm text-slate-500">Last 7 local calendar days (oldest to newest).</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ bottom: 8, left: 4, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={52}
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                formatter={(value: number, name: string, item: { dataKey?: string | number }) => {
                  const dk = item?.dataKey != null ? String(item.dataKey) : ''
                  let label =
                    dk === 'petrol' ? 'Petrol usage L' : dk === 'diesel' ? 'Diesel usage L' : ''
                  if (!label) {
                    const n = String(name).toLowerCase()
                    if (n.includes('petrol')) label = 'Petrol usage L'
                    else if (n.includes('diesel')) label = 'Diesel usage L'
                  }
                  return [formatDecimal(Number(value)), label || name]
                }}
              />
              <Line
                type="monotone"
                dataKey="petrol"
                stroke="#059669"
                dot={{ r: 3 }}
                strokeWidth={2}
                name="Petrol usage L"
              />
              <Line
                type="monotone"
                dataKey="diesel"
                stroke="#2563eb"
                dot={{ r: 3 }}
                strokeWidth={2}
                name="Diesel usage L"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-800">Recent inventory</h2>
          <p className="mt-1 text-sm text-slate-500">Last 3 local calendar days only.</p>
        </div>
        {recentInventoryPieData.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No inventory rows in the last 3 days.</div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[340px_1fr]">
            <div className="h-64 rounded-lg bg-slate-50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recentInventoryPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={0}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {recentInventoryPieData.map((_, index) => (
                      <Cell key={`recent-inv-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const amount = Number(value) || 0
                      const pct = recentInventoryTotalUsage > 0 ? (amount / recentInventoryTotalUsage) * 100 : 0
                      return [`${formatDecimal(amount)} L (${pct.toFixed(1)}%)`, name]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Pump / Nozzle</span>
                <span className="text-right">Usage L</span>
                <span className="text-right">%</span>
              </div>
              <div className="divide-y divide-slate-100">
                {recentInventoryPieData.map((row, index) => {
                  const pct = recentInventoryTotalUsage > 0 ? (row.value / recentInventoryTotalUsage) * 100 : 0
                  return (
                    <div key={row.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span
                          className="inline-block h-6 w-1.5 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          aria-hidden
                        />
                        <span className="truncate">{row.name}</span>
                      </div>
                      <span className="text-right tabular-nums font-medium text-slate-800">{formatDecimal(row.value)}</span>
                      <span className="text-right tabular-nums text-slate-600">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
