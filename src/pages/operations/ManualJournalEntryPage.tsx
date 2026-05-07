import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useCreateJournalEntryMutation,
  useDeleteJournalEntryMutation,
  useGetAccountsQuery,
  useGetBusinessesQuery,
  useGetCustomerFuelGivensQuery,
  useGetJournalEntriesQuery,
  useGetStationsQuery,
  useGetSuppliersQuery,
  usePatchJournalEntryDescriptionMutation,
} from '../../app/api/apiSlice'
import { useAppSelector } from '../../app/hooks'
import { DataTable, type Column } from '../../components/DataTable'
import { DateField } from '../../components/DateField'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/ToastProvider'
import { FundTransferModal, type FundTransferSubmitPayload } from '../../components/FundTransferModal'
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm'
import { usePagePermissionActions } from '../../hooks/usePagePermissionActions'
import { useDebouncedValue } from '../../lib/hooks'
import { formatDecimal } from '../../lib/formatNumber'
import { isAccountsPayable, isAccountsReceivable } from '../../lib/accountingSubledger'
import { filterAccountsForViewer, filterJournalPostingAccountPicker } from '../../lib/accountScope'
import {
  adminNeedsSettingsStation,
  showBusinessPickerInForms,
  showStationColumnInTables,
  showStationPickerInForms,
  useEffectiveStationId,
} from '../../lib/stationContext'
import type { JournalEntry, JournalEntryWriteRequest } from '../../types/models'

