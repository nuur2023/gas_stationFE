import { useMemo, useState } from 'react'
import {
  useCreateAccountMutation,
  useCreateCustomerPaymentMutation,
  useCreateJournalEntryMutation,
  useDeleteAccountMutation,
  useDeleteCustomerPaymentMutation,
  useDeleteJournalEntryMutation,
  useGetAccountsQuery,
  useGetAccountParentCandidatesQuery,
  useGetCustomerFuelGivensQuery,
  useGetCustomerPaymentsQuery,
  useGetJournalEntriesQuery,
  useGetStationsQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DateField } from '../../components/DateField'
import { filterAccountsForViewer } from '../../lib/accountScope'
import { formatDecimal } from '../../lib/formatNumber'

export function AccountingPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const businessId = authBusinessId ?? 0
  const [page] = useState(1)
  const [pageSize] = useState(100)
  const { data: accounts } = useGetAccountsQuery({
    page,
    pageSize,
    businessId: businessId > 0 ? businessId : undefined,
  })
  const { data: parentCandidates = [] } = useGetAccountParentCandidatesQuery(
    { businessId },
    { skip: businessId <= 0 },
  )
  const { data: journalEntries } = useGetJournalEntriesQuery({ page, pageSize })
  const { data: customerPayments } = useGetCustomerPaymentsQuery({ page, pageSize })
  const { data: stations } = useGetStationsQuery({ page: 1, pageSize: 500, businessId: businessId || undefined })
  const { data: customerGivens } = useGetCustomerFuelGivensQuery({ page: 1, pageSize: 500 })

  const [createAccount] = useCreateAccountMutation()
  const [deleteAccount] = useDeleteAccountMutation()
  const [createJournal] = useCreateJournalEntryMutation()
  const [deleteJournal] = useDeleteJournalEntryMutation()
  const [createPayment] = useCreateCustomerPaymentMutation()
  const [deletePayment] = useDeleteCustomerPaymentMutation()

  const [accName, setAccName] = useState('')
  const [accCode, setAccCode] = useState('')
  const [accParent, setAccParent] = useState<number | ''>('')

  const [jDescription, setJDescription] = useState('')
  const [jJournalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [jStationId, setJStationId] = useState<number | ''>('')
  const [jDebitAccount, setJDebitAccount] = useState<number | ''>('')
  const [jCreditAccount, setJCreditAccount] = useState<number | ''>('')
  const [jAmount, setJAmount] = useState('')
  const [jRemark, setJRemark] = useState('')

  const [pGivenId, setPGivenId] = useState<number | ''>('')
  const [pAmount, setPAmount] = useState('')

  const accountOptions = useMemo(
    () => filterAccountsForViewer(accounts?.items, role, authBusinessId),
    [accounts?.items, role, authBusinessId],
  )
  const stationOptions = useMemo(() => stations?.items ?? [], [stations?.items])
  const givenOptions = useMemo(() => customerGivens?.items ?? [], [customerGivens?.items])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Accounting</h1>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Chart of Accounts</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input className="rounded border px-2 py-2" placeholder="Name" value={accName} onChange={(e) => setAccName(e.target.value)} />
          <input className="rounded border px-2 py-2" placeholder="Code" value={accCode} onChange={(e) => setAccCode(e.target.value)} />
          <div className="rounded border px-2 py-2 text-sm text-slate-500">Type follows parent account</div>
          <select className="rounded border px-2 py-2" value={String(accParent)} onChange={(e) => setAccParent(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Parent account (required)</option>
            {parentCandidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
                {a.businessId == null ? ' (global)' : ''}
              </option>
            ))}
          </select>
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-white"
            onClick={async () => {
              if (!accName.trim() || !accCode.trim() || accParent === '' || businessId <= 0) return
              const parent = accountOptions.find((a) => a.id === accParent)
              if (!parent) return
              await createAccount({
                name: accName.trim(),
                code: accCode.trim(),
                chartsOfAccountsId: parent.chartsOfAccountsId,
                parentAccountId: accParent,
                businessId,
              }).unwrap()
              setAccName('')
              setAccCode('')
              setAccParent('')
            }}
          >Add account</button>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left"><th>Code</th><th>Name</th><th>Type</th><th>Parent</th><th /></tr></thead>
            <tbody>
              {accountOptions.map((a) => (
                <tr key={a.id} className="border-t">
                  <td>{a.code}</td><td>{a.name}</td><td>{a.chartsOfAccounts?.type ?? '—'}</td><td>{a.parentAccountId ?? '—'}</td>
                  <td><button className="text-rose-600" onClick={async () => deleteAccount(a.id).unwrap()}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Manual Journal Entry</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <div className="md:col-span-2">
            <DateField value={jJournalDate} onChange={setJournalDate} />
          </div>
          <input className="rounded border px-2 py-2 md:col-span-2" placeholder="Description" value={jDescription} onChange={(e) => setJDescription(e.target.value)} />
          <select className="rounded border px-2 py-2" value={String(jStationId)} onChange={(e) => setJStationId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">No station</option>{stationOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="rounded border px-2 py-2" value={String(jDebitAccount)} onChange={(e) => setJDebitAccount(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Debit account</option>{accountOptions.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
          <select className="rounded border px-2 py-2" value={String(jCreditAccount)} onChange={(e) => setJCreditAccount(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Credit account</option>{accountOptions.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </select>
          <input className="rounded border px-2 py-2" placeholder="Amount" value={jAmount} onChange={(e) => setJAmount(e.target.value)} />
          <input className="rounded border px-2 py-2 md:col-span-2" placeholder="Remark (customer/supplier)" value={jRemark} onChange={(e) => setJRemark(e.target.value)} />
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-white"
            onClick={async () => {
              if (jDebitAccount === '' || jCreditAccount === '') return
              await createJournal({
                date: `${jJournalDate}T12:00:00.000Z`,
                description: jDescription,
                businessId,
                stationId: jStationId === '' ? null : jStationId,
                lines: [
                  { accountId: jDebitAccount, debit: jAmount || '0', credit: '0', remark: jRemark || undefined },
                  { accountId: jCreditAccount, debit: '0', credit: jAmount || '0', remark: jRemark || undefined },
                ],
              }).unwrap()
              setJDescription('')
              setJournalDate(new Date().toISOString().slice(0, 10))
              setJStationId('')
              setJDebitAccount('')
              setJCreditAccount('')
              setJAmount('')
              setJRemark('')
            }}
          >Post journal</button>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left"><th>Date</th><th>Description</th><th>Lines</th><th /></tr></thead>
            <tbody>
              {(journalEntries?.items ?? []).map((j) => (
                <tr key={j.id} className="border-t">
                  <td>{new Date(j.date).toLocaleString()}</td>
                  <td>{j.description}</td>
                  <td>{j.lines?.length ?? 0}</td>
                  <td><button className="text-rose-600" onClick={async () => deleteJournal(j.id).unwrap()}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Customer Payments</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="rounded border px-2 py-2" value={String(pGivenId)} onChange={(e) => setPGivenId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select customer fuel given</option>
            {givenOptions.map((g) => <option key={g.id} value={g.id}>{g.name} | #{g.id}</option>)}
          </select>
          <input className="rounded border px-2 py-2" placeholder="Amount paid" value={pAmount} onChange={(e) => setPAmount(e.target.value)} />
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-white"
            onClick={async () => {
              if (pGivenId === '') return
              await createPayment({ customerFuelGivenId: pGivenId, amountPaid: pAmount, businessId }).unwrap()
              setPGivenId(''); setPAmount('')
            }}
          >Save payment</button>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left"><th>Date</th><th>CustomerFuelGivenId</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {(customerPayments?.items ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td>{new Date(p.paymentDate).toLocaleString()}</td>
                  <td>{p.customerFuelGivenId}</td>
                  <td>{formatDecimal(p.amountPaid)}</td>
                  <td><button className="text-rose-600" onClick={async () => deletePayment(p.id).unwrap()}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

