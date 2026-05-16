import { Provider } from 'react-redux'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { store } from './app/store'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { DippingsPage } from './pages/operations/DippingsPage'
import { ExpensesPage } from './pages/operations/ExpensesPage'
import { InventorySalesPage } from './pages/operations/InventorySalesPage'
import { InventorySaleDetailPage } from './pages/operations/InventorySaleDetailPage'
import { GeneratorUsagePage } from './pages/operations/GeneratorUsagePage'
import { CustomerFuelGivensPage } from './pages/operations/CustomerFuelGivensPage'
import { CustomerFuelGivenDetailsPage } from './pages/operations/CustomerFuelGivenDetailsPage'
import { LiterReceivedsPage } from './pages/operations/LiterReceivedsPage'
import { LiterReceivedReportPage } from './pages/reports/LiterReceivedReportPage'
import { DailyCashSalesReportPage } from './pages/reports/DailyCashSalesReportPage'
import { DailyFuelGivenReportPage } from './pages/reports/DailyFuelGivenReportPage'
import { GeneratorUsageReportPage } from './pages/reports/GeneratorUsageReportPage'
import { GeneralDailyReportPage } from './pages/reports/GeneralDailyReportPage'
import { InventoryDailyReportPage } from './pages/reports/InventoryDailyReportPage'
import { OutstandingCustomersReportPage } from './pages/reports/OutstandingCustomersReportPage'
import { DailyStationReportPage } from './pages/reports/DailyStationReportPage'
import { SupplierReportPage } from './pages/reports/SupplierReportPage'
import { CustomerReportPage } from './pages/reports/CustomerReportPage'
import { FinancialReportsPage } from './pages/reports/FinancialReportsPage'
import {
  CashOrUsdTakenReportPage,
  ExchangeReportPage,
  ExpenseReportPage,
} from './pages/reports/ExpenseExchangeReportsPages'
import { ToastProvider } from './components/ToastProvider'
import { PurchaseDetailPage } from './pages/operations/PurchaseDetailPage'
import { PurchasesPage } from './pages/operations/PurchasesPage'
import { SupplierPaymentsPage } from './pages/operations/SupplierPaymentsPage'
import { PumpsPage } from './pages/operations/PumpsPage'
import { NozzlesPage } from './pages/operations/NozzlesPage'
import { DippingPumpsPage } from './pages/operations/DippingPumpsPage'
import { SuppliersPage } from './pages/operations/SuppliersPage'
import { RatesPage } from './pages/operations/RatesPage'
import { BusinessUsersPage } from './pages/setup/BusinessUsersPage'
import { BusinessesPage } from './pages/setup/BusinessesPage'
import { MenusPage } from './pages/setup/MenusPage'
import { PermissionsPage } from './pages/setup/PermissionsPage'
import { RolesPage } from './pages/setup/RolesPage'
import { StationsPage } from './pages/setup/StationsPage'
import { SubMenusPage } from './pages/setup/SubMenusPage'
import { UsersPage } from './pages/setup/UsersPage'
import { FuelTypesPage } from './pages/operations/FuelTypesPage'
import { CurrenciesPage } from './pages/setup/CurrenciesPage'
import { FuelPricesPage } from './pages/setup/FuelPricesPage'
import { SettingsPage } from './pages/setup/SettingsPage'
import { ChartOfAccountsPage } from './pages/operations/ChartOfAccountsPage'
import { ChartsOfAccountsPage } from './pages/operations/ChartsOfAccountsPage'
import { TreeChartsOfAccountsPage } from './pages/operations/TreeChartsOfAccountsPage'
import { JournalEntryDetailPage } from './pages/operations/JournalEntryDetailPage'
import { ManualJournalEntryPage } from './pages/operations/ManualJournalEntryPage'
import { RecurringJournalEntriesPage } from './pages/accounting/RecurringJournalEntriesPage'
import { AccountingPeriodsPage } from './pages/accounting/AccountingPeriodsPage'
import { AccountingDashboardPage } from './pages/accounting/AccountingDashboardPage'
import { CustomerPaymentsPage } from './pages/operations/CustomerPaymentsPage'
import { BusinessFuelInventoryPage } from './pages/fuel-inventory/BusinessFuelInventoryPage'
import { TransferFuelsPage } from './pages/fuel-inventory/TransferFuelsPage'
import { TransferAuditTrailPage } from './pages/fuel-inventory/TransferAuditTrailPage'
import { NoPermissionsPage } from './pages/NoPermissionsPage'
import { LEGACY_FINANCIAL_KIND_TO_PATH } from './lib/financialReportRoutes'
import { EmployeesPage } from './pages/payroll/EmployeesPage'
import { EmployeeDetailsPage } from './pages/payroll/EmployeeDetailsPage'
import { EmployeePaymentsPage } from './pages/payroll/EmployeePaymentsPage'
import { PayrollRunsPage } from './pages/payroll/PayrollRunsPage'
import { PayrollStatusReportPage } from './pages/reports/PayrollStatusReportPage'
import { EmployeePaymentHistoryReportPage } from './pages/reports/EmployeePaymentHistoryReportPage'