export function ManualJournalEntryPage() {
  const { canView: routeCanView, canCreate: routeCanCreate, canUpdate: routeCanUpdate } = usePagePermissionActions()
  const { showSuccess, showError } = useToast()
  type DraftLine = {
    accountId: number | null
    debit: string
    credit: string
    remark: string
    customerId: number | null
    supplierId: number | null
  }
  const emptyLine = (): DraftLine => ({
    accountId: null,
    debit: '0',
    credit: '0',
    remark: '',
    customerId: null,
    supplierId: null,
  })
  const navigate = useNavigate()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const effectiveStationId = useEffectiveStationId()
  const showBizPicker = showBusinessPickerInForms(role)
  const showStationPicker = showStationPickerInForms(role)
  const [formBusinessId, setFormBusinessId] = useState<number | null>(authBusinessId ?? null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 350)

  const { data, isFetching } = useGetJournalEntriesQuery({
    page,
    pageSize,
    q: debounced || undefined,
    ...(effectiveStationId != null && effectiveStationId > 0 ? { filterStationId: effectiveStationId } : {}),
  })
  const accountsQuerySkipped = !showBizPicker && (authBusinessId == null || authBusinessId <= 0)
  const { data: accounts } = useGetAccountsQuery(
    {
      page: 1,
      pageSize: 500,
      businessId: showBizPicker ? (formBusinessId ?? undefined) : (authBusinessId ?? undefined),
    },
    { skip: accountsQuerySkipped },
  )
  const { data: stations } = useGetStationsQuery({
    page: 1,
    pageSize: 500,
    businessId: showBizPicker ? (formBusinessId ?? undefined) : (authBusinessId ?? undefined),
  })
  const resolvedBusinessId = showBizPicker ? formBusinessId : authBusinessId
  const skipSubledgerLists = resolvedBusinessId == null || resolvedBusinessId <= 0
  const { data: customerFuelPaged } = useGetCustomerFuelGivensQuery(
    { page: 1, pageSize: 500 },
    { skip: skipSubledgerLists },
  )
  const { data: suppliersPaged } = useGetSuppliersQuery(
    { page: 1, pageSize: 500, businessId: resolvedBusinessId ?? undefined },
    { skip: skipSubledgerLists },
  )
  const { data: businesses } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined })
  const [createJournal, { isLoading: journalSaving }] = useCreateJournalEntryMutation()
  const [deleteJournal] = useDeleteJournalEntryMutation()
  const [patchJournalDescription, { isLoading: descSaving }] = usePatchJournalEntryDescriptionMutation()
  const { requestDelete, dialog: deleteDialog } = useDeleteConfirm()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [stationId, setStationId] = useState<number | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([
    emptyLine(),
    emptyLine(),
  ])
  const [selectedLineIdx, setSelectedLineIdx] = useState(0)
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [entryKind, setEntryKind] = useState(0)
  const [transferOpen, setTransferOpen] = useState(false)
  const [descEditOpen, setDescEditOpen] = useState(false)
  const [descEditEntry, setDescEditEntry] = useState<JournalEntry | null>(null)
  const [descEditText, setDescEditText] = useState('')
  const [descEditDate, setDescEditDate] = useState(() => new Date().toISOString().slice(0, 10))

  const entryKindOptions: SelectOption[] = useMemo(
    () => [
      { value: '0', label: 'Normal' },
      { value: '1', label: 'Adjusting' },
      { value: '2', label: 'Closing' },
    ],
    [],
  )

  const businessOptions: SelectOption[] = useMemo(() => {
    const items = businesses?.items ?? []
    if (showBizPicker) return items.map((x) => ({ value: String(x.id), label: x.name }))
    if (authBusinessId != null) {
      const b = items.find((x) => x.id === authBusinessId)
      return b ? [{ value: String(b.id), label: b.name }] : []
    }
    return []
  }, [businesses?.items, showBizPicker, authBusinessId])
  const stationOptions: SelectOption[] = useMemo(
    () => (stations?.items ?? []).map((x) => ({ value: String(x.id), label: x.name })),
    [stations?.items],
  )
  const stationNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of stations?.items ?? []) m.set(s.id, s.name)
    return m
  }, [stations?.items])
  const viewerAccounts = useMemo(
    () => filterAccountsForViewer(accounts?.items, role, authBusinessId),
    [accounts?.items, role, authBusinessId],
  )
  const journalSelectableAccounts = useMemo(
    () => filterJournalPostingAccountPicker(viewerAccounts, resolvedBusinessId),
    [viewerAccounts, resolvedBusinessId],
  )
  const accountById = useMemo(() => {
    const m = new Map<number, (typeof journalSelectableAccounts)[number]>()
    for (const a of journalSelectableAccounts) m.set(a.id, a)
    return m
  }, [journalSelectableAccounts])
  const accountOptions: SelectOption[] = useMemo(
    () => journalSelectableAccounts.map((x) => ({ value: String(x.id), label: `${x.code} - ${x.name}` })),
    [journalSelectableAccounts],
  )
  const customerOptions: SelectOption[] = useMemo(() => {
    const bid = resolvedBusinessId ?? 0
    return (customerFuelPaged?.items ?? [])
      .filter((c) => c.businessId === bid)
      .map((c) => ({
        value: String(c.id),
        label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}`,
      }))
  }, [customerFuelPaged?.items, resolvedBusinessId])
  const supplierOptions: SelectOption[] = useMemo(
    () => (suppliersPaged?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [suppliersPaged?.items],
  )

  const cols: Column<JournalEntry>[] = useMemo(() => {
    const c: Column<JournalEntry>[] = [
      { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleString() },
      { key: 'description', header: 'Description' },
    ]
    if (showStationColumnInTables(role)) {
      c.push({
        key: 'stationId',
        header: 'Station',
        render: (r) => (r.stationId ? (stationNameById.get(r.stationId) ?? `#${r.stationId}`) : '—'),
      })
    }
    c.push(
      { key: 'lines', header: 'Lines', render: (r) => String(r.lines?.length ?? 0) },
      {
        key: 'amount',
        header: 'Amount',
        render: (r) => {
          const totalDebit = (r.lines ?? []).reduce((sum, x) => sum + (x.debit ?? 0), 0)
          return `$${formatDecimal(totalDebit)}`
        },
      },
    )
    return c
  }, [role, stationNameById])

  const totals = useMemo(() => {
    const parse = (v: string) => Number.parseFloat((v || '').replace(',', '.'))
    return lines.reduce(
      (acc, l) => {
        const d = parse(l.debit)
        const c = parse(l.credit)
        acc.debit += Number.isFinite(d) ? d : 0
        acc.credit += Number.isFinite(c) ? c : 0
        return acc
      },
      { debit: 0, credit: 0 },
    )
  }, [lines])

  useEffect(() => {
    if (!open || showStationPicker) return
    setStationId(effectiveStationId != null && effectiveStationId > 0 ? effectiveStationId : null)
  }, [open, showStationPicker, effectiveStationId])

  const formError = useMemo(() => {
    const parse = (v: string) => Number.parseFloat((v || '').replace(',', '.'))
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      if (!l.accountId) return 'Each line must have an account selected.'
      const d = parse(l.debit)
      const c = parse(l.credit)
      const debit = Number.isFinite(d) ? d : 0
      const credit = Number.isFinite(c) ? c : 0
      if (debit < 0 || credit < 0) return 'Debit and credit amounts cannot be negative.'
      if (debit === 0 && credit === 0) return 'Each line must have a debit or a credit amount.'
    }
    if (Math.abs(totals.debit - totals.credit) >= 0.0001) {
      return 'Total debit must equal total credit.'
    }
    for (const l of lines) {
      const acc = l.accountId ? accountById.get(l.accountId) : undefined
      const ar = isAccountsReceivable(acc)
      const ap = isAccountsPayable(acc)
      if (l.customerId != null && l.customerId > 0 && l.supplierId != null && l.supplierId > 0) {
        return 'A line cannot have both a customer and a supplier.'
      }
      if (ar) {
        if (l.customerId == null || l.customerId <= 0) {
          return 'Accounts Receivable lines require a customer.'
        }
        if (l.supplierId != null && l.supplierId > 0) {
          return 'Supplier is not allowed on Accounts Receivable lines.'
        }
      } else if (ap) {
        if (l.supplierId == null || l.supplierId <= 0) {
          return 'Accounts Payable lines require a supplier.'
        }
        if (l.customerId != null && l.customerId > 0) {
          return 'Customer is not allowed on Accounts Payable lines.'
        }
      }
    }
    return null
  }, [lines, totals.debit, totals.credit, accountById])

  const linesValid = formError == null

  useEffect(() => {
    if (lines.length === 0) return
    if (selectedLineIdx >= lines.length) setSelectedLineIdx(lines.length - 1)
  }, [lines.length, selectedLineIdx])

  async function save() {
    if (!linesValid || !description.trim()) return
    const resolvedStationId = showStationPicker
      ? stationId ?? null
      : effectiveStationId != null && effectiveStationId > 0
        ? effectiveStationId
        : null
    const body: JournalEntryWriteRequest = {
      date: `${journalDate}T12:00:00.000Z`,
      description: description.trim(),
      businessId: showBizPicker ? (formBusinessId ?? undefined) : undefined,
      stationId: resolvedStationId,
      ...(entryKind > 0 ? { entryKind } : {}),
      lines: lines.map((l) => ({
        accountId: l.accountId!,
        debit: String(Number.parseFloat(l.debit.replace(',', '.')) || 0),
        credit: String(Number.parseFloat(l.credit.replace(',', '.')) || 0),
        remark: l.remark.trim() || undefined,
        ...(l.customerId != null && l.customerId > 0 ? { customerId: l.customerId } : {}),
        ...(l.supplierId != null && l.supplierId > 0 ? { supplierId: l.supplierId } : {}),
      })),
    }
    await createJournal(body).unwrap()
    setOpen(false)
    setDescription('')
    setStationId(null)
    setJournalDate(new Date().toISOString().slice(0, 10))
    setEntryKind(0)
    setLines([emptyLine(), emptyLine()])
    setSelectedLineIdx(0)
  }

  function openDescriptionEdit(row: JournalEntry) {
    setDescEditEntry(row)
    setDescEditText(row.description ?? '')
    setDescEditDate((row.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    setDescEditOpen(true)
  }

  async function saveDescriptionEdit() {
    if (descEditEntry == null) return
    try {
      await patchJournalDescription({
        id: descEditEntry.id,
        body: {
          description: descEditText,
          date: `${descEditDate}T12:00:00.000Z`,
        },
      }).unwrap()
      showSuccess('Journal header updated.')
      setDescEditOpen(false)
      setDescEditEntry(null)
    } catch (e) {
      const msg =
        typeof e === 'object' && e != null && 'data' in e && typeof (e as { data?: unknown }).data === 'string'
          ? (e as { data: string }).data
          : 'Could not update journal header.'
      showError(msg)
    }
  }

  async function submitFundTransfer(p: FundTransferSubmitPayload) {
    const desc =
      p.note.trim().length > 0 ? `Fund transfer — ${p.note.trim()}` : 'Fund transfer'
    const body: JournalEntryWriteRequest = {
      date: `${p.date}T12:00:00.000Z`,
      description: desc,
      businessId: showBizPicker ? (formBusinessId ?? undefined) : undefined,
      stationId: p.stationId,
      lines: [
        { accountId: p.fromAccountId, debit: '0', credit: p.amount },
        { accountId: p.toAccountId, debit: p.amount, credit: '0' },
      ],
    }
    await createJournal(body).unwrap()
  }

  return (
    <>
      <DataTable<JournalEntry>
        title="Manual Journal Entry"
        addLabel="Post Journal"
        rows={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={(q) => {
          setSearch(q)
          setPage(1)
        }}
        columns={cols}
        isLoading={isFetching}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        onAdd={() => {
          setJournalDate(new Date().toISOString().slice(0, 10))
          setEntryKind(0)
          setOpen(true)
        }}
        renderExtraRowActions={(row) => (
          <>
            {routeCanUpdate ? (
              <button
                type="button"
                title="Edit journal header"
                onClick={() => openDescriptionEdit(row)}
                className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              title={!routeCanView ? 'No view permission' : 'View journal details'}
              disabled={!routeCanView}
              onClick={() => navigate(`/accounting/manual-journal-entry/${row.id}`)}
              className="mr-1 inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eye className="h-4 w-4" />
            </button>
          </>
        )}
        onDeleteOne={(id) =>
          requestDelete({
            title: 'Delete journal entry?',
            description: 'This journal entry will be removed from active records.',
            action: async () => {
              await deleteJournal(id).unwrap()
              setSelected((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            },
          })
        }
        onDeleteSelected={() =>
          requestDelete({
            title: 'Delete selected journal entries?',
            description: `Delete ${selected.size} selected row(s).`,
            action: async () => {
              await Promise.all(Array.from(selected).map((id) => deleteJournal(id).unwrap()))
              setSelected(new Set())
            },
          })
        }
        extraToolbar={
          routeCanCreate ? (
            <button
              type="button"
              disabled={adminNeedsSettingsStation(role, effectiveStationId)}
              title={
                adminNeedsSettingsStation(role, effectiveStationId)
                  ? 'Choose a working station under Settings first.'
                  : undefined
              }
              onClick={() => setTransferOpen(true)}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Fund transfer
            </button>
          ) : undefined
        }
      />

      <Modal
        open={descEditOpen}
        onClose={() => {
          setDescEditOpen(false)
          setDescEditEntry(null)
        }}
        title="Edit journal header"
        className="max-w-lg"
      >
        <p className="mb-2 text-sm text-slate-600">
          Update the journal date and description. Lines and amounts are not modified.
        </p>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
          <DateField value={descEditDate} onChange={setDescEditDate} />
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          className="mb-4 min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2"
          value={descEditText}
          onChange={(e) => setDescEditText(e.target.value)}
          maxLength={4000}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            onClick={() => {
              setDescEditOpen(false)
              setDescEditEntry(null)
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={descSaving || descEditEntry == null}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => void saveDescriptionEdit()}
          >
            {descSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>

      <FundTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        submitting={journalSaving}
        accountOptions={accountOptions}
        accountById={accountById}
        showStationPicker={showStationPicker}
        stationOptions={stationOptions}
        effectiveStationId={effectiveStationId}
        onSubmit={submitFundTransfer}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Post manual journal"
        className="w-[min(100%,calc(100vw-0.5rem))] max-w-5xl"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {showBizPicker && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Business</label>
              <FormSelect
                options={businessOptions}
                value={businessOptions.find((x) => x.value === String(formBusinessId ?? '')) ?? null}
                onChange={(opt) => setFormBusinessId(opt ? Number(opt.value) : null)}
                placeholder="Select business"
              />
            </div>
          )}
          <div className="md:col-span-2">
            <DateField value={journalDate} onChange={setJournalDate} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <div className={`grid gap-3 ${showStationPicker ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              <div className="min-w-0">
                <label className="mb-1 block text-sm font-medium text-slate-700">Entry type</label>
                <div className="w-full min-w-0">
                  <FormSelect
                    options={entryKindOptions}
                    value={entryKindOptions.find((o) => o.value === String(entryKind)) ?? entryKindOptions[0]}
                    onChange={(o) => setEntryKind(o ? Number(o.value) : 0)}
                  />
                </div>
              </div>
              {showStationPicker ? (
                <div className="min-w-0">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Station (optional)</label>
                  <div className="w-full min-w-0">
                    <FormSelect
                      options={stationOptions}
                      value={stationOptions.find((x) => x.value === String(stationId ?? '')) ?? null}
                      onChange={(opt) => setStationId(opt ? Number(opt.value) : null)}
                      isClearable
                      placeholder="No station"
                    />
                  </div>
                </div>
              ) : null}
            </div>
            {/* <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
              <p className="mb-1.5 font-semibold text-slate-800">Entry types</p>
              <ul className="mb-2 list-disc space-y-1 pl-4 marker:text-slate-400">
                <li>
                  <span className="font-medium text-slate-900">Normal</span> — default for operations and for{' '}
                  <strong>manual period close</strong> (recommended).
                </li>
                <li>
                  <span className="font-medium text-slate-900">Adjusting</span> — accruals / deferrals / corrections at
                  period-end.
                </li>
                <li>
                  <span className="font-medium text-slate-900">Closing</span> — optional; excluded from some trial-balance
                  views. Prefer <strong>Normal</strong> when you post your own close-to-equity journal.
                </li>
              </ul>
              <p className="mb-1 font-semibold text-slate-800">Manual close example (net income 290)</p>
              <p className="mb-1 text-slate-600">
                Use entry type <strong>Normal</strong>. One journal, debits = credits:
              </p>
              <ul className="list-disc space-y-0.5 pl-4 font-mono text-[11px] text-slate-700 marker:text-slate-400">
                <li>Dr Fuel Sales (Income) 750</li>
                <li>Cr COGS 360 · Cr Rent expense 100 · Cr Retained earnings (Equity) 290</li>
              </ul>
              <p className="mt-1.5 text-slate-600">Replace accounts and amounts with your trial balance. Retained earnings must be an Equity chart account.</p>
            </div> */}
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Journal lines</label>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add line
              </button>
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[52rem] table-fixed divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="min-w-[16rem] px-3 py-2 text-left font-semibold text-slate-600">Account</th>
                      <th className="min-w-[7.5rem] w-[7.5rem] px-3 py-2 text-left font-semibold text-slate-600">Debit</th>
                      <th className="min-w-[7.5rem] w-[7.5rem] px-3 py-2 text-left font-semibold text-slate-600">Credit</th>
                      <th className="min-w-[13rem] px-3 py-2 text-left font-semibold text-slate-600">Remark</th>
                      <th className="w-12 min-w-[3rem] shrink-0 px-2 py-2 text-right font-semibold text-slate-600" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => {
                      return (
                      <tr
                        key={idx}
                        className={`align-top ${idx === selectedLineIdx ? 'bg-emerald-50/30' : ''}`}
                        onClick={() => setSelectedLineIdx(idx)}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="min-w-[16rem]">
                            <FormSelect
                              options={accountOptions}
                              value={accountOptions.find((x) => x.value === String(line.accountId ?? '')) ?? null}
                              onChange={(opt) =>
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          accountId: opt ? Number(opt.value) : null,
                                          customerId: null,
                                          supplierId: null,
                                        }
                                      : l,
                                  ),
                                )
                              }
                              placeholder="Select account"
                            />
                          </div>
                        </td>
                        <td className="min-w-[7.5rem] px-3 py-2 align-top">
                          <input
                            className="w-full min-w-[7rem] rounded-lg border border-slate-200 px-2 py-2 tabular-nums"
                            placeholder="0"
                            value={line.debit}
                            onChange={(e) =>
                              setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, debit: e.target.value } : l)))
                            }
                          />
                        </td>
                        <td className="min-w-[7.5rem] px-3 py-2 align-top">
                          <input
                            className="w-full min-w-[7rem] rounded-lg border border-slate-200 px-2 py-2 tabular-nums"
                            placeholder="0"
                            value={line.credit}
                            onChange={(e) =>
                              setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, credit: e.target.value } : l)))
                            }
                          />
                        </td>
                        <td className="min-w-[13rem] px-3 py-2 align-top">
                          <input
                            className="w-full min-w-[12rem] rounded-lg border border-slate-200 px-2 py-2"
                            placeholder="Remark (optional)"
                            value={line.remark}
                            onChange={(e) =>
                              setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, remark: e.target.value } : l)))
                            }
                          />
                        </td>
                        <td className="w-12 min-w-[3rem] shrink-0 px-2 py-2 text-right align-top">
                          <button
                            type="button"
                            disabled={lines.length <= 1}
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                            className="inline-flex rounded p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                            title="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {lines[selectedLineIdx] && (() => {
                const line = lines[selectedLineIdx]
                return (
                  <div className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Customer (selected line)</label>
                      <FormSelect
                        options={customerOptions}
                        value={customerOptions.find((x) => x.value === String(line.customerId ?? '')) ?? null}
                        onChange={(opt) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === selectedLineIdx
                                ? { ...l, customerId: opt ? Number(opt.value) : null, supplierId: null }
                                : l,
                            ),
                          )
                        }
                        isClearable
                        placeholder="None"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Supplier (selected line)</label>
                      <FormSelect
                        options={supplierOptions}
                        value={supplierOptions.find((x) => x.value === String(line.supplierId ?? '')) ?? null}
                        onChange={(opt) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === selectedLineIdx
                                ? { ...l, supplierId: opt ? Number(opt.value) : null, customerId: null }
                                : l,
                            ),
                          )
                        }
                        isClearable
                        placeholder="None"
                      />
                    </div>
                  </div>
                )
              })()}
              <div className="flex justify-end gap-6 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-700">
                <span>Total debit: {formatDecimal(totals.debit)}</span>
                <span>Total credit: {formatDecimal(totals.credit)}</span>
              </div>
              {formError && <p className="text-xs text-rose-700">{formError}</p>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!linesValid || !description.trim() || !routeCanCreate}
            title={!routeCanCreate ? 'No create permission' : undefined}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </Modal>
      {deleteDialog}
    </>
  )
}
