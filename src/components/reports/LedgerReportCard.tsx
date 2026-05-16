import type { CashOutDailyLineDto } from '../../types/models'
import { formatCurrency, formatWithCurrencySymbol } from '../../lib/formatNumber'

export type LedgerCardKind = 'Expense' | 'Exchange' | 'cashOrUsdTaken'

function badgeFor(kind: LedgerCardKind) {
  switch (kind) {
    case 'Exchange':
      return { label: 'exchange', className: 'bg-emerald-50 text-emerald-800' }
    case 'cashOrUsdTaken':
      return { label: 'cash taken', className: 'bg-emerald-50 text-emerald-800' }
    default:
      return { label: 'expense', className: 'bg-red-50 text-red-800' }
  }
}

function formatDisplayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function LedgerReportCard({
  row,
  kind,
  resolveSymbol,
}: {
  row: CashOutDailyLineDto
  kind: LedgerCardKind
  resolveSymbol: (row: CashOutDailyLineDto) => string
}) {
  const code = (row.currencyCode || 'USD').trim().toUpperCase()
  const isUsd = code === 'USD'
  const symbol = resolveSymbol(row)
  const badge = badgeFor(kind)

  let amountPrimary = ''
  let amountSecondary: string | null = null

  if (kind === 'cashOrUsdTaken') {
    amountPrimary = formatWithCurrencySymbol(row.localAmount, 'SSP')
    if (Math.abs(row.amountUsd) > 1e-9) {
      amountSecondary = formatCurrency(row.amountUsd, 'USD')
    }
  } else if (kind === 'Expense' && isUsd) {
    amountPrimary = formatCurrency(row.amountUsd, 'USD')
  } else if (kind === 'Expense') {
    amountPrimary = formatWithCurrencySymbol(row.localAmount, symbol || code)
    if (Math.abs(row.amountUsd) > 1e-9) {
      amountSecondary = formatCurrency(row.amountUsd, 'USD')
    }
  } else {
    amountPrimary = formatWithCurrencySymbol(row.localAmount, symbol || code)
    if (Math.abs(row.amountUsd) > 1e-9) {
      amountSecondary = formatCurrency(row.amountUsd, 'USD')
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <time className="text-sm font-normal text-slate-500" dateTime={row.date}>
          {formatDisplayDate(row.date)}
        </time>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold lowercase ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-red-800 tabular-nums">{amountPrimary}</p>
      {amountSecondary ? (
        <p className="mt-1 text-base font-semibold text-red-700 tabular-nums">{amountSecondary}</p>
      ) : null}
      {!isUsd && row.rate > 1e-9 && kind !== 'cashOrUsdTaken' ? (
        <p className="mt-1 text-xs text-slate-500">
          Rate: {formatWithCurrencySymbol(row.rate, symbol || code)}
        </p>
      ) : null}
      <hr className="my-3 border-slate-200" />
      <p className="text-base font-bold text-slate-900">{row.description || '—'}</p>
    </article>
  )
}
