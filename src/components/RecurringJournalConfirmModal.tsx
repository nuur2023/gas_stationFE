import { useEffect, useMemo, useState } from 'react'
import { useConfirmRecurringJournalPostMutation, useGetTrialBalanceReportQuery } from '../app/api/apiSlice'
import { formatDecimal } from '../lib/formatNumber'
import { Modal } from './Modal'

export type RecurringJournalPendingRow = {
  id: number
  name: string
  amount: number
  pendingConfirmationRunDate: string | null
  stationId?: number | null
  stationName?: string | null
  debitAccountId?: number | null
  creditAccountId?: number | null
  debitLabel?: string | null
  creditLabel?: string | null
  frequency?: number
  frequencyLabel?: string | null
  startDate?: string | null
  endDate?: string | null
  nextRunDate?: string | null
  supplierLabel?: string | null
  customerLabel?: string | null
}

function formatIsoShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  return d || '—'
}

const frequencyFallback = ['Daily', 'Weekly', 'Monthly', 'Yearly']

function resolveFrequencyLabel(row: RecurringJournalPendingRow): string {
  if (row.frequencyLabel) return row.frequencyLabel
  if (row.frequency != null && row.frequency >= 0 && row.frequency < frequencyFallback.length) {
    return frequencyFallback[row.frequency]
  }
  return '—'
}

function formatTrialMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$ ${formatDecimal(Math.abs(n))}`
}

export function RecurringJournalConfirmModal({
  open,
  onLater,
  onPosted,
  businessId,
  pendingRows,
  showStationColumn = false,
}: {
  open: boolean
  onLater: () => void
  onPosted?: () => void
  businessId: number
  pendingRows: RecurringJournalPendingRow[]
  /** Match recurring journals table: show Station column for SuperAdmin/Admin. */
  showStationColumn?: boolean
}) {
  const first = pendingRows[0]
  const [amount, setAmount] = useState('')
  const [confirmPost, { isLoading }] = useConfirmRecurringJournalPostMutation()

  const toDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const trialStationId =
    first?.stationId != null && first.stationId > 0 ? first.stationId : undefined

  const { data: trialRows, isLoading: trialLoading } = useGetTrialBalanceReportQuery(
    {
      businessId: businessId > 0 ? businessId : 0,
      to: toDate,
      trialBalanceMode: 'adjusted',
      ...(trialStationId != null ? { stationId: trialStationId } : {}),
    },
    { skip: !open || businessId <= 0 || !first },
  )

  const balanceByAccountId = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of trialRows ?? []) {
      const row = r as { accountId: number; balance: number }
      if (row.accountId != null) m.set(row.accountId, Number(row.balance ?? 0))
    }
    return m
  }, [trialRows])

  useEffect(() => {
    if (first) setAmount(String(first.amount))
  }, [first?.id, first?.amount])

  async function onConfirm() {
    if (!first || businessId <= 0) return
    const n = Number.parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    await confirmPost({
      id: first.id,
      body: { businessId, amount: String(n) },
    }).unwrap()
    onPosted?.()
  }

  if (!open || !first) return null

  const rest = pendingRows.length - 1
  const debit = first.debitLabel?.trim() || '—'
  const credit = first.creditLabel?.trim() || '—'
  const station =
    first.stationName?.trim() ||
    (first.stationId != null && first.stationId > 0 ? `Station #${first.stationId}` : '—')

  const debitAccountId = first.debitAccountId != null && first.debitAccountId > 0 ? first.debitAccountId : null
  const creditAccountId =
    first.creditAccountId != null && first.creditAccountId > 0 ? first.creditAccountId : null

  const debitBalanceCell =
    debitAccountId == null ? '—' : trialLoading ? '…' : formatTrialMoney(balanceByAccountId.get(debitAccountId) ?? 0)
  const creditBalanceCell =
    creditAccountId == null
      ? '—'
      : trialLoading
        ? '…'
        : formatTrialMoney(balanceByAccountId.get(creditAccountId) ?? 0)

  return (
    <Modal
      open={open}
      title="Recurring journal ready to post"
      onClose={onLater}
      className="max-w-6xl"
    >
      <p className="text-sm text-slate-600">
        This entry uses <strong>confirm when due</strong>. Review the line below, edit <strong>Amount</strong> if
        needed, then post — or choose <strong>Later</strong> (it stays under <strong>Recurring journals</strong>{' '}
        until you confirm).
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Debit / credit <strong>balance</strong> columns use the same basis as the chart of accounts tree: adjusted trial
        balance through today
        {trialStationId != null ? ` (station #${trialStationId})` : ''}.
      </p>
      {rest > 0 ? (
        <p className="mt-2 text-xs text-amber-800">
          {rest} more recurring {rest === 1 ? 'entry' : 'entries'} also waiting — confirm them from{' '}
          <strong>Accounting → Recurring journals</strong> after this one.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-max min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Name</th>
              {showStationColumn ? (
                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Station</th>
              ) : null}
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Debit</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-600">Debit balance</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Credit</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-600">Credit balance</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Amount</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Frequency</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Start</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">End</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Next run</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Awaiting confirm</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Supplier</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-600">Customer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-white hover:bg-slate-50/80">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{first.name}</td>
              {showStationColumn ? (
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{station}</td>
              ) : null}
              <td className="max-w-[14rem] whitespace-normal px-3 py-2 text-slate-700">{debit}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                {debitBalanceCell}
              </td>
              <td className="max-w-[14rem] whitespace-normal px-3 py-2 text-slate-700">{credit}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                {creditBalanceCell}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-middle">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  aria-label="Amount to post"
                />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{resolveFrequencyLabel(first)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatIsoShort(first.startDate)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatIsoShort(first.endDate)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                {formatIsoShort(first.nextRunDate)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-amber-950">
                {formatIsoShort(first.pendingConfirmationRunDate)}
              </td>
              <td className="max-w-[10rem] whitespace-normal px-3 py-2 text-slate-700">
                {first.supplierLabel?.trim() || '—'}
              </td>
              <td className="max-w-[10rem] whitespace-normal px-3 py-2 text-slate-700">
                {first.customerLabel?.trim() || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onLater}
        >
          Later
        </button>
        <button
          type="button"
          disabled={isLoading || businessId <= 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          onClick={() => void onConfirm()}
        >
          {isLoading ? 'Posting…' : 'Confirm & post'}
        </button>
      </div>
    </Modal>
  )
}
