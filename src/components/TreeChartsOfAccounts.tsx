import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleArrowRight,
  Folder,
  FolderOpen,
  Search,
} from 'lucide-react'
import { formatDecimal } from '../lib/formatNumber'
import {
  accountKey,
  accountMatchesQuery,
  chartKey,
  collectExpandKeys,
  sectionHasAnyMatch,
  subtreeHasMatch,
  type TreeAccountNode,
  type TreeChartSection,
} from '../lib/chartOfAccountsTree'
import { cn } from '../lib/cn'
import type { Account } from '../types/models'

type TreeChartsOfAccountsProps = {
  sections: TreeChartSection[]
  /** Direct activity balance per account id (own postings only; rollups add children). */
  directBalanceByAccountId: Map<number, number>
  /** Open General Ledger (or other route) for this account. */
  onAccountClick?: (account: Account) => void
  isLoading?: boolean
}

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$ ${formatDecimal(Math.abs(n))}`
}

function balanceColorClass(n: number): string {
  if (n < 0) return 'text-rose-600'
  if (n > 0) return 'text-emerald-800'
  return 'text-slate-500'
}

function AccountBranch({
  node,
  depth,
  expanded,
  toggle,
  searchQ,
  rollupByAccountId,
  onAccountClick,
}: {
  node: TreeAccountNode
  depth: number
  expanded: Set<string>
  toggle: (key: string) => void
  searchQ: string
  rollupByAccountId: Map<number, number>
  onAccountClick?: (account: Account) => void
}) {
  const hasChildren = node.children.length > 0
  const key = accountKey(node.account.id)
  const open = expanded.has(key)
  const q = searchQ.trim()
  const matched = q.length > 0 && accountMatchesQuery(node.account, q)
  const bal = rollupByAccountId.get(node.account.id) ?? 0

  if (q && !subtreeHasMatch(node, q)) return null

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 pr-2 text-sm',
          matched && 'font-medium text-rose-600',
          !matched && 'text-slate-800',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
              onClick={() => toggle(key)}
              aria-expanded={open}
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {open ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/90" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-600/90" />
            )}
          </>
        ) : (
          <>
            <span className="inline-flex h-7 w-7 shrink-0" aria-hidden />
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500">
              <CircleArrowRight className="h-4 w-4" />
            </span>
          </>
        )}
        <button
          type="button"
          title={onAccountClick ? 'View general ledger for this account' : undefined}
          onClick={() => onAccountClick?.(node.account)}
          className={cn(
            'min-w-0 flex-1 truncate rounded px-1 text-left outline-none ring-emerald-500/30 focus-visible:ring-2',
            onAccountClick ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default',
          )}
        >
          <span className="font-medium">{node.account.name}</span>
          <span className={cn(!matched && 'text-slate-500')}> ({node.account.code})</span>
          <span className={cn(!matched && 'text-slate-500')}> — </span>
          <span className={cn('tabular-nums font-medium', balanceColorClass(bal))}>{formatMoney(bal)}</span>
        </button>
        {!hasChildren ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <span className="w-4 shrink-0" />
        )}
      </div>
      {hasChildren && open && (
        <div className="relative border-l border-dotted border-slate-300/80" style={{ marginLeft: `${18 + depth * 16}px` }}>
          {node.children.map((c) => (
            <AccountBranch
              key={c.account.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              searchQ={searchQ}
              rollupByAccountId={rollupByAccountId}
              onAccountClick={onAccountClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TreeChartsOfAccounts({
  sections,
  directBalanceByAccountId,
  onAccountClick,
  isLoading,
}: TreeChartsOfAccountsProps) {
  const [searchInput, setSearchInput] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const { rollupByAccountId, sectionTotalByChartId } = useMemo(() => {
    const rollup = new Map<number, number>()
    function compute(node: TreeAccountNode): number {
      const rawOwn = directBalanceByAccountId.get(node.account.id) ?? 0
      const own = rawOwn
      let childSum = 0
      for (const ch of node.children) childSum += compute(ch)
      const total = own + childSum
      rollup.set(node.account.id, total)
      return total
    }
    const sectionTotals = new Map<number, number>()
    for (const sec of sections) {
      let st = 0
      for (const r of sec.roots) st += compute(r)
      sectionTotals.set(sec.chart.id, st)
    }
    return { rollupByAccountId: rollup, sectionTotalByChartId: sectionTotals }
  }, [sections, directBalanceByAccountId])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQ(searchInput), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (sections.length === 0) return
    const q = searchQ.trim()
    if (q) {
      setExpanded(collectExpandKeys(sections))
    } else {
      const next = new Set<string>()
      for (const s of sections) next.add(chartKey(s.chart.id))
      setExpanded(next)
    }
  }, [sections, searchQ])

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(collectExpandKeys(sections))
  }, [sections])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const visibleSections = useMemo(() => {
    const q = searchQ.trim()
    if (!q) return sections
    return sections.filter((s) => sectionHasAnyMatch(s, q))
  }, [sections, searchQ])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search accounts…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none ring-emerald-500/25 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : visibleSections.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No accounts match your search.</p>
        ) : (
          <div className="space-y-1">
            {visibleSections.map((section) => {
              const ck = chartKey(section.chart.id)
              const open = expanded.has(ck)
              const sectionTotal = sectionTotalByChartId.get(section.chart.id) ?? 0
              return (
                <div key={section.chart.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={() => toggle(ck)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
                      {open ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span className="truncate">{section.chart.type}</span>
                    </span>
                    <span className={cn('shrink-0 tabular-nums', balanceColorClass(sectionTotal))}>{formatMoney(sectionTotal)}</span>
                  </button>
                  {open && (
                    <div className="mt-1">
                      {section.roots.length === 0 ? (
                        <p className="py-2 pl-8 text-sm text-slate-500">No accounts in this category.</p>
                      ) : (
                        section.roots.map((r) => (
                          <AccountBranch
                            key={r.account.id}
                            node={r}
                            depth={0}
                            expanded={expanded}
                            toggle={toggle}
                            searchQ={searchQ}
                            rollupByAccountId={rollupByAccountId}
                            onAccountClick={onAccountClick}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
