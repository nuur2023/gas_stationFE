import type { Account, ChartsOfAccounts } from '../types/models'

type AccountForSubledger = Pick<Account, 'name'> & {
  chartsOfAccounts?: Pick<ChartsOfAccounts, 'type'> | null
}

/** Mirrors backend AccountingSubledgerRules.IsAccountsReceivable */
export function isAccountsReceivable(account: AccountForSubledger | undefined): boolean {
  if (!account) return false
  const type = account.chartsOfAccounts?.type?.trim() ?? ''
  if (type.toLowerCase() !== 'asset') return false
  const n = (account.name ?? '').toLowerCase()
  return n.includes('receivable') || n.includes('a/r')
}

/** Mirrors backend AccountingSubledgerRules.IsAccountsPayable */
export function isAccountsPayable(account: AccountForSubledger | undefined): boolean {
  if (!account) return false
  const type = account.chartsOfAccounts?.type?.trim() ?? ''
  if (type.toLowerCase() !== 'liability') return false
  const n = (account.name ?? '').toLowerCase()
  return n.includes('payable')
}
