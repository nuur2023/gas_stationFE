import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetBusinessesQuery, useGetTransferInventoryAuditTrailPagedQuery } from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { useDebouncedValue } from '../../lib/hooks'
import { formatDecimal } from '../../lib/formatNumber'
import { showBusinessPickerInForms } from '../../lib/stationContext'
import type { TransferInventoryAuditListRow } from '../../types/models'

export function TransferAuditTrailPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const showBizPicker = showBusinessPickerInForms(role)

  const [formBusinessId, setFormBusinessId] = useState<number | null>(null)
  const effectiveBusinessId = showBizPicker ? formBusinessId : authBusinessId

  const { data: businessesData } = useGetBusinessesQuery(
    { page: 1, pageSize: 500, q: undefined },
    { skip: !showBizPicker },
  )

  const businessOptions: SelectOption[] = useMemo(
    () =>
      (businessesData?.items ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    [businessesData?.items],
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

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, effectiveBusinessId])

  const { data: paged, isFetching } = useGetTransferInventoryAuditTrailPagedQuery(
    {
      businessId: effectiveBusinessId ?? undefined,
      page,
      pageSize,
      q: debouncedSearch.trim() || undefined,
    },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )

  const rows = paged?.items ?? []
  const hasBusinessContext = effectiveBusinessId != null && effectiveBusinessId > 0
  const showTable = showBizPicker || hasBusinessContext

  const columns: Column<TransferInventoryAuditListRow>[] = useMemo(
    () => [
      { key: 'transferInventoryId', header: 'Transfer #' },
      {
        key: 'changedAt',
        header: 'When',
        render: (row) => new Date(row.changedAt).toLocaleString(),
      },
      { key: 'action', header: 'Action' },
      {
        key: 'changedByName',
        header: 'By',
        render: (row) => row.changedByName ?? `User #${row.changedByUserId}`,
      },
      { key: 'fuelName', header: 'Fuel' },
      { key: 'stationName', header: 'Station' },
      {
        key: 'liters',
        header: 'Liters',
        align: 'right',
        render: (row) => formatDecimal(row.liters),
      },
      {
        key: 'date',
        header: 'Transfer date',
        render: (row) => new Date(row.date).toLocaleString(),
      },
      {
        key: 'reason',
        header: 'Reason',
        render: (row) => row.reason ?? '—',
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transfer audit trail</h1>
        <p className="mt-1 text-slate-600">
          History of creates, edits, and deletes for pool-to-station transfers. To add or change transfers, use{' '}
          <Link to="/transfers" className="font-medium text-emerald-700 underline hover:text-emerald-800">
            Transfer to station
          </Link>
          .
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
            <p className="mt-2 text-sm text-slate-600">Choose a business to load the audit table.</p>
          ) : null}
        </div>
      ) : !hasBusinessContext ? (
        <p className="text-slate-600">No business assigned.</p>
      ) : null}

      {showTable ? (
        <DataTable<TransferInventoryAuditListRow>
          readOnly
          title="Audit entries"
          rows={hasBusinessContext ? rows : []}
          totalCount={hasBusinessContext ? (paged?.totalCount ?? 0) : 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          search={searchInput}
          onSearchChange={setSearchInput}
          columns={columns}
          isLoading={hasBusinessContext && isFetching}
          selectedIds={new Set()}
          onSelectedIdsChange={() => undefined}
          onDeleteOne={() => undefined}
          onDeleteSelected={() => undefined}
          emptyMessage={
            !hasBusinessContext && showBizPicker
              ? businessOptions.length === 0
                ? 'Add a business above to use this table.'
                : 'Select a business above to load audit entries.'
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
