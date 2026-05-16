import type { CapitalStatementReportDto } from '../../types/models'
import { formatDecimalSigned } from '../../lib/formatNumber'

/** Matches `FinancialReportsPage` URL `view` (avoid importing page → no circular deps). */
export type CapitalStatementEntryView = 'adjusted' | 'unadjusted' | 'postclosing'

const EPS = 1e-9

function signedAmountClass(value: number): string {
  if (!Number.isFinite(value)) return 'text-slate-500'
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-slate-700'
}

function SignedAmountCell({ value }: { value: number }) {
  return (
    <span className={`tabular-nums ${signedAmountClass(value)}`}>{formatDecimalSigned(value)}</span>
  )
}

function EquityAccountRow({
  row,
}: {
  row: { accountId: number; code: string; name: string; beginning: number; change: number; ending: number }
}) {
  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-2.5 text-slate-800">
        <span className="font-mono text-xs text-slate-500">{row.code}</span>{' '}
        <span className="text-slate-900">{row.name}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <SignedAmountCell value={row.beginning} />
      </td>
      <td className="px-4 py-2.5 text-right">
        <SignedAmountCell value={row.change} />
      </td>
      <td className="px-4 py-2.5 text-right font-medium">
        <SignedAmountCell value={row.ending} />
      </td>
    </tr>
  )
}

export function CapitalStatementReportView({
  data,
  isLoading,
  periodLabel,
  documentHeading,
  entryView = 'adjusted',
}: {
  data: CapitalStatementReportDto | undefined
  isLoading: boolean
  periodLabel: string
  documentHeading: string
  entryView?: CapitalStatementEntryView
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading report…</p>
  }

  if (!data) {
    return <p className="text-sm text-slate-600">No data for this period.</p>
  }

  const equityRows = data.equityRows ?? []
  const drawingRows = data.drawingRows ?? []
  const netIncome = Number(data.netIncome ?? 0)

  const showNetIncomeRow = entryView === 'unadjusted' || entryView === 'adjusted'

  const tableHasContent =
    equityRows.length > 0 ||
    drawingRows.length > 0 ||
    (showNetIncomeRow && Math.abs(netIncome) > EPS)

  const footerBeginning = Number(data.totalBeginning ?? 0)
  const footerChange = Number(data.totalChange ?? 0) + (showNetIncomeRow ? netIncome : 0)
  const footerEnding = Number(data.totalEnding ?? 0) + (showNetIncomeRow ? netIncome : 0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-5 text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{documentHeading}</h2>
          <p className="mt-1 text-sm text-slate-500">{periodLabel}</p>
        </div>
        <table className="w-full min-w-[36rem] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Account</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Beginning</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Change</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Ending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!tableHasContent ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No equity accounts with activity in this range.
                </td>
              </tr>
            ) : (
              <>
                {equityRows.map((r) => (
                  <EquityAccountRow key={r.accountId} row={r} />
                ))}
                {drawingRows.map((r) => (
                  <EquityAccountRow key={r.accountId} row={r} />
                ))}
                {showNetIncomeRow && Math.abs(netIncome) > EPS ? (
                  <tr key="__net_income_period" className="bg-slate-50/50 hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 text-slate-800">
                      <span className="text-slate-900 italic">Net income (period)</span>
                      <span className="ml-2 text-xs font-normal text-slate-500">(Income Statement, same dates)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <SignedAmountCell value={0} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <SignedAmountCell value={netIncome} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      <SignedAmountCell value={netIncome} />
                    </td>
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
          {tableHasContent ? (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/80">
              <tr className="font-semibold text-slate-900">
                <td className="px-4 py-3">Total equity</td>
                <td className="px-4 py-3 text-right">
                  <SignedAmountCell value={footerBeginning} />
                </td>
                <td className="px-4 py-3 text-right">
                  <SignedAmountCell value={footerChange} />
                </td>
                <td className="px-4 py-3 text-right">
                  <SignedAmountCell value={footerEnding} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}