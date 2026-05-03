import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useGetAccountsQuery,
  useGetAccountsWithBalancesQuery,
  useGetBusinessesQuery,
  useGetChartsOfAccountsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { TreeChartsOfAccounts } from '../../components/TreeChartsOfAccounts'
import { filterAccountsForViewer } from '../../lib/accountScope'
import { buildSectionsForCharts } from '../../lib/chartOfAccountsTree'
import { showBusinessPickerInForms, useEffectiveStationId } from '../../lib/stationContext'
import type { Account } from '../../types/models'

function accountBalanceApiRow(r: unknown): { id: number; balance: number } | null {
  if (r == null || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const rawId = o.id ?? o.Id
  const rawBal = o.balance ?? o.Balance
  const id = typeof rawId === 'number' ? rawId : Number(rawId)
  if (!Number.isFinite(id)) return null
  const bal = typeof rawBal === 'number' ? rawBal : Number(rawBal)
  return { id, balance: Number.isFinite(bal) ? bal : 0 }
}

export function TreeChartsOfAccountsPage() {
  const navigate = useNavigate()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const [filterBusinessId, setFilterBusinessId] = useState<number | null>(authBusinessId ?? null)

  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })

  useEffect(() => {
    if (!showBizPicker) return
    if (filterBusinessId != null) return
    if (authBusinessId != null && authBusinessId > 0) {
      setFilterBusinessId(authBusinessId)
      return
    }
    const items = businesses?.items ?? []
    if (items.length === 1) setFilterBusinessId(items[0].id)
  }, [showBizPicker, filterBusinessId, authBusinessId, businesses?.items])

  const businessQueryId = showBizPicker ? (filterBusinessId ?? undefined) : (authBusinessId ?? undefined)
  const accountsQuerySkipped =
    (!showBizPicker && (authBusinessId == null || authBusinessId <= 0)) ||
    (showBizPicker && (businessQueryId == null || businessQueryId <= 0))
  const { data, isFetching: accountsLoading } = useGetAccountsQuery(
    { page: 1, pageSize: 3000, businessId: businessQueryId },
    { skip: accountsQuerySkipped },
  )
  const { data: chartsOfAccounts, isFetching: chartsLoading } = useGetChartsOfAccountsQuery({})

  const trialBusinessId = businessQueryId != null && businessQueryId > 0 ? businessQueryId : 0
  const { data: balanceRows, isFetching: balancesLoading } = useGetAccountsWithBalancesQuery(
    {
      businessId: trialBusinessId,
      trialBalanceMode: 'adjusted',
      ...(effectiveStationId != null && effectiveStationId > 0 ? { stationId: effectiveStationId } : {}),
    },
    { skip: trialBusinessId <= 0 },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businesses?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businesses?.items],
  )

  const tableRows = data?.items
  const visibleAccounts = useMemo(() => {
    const rows = tableRows ?? []
    const scoped = filterAccountsForViewer(rows, role, authBusinessId)
    if (role === 'SuperAdmin') return scoped
    return scoped.filter((a) => a.businessId != null)
  }, [tableRows, role, authBusinessId])

  const charts = chartsOfAccounts ?? []
  const sections = useMemo(
    () => buildSectionsForCharts(charts, visibleAccounts),
    [charts, visibleAccounts],
  )

  const directBalanceByAccountId = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of visibleAccounts) m.set(a.id, 0)
    for (const r of balanceRows ?? []) {
      const row = accountBalanceApiRow(r)
      if (row) m.set(row.id, row.balance)
    }
    return m
  }, [balanceRows, visibleAccounts])

  const loading = accountsLoading || chartsLoading || (trialBusinessId > 0 && balancesLoading)

  const goToGeneralLedger = useCallback(
    (account: Account) => {
      const q = new URLSearchParams({ accountId: String(account.id) })
      if (showBizPicker && businessQueryId != null && businessQueryId > 0) {
        q.set('businessId', String(businessQueryId))
      }
      navigate(`/financial-reports/general-ledger?${q.toString()}`)
    },
    [navigate, showBizPicker, businessQueryId],
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Chart of accounts (tree)</h1>
          <p className="text-sm text-slate-600">
            Balances are the sum of all posted journal lines for each account (debits and credits; adjusted mode excludes
            closing entries only). Normal balance by account type (e.g. equity credits show positive). Parent rows add
            child totals. When a workspace station is set in Settings, only postings for that station are included.
            Balances refresh when you post or change journals. Click an account name or balance to open the general ledger
            for that account.
          </p>
        </div>
        {showBizPicker ? (
          <div className="w-full sm:w-72">
            <label className="mb-1 block text-xs font-medium text-slate-600">Business</label>
            <FormSelect
              options={businessOptions}
              value={businessOptions.find((o) => o.value === String(filterBusinessId ?? '')) ?? null}
              onChange={(o) => setFilterBusinessId(o?.value ? Number(o.value) : null)}
              placeholder="Select business"
              isClearable
            />
          </div>
        ) : null}
      </div>

      <TreeChartsOfAccounts
        sections={sections}
        directBalanceByAccountId={directBalanceByAccountId}
        onAccountClick={goToGeneralLedger}
        isLoading={loading}
      />
    </div>
  )
}
