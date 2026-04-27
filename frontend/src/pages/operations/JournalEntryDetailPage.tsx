import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useGetAccountsQuery, useGetJournalEntryQuery } from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { filterAccountsForViewer } from '../../lib/accountScope'
import { formatDecimal } from '../../lib/formatNumber'
import type { JournalEntryLine } from '../../types/models'

export function JournalEntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const id = Number(entryId)
  const skip = !Number.isFinite(id) || id <= 0

  const { data: entry, isFetching, isError } = useGetJournalEntryQuery(id, { skip })
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)

  const { data: accounts } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: entry?.businessId },
    { skip: !entry?.businessId },
  )

  const accountItemsForViewer = useMemo(
    () => filterAccountsForViewer(accounts?.items, role, authBusinessId),
    [accounts?.items, role, authBusinessId],
  )

  const accountLabelById = useMemo(() => {
    const m = new Map<number, string>()
    for (const a of accountItemsForViewer) m.set(a.id, `${a.code} - ${a.name}`)
    return m
  }, [accountItemsForViewer])


  function lineAccountLabel(line: JournalEntryLine) {
    return accountLabelById.get(line.accountId) ?? `Account #${line.accountId}`
  }

  function lineCustomerLabel(line: JournalEntryLine) {
    if (line.customer?.name) return line.customer.name
    return line.customerId != null && line.customerId > 0 ? `#${line.customerId}` : '—'
  }

  function lineSupplierLabel(line: JournalEntryLine) {
    if (line.supplier?.name) return line.supplier.name
    return line.supplierId != null && line.supplierId > 0 ? `#${line.supplierId}` : '—'
  }

  if (skip) {
    return (
      <div className="space-y-4">
        <Link to="/accounting/manual-journal-entry" className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to manual journal entry
        </Link>
        <p className="text-slate-600">Invalid journal entry.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/accounting/manual-journal-entry"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Manual journal entry
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">View journal details</h1>
      </div>

      {isFetching && <p className="text-slate-600">Loading…</p>}
      {isError && !isFetching && <p className="text-red-600">Could not load this journal entry.</p>}

      {entry && !isFetching && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Account</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Debit</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Credit</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Customer</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Supplier</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(entry.lines ?? []).map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 text-slate-800">{lineAccountLabel(line)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{formatDecimal(line.debit)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{formatDecimal(line.credit)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{lineCustomerLabel(line)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{lineSupplierLabel(line)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{line.remark?.trim() ? line.remark : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