function LegacyFinancialReportsRedirect() {
  const [searchParams] = useSearchParams()
  const kind = searchParams.get('kind') ?? 'trial'
  const to = LEGACY_FINANCIAL_KIND_TO_PATH[kind] ?? '/financial-reports/trial-balance'
  return <Navigate to={to} replace />
}

export function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/no-permission" element={<NoPermissionsPage />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="setup/roles" element={<RolesPage />} />
              <Route path="setup/users" element={<UsersPage />} />
              <Route path="setup/business-users" element={<BusinessUsersPage />} />
              <Route path="setup/businesses" element={<BusinessesPage />} />
              <Route path="setup/menus" element={<MenusPage />} />
              <Route path="setup/submenus" element={<SubMenusPage />} />
              <Route path="setup/permissions" element={<PermissionsPage />} />
              <Route path="setup/fuel-types" element={<FuelTypesPage />} />
              <Route path="setup/currencies" element={<CurrenciesPage />} />
              <Route path="setup/fuel-prices" element={<FuelPricesPage />} />
              <Route path="setup/settings" element={<SettingsPage />} />
              <Route path="fuel-sales" element={<Navigate to="/inventory" replace />} />
              <Route path="expenses" element={<ExpensesPage sideAction="Operation" />} />
              <Route path="management/expenses" element={<ExpensesPage sideAction="Management" />} />
              <Route path="operations/exchange" element={<ExpensesPage expenseKind="Exchange" sideAction="Operation" />} />
              <Route path="management/exchange" element={<ExpensesPage expenseKind="Exchange" sideAction="Management" />} />
              <Route path="operations/cash-usd-taken" element={<ExpensesPage expenseKind="cashOrUsdTaken" sideAction="Operation" />} />
              <Route path="inventory" element={<InventorySalesPage />} />
              <Route path="inventory/:saleId" element={<InventorySaleDetailPage />} />
              <Route path="rates" element={<RatesPage />} />
              <Route path="generator-usage" element={<GeneratorUsagePage />} />
              <Route path="customer-fuel-givens" element={<CustomerFuelGivensPage />} />
              <Route path="customer-fuel-givens/:id" element={<CustomerFuelGivenDetailsPage />} />
              <Route path="accounting" element={<Navigate to="/accounting/accounts" replace />} />
              <Route path="accounting/dashboard" element={<AccountingDashboardPage />} />
              <Route path="accounting/accounts" element={<ChartOfAccountsPage />} />
              <Route path="accounting/charts-of-accounts" element={<ChartsOfAccountsPage />} />
              <Route path="accounting/chart-of-accounts-tree" element={<TreeChartsOfAccountsPage />} />
              <Route path="accounting/chart-of-accounts" element={<Navigate to="/accounting/charts-of-accounts" replace />} />
              <Route path="accounting/manual-journal-entry/:entryId" element={<JournalEntryDetailPage />} />
              <Route path="accounting/manual-journal-entry" element={<ManualJournalEntryPage />} />
              <Route path="accounting/recurring-journals" element={<RecurringJournalEntriesPage />} />
              <Route path="accounting/periods" element={<AccountingPeriodsPage />} />
              <Route path="accounting/customer-payments" element={<CustomerPaymentsPage />} />
              <Route path="accounting/financial-reports" element={<Navigate to="/financial-reports/trial-balance" replace />} />
              <Route path="fuel-types" element={<Navigate to="/setup/fuel-types" replace />} />
              <Route path="pumps" element={<PumpsPage />} />
              <Route path="nozzles" element={<NozzlesPage />} />
              <Route path="pumps/nozzles" element={<Navigate to="/nozzles" replace />} />
              <Route path="dipping-pumps" element={<DippingPumpsPage />} />
              <Route path="pumps/dipping-pumps" element={<Navigate to="/dipping-pumps" replace />} />
              <Route path="dipping" element={<DippingsPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="purchases" element={<PurchasesPage />} />
              <Route path="supplier-payments" element={<SupplierPaymentsPage />} />
              <Route path="purchases/:purchaseId" element={<PurchaseDetailPage />} />
              <Route path="fuel-inventory" element={<BusinessFuelInventoryPage />} />
              <Route path="transfers" element={<TransferFuelsPage />} />
              <Route path="transfer-audit-trail" element={<TransferAuditTrailPage />} />
              <Route path="fuel-inventory/transfers" element={<Navigate to="/transfers" replace />} />
              <Route path="liter-received" element={<LiterReceivedsPage />} />
              <Route path="reports/liter-received" element={<LiterReceivedReportPage />} />
              <Route path="reports/daily-cash-sales" element={<DailyCashSalesReportPage />} />
              <Route path="reports/cash-out-daily" element={<Navigate to="/reports/expenses" replace />} />
              <Route path="reports/expenses" element={<ExpenseReportPage />} />
              <Route path="reports/exchange" element={<ExchangeReportPage />} />
              <Route path="reports/cash-usd-taken" element={<CashOrUsdTakenReportPage />} />
              <Route path="reports/daily-fuel-given" element={<DailyFuelGivenReportPage />} />
              <Route path="reports/generator-usage" element={<GeneratorUsageReportPage />} />
              <Route path="reports/general-daily" element={<GeneralDailyReportPage />} />
              <Route path="reports/inventory-daily" element={<InventoryDailyReportPage />} />
              <Route path="reports/daily-station" element={<DailyStationReportPage />} />
              <Route path="reports/supplier" element={<SupplierReportPage />} />
              <Route path="reports/customer" element={<CustomerReportPage />} />
              <Route path="reports/outstanding-customers" element={<OutstandingCustomersReportPage />} />
              <Route path="reports/payroll-paid" element={<PayrollStatusReportPage mode="paid" />} />
              <Route path="reports/payroll-unpaid" element={<PayrollStatusReportPage mode="unpaid" />} />
              <Route path="reports/employee-payment-history" element={<EmployeePaymentHistoryReportPage />} />
              <Route path="reports/financial" element={<LegacyFinancialReportsRedirect />} />
              <Route path="financial-reports/trial-balance" element={<FinancialReportsPage />} />
              <Route
                path="financial-reports/trial-balance-unadjusted"
                element={<Navigate to="/financial-reports/trial-balance?view=unadjusted" replace />}
              />
              <Route
                path="financial-reports/trial-balance-adjusted"
                element={<Navigate to="/financial-reports/trial-balance?view=adjusted" replace />}
              />
              <Route
                path="financial-reports/trial-balance-post-closing"
                element={<Navigate to="/financial-reports/trial-balance?view=postclosing" replace />}
              />
              <Route path="financial-reports/general-ledger" element={<FinancialReportsPage />} />
              <Route path="financial-reports/profit-and-loss" element={<FinancialReportsPage />} />
              <Route path="financial-reports/balance-sheet" element={<FinancialReportsPage />} />
              <Route path="financial-reports/capital-statement" element={<FinancialReportsPage />} />
              <Route path="financial-reports/customer-balances" element={<FinancialReportsPage />} />
              <Route path="financial-reports/supplier-balances" element={<FinancialReportsPage />} />
              <Route path="financial-reports/daily-cash-flow" element={<FinancialReportsPage />} />
              <Route path="financial-reports/report-period-view" element={<FinancialReportsPage />} />
              <Route path="stations" element={<StationsPage />} />
              {/* Legacy URLs */}
              <Route path="operations/fuel-sales" element={<Navigate to="/inventory" replace />} />
              <Route path="operations/expenses" element={<Navigate to="/expenses" replace />} />
              <Route path="operations/inventory" element={<Navigate to="/inventory" replace />} />
              <Route path="operations/rates" element={<Navigate to="/rates" replace />} />
              <Route path="operations/generator-usage" element={<Navigate to="/generator-usage" replace />} />
              <Route path="operations/fuel-types" element={<Navigate to="/fuel-types" replace />} />
              <Route path="operations/pumps" element={<Navigate to="/pumps" replace />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="employees/:id" element={<EmployeeDetailsPage />} />
              <Route path="payrolls" element={<EmployeePaymentsPage />} />
              <Route path="payrolls/runs" element={<PayrollRunsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </Provider>
  )
}
