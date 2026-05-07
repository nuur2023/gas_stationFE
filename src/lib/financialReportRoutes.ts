/**
 * Financial reports moved from `/reports/financial?kind=…` to path-based URLs.
 * Keep legacy strings so existing DB permission rows still work.
 */

/** Old per-variant URLs (redirect to `/financial-reports/trial-balance?view=…`). */
export const TRIAL_BALANCE_LEGACY_VARIANT_PATHS: readonly string[] = [
  '/financial-reports/trial-balance-unadjusted',
  '/financial-reports/trial-balance-adjusted',
  '/financial-reports/trial-balance-post-closing',
]

/** Trial balance page or legacy variant paths (for permissions / redirects). */
export function isTrialBalanceFinancialPath(pathname: string): boolean {
  return pathname === '/financial-reports/trial-balance' || TRIAL_BALANCE_LEGACY_VARIANT_PATHS.includes(pathname)
}

/** View access: canonical trial route, legacy variant routes, or legacy ?kind=trial permission. */
export function trialBalanceFinancialPathAllowed(pathname: string, set: Set<string>): boolean {
  if (!isTrialBalanceFinancialPath(pathname)) return false
  if (set.has('/financial-reports/trial-balance')) return true
  if (set.has('/reports/financial?kind=trial')) return true
  return TRIAL_BALANCE_LEGACY_VARIANT_PATHS.some((p) => set.has(p))
}

export const FINANCIAL_REPORT_PATH_TO_LEGACY: Readonly<Record<string, string>> = {
  '/financial-reports/trial-balance': '/reports/financial?kind=trial',
  ...Object.fromEntries(TRIAL_BALANCE_LEGACY_VARIANT_PATHS.map((p) => [p, '/reports/financial?kind=trial'])),
  '/financial-reports/general-ledger': '/reports/financial?kind=ledger',
  '/financial-reports/profit-and-loss': '/reports/financial?kind=pl',
  '/financial-reports/balance-sheet': '/reports/financial?kind=bs',
  '/financial-reports/capital-statement': '/reports/financial?kind=capital',
  '/financial-reports/customer-balances': '/reports/financial?kind=customer',
  '/financial-reports/supplier-balances': '/reports/financial?kind=supplier',
  '/financial-reports/daily-cash-flow': '/reports/financial?kind=daily-cash-flow',
  '/financial-reports/report-period-view': '/reports/financial?kind=period-view',
}

/** Paths (except cash flow statement) used to infer “has some financial report” access. */
export const FINANCIAL_REPORT_CORE_PATHS: readonly string[] = [
  '/financial-reports/trial-balance',
  '/financial-reports/general-ledger',
  '/financial-reports/profit-and-loss',
  '/financial-reports/balance-sheet',
  '/financial-reports/capital-statement',
  '/financial-reports/customer-balances',
  '/financial-reports/supplier-balances',
]

export const FINANCIAL_REPORT_LEGACY_CORE_ROUTES: readonly string[] = [
  '/reports/financial?kind=trial',
  '/reports/financial?kind=ledger',
  '/reports/financial?kind=pl',
  '/reports/financial?kind=bs',
  '/reports/financial?kind=capital',
  '/reports/financial?kind=customer',
  '/reports/financial?kind=supplier',
]

export function financialReportLegacyPermissionRoute(pathname: string): string | undefined {
  return FINANCIAL_REPORT_PATH_TO_LEGACY[pathname]
}

/** Map `?kind=` value to the new canonical path (for redirects). */
export const LEGACY_FINANCIAL_KIND_TO_PATH: Readonly<Record<string, string>> = {
  trial: '/financial-reports/trial-balance',
  ledger: '/financial-reports/general-ledger',
  pl: '/financial-reports/profit-and-loss',
  bs: '/financial-reports/balance-sheet',
  capital: '/financial-reports/capital-statement',
  customer: '/financial-reports/customer-balances',
  supplier: '/financial-reports/supplier-balances',
  'daily-cash-flow': '/financial-reports/daily-cash-flow',
  'period-view': '/financial-reports/report-period-view',
}
