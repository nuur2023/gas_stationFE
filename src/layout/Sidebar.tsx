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
import { useNavAccess } from '../hooks/useNavAccess'
import { cn } from '../lib/cn'
import {
  FINANCIAL_REPORT_CORE_PATHS,
  FINANCIAL_REPORT_LEGACY_CORE_ROUTES,
} from '../lib/financialReportRoutes'
import { CollapsedFlyoutMenu, navTargetIsActive, type FlyoutItem } from './CollapsedFlyoutMenu'

function managementNavItemAllowed(to: string, linkAllowed: (route: string) => boolean): boolean {
  if (to === '/nozzles') return linkAllowed('/nozzles') || linkAllowed('/pumps/nozzles')
  if (to === '/dipping-pumps')
    return linkAllowed('/dipping-pumps') || linkAllowed('/pumps/dipping-pumps') || linkAllowed('/pumps')
  return linkAllowed(to)
}

const OPERATIONS_CHILDREN: FlyoutItem[] = [
  { to: '/inventory', label: 'Fuel Sales', icon: Droplets },
  { to: '/customer-fuel-givens', label: 'Customers', icon: UserRoundPlus },
  { to: '/liter-received', label: 'Liter Received', icon: Truck },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/generator-usage', label: 'Generators', icon: Zap },
  { to: '/accounting/customer-payments', label: 'Payments', icon: CreditCard },
]

const MANAGEMENT_CHILDREN: FlyoutItem[] = [
  { to: '/setup/fuel-types', label: 'Fuel Types', icon: Fuel },
  { to: '/setup/fuel-prices', label: 'Pricing', icon: Droplets },
  { to: '/rates', label: 'Rates', icon: Percent },
  { to: '/dipping', label: 'Tank (Dipping)', icon: Beaker },
  { to: '/pumps', label: 'Pumps', icon: Fuel },
  { to: '/nozzles', label: 'Nozzles', icon: Link2 },
  { to: '/dipping-pumps', label: 'DippingPump', icon: Link2 },
  { to: '/suppliers', label: 'Suppliers', icon: Contact },
  { to: '/purchases', label: 'Purchases', icon: Cylinder },
]

const ADMINISTRATION_CHILDREN: FlyoutItem[] = [
  { to: '/setup/users', label: 'Users', icon: Users },
  { to: '/setup/business-users', label: 'Assigning Station', icon: UserSquare2 },
  { to: '/setup/permissions', label: 'Permissions', icon: Shield },
  { to: '/setup/settings', label: 'Settings', icon: User },
]

