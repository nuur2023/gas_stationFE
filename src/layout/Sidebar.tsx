import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  BarChart2,
  Banknote,
  Beaker,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Cylinder,
  Droplets,
  FileText,
  Fuel,
  GitBranch,
  LayoutDashboard,
  Link2,
  ListTree,
  MapPin,
  Percent,
  Repeat2,
  CalendarRange,
  ArrowRightLeft,
  ClipboardList,
  Shield,
  Truck,
  User,
  Users,
  UserSquare2,
  Wallet,
  X,
  Zap,
  UserRoundPlus,
} from 'lucide-react'
import { useNavAccess } from '../hooks/useNavAccess'
import { useAppSelector } from '../app/hooks'
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
  { to: '/operations/cash-usd-taken', label: 'Cash or USD Taken', icon: Wallet },
  { to: '/operations/exchange', label: 'Exchange', icon: ArrowRightLeft },
  { to: '/generator-usage', label: 'Generators', icon: Zap },
  { to: '/accounting/customer-payments', label: 'Payments', icon: CreditCard },
]

const MANAGEMENT_CHILDREN: FlyoutItem[] = [
  { to: '/setup/fuel-types', label: 'Fuel Types', icon: Fuel },
  { to: '/fuel-inventory', label: 'Pool', icon: Cylinder },
  { to: '/transfers', label: 'Transfer to station', icon: ArrowRightLeft },
  { to: '/transfer-audit-trail', label: 'Transfer audit trail', icon: ClipboardList },
  { to: '/setup/fuel-prices', label: 'Pricing', icon: Droplets },
  { to: '/rates', label: 'Rates', icon: Percent },
  { to: '/management/expenses', label: 'Expenses', icon: Wallet },
  { to: '/management/exchange', label: 'Exchange', icon: ArrowRightLeft },
  { to: '/dipping', label: 'Tank (Dipping)', icon: Beaker },
  { to: '/pumps', label: 'Pumps', icon: Fuel },
  { to: '/nozzles', label: 'Nozzles', icon: Link2 },
  { to: '/dipping-pumps', label: 'DippingPump', icon: Link2 },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/purchases', label: 'Purchases', icon: Cylinder },
  { to: '/supplier-payments', label: 'Supplier payments', icon: Banknote },
]

const EMPLOYEES_CHILDREN: FlyoutItem[] = [
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/reports/payroll-paid', label: 'Paid employees', icon: FileText },
  { to: '/reports/payroll-unpaid', label: 'Unpaid employees', icon: FileText },
  { to: '/reports/employee-payment-history', label: 'Employee payment history', icon: ClipboardList },
]

/** Routes that live under Reports URLs but are grouped under Employees in the sidebar. */
const EMPLOYEES_SECTION_PATH_PREFIXES = [
  '/employees',
  '/reports/payroll-paid',
  '/reports/payroll-unpaid',
  '/reports/employee-payment-history',
] as const

const PAYROLLS_CHILDREN: FlyoutItem[] = [
  { to: '/payrolls', label: 'Record payment', icon: Banknote },
  { to: '/payrolls/runs', label: 'Payroll runs', icon: CalendarRange },
]

const ADMINISTRATION_CHILDREN: FlyoutItem[] = [
  { to: '/setup/users', label: 'Users', icon: Users },
  { to: '/setup/business-users', label: 'Assigning Station', icon: UserSquare2 },
  { to: '/setup/permissions', label: 'Permissions', icon: Shield },
  { to: '/setup/settings', label: 'Settings', icon: User },
]

const ACCOUNTING_CHILDREN: FlyoutItem[] = [
  { to: '/accounting/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounting/accounts', label: 'Accounts', icon: Wallet },
  { to: '/accounting/chart-of-accounts-tree', label: 'COA tree', icon: GitBranch },
  { to: '/accounting/charts-of-accounts', label: 'Charts of accounts', icon: ListTree },
  { to: '/accounting/manual-journal-entry', label: 'Manual journal entry', icon: FileText },
  { to: '/accounting/recurring-journals', label: 'Recurring journals', icon: Repeat2 },
  { to: '/accounting/periods', label: 'Accounting periods', icon: CalendarRange },
]

