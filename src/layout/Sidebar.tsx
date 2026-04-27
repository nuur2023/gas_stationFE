import { useCallback, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  BarChart2,
  Beaker,
  Building2,
  ChevronDown,
  ChevronRight,
  Contact,
  CreditCard,
  Cylinder,
  Droplets,
  FileText,
  Fuel,
  LayoutDashboard,
  Link2,
  ListTree,
  MapPin,
  Percent,
  Shield,
  Truck,
  User,
  Users,
  UserSquare2,
  Wallet,
  Zap,
  UserRoundPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavAccess } from '../hooks/useNavAccess'
import { cn } from '../lib/cn'
import {
  FINANCIAL_REPORT_CORE_PATHS,
  FINANCIAL_REPORT_LEGACY_CORE_ROUTES,
} from '../lib/financialReportRoutes'
import { CollapsedFlyoutMenu, navTargetIsActive, type FlyoutItem } from './CollapsedFlyoutMenu'

const OPS_SECTIONS: { title: string; icon: LucideIcon; to: string; linkLabel: string }[] = [
  { title: 'Expenses', icon: Wallet, to: '/expenses', linkLabel: 'Expenses' },
  { title: 'Suppliers', icon: Contact, to: '/suppliers', linkLabel: 'Suppliers' },
  { title: 'Purchases', icon: Cylinder, to: '/purchases', linkLabel: 'Purchases' },
  { title: 'Inventory', icon: Droplets, to: '/inventory', linkLabel: 'Inventory' },
  { title: 'Rates', icon: Percent, to: '/rates', linkLabel: 'Rates' },
  { title: 'Generator usage', icon: Zap, to: '/generator-usage', linkLabel: 'Generator usage' },
  { title: 'DippingPump', icon: Link2, to: '/dipping-pumps', linkLabel: 'DippingPump' },
  { title: 'Dipping', icon: Beaker, to: '/dipping', linkLabel: 'Dipping' },
  { title: 'Liter received', icon: Truck, to: '/liter-received', linkLabel: 'Liter received' },
  { title: 'Fuel given', icon: UserRoundPlus, to: '/customer-fuel-givens', linkLabel: 'Fuel given' },
]

const PUMP_CHILDREN: FlyoutItem[] = [
  { to: '/pumps', label: 'Pump creation', icon: Fuel },
  { to: '/nozzles', label: 'Nozzles', icon: Link2 },
]

const ACCOUNTING_CHILDREN: FlyoutItem[] = [
  { to: '/accounting/accounts', label: 'Accounts', icon: Wallet },
  { to: '/accounting/charts-of-accounts', label: 'Charts of accounts', icon: ListTree },
  { to: '/accounting/manual-journal-entry', label: 'Manual journal entry', icon: FileText },
]

const PAYMENTS_CHILDREN: FlyoutItem[] = [
  { to: '/accounting/customer-payments', label: 'Payments', icon: Wallet },
]

const FINANCIAL_REPORTS_CHILDREN: FlyoutItem[] = [
  { to: '/financial-reports/trial-balance', label: 'Trial balance', icon: FileText },
  { to: '/financial-reports/general-ledger', label: 'General ledger', icon: FileText },
  { to: '/financial-reports/profit-and-loss', label: 'Profit and loss', icon: FileText },
  { to: '/financial-reports/balance-sheet', label: 'Balance sheet', icon: FileText },
  { to: '/financial-reports/customer-balances', label: 'Customer balances', icon: FileText },
  { to: '/financial-reports/supplier-balances', label: 'Supplier balances', icon: FileText },
  { to: '/financial-reports/daily-cash-flow', label: 'Daily cash flow', icon: FileText },
]

const REPORTS_CHILDREN: FlyoutItem[] = [
  { to: '/reports/liter-received', label: 'Liter received', icon: FileText },
  { to: '/reports/daily-cash-sales', label: 'Daily cash sales report', icon: FileText },
  { to: '/reports/cash-out-daily', label: 'Cash out daily', icon: FileText },
  { to: '/reports/daily-fuel-given', label: 'Daily given fuel', icon: FileText },
  { to: '/reports/generator-usage', label: 'Generator usage report', icon: FileText },
  { to: '/reports/general-daily', label: 'General daily report', icon: FileText },
  { to: '/reports/inventory-daily', label: 'Inventory daily', icon: FileText },
  { to: '/reports/outstanding-customers', label: 'Outstanding customers', icon: AlertCircle },
]

