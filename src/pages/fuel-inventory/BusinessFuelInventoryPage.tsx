import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateBusinessFuelInventoryCreditMutation,
  useDeleteBusinessFuelInventoryCreditMutation,
  useGetBusinessFuelInventoryBalancesQuery,
  useGetBusinessFuelInventoryCreditsQuery,
  useGetBusinessesQuery,
  useGetFuelTypesQuery,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { DateField } from '../../components/DateField'
import { useToast } from '../../components/ToastProvider'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms } from '../../lib/stationContext'

function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'string' && data.trim()) return data
  }
  return 'Request failed.'
}

export function BusinessFuelInventoryPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)
  const { showError, showSuccess } = useToast()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: businessesData } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    { skip: !showBizPicker },
  )

  const { data: balances = [], isFetching: balLoading } = useGetBusinessFuelInventoryBalancesQuery(
    { businessId: effectiveBusinessId ?? undefined },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )

  const [creditPage, setCreditPage] = useState(1)
  const [creditPageSize, setCreditPageSize] = useState(25)
  const [creditSearch, setCreditSearch] = useState('')
  const [selectedCreditIds, setSelectedCreditIds] = useState<Set<number>>(new Set())
  const { data: creditsPaged, isFetching: creditsLoading } = useGetBusinessFuelInventoryCreditsQuery(
    { businessId: effectiveBusinessId ?? undefined, page: creditPage, pageSize: creditPageSize },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )

  const { data: fuelTypesAll = [] } = useGetFuelTypesQuery()
  const fuelTypesForBusiness = useMemo(() => {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0) return []
    return fuelTypesAll.filter((f) => f.businessId === effectiveBusinessId)
  }, [fuelTypesAll, effectiveBusinessId])

  const businessOptions: SelectOption[] = useMemo(
    () =>
      (businessesData?.items ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [businessesData?.items],
  )

  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypesForBusiness.map((f) => ({ value: String(f.id), label: f.fuelName })),
    [fuelTypesForBusiness],
  )

  const businessSelectValue = useMemo(
    () => businessOptions.find((o) => o.value === String(formBusinessId ?? '')) ?? null,
    [businessOptions, formBusinessId],
  )

  useEffect(() => {
    if (!showBizPicker) return
    const items = businessesData?.items ?? []
    if (items.length === 0) return
    setFormBusinessId((prev) => (prev != null && items.some((b) => b.id === prev) ? prev : items[0].id))
  }, [showBizPicker, businessesData?.items])

  useEffect(() => {
    setSelectedCreditIds(new Set())
    setCreditPage(1)
    setBalancePage(1)
  }, [effectiveBusinessId])

  const [creditOpen, setCreditOpen] = useState(false)
  const [creditFuelId, setCreditFuelId] = useState<string | null>(null)
  const [creditLiters, setCreditLiters] = useState('')
  const [creditDate, setCreditDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [creditRef, setCreditRef] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [createCredit, { isLoading: savingCredit }] = useCreateBusinessFuelInventoryCreditMutation()
  const [deleteCredit] = useDeleteBusinessFuelInventoryCreditMutation()

  const [balanceSearch, setBalanceSearch] = useState('')
  const [balancePage, setBalancePage] = useState(1)
  const [balancePageSize, setBalancePageSize] = useState(20)

  const creditFuelSelectValue = useMemo(
    () => (creditFuelId ? fuelOptions.find((o) => o.value === creditFuelId) ?? null : null),
    [fuelOptions, creditFuelId],
  )

  async function submitCredit() {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0) {
      showError('Select a business.')
      return
    }
    const fid = creditFuelId ? Number(creditFuelId) : 0
    if (!fid) {
      showError('Select a fuel type.')
      return
    }
    try {
      await createCredit({
        businessId: effectiveBusinessId,
        fuelTypeId: fid,
        liters: creditLiters.trim() || '0',
        date: new Date(creditDate + 'T12:00:00').toISOString(),
        reference: creditRef.trim() || '—',
        note: creditNote.trim() || undefined,
      }).unwrap()
      showSuccess('Stock credited to business pool.')
      setCreditOpen(false)
      setCreditLiters('')
      setCreditRef('')
      setCreditNote('')
    } catch (e) {
      showError(getApiErrorMessage(e))
    }
  }

  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase()
    if (!q) return balances
    return balances.filter((b) => b.fuelName.toLowerCase().includes(q))
  }, [balances, balanceSearch])

  const balancePageRows = useMemo(() => {
    const start = (balancePage - 1) * balancePageSize
    return filteredBalances.slice(start, start + balancePageSize)
  }, [filteredBalances, balancePage, balancePageSize])

  const filteredCredits = useMemo(() => {
    const rows = creditsPaged?.items ?? []
    const q = creditSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (c) =>
        c.fuelName.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) ||
        (c.creatorName ?? '').toLowerCase().includes(q),
    )
  }, [creditsPaged?.items, creditSearch])

  const balanceColumns: Column<(typeof balances)[number]>[] = [
    { key: 'fuelName', header: 'Fuel type' },
    { key: 'liters', header: 'Liters', align: 'right', render: (row) => formatDecimal(row.liters) },
  ]

  const creditColumns: Column<(typeof filteredCredits)[number]>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => new Date(row.date).toLocaleString(),
    },
    { key: 'fuelName', header: 'Fuel' },
    { key: 'liters', header: 'Liters', align: 'right', render: (row) => formatDecimal(row.liters) },
    { key: 'reference', header: 'Reference' },
    { key: 'creatorName', header: 'By', render: (row) => row.creatorName ?? '—' },
  ]

  function handleDeleteOneCredit(id: number) {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0) return
    const businessId = effectiveBusinessId
    requestDelete({
      title: 'Delete this credit?',
      description: 'This will reduce business pool liters.',
      action: async () => {
        try {
          await deleteCredit({ id, businessId }).unwrap()
          showSuccess('Credit deleted.')
          setSelectedCreditIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        } catch (e) {
          showError(getApiErrorMessage(e))
          throw e
        }
      },
    })
  }

  const hasBusinessContext = effectiveBusinessId != null && effectiveBusinessId > 0
  /** SuperAdmin sees layout before picking a business; normal users need an assigned business. */
  const showFuelTables = showBizPicker || hasBusinessContext

  function handleDeleteSelectedCredits() {
    if (effectiveBusinessId == null || effectiveBusinessId <= 0 || selectedCreditIds.size === 0) return
    const businessId = effectiveBusinessId
    const ids = [...selectedCreditIds]
    requestDelete({
      title: `Delete ${ids.length} selected credit row(s)?`,
      description: 'This will reduce business pool liters for each deleted row.',
      action: async () => {
        try {
          for (const id of ids) {
            await deleteCredit({ id, businessId }).unwrap()
          }
          showSuccess('Selected credits deleted.')
          setSelectedCreditIds(new Set())
        } catch (e) {
          showError(getApiErrorMessage(e))
          throw e
        }
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fuel Pool</h1>
        <p className="mt-1 text-slate-600">
          Manage the fuel pool for a business. Credits add stock (e.g. after purchase). Transfers move liters to a
          station — see <strong>Transfer to station</strong> in the menu.
        </p>
      </div>

      {showBizPicker ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
          <div className="max-w-md">
            <FormSelect
              value={businessSelectValue}
              onChange={(o) => setFormBusinessId(o ? Number(o.value) : null)}
              options={businessOptions}
              placeholder="Select business"
            />
          </div>
          {!hasBusinessContext && businessOptions.length === 0 ? (
            <p className="mt-3 text-sm text-amber-900">
              No businesses exist yet.{' '}
              <Link to="/setup/businesses" className="font-medium text-emerald-700 underline hover:text-emerald-800">
                Create a business
              </Link>{' '}
              under Main setup, then return here.
            </p>
          ) : !hasBusinessContext ? (
            <p className="mt-2 text-sm text-slate-600">Choose a business to load balances and credit history.</p>
          ) : null}
        </div>
      ) : !hasBusinessContext ? (
        <p className="text-slate-600">No business assigned.</p>
      ) : null}

      {showFuelTables ? (
        <>
          <DataTable
            title="Pool Remaining"
            addLabel="Add liters to pool"
            rows={hasBusinessContext ? balancePageRows : []}
            totalCount={hasBusinessContext ? filteredBalances.length : 0}
            page={balancePage}
            pageSize={balancePageSize}
            onPageChange={setBalancePage}
            onPageSizeChange={setBalancePageSize}
            search={balanceSearch}
            onSearchChange={(q) => {
              setBalanceSearch(q)
              setBalancePage(1)
            }}
            columns={balanceColumns}
            isLoading={hasBusinessContext && balLoading}
            selectedIds={new Set<number>()}
            onSelectedIdsChange={() => undefined}
            onAdd={() => setCreditOpen(true)}
            onDeleteOne={() => undefined}
            onDeleteSelected={() => undefined}
            showRowSelection={false}
            showRowActions={false}
            emptyMessage={
              !hasBusinessContext && showBizPicker
                ? businessOptions.length === 0
                  ? 'Add a business above to use this table.'
                  : 'Select a business above to load balances.'
                : undefined
            }
            tableActionPermissions={
              !hasBusinessContext && showBizPicker
                ? { canCreate: false, canUpdate: false, canDelete: false }
                : undefined
            }
          />

          <DataTable
            title="Pool history"
            rows={hasBusinessContext ? filteredCredits : []}
            totalCount={hasBusinessContext ? (creditsPaged?.totalCount ?? 0) : 0}
            page={creditPage}
            pageSize={creditPageSize}
            onPageChange={setCreditPage}
            onPageSizeChange={setCreditPageSize}
            search={creditSearch}
            onSearchChange={(q) => {
              setCreditSearch(q)
              setCreditPage(1)
            }}
            columns={creditColumns}
            isLoading={hasBusinessContext && creditsLoading}
            selectedIds={selectedCreditIds}
            onSelectedIdsChange={setSelectedCreditIds}
            onDeleteOne={handleDeleteOneCredit}
            onDeleteSelected={handleDeleteSelectedCredits}
            hideSearch={false}
            emptyMessage={
              !hasBusinessContext && showBizPicker
                ? businessOptions.length === 0
                  ? 'Add a business above to use this table.'
                  : 'Select a business above to load credit history.'
                : undefined
            }
            tableActionPermissions={
              !hasBusinessContext && showBizPicker
                ? { canCreate: false, canUpdate: false, canDelete: false }
                : undefined
            }
          />
        </>
      ) : null}

      <Modal open={creditOpen} onClose={() => setCreditOpen(false)} title="Credit business fuel pool">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This records liters <strong>into</strong> the business pool (stock-in). It does not change dipping or
            purchases.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fuel type</label>
            <FormSelect
              value={creditFuelSelectValue}
              onChange={(o) => setCreditFuelId(o?.value ?? null)}
              options={fuelOptions}
              placeholder="Select fuel"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Liters</label>
            <input
              type="text"
              inputMode="decimal"
              value={creditLiters}
              onChange={(e) => setCreditLiters(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="0"
            />
          </div>
          <DateField label="Date" value={creditDate} onChange={setCreditDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reference</label>
            <input
              type="text"
              value={creditRef}
              onChange={(e) => setCreditRef(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Invoice / purchase ref"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" onClick={() => setCreditOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={savingCredit}
              onClick={() => void submitCredit()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save credit
            </button>
          </div>
        </div>
      </Modal>
      </div>
    </>
  )
}
