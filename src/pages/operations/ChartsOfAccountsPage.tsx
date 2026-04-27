import { useGetChartsOfAccountsQuery } from '../../app/api/apiSlice'
import { DataTable, type Column } from '../../components/DataTable'

type ChartsRow = {
  id: number
  type: string
}

export function ChartsOfAccountsPage() {
  const { data: rowsData, isFetching } = useGetChartsOfAccountsQuery({ businessId: undefined })

  const rows: ChartsRow[] = rowsData ?? []
  const cols: Column<ChartsRow>[] = [
    { key: 'id', header: 'ID' },
    { key: 'type', header: 'Type' },
  ]

  return (
    <DataTable<ChartsRow>
      title="Charts of Accounts"
      readOnly
      rows={rows}
      totalCount={rows.length}
      page={1}
      pageSize={rows.length || 10}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
      search=""
      onSearchChange={() => {}}
      columns={cols}
      isLoading={isFetching}
      selectedIds={new Set<number>()}
      onSelectedIdsChange={() => {}}
      onEdit={() => {}}
      onDeleteOne={() => {}}
      onDeleteSelected={() => {}}
    />
  )
}

