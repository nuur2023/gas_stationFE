import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { FormSelect, type SelectOption } from './FormSelect'
import { cn } from '../lib/cn'
import { isAccountsPayable, isAccountsReceivable } from '../lib/accountingSubledger'
import type { Account } from '../types/models'

export type FundTransferSubmitPayload = {
  fromAccountId: number
  toAccountId: number
  amount: string
  date: string
  stationId: number | null
  note: string
}

type FundTransferModalProps = {
  open: boolean
  onClose: () => void
  submitting: boolean
  accountOptions: SelectOption[]
  accountById: Map<number, Account>
  showStationPicker: boolean
  stationOptions: SelectOption[]
  /** When the station picker is hidden, this station is applied automatically. */
  effectiveStationId: number | null
  onSubmit: (payload: FundTransferSubmitPayload) => Promise<void>
}

export function FundTransferModal({
  open,
  onClose,
  submitting,
  accountOptions,
  accountById,
  showStationPicker,
  stationOptions,
  effectiveStationId,
  onSubmit,
}: FundTransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [stationId, setStationId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setFromAccountId(null)
    setToAccountId(null)
    setAmount('')
    setTransferDate(new Date().toISOString().slice(0, 10))
    setNote('')
    setStationId(showStationPicker ? null : effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : null)
  }, [open, showStationPicker, effectiveStationId])

  const error = useMemo(() => {
    if (fromAccountId == null || toAccountId == null) return 'Select from and to accounts.'
    if (fromAccountId === toAccountId) return 'From and to accounts must differ.'
    const n = Number.parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return 'Amount must be greater than zero.'
    const fromA = accountById.get(fromAccountId)
    const toA = accountById.get(toAccountId)
    if (
      isAccountsReceivable(fromA) ||
      isAccountsPayable(fromA) ||
      isAccountsReceivable(toA) ||
      isAccountsPayable(toA)
    ) {
      return 'Receivable and payable accounts are not supported here — use manual journal with the correct subledger.'
    }
    if (showStationPicker && (stationId == null || stationId <= 0)) return 'Select a station for this transfer.'
    return null
  }, [fromAccountId, toAccountId, amount, accountById, showStationPicker, stationId])

  async function handleSubmit() {
    if (error != null || fromAccountId == null || toAccountId == null) return
    const resolvedStation = showStationPicker
      ? stationId
      : effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : null
    await onSubmit({
      fromAccountId,
      toAccountId,
      amount: String(Number.parseFloat(amount.replace(',', '.')) || 0),
      date: transferDate,
      stationId: resolvedStation,
      note: note.trim(),
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 mx-auto my-4 w-[min(100%,calc(100vw-0.5rem))] max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl sm:my-8 sm:max-w-xl',
        )}
      >
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/90 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Fund Transfer</h2>
              <p className="text-sm text-white/85">Move funds between accounts</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-3">
            <div className="min-w-0">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                From account <span className="text-rose-500">*</span>
              </label>
              <FormSelect
                options={accountOptions}
                value={accountOptions.find((o) => o.value === String(fromAccountId ?? '')) ?? null}
                onChange={(o) => setFromAccountId(o ? Number(o.value) : null)}
                placeholder="source account"
              />
            </div>
            <div className="flex justify-center py-1 sm:pb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md sm:h-10 sm:w-10">
                <ArrowLeftRight className="h-5 w-5 rotate-90 sm:rotate-0" aria-hidden />
              </div>
            </div>
            <div className="min-w-0">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                To account <span className="text-rose-500">*</span>
              </label>
              <FormSelect
                options={accountOptions}
                value={accountOptions.find((o) => o.value === String(toAccountId ?? '')) ?? null}
                onChange={(o) => setToAccountId(o ? Number(o.value) : null)}
                placeholder="destination account"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="min-h-[2.60rem] w-full rounded-lg border border-slate-200 px-3 py-2.3 text-lg font-medium tabular-nums outline-none ring-emerald-500/25 focus:ring-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                className="min-h-[2.75rem] w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500/25 focus:ring-2"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
          </div>

          {showStationPicker && (
            <div className="min-w-0">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Station <span className="text-rose-500">*</span>
              </label>
              <FormSelect
                options={stationOptions}
                value={stationOptions.find((o) => o.value === String(stationId ?? '')) ?? null}
                onChange={(o) => setStationId(o ? Number(o.value) : null)}
                placeholder="Select station"
              />
            </div>
          )}

          <div className="min-w-0">
            <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Note</label>
            <textarea
              rows={3}
              placeholder="Optional note…"
              className="min-h-[5.5rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none ring-emerald-500/25 focus:ring-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!!error || submitting}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer funds
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
