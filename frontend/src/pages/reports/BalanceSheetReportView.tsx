import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDecimal } from '../../lib/formatNumber'
import type { BalanceSheetReportDto } from '../../types/models'

type SectionKey = 'assets' | 'liabilities' | 'equity'

function zebra(i: number) {
  return i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
}

export function BalanceSheetReportView({
  data,
  isLoading,
  periodLabel,
}: {
  data: BalanceSheetReportDto | undefined
  isLoading: boolean
  periodLabel: string
}) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    assets: true,
    liabilities: true,
    equity: true,
  })

  function toggle(k: SectionKey) {
    setOpen((o) => ({ ...o, [k]: !o[k] }))
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading report…</p>
  }

  if (!data) {
    return <p className="text-sm text-slate-600">No data for this period.</p>
  }

  const assetAccounts = data.assetAccounts ?? []
  const liabilityAccounts = data.liabilityAccounts ?? []
  const equityAccounts = data.equityAccounts ?? []
  const outOfBalance = Math.abs(data.assets - (data.liabilitiesAndEquity ?? data.liabilities + data.equity)) > 0.000001

  let rowIndex = 0
  const nextZebra = () => zebra(rowIndex++)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-5 text-center">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Balance sheet</h2>
        <p className="mt-1 text-sm text-slate-500">{periodLabel}</p>
      </div>

      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account</th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className={nextZebra()}>
            <td colSpan={2} className="px-4 py-2.5 pl-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Financial position
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('assets')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.assets ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Assets
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.assets &&
            assetAccounts.map((r) => (
              <tr key={`a-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.balance)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total assets</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.assets ?? 0)}
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('liabilities')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.liabilities ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Liabilities
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.liabilities &&
            liabilityAccounts.map((r) => (
              <tr key={`l-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.balance)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total liabilities</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.liabilities ?? 0)}
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('equity')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.equity ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Equity
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.equity &&
            equityAccounts.map((r) => (
              <tr key={`e-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.balance)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total equity</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.equity ?? 0)}
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'border-t-2 border-slate-200 bg-slate-50/90')}>
            <td className="px-4 py-3 pl-8 font-semibold text-slate-900">Total liabilities &amp; equity</td>
            <td className="px-6 py-3 text-right text-base font-bold tabular-nums text-slate-900">
              {formatDecimal(data.liabilitiesAndEquity ?? data.liabilities + data.equity)}
            </td>
          </tr>

          {outOfBalance && (
            <tr className={cn(zebra(rowIndex), 'bg-amber-50')}>
              <td colSpan={2} className="px-6 py-3 text-center text-sm font-medium text-amber-900">
                Assets and liabilities + equity differ by{' '}
                {formatDecimal(data.assets - (data.liabilitiesAndEquity ?? data.liabilities + data.equity))}. Check journal entries.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
