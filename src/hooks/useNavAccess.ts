import { useCallback, useMemo } from 'react'
import { useGetMyPermissionsQuery } from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
import {
  FINANCIAL_REPORT_CORE_PATHS,
  FINANCIAL_REPORT_LEGACY_CORE_ROUTES,
  FINANCIAL_REPORT_PATH_TO_LEGACY,
  TRIAL_BALANCE_LEGACY_VARIANT_PATHS,
  trialBalanceFinancialPathAllowed,
} from '../lib/financialReportRoutes'
import { permissionItemCoversPath } from '../lib/permissionItemCoversPath'
import { permissionRouteMatches } from '../lib/permissionRoutes'

function splitTo(to: string): { pathname: string; search: string } {
  const q = to.indexOf('?')
  if (q === -1) return { pathname: to, search: '' }
  return { pathname: to.slice(0, q), search: to.slice(q) }
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

function setHasAnyRoute(set: Set<string>, routes: readonly string[]): boolean {
  return routes.some((route) => set.has(route))
}

/** Cash flow statement: explicit permission, or any other financial report (new or legacy). */
function hasFinancialPermissionForDailyCashFlow(set: Set<string>): boolean {
  if (set.has('/financial-reports/daily-cash-flow')) return true
  if (set.has('/reports/financial?kind=daily-cash-flow')) return true
  if (setHasAnyRoute(set, FINANCIAL_REPORT_CORE_PATHS)) return true
  if (setHasAnyRoute(set, FINANCIAL_REPORT_LEGACY_CORE_ROUTES)) return true
  return false
}

/** Report period view: explicit permission, or any other financial report (new or legacy). */
function hasFinancialPermissionForPeriodView(set: Set<string>): boolean {
  if (set.has('/financial-reports/report-period-view')) return true
  if (set.has('/reports/financial?kind=period-view')) return true
  if (setHasAnyRoute(set, FINANCIAL_REPORT_CORE_PATHS)) return true
  if (setHasAnyRoute(set, FINANCIAL_REPORT_LEGACY_CORE_ROUTES)) return true
  return false
}

/** User can open `pathname` if they have the new path permission or the legacy ?kind= row. */
function financialPathAllowedByModernOrLegacy(
  pathname: string,
  search: string,
  set: Set<string>,
): boolean {
  if (trialBalanceFinancialPathAllowed(pathname, set)) return true
  for (const r of set) {
    if (permissionRouteMatches(pathname, search, r)) return true
  }
  const legacy = FINANCIAL_REPORT_PATH_TO_LEGACY[pathname]
  if (legacy && set.has(legacy)) return true
  return false
}

function financialLinkAllowedByModernOrLegacy(pathname: string, search: string, set: Set<string>): boolean {
  if (trialBalanceFinancialPathAllowed(pathname, set)) return true
  for (const r of set) {
    if (exactRouteMatches(pathname, search, r)) return true
  }
  const legacy = FINANCIAL_REPORT_PATH_TO_LEGACY[pathname]
  if (legacy) {
    const { pathname: lp, search: ls } = splitTo(legacy)
    for (const r of set) {
      if (exactRouteMatches(lp, ls, r)) return true
    }
  }
  return false
}

/** Legacy URL: `/reports/financial?kind=…` — allow if DB has new path or old query row. */
function legacyFinancialQueryAllowed(pathname: string, search: string, set: Set<string>): boolean {
  if (pathname !== '/reports/financial') return false
  for (const r of set) {
    if (permissionRouteMatches(pathname, search, r)) return true
  }
  const kind = new URLSearchParams(search).get('kind')
  if (!kind) return false
  if (kind === 'trial') {
    return (
      set.has('/financial-reports/trial-balance') ||
      set.has('/reports/financial?kind=trial') ||
      TRIAL_BALANCE_LEGACY_VARIANT_PATHS.some((p) => set.has(p))
    )
  }
  const modernPath =
    kind === 'ledger'
      ? '/financial-reports/general-ledger'
      : kind === 'pl'
        ? '/financial-reports/profit-and-loss'
        : kind === 'bs'
          ? '/financial-reports/balance-sheet'
          : kind === 'capital'
            ? '/financial-reports/capital-statement'
            : kind === 'customer'
              ? '/financial-reports/customer-balances'
              : kind === 'supplier'
                ? '/financial-reports/supplier-balances'
                : kind === 'daily-cash-flow'
                  ? '/financial-reports/daily-cash-flow'
                  : kind === 'period-view'
                    ? '/financial-reports/report-period-view'
                  : null
  if (modernPath && set.has(modernPath)) return true
  if (kind === 'daily-cash-flow') return hasFinancialPermissionForDailyCashFlow(set)
  if (kind === 'period-view') return hasFinancialPermissionForPeriodView(set)
  return false
}

function inventoryTransferAliasAllowed(pathname: string, search: string, set: Set<string>): boolean {
  if (pathname === '/transfers') {
    for (const r of set) {
      if (permissionRouteMatches('/fuel-inventory/transfers', search, r)) return true
    }
  }
  if (pathname === '/fuel-inventory/transfers') {
    for (const r of set) {
      if (permissionRouteMatches('/transfers', search, r)) return true
    }
  }
  if (pathname === '/transfer-audit-trail') {
    if (set.has('/transfer-audit-trail')) return true
    for (const r of set) {
      if (permissionRouteMatches('/transfers', search, r)) return true
      if (permissionRouteMatches('/fuel-inventory/transfers', search, r)) return true
    }
  }
  return false
}

/** Only SuperAdmin bypasses permission rows. */
function bypassPermissionNav(role: string | null): boolean {
  return role === 'SuperAdmin'
}

export type RouteActionFlags = {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export function useNavAccess() {
  const token = useAppSelector((s) => s.auth.token)
  const role = useAppSelector((s) => s.auth.role)
  const bypass = bypassPermissionNav(role)
  const skip = !token || bypass

  const q = useGetMyPermissionsQuery(undefined, { skip })

  const navSettled = skip || q.isSuccess || q.isError
  const fullAccess = bypass || (q.data?.fullAccess ?? false)

  const allowedViewRoutes = useMemo(() => {
    if (fullAccess) return null as Set<string> | null
    const set = new Set<string>()
    for (const i of q.data?.items ?? []) {
      if (i.canView && i.route) set.add(i.route.trim())
    }
    return set
  }, [fullAccess, q.data?.items])

  /** Metrics dashboard at `/`; home route stays allowed for everyone, but UI shows a welcome screen without this. */
  const canViewDashboard = useMemo(() => {
    if (fullAccess) return true
    return allowedViewRoutes?.has('/') ?? false
  }, [fullAccess, allowedViewRoutes])

  const hasAnyPermission = useMemo(() => {
    if (fullAccess) return true
    return (allowedViewRoutes?.size ?? 0) > 0
  }, [fullAccess, allowedViewRoutes])

  const pathnameAllowed = useCallback(
    (pathname: string, search: string) => {
      if (fullAccess) return true
      if (pathname === '/' || pathname === '') return true
      const set = allowedViewRoutes
      if (!set || set.size === 0) return false
      for (const r of set) {
        if (permissionRouteMatches(pathname, search, r)) return true
      }
      if (pathname.startsWith('/financial-reports/')) {
        if (financialPathAllowedByModernOrLegacy(pathname, search, set)) return true
        if (pathname === '/financial-reports/daily-cash-flow') {
          return hasFinancialPermissionForDailyCashFlow(set)
        }
        if (pathname === '/financial-reports/report-period-view') {
          return hasFinancialPermissionForPeriodView(set)
        }
      }
      if (inventoryTransferAliasAllowed(pathname, search, set)) return true
      if (legacyFinancialQueryAllowed(pathname, search, set)) return true
      if (pathname === '/accounting/chart-of-accounts-tree' && set.has('/accounting/accounts')) return true
      if (pathname === '/supplier-payments' && set.has('/purchases')) return true
      return false
    },
    [fullAccess, allowedViewRoutes],
  )

  const linkAllowed = useCallback(
    (to: string) => {
      if (fullAccess) return true
      const { pathname, search } = splitTo(to.trim())
      const set = allowedViewRoutes
      if (!set || set.size === 0) return false
      for (const r of set) {
        if (exactRouteMatches(pathname, search, r)) return true
      }
      if (pathname.startsWith('/financial-reports/')) {
        if (financialLinkAllowedByModernOrLegacy(pathname, search, set)) return true
        if (pathname === '/financial-reports/daily-cash-flow') {
          return hasFinancialPermissionForDailyCashFlow(set)
        }
        if (pathname === '/financial-reports/report-period-view') {
          return hasFinancialPermissionForPeriodView(set)
        }
      }
      if (inventoryTransferAliasAllowed(pathname, search, set)) return true
      if (pathname === '/reports/financial' && legacyFinancialQueryAllowed(pathname, search, set)) return true
      if (pathname === '/accounting/chart-of-accounts-tree' && set.has('/accounting/accounts')) return true
      if (pathname === '/supplier-payments' && set.has('/purchases')) return true
      return false
    },
    [fullAccess, allowedViewRoutes],
  )

  const getRouteActionFlags = useCallback(
    (pathname: string, search: string): RouteActionFlags => {
      if (fullAccess || bypass) {
        return { canView: true, canCreate: true, canUpdate: true, canDelete: true }
      }
      const canView = pathnameAllowed(pathname, search)
      if (!canView) {
        return { canView: false, canCreate: false, canUpdate: false, canDelete: false }
      }
      const items = q.data?.items ?? []
      let canCreate = false
      let canUpdate = false
      let canDelete = false
      for (const i of items) {
        const route = i.route?.trim()
        if (!route) continue
        if (!permissionItemCoversPath(pathname, search, route)) continue
        if (i.canCreate) canCreate = true
        if (i.canUpdate) canUpdate = true
        if (i.canDelete) canDelete = true
      }
      return { canView, canCreate, canUpdate, canDelete }
    },
    [fullAccess, bypass, pathnameAllowed, q.data?.items],
  )

  return {
    bypass,
    navSettled,
    fullAccess,
    allowedViewRoutes,
    hasAnyPermission,
    canViewDashboard,
    pathnameAllowed,
    linkAllowed,
    getRouteActionFlags,
    isFetchingPermissions: !skip && q.isFetching,
  }
}