const ACCOUNTING_CHILDREN: FlyoutItem[] = [
  { to: '/accounting/accounts', label: 'Accounts', icon: Wallet },
  { to: '/accounting/charts-of-accounts', label: 'Charts of accounts', icon: ListTree },
  { to: '/accounting/manual-journal-entry', label: 'Manual journal entry', icon: FileText },
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

const MAIN_SETUP_CHILDREN: FlyoutItem[] = [
  { to: '/setup/businesses', label: 'Business', icon: Building2 },
  { to: '/setup/roles', label: 'Roles', icon: Shield },
  { to: '/setup/users', label: 'Users', icon: Users },
  { to: '/stations', label: 'Stations', icon: MapPin },
  { to: '/setup/business-users', label: 'Assigning Station', icon: UserSquare2 },
  { to: '/setup/menus', label: 'Menus', icon: ListTree },
  { to: '/setup/submenus', label: 'Submenus', icon: Link2 },
  { to: '/setup/currencies', label: 'Currencies', icon: Wallet },
  { to: '/setup/permissions', label: 'Permissions', icon: Shield },
  { to: '/setup/settings', label: 'Settings', icon: User },
]

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
  const isAdminUser = role?.trim().toLowerCase() === 'admin'

  const operationsChildren = useMemo(
    () => OPERATIONS_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const managementChildren = useMemo(
    () => MANAGEMENT_CHILDREN.filter((c) => managementNavItemAllowed(c.to, linkAllowed)),
    [linkAllowed],
  )
  const administrationChildren = useMemo(
    () => ADMINISTRATION_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const accountingChildren = useMemo(
    () => ACCOUNTING_CHILDREN.filter((c) => linkAllowed(c.to)),
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
  const mainSetupChildren = useMemo(
    () => MAIN_SETUP_CHILDREN.filter((x) => linkAllowed(x.to)),
    [linkAllowed],
  )
  const [setupOpen, setSetupOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [accountingOpen, setAccountingOpen] = useState(true)
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [managementOpen, setManagementOpen] = useState(true)
  const [administrationOpen, setAdministrationOpen] = useState(true)
  const [financialReportsOpen, setFinancialReportsOpen] = useState(true)
  const [hoverSetup, setHoverSetup] = useState(false)
  const [hoverReports, setHoverReports] = useState(false)
  const [hoverAccounting, setHoverAccounting] = useState(false)
  const [hoverOperations, setHoverOperations] = useState(false)
  const [hoverManagement, setHoverManagement] = useState(false)
  const [hoverAdministration, setHoverAdministration] = useState(false)
  const [hoverFinancialReports, setHoverFinancialReports] = useState(false)
  const setupLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accountingLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const operationsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const managementLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const administrationLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const financialReportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setupAnchorRef = useRef<HTMLButtonElement>(null)
  const reportsAnchorRef = useRef<HTMLButtonElement>(null)
  const accountingAnchorRef = useRef<HTMLButtonElement>(null)
  const operationsAnchorRef = useRef<HTMLButtonElement>(null)
  const managementAnchorRef = useRef<HTMLButtonElement>(null)
  const administrationAnchorRef = useRef<HTMLButtonElement>(null)
  const financialReportsAnchorRef = useRef<HTMLButtonElement>(null)

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

  const clearOperationsTimer = () => {
    if (operationsLeaveT.current) {
      clearTimeout(operationsLeaveT.current)
      operationsLeaveT.current = null
    }
  }
  const enterOperations = useCallback(() => {
    clearOperationsTimer()
    setHoverOperations(true)
  }, [])
  const leaveOperations = useCallback(() => {
    clearOperationsTimer()
    operationsLeaveT.current = setTimeout(() => setHoverOperations(false), 220)
  }, [])

  const clearManagementTimer = () => {
    if (managementLeaveT.current) {
      clearTimeout(managementLeaveT.current)
      managementLeaveT.current = null
    }
  }
  const enterManagement = useCallback(() => {
    clearManagementTimer()
    setHoverManagement(true)
  }, [])
  const leaveManagement = useCallback(() => {
    clearManagementTimer()
    managementLeaveT.current = setTimeout(() => setHoverManagement(false), 220)
  }, [])

  const clearAdministrationTimer = () => {
    if (administrationLeaveT.current) {
      clearTimeout(administrationLeaveT.current)
      administrationLeaveT.current = null
    }
  }
  const enterAdministration = useCallback(() => {
    clearAdministrationTimer()
    setHoverAdministration(true)
  }, [])
  const leaveAdministration = useCallback(() => {
    clearAdministrationTimer()
    administrationLeaveT.current = setTimeout(() => setHoverAdministration(false), 220)
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

        {operationsChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterOperations} onMouseLeave={leaveOperations}>
          <button
            ref={operationsAnchorRef}
            type="button"
            onClick={() => !collapsed && setOperationsOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Fuel className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Operations</span>
                {operationsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverOperations}
              title="Operations"
              items={operationsChildren}
              anchorRef={operationsAnchorRef}
              onRequestClose={() => setHoverOperations(false)}
              onMouseEnter={enterOperations}
              onMouseLeave={leaveOperations}
            />
          )}

          {!collapsed && operationsOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {operationsChildren.map(({ to, label, icon: Icon }) => (
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

        {managementChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterManagement} onMouseLeave={leaveManagement}>
          <button
            ref={managementAnchorRef}
            type="button"
            onClick={() => !collapsed && setManagementOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Building2 className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Management</span>
                {managementOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverManagement}
              title="Management"
              items={managementChildren}
              anchorRef={managementAnchorRef}
              onRequestClose={() => setHoverManagement(false)}
              onMouseEnter={enterManagement}
              onMouseLeave={leaveManagement}
            />
          )}

          {!collapsed && managementOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {managementChildren.map(({ to, label, icon: Icon }) => (
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

        {administrationChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterAdministration} onMouseLeave={leaveAdministration}>
          <button
            ref={administrationAnchorRef}
            type="button"
            onClick={() => !collapsed && setAdministrationOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Shield className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Administration</span>
                {administrationOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverAdministration}
              title="Administration"
              items={administrationChildren}
              anchorRef={administrationAnchorRef}
              onRequestClose={() => setHoverAdministration(false)}
              onMouseEnter={enterAdministration}
              onMouseLeave={leaveAdministration}
            />
          )}

          {!collapsed && administrationOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {administrationChildren.map(({ to, label, icon: Icon }) => (
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
                <span className="flex-1">Financial Report</span>
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
              title="Financial Report"
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

        {mainSetupChildren.length > 0 && !isAdminUser ? (
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
              items={mainSetupChildren}
              anchorRef={setupAnchorRef}
              onRequestClose={() => setHoverSetup(false)}
              onMouseEnter={enterSetup}
              onMouseLeave={leaveSetup}
            />
          )}

          {!collapsed && setupOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {mainSetupChildren.map(({ to, label, icon: Icon }) => (
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
