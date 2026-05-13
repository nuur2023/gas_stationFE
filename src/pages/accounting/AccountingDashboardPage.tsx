import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  useGetAccountingDashboardOverviewQuery,
  useGetAccountingDashboardRecentTransactionsQuery,
  useGetBusinessesQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { formatCurrency } from '../../lib/formatNumber'
import { showBusinessPickerInForms, showStationPickerInForms, useEffectiveStationId } from '../../lib/stationContext'

function money(n: number) {
  return formatCurrency(n, 'USD')
}

const COLORS = ['#0d9488', '#f59e0b', '#6366f1', '#ec4899', '#64748b']

const TX_PAGE_SIZE = 10

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultLastTwoDaysRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 1)
  return { from: formatYmdLocal(from), to: formatYmdLocal(to) }
}

export function AccountingDashboardPage() {
  const { canView: routeCanView } = usePagePermissionActions()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPick = showStationPickerInForms(role)
  const effectiveStationId = useEffectiveStationId()

  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)
  const [scopeStationId, setScopeStationId] = useState<number | ''>('')

  const businessQueryId = showBizPicker ? filterBusinessId ?? undefined : authBusinessId ?? undefined
  const effectiveBusinessId = businessQueryId ?? 0

  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stations } = useGetStationsQuery(
    { page: 1, pageSize: 500, businessId: effectiveBusinessId > 0 ? effectiveBusinessId : undefined },
    { skip: effectiveBusinessId <= 0 },
  )

  const appliedStationId = useMemo(() => {
    if (showStationPick) {
      if (scopeStationId === '' || scopeStationId === 0) return undefined
      return Number(scopeStationId)
    }
    if (effectiveStationId != null && effectiveStationId > 0) return effectiveStationId
    return undefined
  }, [showStationPick, scopeStationId, effectiveStationId])

  const skipQuery = !routeCanView || effectiveBusinessId <= 0
  const { data, isFetching, isError, error } = useGetAccountingDashboardOverviewQuery(
    { businessId: effectiveBusinessId, stationId: appliedStationId },
    { skip: skipQuery },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businesses?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businesses?.items],
  )

  const filterBusinessValue = useMemo(
    () => businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null,
    [businessOptions, filterBusinessId],
  )

  const stationOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: '', label: 'All stations (business)' }]
    const rest = (stations?.items ?? []).map((s) => ({ value: String(s.id), label: s.name ?? `Station ${s.id}` }))
    return [...base, ...rest]
  }, [stations?.items])

  const stationScopeValue = useMemo(
    () => stationOptions.find((o) => o.value === (scopeStationId === '' ? '' : String(scopeStationId))) ?? stationOptions[0] ?? null,
    [stationOptions, scopeStationId],
  )

  const initialTxRange = useMemo(() => defaultLastTwoDaysRange(), [])
  const [txDraftFrom, setTxDraftFrom] = useState(initialTxRange.from)
  const [txDraftTo, setTxDraftTo] = useState(initialTxRange.to)
  const [txAppliedFrom, setTxAppliedFrom] = useState(initialTxRange.from)
  const [txAppliedTo, setTxAppliedTo] = useState(initialTxRange.to)
  const [txPage, setTxPage] = useState(1)

  const { data: txData, isFetching: txFetching } = useGetAccountingDashboardRecentTransactionsQuery(
    {
      businessId: effectiveBusinessId,
      stationId: appliedStationId,
      from: txAppliedFrom,
      to: txAppliedTo,
      page: txPage,
      pageSize: TX_PAGE_SIZE,
    },
    { skip: skipQuery },
  )

  const txTotalPages = Math.max(1, Math.ceil((txData?.totalCount ?? 0) / TX_PAGE_SIZE))

  const plBars = useMemo(() => {
    if (!data) return []
    return [
      {
        name: 'This period',
        Revenue: data.profitLossCompare.thisMonth.revenue,
        Expenses: data.profitLossCompare.thisMonth.expenses,
        Profit: data.profitLossCompare.thisMonth.profit,
      },
      {
        name: 'Prior period',
        Revenue: data.profitLossCompare.previousMonth.revenue,
        Expenses: data.profitLossCompare.previousMonth.expenses,
        Profit: data.profitLossCompare.previousMonth.profit,
      },
    ]
  }, [data])

  const expensePie = useMemo(() => {
    if (!data) return []
    const e = data.expenseBreakdownThisMonth
    const rows = [
      { name: 'Salaries', value: e.salaries },
      { name: 'Rent', value: e.rent },
      { name: 'Utilities', value: e.utilities },
      { name: 'Supplies', value: e.supplies },
      { name: 'Other', value: e.other },
    ]
    return rows.filter((r) => Math.abs(r.value) > 0.0001)
  }, [data])

  return (
    <div className="relative space-y-6">
      {!routeCanView ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-24 backdrop-blur-sm">
          <p className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">You do not have permission to view this page.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Accounting dashboard</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {showBizPicker ? (
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
              <FormSelect
                options={businessOptions}
                value={filterBusinessValue}
                onChange={(opt) => setFilterBusinessId(opt ? Number(opt.value) : null)}
                placeholder="Select business"
                isClearable
              />
            </div>
          ) : null}
          {showStationPick ? (
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">Station scope</label>
              <FormSelect
                options={stationOptions}
                value={stationScopeValue}
                onChange={(opt) => {
                  const v = opt?.value ?? ''
                  setScopeStationId(v === '' ? '' : Number(v))
                }}
                placeholder="Station"
              />
            </div>
          ) : null}
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error && 'data' in error && error.data != null
            ? String((error.data as { message?: string }).message ?? 'Failed to load dashboard.')
            : 'Failed to load dashboard.'}
        </div>
      ) : null}

      {isFetching && !data ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[
              { label: 'Total revenue', value: money(data.kpis.totalRevenue), tone: 'text-emerald-700' },
              { label: 'Net profit', value: money(data.kpis.netProfit), tone: data.kpis.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'Total expenses', value: money(data.kpis.totalExpenses), tone: 'text-amber-700' },
              { label: 'Cash balance', value: money(data.kpis.cashBalance), tone: 'text-slate-800' },
              {
                label: 'Bank balance',
                value: money(data.kpis.bankBalance),
                tone: 'text-slate-800',
                title:
                  'Bank includes asset accounts whose names look like bank balances (e.g. Bank, Checking, Savings). Cash on hand or “Cash” without those words is counted under Cash — so Bank can be $0 if you only use a cash account.',
              },
              { label: 'Inventory value', value: money(data.kpis.inventoryValue), tone: 'text-slate-800' },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                title={'title' in k && typeof k.title === 'string' ? k.title : undefined}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className={`mt-2 text-lg font-semibold tabular-nums ${k.tone}`}>{k.value}</div>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-1">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Profit &amp; loss overview</h2>
              <p className="mb-4 text-xs text-slate-500">This month vs same-length prior month.</p>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Cash flow (this month)</h2>
              <p className="mb-4 text-xs text-slate-500">Direct method — aligned with financial reports.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Operating</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">{money(data.cashFlowThisMonth.operatingCashFlow)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Investing</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">{money(data.cashFlowThisMonth.investingCashFlow)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Financing</div>
                  <div className="mt-1 font-semibold tabular-nums text-slate-900">{money(data.cashFlowThisMonth.financingCashFlow)}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-800">Net change</div>
                  <div className="mt-1 font-semibold tabular-nums text-emerald-900">{money(data.cashFlowThisMonth.netCashChange)}</div>
                </div>
              </div>
              <div className="mt-4 h-48 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.cashTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="netCashChange" fill="#0d9488" name="Net cash" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Expense breakdown</h2>
            <p className="mb-4 text-xs text-slate-500">Operating expenses this month (by category).</p>
            {expensePie.length === 0 ? (
              <p className="text-sm text-slate-500">No expense activity in the current month.</p>
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                      {expensePie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Recent transactions</h2>
            <p className="mb-4 text-xs text-slate-500">
              Journal lines in the selected date range (default: last two calendar days). Use filters and pagination to browse.
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
                <input
                  type="date"
                  value={txDraftFrom}
                  max={txDraftTo}
                  onChange={(e) => setTxDraftFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
                <input
                  type="date"
                  value={txDraftTo}
                  min={txDraftFrom}
                  onChange={(e) => setTxDraftTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={() => {
                  setTxAppliedFrom(txDraftFrom)
                  setTxAppliedTo(txDraftTo)
                  setTxPage(1)
                }}
              >
                Apply dates
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const r = defaultLastTwoDaysRange()
                  setTxDraftFrom(r.from)
                  setTxDraftTo(r.to)
                  setTxAppliedFrom(r.from)
                  setTxAppliedTo(r.to)
                  setTxPage(1)
                }}
              >
                Last 2 days
              </button>
            </div>
            {txFetching && !txData ? (
              <p className="text-sm text-slate-500">Loading transactions…</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs text-slate-500">
                        <th className="py-2 pr-2">Entry</th>
                        <th className="py-2 pr-2">Date</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Account</th>
                        <th className="py-2 pr-2">Description</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(txData?.items ?? []).map((r, idx) => (
                        <tr key={`${r.journalEntryId}-${idx}-${r.accountCode ?? ''}`} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-2 tabular-nums text-slate-600">#{r.journalEntryId}</td>
                          <td className="py-2 pr-2 tabular-nums text-slate-600">{new Date(r.date).toLocaleDateString()}</td>
                          <td className="py-2 pr-2 text-slate-700">{r.kind}</td>
                          <td className="py-2 pr-2 text-slate-800">
                            {r.accountCode ? `${r.accountCode} — ` : ''}
                            {r.account}
                          </td>
                          <td className="max-w-[200px] truncate py-2 pr-2 text-slate-600" title={r.description ?? ''}>
                            {r.description ?? '—'}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium text-slate-900">{money(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <span>
                    {(txData?.totalCount ?? 0) === 0
                      ? 'No lines in this range.'
                      : `Showing ${(txPage - 1) * TX_PAGE_SIZE + 1}–${Math.min(txPage * TX_PAGE_SIZE, txData?.totalCount ?? 0)} of ${txData?.totalCount}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="tabular-nums text-slate-500">
                      Page {txPage} / {txTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={txPage >= txTotalPages}
                      onClick={() => setTxPage((p) => p + 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {!skipQuery && !isFetching && !data && !isError && routeCanView ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Select a business to load the dashboard.</div>
      ) : null}
    </div>
  )
}
