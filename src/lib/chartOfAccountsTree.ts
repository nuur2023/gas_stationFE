import type { Account, ChartsOfAccounts } from '../types/models'

export type TreeAccountNode = {
  account: Account
  children: TreeAccountNode[]
}

export type TreeChartSection = {
  chart: ChartsOfAccounts
  roots: TreeAccountNode[]
}

/** Puts common statement order first; remaining types follow alphabetically. */
export function sortChartsForTree(charts: ChartsOfAccounts[]): ChartsOfAccounts[] {
  const rank = (t: string) => {
    const u = t.trim().toLowerCase()
    if (u === 'asset') return 0
    if (u === 'liability') return 1
    if (u === 'equity') return 2
    if (u === 'income') return 3
    if (u === 'cogs' || u === 'cost of goods sold') return 4
    if (u === 'expense') return 5
    if (u === 'temporary' || u === 'temporary account') return 6
    return 100
  }
  return [...charts].sort((a, b) => {
    const d = rank(a.type) - rank(b.type)
    return d !== 0 ? d : a.type.localeCompare(b.type)
  })
}

export function buildSectionsForCharts(
  charts: ChartsOfAccounts[],
  accounts: Account[],
): TreeChartSection[] {
  const idSet = new Set(accounts.map((a) => a.id))
  const byChart = new Map<number, Account[]>()
  for (const c of charts) byChart.set(c.id, [])
  for (const a of accounts) {
    const list = byChart.get(a.chartsOfAccountsId)
    if (list) list.push(a)
  }
  for (const list of byChart.values()) list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  function rootsForChart(list: Account[]): Account[] {
    return list.filter(
      (a) => a.parentAccountId == null || !idSet.has(a.parentAccountId),
    )
  }

  function childrenOf(parentId: number, list: Account[]): Account[] {
    return list.filter((a) => a.parentAccountId === parentId)
  }

  function nest(account: Account, list: Account[]): TreeAccountNode {
    const kids = childrenOf(account.id, list)
    return { account, children: kids.map((k) => nest(k, list)) }
  }

  return sortChartsForTree(charts).map((chart) => {
    const list = byChart.get(chart.id) ?? []
    const roots = rootsForChart(list)
    return { chart, roots: roots.map((r) => nest(r, list)) }
  })
}

export function accountMatchesQuery(account: Account, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return false
  return (
    account.name.toLowerCase().includes(s) ||
    account.code.toLowerCase().includes(s) ||
    `${account.code} ${account.name}`.toLowerCase().includes(s)
  )
}

export function subtreeHasMatch(node: TreeAccountNode, q: string): boolean {
  const s = q.trim()
  if (!s) return true
  if (accountMatchesQuery(node.account, s)) return true
  return node.children.some((c) => subtreeHasMatch(c, s))
}

export function sectionHasAnyMatch(section: TreeChartSection, q: string): boolean {
  const s = q.trim()
  if (!s) return true
  return section.roots.some((r) => subtreeHasMatch(r, s))
}

/** All expand keys for charts + account nodes that have children. */
export function collectExpandKeys(sections: TreeChartSection[]): Set<string> {
  const keys = new Set<string>()
  for (const s of sections) {
    keys.add(chartKey(s.chart.id))
    for (const r of s.roots) collectAccountExpandKeys(r, keys)
  }
  return keys
}

function collectAccountExpandKeys(node: TreeAccountNode, keys: Set<string>) {
  if (node.children.length > 0) {
    keys.add(accountKey(node.account.id))
    for (const c of node.children) collectAccountExpandKeys(c, keys)
  }
}

export function chartKey(chartId: number) {
  return `coa:${chartId}`
}

export function accountKey(accountId: number) {
  return `acc:${accountId}`
}