const FINANCIAL_REPORTS_CHILDREN: FlyoutItem[] = [
  { to: '/financial-reports/trial-balance', label: 'Trial balance', icon: FileText },
  { to: '/financial-reports/general-ledger', label: 'General ledger', icon: FileText },
  { to: '/financial-reports/profit-and-loss', label: 'Income Statement', icon: FileText },
  { to: '/financial-reports/balance-sheet', label: 'Balance sheet', icon: FileText },
  { to: '/financial-reports/capital-statement', label: 'Capital Statement', icon: FileText },
  { to: '/financial-reports/customer-balances', label: 'Customer balances', icon: FileText },
  { to: '/financial-reports/supplier-balances', label: 'Supplier balances', icon: FileText },
  { to: '/financial-reports/daily-cash-flow', label: 'Cash flow statement', icon: FileText },
  { to: '/financial-reports/report-period-view', label: 'Report Period View', icon: FileText },
]

const REPORTS_CHILDREN: FlyoutItem[] = [
  { to: '/reports/liter-received', label: 'Liter received', icon: FileText },
  { to: '/reports/daily-cash-sales', label: 'Daily cash sales report', icon: FileText },
  { to: '/reports/expenses', label: 'Expense reports', icon: FileText },
  { to: '/reports/exchange', label: 'Exchange reports', icon: FileText },
  { to: '/reports/cash-usd-taken', label: 'Cash or USD Taken reports', icon: FileText },
  { to: '/reports/daily-fuel-given', label: 'Daily given fuel', icon: FileText },
  { to: '/reports/generator-usage', label: 'Generator usage report', icon: FileText },
  { to: '/reports/general-daily', label: 'General daily report', icon: FileText },
  { to: '/reports/inventory-daily', label: 'Inventory daily', icon: FileText },
  { to: '/reports/daily-station', label: 'Daily station report', icon: FileText },
  { to: '/reports/supplier', label: 'Supplier report', icon: FileText },
  { to: '/reports/customer', label: 'Customer report', icon: FileText },
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
  isMobile: boolean
  onMobileClose: () => void
  userName: string | null
  userEmail: string | null
  role: string | null
  stationName: string
  /** Recurring journals awaiting user confirmation (confirm-when-due). */
  recurringPendingCount?: number
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  isMobile,
  onMobileClose,
  userName,
  userEmail,
  role,
  stationName,
  recurringPendingCount = 0,
}: SidebarProps) {
  const location = useLocation()
  const { linkAllowed, canViewDashboard } = useNavAccess()
  const supportsPool = useAppSelector((s) => s.auth.supportsPool)
  const isAdminUser = role?.trim().toLowerCase() === 'admin'

  const operationsChildren = useMemo(
    () => OPERATIONS_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const managementChildren = useMemo(
    () =>
      MANAGEMENT_CHILDREN.filter((c) => {
        if (
          supportsPool === false &&
          (c.to === '/fuel-inventory' || c.to === '/transfers' || c.to === '/transfer-audit-trail')
        ) {
          return false
        }
        return managementNavItemAllowed(c.to, linkAllowed)
      }),
    [linkAllowed, supportsPool],
  )
  const employeesChildren = useMemo(() => EMPLOYEES_CHILDREN.filter((c) => linkAllowed(c.to)), [linkAllowed])
  const payrollsChildren = useMemo(() => PAYROLLS_CHILDREN.filter((c) => linkAllowed(c.to)), [linkAllowed])
  const administrationChildren = useMemo(
    () => ADMINISTRATION_CHILDREN.filter((c) => linkAllowed(c.to)),
    [linkAllowed],
  )
  const accountingChildren = useMemo(() => {
    const base = ACCOUNTING_CHILDREN.filter((c) => linkAllowed(c.to))
    if (recurringPendingCount <= 0) return base
    return base.map((c) =>
      c.to === '/accounting/recurring-journals' ? { ...c, badge: recurringPendingCount } : c,
    )
  }, [linkAllowed, recurringPendingCount])
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
  const [setupOpen, setSetupOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [accountingOpen, setAccountingOpen] = useState(false)
  const [operationsOpen, setOperationsOpen] = useState(false)
  const [managementOpen, setManagementOpen] = useState(false)
  const [employeesOpen, setEmployeesOpen] = useState(false)
  const [payrollsOpen, setPayrollsOpen] = useState(false)
  const [administrationOpen, setAdministrationOpen] = useState(false)
  const [financialReportsOpen, setFinancialReportsOpen] = useState(false)
  const [hoverSetup, setHoverSetup] = useState(false)
  const [hoverReports, setHoverReports] = useState(false)
  const [hoverAccounting, setHoverAccounting] = useState(false)
  const [hoverOperations, setHoverOperations] = useState(false)
  const [hoverManagement, setHoverManagement] = useState(false)
  const [hoverEmployees, setHoverEmployees] = useState(false)
  const [hoverPayrolls, setHoverPayrolls] = useState(false)
  const [hoverAdministration, setHoverAdministration] = useState(false)
  const [hoverFinancialReports, setHoverFinancialReports] = useState(false)
  const setupLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accountingLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const operationsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const managementLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const employeesLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const payrollsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const administrationLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const financialReportsLeaveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setupAnchorRef = useRef<HTMLButtonElement>(null)
  const reportsAnchorRef = useRef<HTMLButtonElement>(null)
  const accountingAnchorRef = useRef<HTMLButtonElement>(null)
  const operationsAnchorRef = useRef<HTMLButtonElement>(null)
  const managementAnchorRef = useRef<HTMLButtonElement>(null)
  const employeesAnchorRef = useRef<HTMLButtonElement>(null)
  const payrollsAnchorRef = useRef<HTMLButtonElement>(null)
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

  const clearEmployeesTimer = () => {
    if (employeesLeaveT.current) {
      clearTimeout(employeesLeaveT.current)
      employeesLeaveT.current = null
    }
  }
  const enterEmployees = useCallback(() => {
    clearEmployeesTimer()
    setHoverEmployees(true)
  }, [])
  const leaveEmployees = useCallback(() => {
    clearEmployeesTimer()
    employeesLeaveT.current = setTimeout(() => setHoverEmployees(false), 220)
  }, [])

  const clearPayrollsTimer = () => {
    if (payrollsLeaveT.current) {
      clearTimeout(payrollsLeaveT.current)
      payrollsLeaveT.current = null
    }
  }
  const enterPayrolls = useCallback(() => {
    clearPayrollsTimer()
    setHoverPayrolls(true)
  }, [])
  const leavePayrolls = useCallback(() => {
    clearPayrollsTimer()
    payrollsLeaveT.current = setTimeout(() => setHoverPayrolls(false), 220)
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
  const closeAllMenus = useCallback(() => {
    setSetupOpen(false)
    setReportsOpen(false)
    setAccountingOpen(false)
    setOperationsOpen(false)
    setManagementOpen(false)
    setEmployeesOpen(false)
    setPayrollsOpen(false)
    setAdministrationOpen(false)
    setFinancialReportsOpen(false)
  }, [])

  useEffect(() => {
    const p = location.pathname
    const showEmployeesFlyout = EMPLOYEES_SECTION_PATH_PREFIXES.some(
      (prefix) => p === prefix || p.startsWith(`${prefix}/`),
    )
    if (showEmployeesFlyout) setEmployeesOpen(true)
  }, [location.pathname])

  const toggleOnlyMenu = useCallback(
    (
      menu:
        | 'setup'
        | 'reports'
        | 'accounting'
        | 'operations'
        | 'management'
        | 'employees'
        | 'payrolls'
        | 'administration'
        | 'financialReports',
    ) => {
      const wasOpen =
        (menu === 'setup' && setupOpen) ||
        (menu === 'reports' && reportsOpen) ||
        (menu === 'accounting' && accountingOpen) ||
        (menu === 'operations' && operationsOpen) ||
        (menu === 'management' && managementOpen) ||
        (menu === 'employees' && employeesOpen) ||
        (menu === 'payrolls' && payrollsOpen) ||
        (menu === 'administration' && administrationOpen) ||
        (menu === 'financialReports' && financialReportsOpen)

      closeAllMenus()
      if (!wasOpen) {
        if (menu === 'setup') setSetupOpen(true)
        if (menu === 'reports') setReportsOpen(true)
        if (menu === 'accounting') setAccountingOpen(true)
        if (menu === 'operations') setOperationsOpen(true)
        if (menu === 'management') setManagementOpen(true)
        if (menu === 'employees') setEmployeesOpen(true)
        if (menu === 'payrolls') setPayrollsOpen(true)
        if (menu === 'administration') setAdministrationOpen(true)
        if (menu === 'financialReports') setFinancialReportsOpen(true)
      }
    },
    [
      accountingOpen,
      administrationOpen,
      closeAllMenus,
      employeesOpen,
      financialReportsOpen,
      managementOpen,
      operationsOpen,
      payrollsOpen,
      reportsOpen,
      setupOpen,
    ],
  )

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
          onClick={isMobile ? onMobileClose : onToggleCollapse}
          className="ml-auto rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title={isMobile ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isMobile ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isMobile ? (
            <X className="h-5 w-5" />
          ) : collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5 rotate-[-90deg]" />
          )}
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
            onClick={() => !collapsed && toggleOnlyMenu('operations')}
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
            onClick={() => !collapsed && toggleOnlyMenu('management')}
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
                  end={
                    to === '/pumps' ||
                    to === '/fuel-inventory' ||
                    to === '/transfers' ||
                    to === '/transfer-audit-trail'
                  }
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

        {employeesChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterEmployees} onMouseLeave={leaveEmployees}>
          <button
            ref={employeesAnchorRef}
            type="button"
            onClick={() => !collapsed && toggleOnlyMenu('employees')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Briefcase className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Employees</span>
                {employeesOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverEmployees}
              title="Employees"
              items={employeesChildren}
              anchorRef={employeesAnchorRef}
              onRequestClose={() => setHoverEmployees(false)}
              onMouseEnter={enterEmployees}
              onMouseLeave={leaveEmployees}
            />
          )}

          {!collapsed && employeesOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {employeesChildren.map(({ to, label, icon: Icon }) => (
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

        {payrollsChildren.length > 0 ? (
        <div className="relative overflow-visible" onMouseEnter={enterPayrolls} onMouseLeave={leavePayrolls}>
          <button
            ref={payrollsAnchorRef}
            type="button"
            onClick={() => !collapsed && toggleOnlyMenu('payrolls')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <Wallet className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Payrolls</span>
                {payrollsOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {collapsed && (
            <CollapsedFlyoutMenu
              open={hoverPayrolls}
              title="Payrolls"
              items={payrollsChildren}
              anchorRef={payrollsAnchorRef}
              onRequestClose={() => setHoverPayrolls(false)}
              onMouseEnter={enterPayrolls}
              onMouseLeave={leavePayrolls}
            />
          )}

          {!collapsed && payrollsOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
              {payrollsChildren.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/payrolls'}
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
            onClick={() => !collapsed && toggleOnlyMenu('administration')}
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
            onClick={() => !collapsed && toggleOnlyMenu('reports')}
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
            onClick={() => !collapsed && toggleOnlyMenu('accounting')}
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
              {accountingChildren.map(({ to, label, icon: Icon, badge }) => (
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
                  <span className="flex-1">{label}</span>
                  {badge != null && badge > 0 ? (
                    <span className="min-w-[1.25rem] rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-slate-950">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
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
            onClick={() => !collapsed && toggleOnlyMenu('financialReports')}
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
            onClick={() => !collapsed && toggleOnlyMenu('setup')}
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
