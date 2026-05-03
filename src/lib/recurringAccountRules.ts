import type { Account } from '../types/models'

function normType(account: Account | undefined): string {
  return String(account?.chartsOfAccounts?.type ?? '').trim().toLowerCase()
}

/** Matches backend `AccountingAccountRules.IsDebitSideForRecurring`. */
export function isRecurringDebitAccount(account: Account | undefined): boolean {
  const t = normType(account)
  return (
    t === 'asset' ||
    t === 'expense' ||
    t === 'cogs' ||
    t === 'cost of goods sold'
  )
}

/** Matches backend `AccountingAccountRules.IsCreditSideForRecurring`. */
export function isRecurringCreditAccount(account: Account | undefined): boolean {
  const t = normType(account)
  return t === 'liability' || t === 'equity' || t === 'asset'
}
