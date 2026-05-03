import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  useGetAccountsQuery,
  useGetBusinessesQuery,
  useGetCustomerFuelGivensQuery,
  useGetRecurringJournalEntriesQuery,
  useGetStationsQuery,
  useGetSuppliersQuery,
} from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
import {
  RecurringJournalConfirmModal,
  type RecurringJournalPendingRow,
} from '../components/RecurringJournalConfirmModal'
import { useNavAccess } from '../hooks/useNavAccess'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/hooks'
import { filterAccountsForViewer, filterBusinessLeafAccounts } from '../lib/accountScope'
import { adminNeedsSettingsStation, showStationColumnInTables, useEffectiveStationId } from '../lib/stationContext'
import type { Account } from '../types/models'
import { Navbar } from './Navbar'
import { ProfileDrawer } from './ProfileDrawer'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const location = useLocation()
  const isMd = useMediaQuery('(min-width: 768px)')
  const { name, email, role, businessId, stationId, selectedStationId } = useAppSelector((s) => s.auth)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const activeStationId = selectedStationId ?? stationId
  const effectiveStationId = useEffectiveStationId()
  const { linkAllowed, navSettled, getRouteActionFlags } = useNavAccess()
  const canSeeRecurring = linkAllowed('/accounting/recurring-journals')
  const onRecurringJournalsPage = location.pathname === '/accounting/recurring-journals'
  const skipRecurringPoll =
    !businessId ||
    businessId <= 0 ||
    !canSeeRecurring ||
    adminNeedsSettingsStation(role, effectiveStationId)

  const { data: recurringRows = [] } = useGetRecurringJournalEntriesQuery(
    {
      businessId: businessId ?? 0,
      ...(effectiveStationId != null && effectiveStationId > 0 ? { filterStationId: effectiveStationId } : {}),
    },
    { skip: skipRecurringPoll, pollingInterval: 180_000 },
  )

  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 300, q: undefined, businessId: businessId ?? undefined },
    { skip: !businessId },
  )

  const hasPendingRecurring = useMemo(() => {
    const list = recurringRows as { pendingConfirmationRunDate?: string | null }[]
    return list.some((r) => r.pendingConfirmationRunDate)
  }, [recurringRows])

  const { data: accountsPaged } = useGetAccountsQuery(
    { page: 1, pageSize: 500, businessId: businessId ?? 0 },
    { skip: !businessId || !hasPendingRecurring },
  )
  const { data: suppliersPaged } = useGetSuppliersQuery(
    { page: 1, pageSize: 500, businessId: businessId ?? 0 },
    { skip: !businessId || !hasPendingRecurring },
  )
  const { data: customerFuelPaged } = useGetCustomerFuelGivensQuery(
    { page: 1, pageSize: 500 },
    { skip: !businessId || !hasPendingRecurring },
  )

  const accountById = useMemo(() => {
    const raw = accountsPaged?.items ?? []
    const scoped = filterAccountsForViewer(raw, role, businessId)
    const leaf = filterBusinessLeafAccounts(scoped)
    const m = new Map<number, Account>()
    for (const a of leaf) m.set(a.id, a)
    return m
  }, [accountsPaged?.items, role, businessId])

  const supplierNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of suppliersPaged?.items ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersPaged?.items])

  const customerNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of customerFuelPaged?.items ?? []) {
      if (businessId != null && c.businessId === businessId) m.set(c.id, c.name)
    }
    return m
  }, [customerFuelPaged?.items, businessId])

  type RjListRow = {
    id: number
    name: string
    amount: number
    stationId?: number | null
    debitAccountId: number
    creditAccountId: number
    frequency: number
    startDate: string
    endDate?: string | null
    nextRunDate?: string | null
    supplierId?: number | null
    customerFuelGivenId?: number | null
    pendingConfirmationRunDate?: string | null
  }

  const pendingRows: RecurringJournalPendingRow[] = useMemo(() => {
    const list = recurringRows as RjListRow[]
    const stationById = new Map<number, string>()
    for (const s of stationsData?.items ?? []) stationById.set(s.id, s.name)

    return list
      .filter((r) => r.pendingConfirmationRunDate)
      .map((r) => {
        const da = accountById.get(r.debitAccountId)
        const ca = accountById.get(r.creditAccountId)
        return {
          id: r.id,
          name: r.name,
          amount: r.amount,
          pendingConfirmationRunDate: r.pendingConfirmationRunDate ?? null,
          stationId: r.stationId,
          stationName: r.stationId ? (stationById.get(r.stationId) ?? null) : null,
          debitAccountId: r.debitAccountId,
          creditAccountId: r.creditAccountId,
          debitLabel: da ? `${da.code} ${da.name}` : null,
          creditLabel: ca ? `${ca.code} ${ca.name}` : null,
          frequency: r.frequency,
          startDate: r.startDate,
          endDate: r.endDate ?? null,
          nextRunDate: r.nextRunDate ?? null,
          supplierLabel:
            r.supplierId && r.supplierId > 0 ? (supplierNameById.get(r.supplierId) ?? null) : null,
          customerLabel:
            r.customerFuelGivenId && r.customerFuelGivenId > 0
              ? (customerNameById.get(r.customerFuelGivenId) ?? null)
              : null,
        }
      })
  }, [recurringRows, accountById, stationsData?.items, supplierNameById, customerNameById])

  const pendingSnapshot = useMemo(
    () =>
      pendingRows
        .map((r) => r.id)
        .sort((a, b) => a - b)
        .join(','),
    [pendingRows],
  )

  const [dismissedPendingSnapshot, setDismissedPendingSnapshot] = useState('')
  const [recurringConfirmOpen, setRecurringConfirmOpen] = useState(false)

  useEffect(() => {
    if (onRecurringJournalsPage) {
      setRecurringConfirmOpen(false)
      return
    }
    if (pendingRows.length === 0) {
      setRecurringConfirmOpen(false)
      setDismissedPendingSnapshot('')
      return
    }
    if (pendingSnapshot && pendingSnapshot !== dismissedPendingSnapshot) {
      setRecurringConfirmOpen(true)
    }
  }, [
    onRecurringJournalsPage,
    pendingRows.length,
    pendingSnapshot,
    dismissedPendingSnapshot,
  ])

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 300, q: undefined }, { skip: !businessId })

  const businessName = businessesData?.items.find((b) => b.id === businessId)?.name ?? 'Gas Station'
  const stationName =
    stationsData?.items.find((s) => s.id === activeStationId)?.name ?? (activeStationId ? `Station #${activeStationId}` : 'Menu')

  const pageFlags = useMemo(
    () => getRouteActionFlags(location.pathname, location.search),
    [getRouteActionFlags, location.pathname, location.search],
  )
  const mainContentBlocked = navSettled && !pageFlags.canView

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (isMd) setMobileNavOpen(false)
  }, [isMd])

  return (
    <div className="flex h-screen min-h-0 bg-slate-50">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-slate-900/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          'flex h-full shrink-0 transition-transform duration-200 ease-out',
          'fixed left-0 top-0 z-[100] md:relative md:z-auto',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Sidebar
          collapsed={isMd ? collapsed : false}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          isMobile={!isMd}
          onMobileClose={() => setMobileNavOpen(false)}
          userName={name}
          userEmail={email}
          role={role}
          stationName={stationName}
          recurringPendingCount={pendingRows.length}
        />
      </div>
      <div className="relative z-0 flex min-w-0 flex-1 flex-col">
        <Navbar
          businessName={businessName}
          mobileNavOpen={mobileNavOpen}
          onMenuClick={() => setMobileNavOpen((open) => !open)}
          onProfileClick={() => setProfileOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        {mainContentBlocked ? (
          <div
            className="pointer-events-auto absolute inset-0 z-20 flex items-start justify-center bg-slate-50/50 px-4 pb-24 pt-16 backdrop-blur-sm"
            role="presentation"
          >
            <p className="max-w-md rounded-xl border border-slate-200 bg-white/95 px-5 py-4 text-center text-sm leading-relaxed text-slate-700 shadow-lg">
              You do not have permission to view this page. Use the menu on the left to open an area you are allowed to access.
            </p>
          </div>
        ) : null}
      </div>
      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={name}
        userEmail={email}
        role={role}
        businessName={businessName}
        stationName={stationName}
      />
      {!skipRecurringPoll && businessId != null && businessId > 0 ? (
        <RecurringJournalConfirmModal
          open={recurringConfirmOpen && pendingRows.length > 0}
          onLater={() => {
            setDismissedPendingSnapshot(pendingSnapshot)
            setRecurringConfirmOpen(false)
          }}
          businessId={businessId}
          showStationColumn={showStationColumnInTables(role)}
          pendingRows={pendingRows}
        />
      ) : null}
    </div>
  )
}
