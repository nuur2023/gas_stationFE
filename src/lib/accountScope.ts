import type { Account } from '../types/models'
import { showBusinessPickerInForms } from './stationContext'

/**
 * SuperAdmin sees all accounts (including global parent rows where businessId is null).
 * Other roles only see accounts tied to their business.
 */
export function filterAccountsForViewer(
  items: Account[] | undefined,
  role: string | null,
  authBusinessId: number | null | undefined,
): Account[] {
  const list = items ?? []
  if (showBusinessPickerInForms(role)) return list
  const bid = authBusinessId ?? null
  if (bid == null || bid <= 0) return []
  return list.filter((a) => a.businessId != null && a.businessId === bid)
}

/**
 * GL / daily cash flow pickers: one business only (SuperAdmin uses the selected business).
 * Excludes global chart rows (businessId null) and other businesses.
 */
export function filterAccountsForFinancialReportsPicker(
  items: Account[] | undefined,
  role: string | null,
  authBusinessId: number | null | undefined,
  selectedBusinessId: number,
): Account[] {
  const list = items ?? []
  if (showBusinessPickerInForms(role)) {
    if (selectedBusinessId <= 0) return []
    return list.filter((a) => a.businessId === selectedBusinessId)
  }
  return filterAccountsForViewer(items, role, authBusinessId)
}

/** Posting accounts only: has a parent (excludes top-level headers like "1000 - Assets"). */
export function filterBusinessLeafAccounts(items: Account[]): Account[] {
  return items.filter(
    (a) =>
      a.businessId != null &&
      a.businessId > 0 &&
      a.parentAccountId != null &&
      a.parentAccountId > 0,
  )
}
