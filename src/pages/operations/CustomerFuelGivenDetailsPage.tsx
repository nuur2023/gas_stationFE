import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useCreateCustomerFuelGivenMutation,
  useDeleteCustomerFuelGivenMutation,
  useGetCurrenciesQuery,
  useGetCustomerFuelGivenCustomerByIdQuery,
  useGetCustomerFuelGivenTransactionsByCustomerQuery,
  useGetDippingsQuery,
  useGetFuelPricesQuery,
  useGetFuelTypesQuery,
  useGetRatesQuery,
  useUpdateCustomerFuelGivenMutation,
} from '../../app/api/apiSlice'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatDecimal, parseNumericInput } from '../../lib/formatNumber'
import { formatRateNumber } from '../../lib/formatRateNumber'
import type { CustomerFuelGiven, CustomerFuelGivenWriteRequest } from '../../types/models'

type TxType = 'Fuel' | 'Cash'

export function CustomerFuelGivenDetailsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const customerId = Number(id ?? 0)
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const { data: customer, isFetching } = useGetCustomerFuelGivenCustomerByIdQuery(customerId, {
    skip: customerId <= 0,
  })
  const { data: transactions = [], isFetching: isFetchingTx } = useGetCustomerFuelGivenTransactionsByCustomerQuery(customerId, {
    skip: customerId <= 0,
  })
  const { data: fuelTypes = [] } = useGetFuelTypesQuery()
  const { data: fuelPrices = [] } = useGetFuelPricesQuery(
    customer && customer.businessId > 0
      ? { filterBusinessId: customer.businessId, filterStationId: customer.stationId > 0 ? customer.stationId : undefined }
      : undefined,
    { skip: !customer || customer.businessId <= 0 },
  )
  const { data: currencies = [] } = useGetCurrenciesQuery()
  const { data: ratesData } = useGetRatesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: dippingsPaged } = useGetDippingsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: customer?.businessId,
      filterStationId: customer && customer.stationId > 0 ? customer.stationId : undefined,
    },
    { skip: !customer || customer.businessId <= 0 },
  )

  const [createTx] = useCreateCustomerFuelGivenMutation()
  const [updateTx] = useUpdateCustomerFuelGivenMutation()
  const [deleteTx] = useDeleteCustomerFuelGivenMutation()

  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<CustomerFuelGiven | null>(null)
  const [type, setType] = useState<TxType>('Fuel')
  const [fuelTypeId, setFuelTypeId] = useState(0)
  const [givenLiter, setGivenLiter] = useState('0')
  const [price, setPrice] = useState('0')
  const [amountUsd, setAmountUsd] = useState('0')
  const [cashAmount, setCashAmount] = useState('0')
  const [remark, setRemark] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amountUsdFocused, setAmountUsdFocused] = useState(false)
  const [currencyId, setCurrencyId] = useState(0)

  const sspCurrencyId = useMemo(() => {
    const row = currencies.find((c) => c.code.trim().toUpperCase() === 'SSP')
    return row?.id ?? 0
  }, [currencies])

  const currencyCodeById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currencies) {
      m.set(c.id, (c.code || '').trim().toUpperCase())
    }
    return m
  }, [currencies])

  /** All currencies from Setup → Currencies (not derived from fuel prices). */
  const currencyOptionsForTx = useMemo(
    (): SelectOption[] =>
      [...currencies]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((c) => ({
          value: String(c.id),
          label: `${(c.code || '').trim().toUpperCase()} (${c.symbol})`,
        })),
    [currencies],
  )

  const currencyDisplayForRow = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of currencies) {
      m.set(c.id, `${(c.code || '').trim().toUpperCase()} (${c.symbol})`)
    }
    return m
  }, [currencies])

  const preferredTxCurrencyId = useMemo(() => {
    if (sspCurrencyId > 0 && currencyOptionsForTx.some((o) => Number(o.value) === sspCurrencyId)) return sspCurrencyId
    const first = Number(currencyOptionsForTx[0]?.value)
    return Number.isFinite(first) && first > 0 ? first : 0
  }, [sspCurrencyId, currencyOptionsForTx])

  const selectedCurrencyOpt = useMemo(
    () => currencyOptionsForTx.find((o) => Number(o.value) === currencyId) ?? null,
    [currencyOptionsForTx, currencyId],
  )

  const selectedFuelCurrencyCode = (currencyCodeById.get(currencyId) ?? 'SSP').trim().toUpperCase()

  const activeSspPerUsd = useMemo(() => {
    if (!customer) return null
    const items = ratesData?.items ?? []
    const active = items.filter((r) => r.active && r.businessId === customer.businessId)
    if (active.length === 0) return null
    active.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const n = Number(active[0].rateNumber)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [ratesData, customer])

  const priceRowForFuel = useMemo(() => {
    if (!customer || fuelTypeId <= 0 || currencyId <= 0) return null
    return (
      fuelPrices.find(
        (fp) =>
          fp.businessId === customer.businessId &&
          (customer.stationId <= 0 || fp.stationId === customer.stationId) &&
          fp.fuelTypeId === fuelTypeId &&
          fp.currencyId === currencyId,
      ) ?? null
    )
  }, [customer, fuelTypeId, fuelPrices, currencyId])

  const dippingBalanceLiters = useMemo(() => {
    if (!customer || fuelTypeId <= 0) return null
    const items = dippingsPaged?.items ?? []
    const row = items.find((d) => d.stationId === customer.stationId && d.fuelTypeId === fuelTypeId)
    return row != null ? Number(row.amountLiter) : null
  }, [customer, fuelTypeId, dippingsPaged?.items])

  const fuelTypeNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const ft of fuelTypes) map.set(ft.id, ft.fuelName)
    return map
  }, [fuelTypes])
  const typeOptions: SelectOption[] = useMemo(
    () => [
      { value: 'Fuel', label: 'Fuel' },
      { value: 'Cash', label: 'Cash' },
    ],
    [],
  )
  const selectedType = useMemo<SelectOption>(
    () => (type === 'Cash' ? { value: 'Cash', label: 'Cash' } : { value: 'Fuel', label: 'Fuel' }),
    [type],
  )
  const fuelTypeOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((ft) => ({ value: String(ft.id), label: ft.fuelName })),
    [fuelTypes],
  )
  const selectedFuelType = useMemo(
    () => fuelTypeOptions.find((o) => o.value === String(fuelTypeId)) ?? null,
    [fuelTypeId, fuelTypeOptions],
  )

  function applyFuelPriceForType(nextFuelTypeId: number, curId: number) {
    if (!customer || nextFuelTypeId <= 0 || curId <= 0) return
    const row =
      fuelPrices.find(
        (fp) =>
          fp.businessId === customer.businessId &&
          (customer.stationId <= 0 || fp.stationId === customer.stationId) &&
          fp.fuelTypeId === nextFuelTypeId &&
          fp.currencyId === curId,
      ) ?? null
    if (row != null && Number.isFinite(Number(row.price))) {
      const pr = Number(row.price)
      setPrice(pr === Math.round(pr) ? String(Math.round(pr)) : String(pr))
    }
  }

  useEffect(() => {
    if (!txModalOpen || type !== 'Fuel' || amountUsdFocused) return
    const g = parseNumericInput(givenLiter)
    const p = parseNumericInput(price)
    if (!Number.isFinite(g) || !Number.isFinite(p) || g < 0 || p < 0) return
    const code = currencyCodeById.get(currencyId) ?? 'SSP'
    let usd: number
    if (code === 'USD') {
      usd = Math.round(g * p * 100) / 100
    } else {
      const r = activeSspPerUsd
      if (r == null || !Number.isFinite(r) || r <= 0) return
      usd = Math.round(((g * p) / r) * 100) / 100
    }
    const next = usd.toFixed(2)
    setAmountUsd((prev) => (prev === next ? prev : next))
  }, [txModalOpen, type, givenLiter, price, activeSspPerUsd, amountUsdFocused, currencyId, currencyCodeById])

  function openCreateTx() {
    setEditingTx(null)
    setType('Fuel')
    setFuelTypeId(0)
    setGivenLiter('0')
    setPrice('0')
    setAmountUsd('0')
    setCashAmount('0')
    setRemark('')
    setDate(new Date().toISOString().slice(0, 10))
    setAmountUsdFocused(false)
    setCurrencyId(preferredTxCurrencyId)
    setTxModalOpen(true)
  }

  function openEditTx(row: CustomerFuelGiven) {
    setEditingTx(row)
    setType(row.type === 'Cash' ? 'Cash' : 'Fuel')
    setFuelTypeId(row.fuelTypeId)
    setGivenLiter(String(row.givenLiter))
    setPrice(String(row.price))
    setAmountUsd(String(row.usdAmount))
    setCashAmount(String(row.cashAmount))
    setRemark(row.remark ?? '')
    setDate(new Date(row.date).toISOString().slice(0, 10))
    setAmountUsdFocused(false)
    const cid = row.currencyId != null && row.currencyId > 0 ? row.currencyId : preferredTxCurrencyId
    setCurrencyId(cid)
    setTxModalOpen(true)
  }

  async function saveTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    const body: CustomerFuelGivenWriteRequest = {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone ?? '',
      type,
      currencyId: currencyId > 0 ? currencyId : preferredTxCurrencyId,
      fuelTypeId: type === 'Fuel' ? fuelTypeId : 0,
      givenLiter: type === 'Fuel' ? givenLiter : '0',
      price: type === 'Fuel' ? price : '0',
      amountUsd: type === 'Fuel' ? amountUsd : '0',
      cashAmount: type === 'Cash' ? cashAmount : '0',
      remark: remark.trim() || undefined,
      stationId: customer.stationId,
      businessId: customer.businessId,
      date: new Date(date).toISOString(),
    }
    if (editingTx) {
      await updateTx({ id: editingTx.id, body }).unwrap()
    } else {
      await createTx(body).unwrap()
    }
    setTxModalOpen(false)
  }

  function handleDeleteTransaction(idToDelete: number) {
    requestDelete({
      title: 'Delete transaction?',
      description: 'This will remove the selected customer transaction.',
      action: async () => {
        await deleteTx(idToDelete).unwrap()
      },
    })
  }

  const fuelContextHint = useMemo(() => {
    if (type !== 'Fuel' || !customer) return null
    const parts: string[] = []
    if (dippingBalanceLiters != null && Number.isFinite(dippingBalanceLiters)) {
      parts.push(`Dipping balance: ${formatDecimal(dippingBalanceLiters)} L`)
    } else {
      parts.push('Dipping balance: —')
    }
    if (selectedFuelCurrencyCode === 'USD') {
      parts.push('Amount USD = given liters × price (USD/L)')
    } else if (activeSspPerUsd != null) {
      parts.push(`Rate: ${formatRateNumber(activeSspPerUsd)} SSP/USD`)
    } else {
      parts.push('Rate: — (add an active rate under Rates to auto-fill Amount USD)')
    }
    return parts.join(' · ')
  }, [type, customer, dippingBalanceLiters, activeSspPerUsd, selectedFuelCurrencyCode])

  return (
    <>
      {deleteDialog}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/customer-fuel-givens')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Customer details</h2>
              {isFetching ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-900">{customer?.name || '—'}</p>
                  <p className="text-lg font-bold tabular-nums text-red-600">{formatDecimal(customer?.balance ?? 0)}</p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={openCreateTx}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Give Cash | Fuel
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Currency</th>
                <th className="px-3 py-2 text-left">Fuel type</th>
                <th className="px-3 py-2 text-right">Given L</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Amount USD</th>
                <th className="px-3 py-2 text-right">Cash</th>
                <th className="px-3 py-2 text-left">Remark</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isFetchingTx && (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={10}>
                    Loading transactions...
                  </td>
                </tr>
              )}
              {!isFetchingTx && transactions.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={10}>
                    No transactions found.
                  </td>
                </tr>
              )}
              {!isFetchingTx &&
                transactions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{new Date(row.date).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.type === 'Cash' ? 'Cash' : 'Fuel'}</td>
                    <td className="px-3 py-2">
                      {row.currencyId != null && row.currencyId > 0
                        ? (currencyDisplayForRow.get(row.currencyId) ?? currencyCodeById.get(row.currencyId) ?? `#${row.currencyId}`)
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.type === 'Cash' ? '—' : fuelTypeNameById.get(row.fuelTypeId) ?? `#${row.fuelTypeId}`}
                    </td>
                    <td className="px-3 py-2 text-right">{row.type === 'Cash' ? '—' : formatDecimal(row.givenLiter)}</td>
                    <td className="px-3 py-2 text-right">{row.type === 'Cash' ? '—' : formatDecimal(row.price)}</td>
                    <td className="px-3 py-2 text-right">{row.type === 'Cash' ? '—' : formatDecimal(row.usdAmount)}</td>
                    <td className="px-3 py-2 text-right">{row.type === 'Cash' ? formatDecimal(row.cashAmount) : '—'}</td>
                    <td className="px-3 py-2">{row.remark || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditTx(row)}
                          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(row.id)}
                          className="rounded p-1.5 text-rose-700 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={txModalOpen}
        title={editingTx ? 'Edit transaction' : 'Give Cash | Fuel'}
        onClose={() => setTxModalOpen(false)}
        className="max-w-3xl"
      >
        <form onSubmit={saveTransaction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <FormSelect
                options={typeOptions}
                value={selectedType}
                onChange={(o) => setType(o?.value === 'Cash' ? 'Cash' : 'Fuel')}
                placeholder="Select type"
              />
            </div>
            {type === 'Fuel' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fuel type</label>
                <FormSelect
                  options={fuelTypeOptions}
                  value={selectedFuelType}
                  onChange={(o) => {
                    const next = o ? Number(o.value) : 0
                    setFuelTypeId(next)
                    applyFuelPriceForType(next, currencyId)
                  }}
                  placeholder="Select fuel type"
                />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <FormSelect
              options={currencyOptionsForTx}
              value={selectedCurrencyOpt}
              onChange={(o) => {
                const next = o ? Number(o.value) : 0
                setCurrencyId(next)
                if (type === 'Fuel' && fuelTypeId > 0) applyFuelPriceForType(fuelTypeId, next)
              }}
              placeholder="Select currency"
              isDisabled={currencyOptionsForTx.length === 0}
            />
            <p className="mt-1 text-xs text-slate-500">List matches Setup → Currencies for this business.</p>
          </div>
          {type === 'Fuel' && fuelContextHint ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{fuelContextHint}</p>
          ) : null}
          {type === 'Fuel' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Given liter</label>
                <input
                  value={givenLiter}
                  onChange={(e) => setGivenLiter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Price ({selectedFuelCurrencyCode} / L)</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                {priceRowForFuel ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Configured price for this fuel: {formatDecimal(Number(priceRowForFuel.price))} {selectedFuelCurrencyCode}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount USD</label>
                <input
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  onFocus={() => setAmountUsdFocused(true)}
                  onBlur={() => setAmountUsdFocused(false)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {selectedFuelCurrencyCode === 'USD'
                    ? 'Amount USD = given liters × price (USD/L); saved with the transaction.'
                    : '(Given L × Price in local) ÷ SSP/USD rate; saved with the transaction.'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash amount</label>
              <input value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remark</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTxModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