const SETUP_CHILDREN: FlyoutItem[] = [
  { to: '/setup/roles', label: 'Roles', icon: Shield },
  { to: '/setup/users', label: 'Users', icon: Users },
  { to: '/setup/business-users', label: 'Assigning Station', icon: UserSquare2 },
  { to: '/setup/businesses', label: 'Businesses', icon: Building2 },
  { to: '/stations', label: 'Stations', icon: MapPin },
  { to: '/setup/menus', label: 'Menus', icon: ListTree },
  { to: '/setup/submenus', label: 'Submenus', icon: Link2 },
  { to: '/setup/permissions', label: 'Permissions', icon: Shield },
  { to: '/setup/fuel-types', label: 'Fuel types', icon: Fuel },
  { to: '/setup/currencies', label: 'Currencies', icon: Wallet },
  { to: '/setup/fuel-prices', label: 'Fuel prices', icon: Droplets },
  { to: '/setup/settings', label: 'Settings', icon: User },
]

function CollapsibleOpsSection({
  title,
  icon: Icon,
  to,
  linkLabel,
  collapsed,
}: {
  title: string
  icon: LucideIcon
  to: string
  linkLabel: string
  collapsed: boolean
}) {
  const [open, setOpen] = useState(true)
  const [hover, setHover] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const leaveT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (leaveT.current) {
      clearTimeout(leaveT.current)
      leaveT.current = null
    }
  }
  const onEnter = () => {
    clear()
    setHover(true)
  }
  const onLeave = () => {
    clear()
    leaveT.current = setTimeout(() => setHover(false), 220)
  }

  const flyoutItems: FlyoutItem[] = [{ to, label: linkLabel, icon: Icon }]

  return (
    <div className="relative overflow-visible" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => !collapsed && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
        title={collapsed ? title : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{title}</span>
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
          </>
        )}
      </button>

      {collapsed && (
        <CollapsedFlyoutMenu
          open={hover}
          title={title}
          items={flyoutItems}
          anchorRef={anchorRef}
          onRequestClose={() => setHover(false)}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        />
      )}

      {!collapsed && open && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2">
          <NavLink
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {linkLabel}
          </NavLink>
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  userName: string | null
  userEmail: string | null
  role: string | null
  stationName: string
}

