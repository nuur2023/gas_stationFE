import { useMemo, useState } from 'react'
import {
  useCreateBusinessUserMutation,
  useDeleteBusinessUserMutation,
  useGetBusinessesQuery,
  useGetBusinessUsersQuery,
  useGetStationsQuery,
  useGetUsersQuery,
  useUpdateBusinessUserMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { FormMultiSelect } from '../../components/FormMultiSelect'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import {
  adminNeedsSettingsStation,
  SETTINGS_STATION_HINT,
  showBusinessColumnInTables,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { BusinessUser } from '../../types/models'

export function BusinessUsersPage() {
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role) || role === 'Admin'

  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data, isFetching } = useGetBusinessUsersQuery({ page, pageSize, q: debounced || undefined })
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: usersData } = useGetUsersQuery({ page: 1, pageSize: 500, q: undefined })
  const { data: stationsForNames } = useGetStationsQuery({ page: 1, pageSize: 2000, q: undefined })

  const [createBu] = useCreateBusinessUserMutation()
  const [updateBu] = useUpdateBusinessUserMutation()
  const [deleteBu] = useDeleteBusinessUserMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BusinessUser | null>(null)
  const [businessId, setBusinessId] = useState<number | null>(null)
  const [userId, setUserId] = useState(0)
  /** Station IDs to assign (SuperAdmin / Admin picker). One BusinessUser row per station. */
  const [stationIds, setStationIds] = useState<number[]>([])
  /** For edit: original user+business key so we can sync rows when stations change. */
  const [originalLink, setOriginalLink] = useState<{ userId: number; businessId: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const effectiveBusinessId = showBizPicker ? businessId : authBusinessId

  const { data: stationsFiltered } = useGetStationsQuery(
    {
      page: 1,
      pageSize: 500,
      q: undefined,
      businessId: effectiveBusinessId ?? undefined,
    },
    { skip: effectiveBusinessId == null || effectiveBusinessId <= 0 },
  )

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businessesData?.items ?? []
    if (showBizPicker) {
      return items.map((b) => ({ value: String(b.id), label: b.name }))
    }
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businessesData?.items, showBizPicker, authBusinessId])

  const userOptions: SelectOption[] = useMemo(
    () => (usersData?.items ?? []).map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })),
    [usersData?.items],
  )

  const stationOptions: SelectOption[] = useMemo(
    () => (stationsFiltered?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsFiltered?.items],
  )

  const businessNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of businessesData?.items ?? []) m.set(b.id, b.name)
    return m
  }, [businessesData?.items])

  const userNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usersData?.items ?? []) m.set(u.id, u.name)
    return m
  }, [usersData?.items])

  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stationsForNames?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stationsForNames?.items])

  function openCreate() {
    setEditing(null)
    setOriginalLink(null)
    if (showBizPicker) {
      setBusinessId(null)
    } else {
      setBusinessId(authBusinessId ?? null)
    }
    setUserId(0)
    setStationIds([])
    setOpen(true)
  }

  function openEdit(row: BusinessUser) {
    setEditing(row)
    setBusinessId(showBizPicker ? row.businessId : authBusinessId ?? null)
    setUserId(row.userId)
    setOriginalLink({ userId: row.userId, businessId: row.businessId })
    const siblings = (data?.items ?? []).filter(
      (bu) => bu.userId === row.userId && bu.businessId === row.businessId,
    )
    const ids = [...new Set(siblings.map((b) => b.stationId).filter((id) => id > 0))].sort((a, b) => a - b)
    setStationIds(ids)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const bid = showBizPicker ? businessId : authBusinessId
    if (bid == null || bid <= 0 || userId <= 0) return

    if (!showStationPicker) {
      if (needsWorkspaceStation) return
      const sid = effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : 0
      const body = { userId, businessId: bid, stationId: sid }
      if (editing) {
        await updateBu({ id: editing.id, body: { ...editing, ...body } }).unwrap()
      } else {
        await createBu(body).unwrap()
      }
      setOpen(false)
      setSelected(new Set())
      return
    }

    const ids = [...new Set(stationIds)].filter((id) => id > 0)
    if (ids.length === 0) return

    const items = data?.items ?? []

    if (editing && originalLink) {
      const oldRows = items.filter(
        (bu) => bu.userId === originalLink.userId && bu.businessId === originalLink.businessId,
      )
      const linkChanged = originalLink.userId !== userId || originalLink.businessId !== bid

      if (linkChanged) {
        for (const r of oldRows) {
          await deleteBu(r.id).unwrap()
        }
        for (const sid of ids) {
          await createBu({ userId, businessId: bid, stationId: sid }).unwrap()
        }
      } else {
        const want = new Set(ids)
        for (const r of oldRows) {
          if (!want.has(r.stationId)) {
            await deleteBu(r.id).unwrap()
          }
        }
        const have = new Set(oldRows.map((r) => r.stationId))
        for (const sid of ids) {
          if (!have.has(sid)) {
            await createBu({ userId, businessId: bid, stationId: sid }).unwrap()
          }
        }
      }
    } else {
      for (const sid of ids) {
        await createBu({ userId, businessId: bid, stationId: sid }).unwrap()
      }
    }

    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Remove this link?',
      description: 'The user–business association will be deleted.',
      action: async () => {
        await deleteBu(id).unwrap()
        setSelected((prev) => {
          const n = new Set(prev)
          n.delete(id)
          return n
        })
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: `Remove ${ids.length} link(s)?`,
      description: 'Selected user–business links will be removed.',
      action: async () => {
        for (const id of ids) {
          await deleteBu(id).unwrap()
        }
        setSelected(new Set())
      },
    })
  }

  const businessSel = businessOptions.find((o) => o.value === String(businessId ?? '')) ?? null
  const userSel = userOptions.find((o) => o.value === String(userId)) ?? null

  const stationMultiValue: SelectOption[] = useMemo(() => {
    return stationIds
      .map((id) => stationOptions.find((o) => Number(o.value) === id))
      .filter((x): x is SelectOption => x != null)
  }, [stationIds, stationOptions])

  const needsWorkspaceStation = adminNeedsSettingsStation(role, effectiveStationId)
  const canSave =
    (showBizPicker ? businessId != null && businessId > 0 : authBusinessId != null && authBusinessId > 0) &&
    userId > 0 &&
    (showStationPicker ? stationIds.some((id) => id > 0) : !needsWorkspaceStation)

  const businessUsersColumns: Column<BusinessUser>[] = useMemo(() => {
    const cols: Column<BusinessUser>[] = [
      { key: 'id', header: 'ID' },
      {
        key: 'userId',
        header: 'User',
        render: (r) => userNameById.get(r.userId) ?? r.userId,
      },
    ]
    if (showBusinessColumnInTables(role)) {
      cols.push({
        key: 'businessId',
        header: 'Business',
        render: (r) => businessNameById.get(r.businessId) ?? r.businessId,
      })
    }
    if (showStationColumnInTables(role)) {
      cols.push({
        key: 'stationId',
        header: 'Station',
        render: (r) =>
          r.stationId > 0 ? (stationNameById.get(r.stationId) ?? `#${r.stationId}`) : '—',
      })
    }
    return cols
  }, [role, userNameById, businessNameById, stationNameById])

  return (
    <>
      {deleteDialog}
      <DataTable<BusinessUser>
        title="Assigning Station"
        addLabel="Add link"
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeleteOne={handleDeleteOne}
        onDeleteSelected={handleDeleteSelected}
        columns={businessUsersColumns}
      />
      <Modal
        open={open}
        title={editing ? 'Edit business user' : 'Add business user'}
        onClose={() => setOpen(false)}
        className="max-w-[min(50rem,calc(100vw-1rem))] sm:max-w-[min(50rem,calc(100vw-2rem))]"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {showBizPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessSel}
                onChange={(o) => {
                  setBusinessId(o ? Number(o.value) : null)
                  setStationIds([])
                }}
                placeholder="Select business"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">User</label>
            <FormSelect
              options={userOptions}
              value={userSel}
              onChange={(o) => setUserId(o ? Number(o.value) : 0)}
              placeholder="Select user"
            />
          </div>
          {needsWorkspaceStation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SETTINGS_STATION_HINT}
            </div>
          )}
          {showStationPicker && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Stations</label>
              <FormMultiSelect
                inputId="business-user-stations"
                options={stationOptions}
                value={stationMultiValue}
                onChange={(opts) => setStationIds(opts.map((o) => Number(o.value)))}
                placeholder={
                  effectiveBusinessId == null || effectiveBusinessId <= 0
                    ? 'Select a business first'
                    : 'Select one or more stations for this user'
                }
                isDisabled={effectiveBusinessId == null || effectiveBusinessId <= 0}
              />
              <p className="mt-1 text-xs text-slate-500">
                Required: pick at least one station. Each station creates a separate link for the same user and
                business. Only stations for the selected business are listed.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
