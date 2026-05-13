import {
  FINANCIAL_REPORT_CORE_PATHS,
  FINANCIAL_REPORT_LEGACY_CORE_ROUTES,
  FINANCIAL_REPORT_PATH_TO_LEGACY,
  LEGACY_FINANCIAL_KIND_TO_PATH,
  isTrialBalanceFinancialPath,
} from './financialReportRoutes'
import { permissionRouteMatches } from './permissionRoutes'

function splitTo(to: string): { pathname: string; search: string } {
  const t = to.trim()
  const q = t.indexOf('?')
  if (q === -1) return { pathname: t, search: '' }
  return { pathname: t.slice(0, q), search: t.slice(q) }
}

function exactRouteMatches(pathname: string, search: string, allowedRoute: string): boolean {
  const r = allowedRoute.trim()
  if (!r) return false
  const q = r.indexOf('?')
  if (q === -1) return pathname === r
  if (pathname !== r.slice(0, q)) return false
  const want = new URLSearchParams(r.slice(q + 1))
  const have = new URLSearchParams(search)
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false
  }
  return true
}

/** True if this permission row should contribute CRUD flags on the cash flow statement report URL. */
function itemCoversDailyCashFlowPath(itemRoute: string): boolean {
  const r = itemRoute.trim()
  if (!r) return false
  if (r === '/financial-reports/daily-cash-flow' || r === '/reports/financial?kind=daily-cash-flow') return true
  if (FINANCIAL_REPORT_CORE_PATHS.includes(r)) return true
  if (FINANCIAL_REPORT_LEGACY_CORE_ROUTES.includes(r)) return true
  return false
}

/**
 * Whether a permission row's `route` covers the current URL for merging action flags
 * (Create / Update / Delete), including financial legacy ↔ modern path pairs.
 */
export function permissionItemCoversPath(pathname: string, search: string, itemRoute: string): boolean {
  const r = itemRoute.trim()
  if (!r) return false

  /** Tree COA is read-only; action flags follow the Accounts submenu. */
  if (pathname === '/accounting/chart-of-accounts-tree' && r === '/accounting/accounts') return true

  if (pathname === '/accounting/dashboard' && r === '/accounting/accounts') return true

  if (pathname === '/supplier-payments' && r === '/purchases') return true

  if (pathname === '/transfer-audit-trail') {
    if (r === '/transfer-audit-trail' || r === '/transfers' || r === '/fuel-inventory/transfers') return true
  }

  if (isTrialBalanceFinancialPath(pathname)) {
    if (r === '/financial-reports/trial-balance' || r === '/reports/financial?kind=trial') return true
    if (isTrialBalanceFinancialPath(r) && r === pathname) return true
  }

  if (permissionRouteMatches(pathname, search, r)) return true

  const legacyFromModern = FINANCIAL_REPORT_PATH_TO_LEGACY[pathname]
  if (legacyFromModern) {
    const { pathname: lp, search: ls } = splitTo(legacyFromModern)
    if (exactRouteMatches(lp, ls, r) || permissionRouteMatches(lp, ls, r)) return true
  }

  if (pathname === '/reports/financial') {
    if (permissionRouteMatches(pathname, search, r)) return true
    const kind = new URLSearchParams(search).get('kind')
    const modernPath = kind ? LEGACY_FINANCIAL_KIND_TO_PATH[kind] : undefined
    if (kind === 'trial' && (r === '/financial-reports/trial-balance' || r === '/reports/financial?kind=trial'))
      return true
    if (kind === 'capital' && (r === '/financial-reports/capital-statement' || r === '/reports/financial?kind=capital'))
      return true
    if (modernPath && permissionRouteMatches(modernPath, '', r)) return true
    if (kind === 'daily-cash-flow') return itemCoversDailyCashFlowPath(r)
  }

  if (pathname === '/financial-reports/daily-cash-flow') {
    if (permissionRouteMatches(pathname, search, r)) return true
    return itemCoversDailyCashFlowPath(r)
  }

  return false
}
