import { useEffect, useMemo, useState } from 'react'
import {
  useCreateCurrencyMutation,
  useDeleteCurrencyMutation,
  useGetCurrenciesQuery,
  useUpdateCurrencyMutation,
} from '../../app/api/apiSlice'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { useDebouncedValue } from '../../lib/hooks'
import type { Currency } from '../../types/models'

export function CurrenciesPage() {
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)
  const { data: all = [], isFetching } = useGetCurrenciesQuery()
  const [createRow] = useCreateCurrencyMutation()
  const [updateRow] = useUpdateCurrencyMutation()
  const [deleteRow] = useDeleteCurrencyMutation()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Currency | null>(null)
  const [countryName, setCountryName] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => setPage(1), [debounced])

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return all
    return all.filter((r) =>
      [r.countryName, r.code, r.name, r.symbol, String(r.id)].some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [all, debounced])

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function openCreate() {
    setEditing(null)
    setCountryName('')
    setCode('')
    setName('')
    setSymbol('')
    setOpen(true)
  }

  function openEdit(row: Currency) {
    setEditing(row)
    setCountryName(row.countryName)
    setCode(row.code)
    setName(row.name)
    setSymbol(row.symbol)
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const body = { countryName: countryName.trim(), code: code.trim(), name: name.trim(), symbol: symbol.trim() }
    if (editing) await updateRow({ id: editing.id, body }).unwrap()
    else await createRow(body).unwrap()
    setOpen(false)
    setSelected(new Set())
  }

  function handleDeleteOne(id: number) {
    requestDelete({
      title: 'Delete currency?',
      description: 'Fuel prices that use this currency may be affected.',
      action: async () => {
        await deleteRow(id).unwrap()
      },
    })
  }

  function handleDeleteSelected() {
    const ids = [...selected]
    requestDelete({
      title: 'Delete selected currencies?',
      description: `Remove ${ids.length} currency row(s)?`,
      action: async () => {
        for (const id of ids) await deleteRow(id).unwrap()
        setSelected(new Set())
      },
    })
  }

  return (
    <>
      {deleteDialog}
      <DataTable<Currency>
        title="Currencies"
        addLabel="Add currency"
        rows={rows}
        totalCount={filtered.length}
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
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'countryName', header: 'Country' },
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name' },
          { key: 'symbol', header: 'Symbol' },
        ]}
      />
      <Modal open={open} title={editing ? 'Edit currency' : 'Add currency'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          <input required value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="Country name" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. SSP)" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Currency name" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          <input required value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