export function Sidebar({ collapsed, onToggleCollapse, userName, userEmail, role, stationName }: SidebarProps) {
  const location = useLocation()
  const { linkAllowed, canViewDashboard } = useNavAccess()

  const opsSections = useMemo(
    () =>
      OPS_SECTIONS.filter((s) => {
        if (s.to === '/dipping-pumps') return linkAllowed('/dipping-pumps') || linkAllowed('/pumps/dipping-pumps') || linkAllowed('/pumps')
        return linkAllowed(s.to)
      }),
    [linkAllowed],
  )
  const accountingChildren = useMemo(
    () => ACCOUNTING_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const paymentsChildren = useMemo(
    () => PAYMENTS_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const financialReportsChildren = useMemo(() => {
    const hasModernCore = FINANCIAL_REPORT_CORE_PATHS.some((r) => linkAllowed(r))
    const hasLegacyCore = FINANCIAL_REPORT_LEGACY_CORE_ROUTES.some((r) => linkAllowed(r))
    const hasAnyCoreFinancial = hasModernCore || hasLegacyCore
    return FINANCIAL_REPORTS_CHILDREN.filter((c) => {
      if (c.to === '/financial-reports/daily-cash-flow') {
        return linkAllowed(c.to) || hasAnyCoreFinancial
      }
      return linkAllowed(c.to)
    })
  }, [linkAllowed])
  const reportsChildren = useMemo(() => REPORTS_CHILDREN.filter((c) => linkAllowed(c.to)), [linkAllowed])
  const setupChildren = useMemo(
    () => SETUP_CHILDREN.filter((x) => linkAllowed(x.to)),
    [linkAllowed],
  )
  const [setupOpen, setSetupOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [accountingOpen, setAccountingOpen] = useState(true)
  const [paymentsOpen, setPaymentsOpen] = useState(true)
  const [financialReportsOpen, setFinancialReportsOpen] = useState(true)
  const [hoverSetup, setHoverSetup] = useState(false)
  const [hoverReports, setHoverReports] = useState(false)
  const [hoverAccounting, setHoverAccounting] = useState(false)
  const [hoverPayments, setHoverPayments] = useState(false)
  const [hoverFinancialReports, setHoverFinancialReports] = useState(false)
  const [pumpOpen, setPumpOpen] = useState(true)
  const [hoverPump, setHoverPump] = useState(false)
  const setupLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accountingLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paymentsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const financialReportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pumpLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setupAnchorRef = useRef<HTMLButtonElement>(null)
  const reportsAnchorRef = useRef<HTMLButtonElement>(null)
  const accountingAnchorRef = useRef<HTMLButtonElement>(null)
  const paymentsAnchorRef = useRef<HTMLButtonElement>(null)
  const financialReportsAnchorRef = useRef<HTMLButtonElement>(null)
  const pumpAnchorRef = useRef<HTMLButtonElement>(null)

  const clearSetupTimer = () => {
    if (setupLeaveT.current) {
      clearTimeout(setupLeaveT.current)
      setupLeaveT.current = null
    }
  }

  const enterSetup = useCallback(() => {
    clearSetupTimer()
    setHoverSetup(true)
  }, [])
  const leaveSetup = useCallback(() => {
    clearSetupTimer()
    setupLeaveT.current = setTimeout(() => setHoverSetup(false), 220)
  }, [])

  const clearReportsTimer = () => {
    if (reportsLeaveT.current) {
      clearTimeout(reportsLeaveT.current)
      reportsLeaveT.current = null
    }
  }
  const enterReports = useCallback(() => {
    clearReportsTimer()
    setHoverReports(true)
  }, [])
  const leaveReports = useCallback(() => {
    clearReportsTimer()
    reportsLeaveT.current = setTimeout(() => setHoverReports(false), 220)
  }, [])

  const clearAccountingTimer = () => {
    if (accountingLeaveT.current) {
      clearTimeout(accountingLeaveT.current)
      accountingLeaveT.current = null
    }
  }
  const enterAccounting = useCallback(() => {
    clearAccountingTimer()
    setHoverAccounting(true)
  }, [])
  const leaveAccounting = useCallback(() => {
    clearAccountingTimer()
    accountingLeaveT.current = setTimeout(() => setHoverAccounting(false), 220)
  }, [])

  const clearPaymentsTimer = () => {
    if (paymentsLeaveT.current) {
      clearTimeout(paymentsLeaveT.current)
      paymentsLeaveT.current = null
    }
  }
  const enterPayments = useCallback(() => {
    clearPaymentsTimer()
    setHoverPayments(true)
  }, [])
  const leavePayments = useCallback(() => {
    clearPaymentsTimer()
    paymentsLeaveT.current = setTimeout(() => setHoverPayments(false), 220)
  }, [])

  const clearFinancialReportsTimer = () => {
    if (financialReportsLeaveT.current) {
      clearTimeout(financialReportsLeaveT.current)
      financialReportsLeaveT.current = null
    }
  }
  const enterFinancialReports = useCallback(() => {
    clearFinancialReportsTimer()
    setHoverFinancialReports(true)
  }, [])
  const leaveFinancialReports = useCallback(() => {
    clearFinancialReportsTimer()
    financialReportsLeaveT.current = setTimeout(() => setHoverFinancialReports(false), 220)
  }, [])

  const clearPumpTimer = () => {
    if (pumpLeaveT.current) {
      clearTimeout(pumpLeaveT.current)
      pumpLeaveT.current = null
    }
  }
  const enterPump = useCallback(() => {
    clearPumpTimer()
    setHoverPump(true)
  }, [])
  const leavePump = useCallback(() => {
    clearPumpTimer()
    pumpLeaveT.current = setTimeout(() => setHoverPump(false), 220)
  }, [])

  const profileTitle = [userName, userEmail, role].filter(Boolean).join(' · ') || 'Profile'

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800',
    )

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-slate-200 bg-slate-900 text-slate-100 transition-[width] duration-200',
        'overflow-visible',
        collapsed ? 'w-[4.25rem]' : 'w-60',
      )}
      style={{ isolation: 'isolate', zIndex: 200 }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700/80 px-3">
        {!collapsed && (
          <span className="truncate text-sm font-bold tracking-tight text-white" title={stationName}>
            {stationName}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="ml-auto rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-[-90deg]" />}
        </button>
      </div>

      <nav className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-visible p-2">
        <NavLink to="/" end className={navLinkClass} title={canViewDashboard ? 'Dashboard' : 'Home'}>
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {!collapsed && (canViewDashboard ? 'Dashboard' : 'Home')}
        </NavLink>

        {opsSections.map((s) => (
          <CollapsibleOpsSection key={s.to} {...s} collapsed={collapsed} />
        ))}

        {(linkAllowed('/pumps') || linkAllowed('/nozzles') || linkAllowed('/pumps/nozzles')) ? (
        <div className="relative overflow-visible" onMouseEnter={enterPump} onMouseLeave={leavePump}>
          <button
            ref={pumpAnchorRef}
            type="button"
            onClick={() => !collapsed && setPumpOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Fuel className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Pump</span>
                {pumpOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverPump}
              title="Pump"
              items={PUMP_CHILDREN}
              anchorRef={pumpAnchorRef}
              onRequestClose={() => setHoverPump(false)}
              onMouseEnter={enterPump}
              onMouseLeave={leavePump}
            />
          )}

          {!collapsed && pumpOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {PUMP_CHILDREN.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/pumps'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}

        {accountingChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterAccounting} onMouseLeave={leaveAccounting}>
          <button
            ref={accountingAnchorRef}
            type="button"
            onClick={() => !collapsed && setAccountingOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <ListTree className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Accounting</span>
                {accountingOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverAccounting}
              title="Accounting"
              items={accountingChildren}
              anchorRef={accountingAnchorRef}
              onRequestClose={() => setHoverAccounting(false)}
              onMouseEnter={enterAccounting}
              onMouseLeave={leaveAccounting}
            />
          )}

          {!collapsed && accountingOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {accountingChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}

        {paymentsChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterPayments} onMouseLeave={leavePayments}>
          <button
            ref={paymentsAnchorRef}
            type="button"
            onClick={() => !collapsed && setPaymentsOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Payments</span>
                {paymentsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverPayments}
              title="Payments"
              items={paymentsChildren}
              anchorRef={paymentsAnchorRef}
              onRequestClose={() => setHoverPayments(false)}
              onMouseEnter={enterPayments}
              onMouseLeave={leavePayments}
            />
          )}

          {!collapsed && paymentsOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {paymentsChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}

        {financialReportsChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterFinancialReports} onMouseLeave={leaveFinancialReports}>
          <button
            ref={financialReportsAnchorRef}
            type="button"
            onClick={() => !collapsed && setFinancialReportsOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <BarChart2 className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Financial reports</span>
                {financialReportsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverFinancialReports}
              title="Financial reports"
              items={financialReportsChildren}
              anchorRef={financialReportsAnchorRef}
              onRequestClose={() => setHoverFinancialReports(false)}
              onMouseEnter={enterFinancialReports}
              onMouseLeave={leaveFinancialReports}
            />
          )}

          {!collapsed && financialReportsOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {financialReportsChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={() =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      navTargetIsActive(location.pathname, location.search, to)
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}

        {reportsChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterReports} onMouseLeave={leaveReports}>
          <button
            ref={reportsAnchorRef}
            type="button"
            onClick={() => !collapsed && setReportsOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <FileText className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Reports</span>
                {reportsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverReports}
              title="Reports"
              items={reportsChildren}
              anchorRef={reportsAnchorRef}
              onRequestClose={() => setHoverReports(false)}
              onMouseEnter={enterReports}
              onMouseLeave={leaveReports}
            />
          )}

          {!collapsed && reportsOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {reportsChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}

        {setupChildren.length > 0 ? (
        <div className="relative mt-1 overflow-visible" onMouseEnter={enterSetup} onMouseLeave={leaveSetup}>
          <button
            ref={setupAnchorRef}
            type="button"
            onClick={() => !collapsed && setSetupOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <ListTree className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Main setup</span>
                {setupOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverSetup}
              title="Main setup"
              items={setupChildren}
              anchorRef={setupAnchorRef}
              onRequestClose={() => setHoverSetup(false)}
              onMouseEnter={enterSetup}
              onMouseLeave={leaveSetup}
            />
          )}

          {!collapsed && setupOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {setupChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        ) : null}
      </nav>

      <div
        className={cn(
          'shrink-0 border-t border-slate-700/80 p-3',
          collapsed ? 'flex justify-center' : 'flex items-center gap-3',
        )}
        title={profileTitle}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <User className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            {userEmail ? (
              <>
                {/* <p className="truncate text-sm font-medium text-white" title={userEmail}>
                  {userEmail}
                </p> */}
                {userName ? <p className="truncate text-xs text-slate-400">{userName}</p> : null}
              </>
            ) : (
              <p className="truncate text-sm font-medium text-white">{userName ?? '—'}</p>
            )}
            {role ? <p className="truncate text-xs text-slate-500">{role}</p> : null}
          </div>
        )}
      </div>
    </aside>
  )
}
