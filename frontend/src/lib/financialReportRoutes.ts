/**
 * Financial reports moved from `/reports/financial?kind=…` to path-based URLs.
 * Keep legacy strings so existing DB permission rows still work.
 */
export const FINANCIAL_REPORT_PATH_TO_LEGACY: Readonly<Record<string, string>> = {
  '/financial-reports/trial-balance': '/reports/financial?kind=trial',
  '/financial-reports/general-ledger': '/reports/financial?kind=ledger',
  '/financial-reports/profit-and-loss': '/reports/financial?kind=pl',
  '/financial-reports/balance-sheet': '/reports/financial?kind=bs',
  '/financial-reports/customer-balances': '/reports/financial?kind=customer',
  '/financial-reports/supplier-balances': '/reports/financial?kind=supplier',
  '/financial-reports/daily-cash-flow': '/reports/financial?kind=daily-cash-flow',
}

/** Paths (except daily cash flow) used to infer “has some financial report” access. */
export const FINANCIAL_REPORT_CORE_PATHS: readonly string[] = [
  '/financial-reports/trial-balance',
  '/financial-reports/general-ledger',
  '/financial-reports/profit-and-loss',
  '/financial-reports/balance-sheet',
  '/financial-reports/customer-balances',
  '/financial-reports/supplier-balances',
]

export const FINANCIAL_REPORT_LEGACY_CORE_ROUTES: readonly string[] = [
  '/reports/financial?kind=trial',
  '/reports/financial?kind=ledger',
  '/reports/financial?kind=pl',
  '/reports/financial?kind=bs',
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
  customer: '/financial-reports/customer-balances',
  supplier: '/financial-reports/supplier-balances',
  'daily-cash-flow': '/financial-reports/daily-cash-flow',
}
