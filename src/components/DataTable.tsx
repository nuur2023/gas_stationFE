import { ChevronLeft, ChevronRight, Search, Trash2, Pencil } from 'lucide-react'
import { cn } from '../lib/cn'

const PAGE_SIZES = [10, 20, 30, 50, 100] as const

export type ColumnAlign = 'left' | 'center' | 'right'

function columnAlignClasses(align: ColumnAlign | undefined): { th: string; td: string } {
  switch (align) {
    case 'center':
      return { th: 'text-center', td: 'text-center' }
    case 'right':
      return { th: 'text-right', td: 'text-right' }
    default:
      return { th: 'text-left', td: 'text-left' }
  }
}

export interface Column<T> {
  key: keyof T | string
  header: string
  /** Header and cell alignment; default left. */
  align?: ColumnAlign
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T extends { id: number }> {
  title: string
  addLabel?: string
  /** When true, hides row selection, actions column, and add/delete toolbar. */
  readOnly?: boolean
  /** Hide row checkbox column (without forcing read-only toolbar behavior). */
  showRowSelection?: boolean
  /** Hide row actions column (without forcing read-only toolbar behavior). */
  showRowActions?: boolean
  /** When false, hides the search field (toolbar title and other controls remain). */
  hideSearch?: boolean
  /** Tooltip for the row edit (pencil) button; default "Edit". */
  editRowTitle?: string
  rows: T[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  search: string
  onSearchChange: (q: string) => void
  columns: Column<T>[]
  isLoading: boolean
  selectedIds: Set<number>
  onSelectedIdsChange: (ids: Set<number>) => void
  /** When omitted, the primary Add button is hidden. */
  onAdd?: () => void
  /** When omitted, the row edit (pencil) button is hidden. */
  onEdit?: (row: T) => void
  onDeleteOne: (id: number) => void
  onDeleteSelected: () => void
  /** Renders before Edit/Delete in the actions cell (e.g. View, Print). */
  renderExtraRowActions?: (row: T) => React.ReactNode
  extraToolbar?: React.ReactNode
  /** Rendered after the table, before the pagination bar (e.g. totals). */
  belowTable?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T extends { id: number }>({
  title,
  addLabel = 'Add',
  readOnly = false,
  showRowSelection,
  showRowActions,
  hideSearch = false,
  editRowTitle = 'Edit',
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  columns,
  isLoading,
  selectedIds,
  onSelectedIdsChange,
  onAdd,
  onEdit: onEditRow,
  onDeleteOne,
  onDeleteSelected,
  renderExtraRowActions,
  extraToolbar,
  belowTable,
  rowClassName,
}: DataTableProps<T>) {
  const rowSelectionEnabled = showRowSelection ?? !readOnly
  const rowActionsEnabled = showRowActions ?? !readOnly
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const extraCols = (rowSelectionEnabled ? 1 : 0) + (rowActionsEnabled ? 1 : 0)
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someSelected = rows.some((r) => selectedIds.has(r.id))

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      const next = new Set(selectedIds)
      rows.forEach((r) => next.delete(r.id))
      onSelectedIdsChange(next)
    } else {
      const next = new Set(selectedIds)
      rows.forEach((r) => next.add(r.id))
      onSelectedIdsChange(next)
    }
  }

  function toggleRow(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange(next)
  }

  function cellValue(row: T, key: keyof T | string) {
    if (typeof key === 'string' && key.includes('.')) {
      const parts = key.split('.')
      let v: unknown = row as unknown
      for (const p of parts) {
        v = (v as Record<string, unknown>)?.[p]
      }
      return v as React.ReactNode
    }
    return row[key as keyof T] as React.ReactNode
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 md:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <h1 className="shrink-0 text-xl font-semibold text-slate-800">{title}</h1>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:flex-1 lg:flex-nowrap lg:items-center lg:justify-end lg:gap-3">
          {!hideSearch && (
            <div className="relative w-full min-w-0 sm:min-w-[12rem] sm:max-w-xs lg:w-56 lg:max-w-none xl:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none ring-emerald-500/30 focus:ring-2"
              />
            </div>
          )}
          {extraToolbar}
          {!readOnly && rowSelectionEnabled && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </button>
          )}
          {!readOnly && onAdd != null && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 sm:w-auto"
            >
              {addLabel}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-max min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {rowSelectionEnabled && (
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && someSelected
                    }}
                    onChange={toggleAllOnPage}
                    className="rounded border-slate-300"
                  />
                </th>
              )}
              {columns.map((c) => {
                const a = columnAlignClasses(c.align)
                return (
                  <th
                    key={String(c.key)}
                    className={cn('whitespace-nowrap px-3 py-3 font-semibold text-slate-600', a.th)}
                  >
                    {c.header}
                  </th>
                )
              })}
              {rowActionsEnabled && (
                <th className="min-w-[10rem] whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-600">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td
                  colSpan={columns.length + extraCols}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + extraCols}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No rows found.
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => (
                <tr key={row.id} className={cn('hover:bg-slate-50/80', rowClassName?.(row))}>
                  {rowSelectionEnabled && (
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                  )}
                  {columns.map((c) => {
                    const a = columnAlignClasses(c.align)
                    return (
                      <td key={String(c.key)} className={cn('whitespace-nowrap px-3 py-2 text-slate-700', a.td)}>
                        {c.render ? c.render(row) : String(cellValue(row, c.key) ?? '')}
                      </td>
                    )
                  })}
                  {rowActionsEnabled && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {renderExtraRowActions?.(row)}
                      {onEditRow != null && (
                        <button
                          type="button"
                          onClick={() => onEditRow(row)}
                          className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          title={editRowTitle}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteOne(row.id)}
                        className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {belowTable}

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Total <span className="font-semibold">{totalCount}</span> · Page{' '}
          <span className="font-semibold">{page}</span> of{' '}
          <span className="font-semibold">{totalPages}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1)
              }}
              className="rounded-lg border border-slate-200 px-2 py-1"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className={cn(
                'rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className={cn(
                'rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40',
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
