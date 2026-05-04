import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDecimal } from '../../lib/formatNumber'
import type { ProfitLossReportDto } from '../../types/models'

type SectionKey = 'income' | 'cogs' | 'expense'

function zebra(i: number) {
  return i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
}

export function ProfitLossReportView({
  data,
  isLoading,
  periodLabel,
  documentHeading = 'Income Statement',
}: {
  data: ProfitLossReportDto | undefined
  isLoading: boolean
  periodLabel: string
  /** Shown as the report title (e.g. includes Unadjusted / Adjusted / Post-closing). */
  documentHeading?: string
}) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    income: true,
    cogs: true,
    expense: true,
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

  const income = data.incomeAccounts ?? []
  const cogs = data.cogsAccounts ?? []
  const expense = data.expenseAccounts ?? []

  let rowIndex = 0
  const nextZebra = () => zebra(rowIndex++)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-5 text-center">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{documentHeading}</h2>
        <p className="mt-1 text-sm text-slate-500">{periodLabel}</p>
      </div>

      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ordinary income / expense
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className={nextZebra()}>
            <td colSpan={2} className="px-4 py-2.5 pl-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue &amp; costs
            </td>
          </tr>

          {/* Income */}
          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('income')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.income ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Income
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.income &&
            income.map((r) => (
              <tr key={`i-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.amount)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total income</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.incomeTotal ?? 0)}
            </td>
          </tr>

          {/* COGS */}
          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('cogs')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.cogs ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Cost of goods sold
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.cogs &&
            cogs.map((r) => (
              <tr key={`c-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.amount)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total COGS</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.cogsTotal ?? 0)}
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'border-t-2 border-slate-200 bg-emerald-50/50')}>
            <td className="px-4 py-3 pl-8 font-semibold text-slate-900">Gross profit</td>
            <td className="px-6 py-3 text-right text-base font-bold tabular-nums text-emerald-900">
              {formatDecimal(data.grossProfit ?? 0)}
            </td>
          </tr>

          {/* Expense */}
          <tr className={cn(nextZebra(), 'cursor-pointer select-none')} onClick={() => toggle('expense')}>
            <td className="px-4 py-2.5 pl-6 font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                {open.expense ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                Expense
              </span>
            </td>
            <td className="px-6 py-2.5" />
          </tr>
          {open.expense &&
            expense.map((r) => (
              <tr key={`e-${r.code}`} className={nextZebra()}>
                <td className="px-4 py-2 pl-12 text-slate-700">
                  {r.code} · {r.name}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-800">{formatDecimal(r.amount)}</td>
              </tr>
            ))}
          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-2.5 pl-8 font-semibold text-slate-900">Total expense</td>
            <td className="px-6 py-2.5 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.expenseTotal ?? 0)}
            </td>
          </tr>

          <tr className={cn(nextZebra(), 'border-t border-slate-300')}>
            <td className="px-4 py-3 pl-6 font-semibold text-slate-900">Net ordinary income</td>
            <td className="px-6 py-3 text-right text-base font-semibold tabular-nums text-slate-900">
              {formatDecimal(data.netOrdinaryIncome ?? 0)}
            </td>
          </tr>

          <tr className={cn(zebra(rowIndex), 'bg-slate-100')}>
            <td className="px-4 py-4 pl-6 text-base font-bold text-slate-900">Net income</td>
            <td className="border-b-4 border-double border-slate-900 px-6 py-4 text-right text-lg font-bold tabular-nums text-slate-900">
              {formatDecimal(data.netIncome ?? 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
