export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface Role {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
  isDeleted?: boolean
}

export interface User {
  id: number
  name: string
  email: string
  phone: string
  passwordHash: string
  roleId: number
  createdAt?: string
  updatedAt?: string
  isDeleted?: boolean
}

export interface Business {
  id: number
  name: string
  address?: string | null
  phoneNumber?: string | null
  isActive?: boolean
  isSupportPool?: boolean
}

export interface Menu {
  id: number
  name: string
  route: string
  subMenus?: SubMenu[]
}

export interface SubMenu {
  id: number
  menuId: number
  name: string
  route: string
}

export interface Permission {
  id: number
  userId: number
  businessId: number
  menuId: number
  subMenuId?: number | null
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

/** Current user's nav access from GET Permissions/me */
export interface PermissionMeItem {
  route: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface PermissionMeResponse {
  fullAccess: boolean
  supportsPool: boolean
  items: PermissionMeItem[]
}

export interface BusinessUser {
  id: number
  userId: number
  businessId: number
  stationId: number
}

export interface FuelType {
  id: number
  fuelName: string
  businessId: number
  createdAt?: string
  updatedAt?: string
  isDeleted?: boolean
}

export interface FuelTypeWriteRequest {
  fuelName: string
  businessId?: number
}

export interface Currency {
  id: number
  countryName: string
  code: string
  name: string
  symbol: string
}

export interface FuelPrice {
  id: number
  fuelTypeId: number
  stationId: number
  businessId: number
  price: number
  currencyId: number
}

export interface FuelPriceWriteRequest {
  fuelTypeId: number
  stationId: number
  businessId?: number
  price: number
  currencyId: number
}

export interface Pump {
  id: number
  pumpNumber: string
  stationId: number
  businessId: number
  userId: number
}

/** Nozzle row with pump label and linked dipping (GET Nozzles/by-business, by-station). */
export interface NozzleStationRow {
  id: number
  pumpId: number
  pumpNumber: string
  name: string
  stationId: number
  businessId: number
  dippingId: number
}

/** Primary nozzle + dipping for a pump (GET Nozzles/for-pump). */
export interface NozzleForPumpRow {
  id: number
  name: string
  dippingId: number
}

export interface Expense {
  id: number
  type: 'Expense' | 'Exchange' | 'cashOrUsdTaken'
  sideAction: 'Operation' | 'Management'
  date: string
  description: string
  currencyId: number
  localAmount: number
  rate: number
  amountUsd: number
  userId: number
  businessId: number
  /** NULL for Management entries (recorded at the business level, no station context). */
  stationId: number | null
}

/** Operation report: cash out lines from expenses (local amount + optional exchange columns). */
export interface CashOutDailyLineDto {
  id: number
  date: string
  kind: string
  description: string
  currencyCode: string
  localAmount: number
  rate: number
  amountUsd: number
  /** NULL for Management entries (recorded at the business level). */
  stationId: number | null
}

export interface CashOutDailyReportDto {
  lines: CashOutDailyLineDto[]
  totalCashOut: number
  /** Sum of line USD amounts; optional for older API responses. */
  totalCashOutUsd?: number
}

/** Central daily summary (matches OperationReports/daily-summary-report). */
export interface DailySummaryReportDto {
  salesLocal: number
  salesSspToUsd: number
  salesUsd: number
  periodFinalUsd: number
  previousBalanceLocal: number
  previousBalanceUsd: number
  previousBalanceSspToUsd: number
  totalLocal: number
  totalSspToUsd: number
  totalUsd: number
  outLocal: number
  outUsd: number
  outAsUsd: number
  balanceLocal: number
  balanceUsd: number
  finalBalanceUsd: number
  periodCashOut: CashOutDailyReportDto
}

export interface DailyFuelGivenRowDto {
  id: number
  date: string
  stationId: number
  fuelTypeId: number
  fuelTypeName: string
  /** Customer / recipient name. */
  name: string
  /** Unit price (local currency per liter). */
  price: number
  totalLiters: number
  totalAmount: number
  usdAmount: number
  transactionCount: number
}

export interface DailyStationAmountRowDto {
  amount: number
  description: string
  date: string
}

export interface DailyStationExchangeRowDto {
  amountSsp: number
  rate: number
  usd: number
  date: string
}

export interface DailyStationCashTakenRowDto {
  amountSsp: number
  amountUsd: number
  date: string
}

export interface DailyStationFuelRowDto {
  type: string
  litersSold: number
  ssp: number
  usd: number
  inDipping: number
  date: string
}

export interface DailyStationFuelPriceDto {
  petrolSsp: number
  dieselSsp: number
  petrolUsd: number
  dieselUsd: number
}

export interface DailyStationReportDto {
  stationName: string
  from: string
  to: string
  fuelPrices: DailyStationFuelPriceDto
  expenseFromStation: DailyStationAmountRowDto[]
  fuelReport: DailyStationFuelRowDto[]
  exchangeFromStation: DailyStationExchangeRowDto[]
  cashTakenFromStation: DailyStationCashTakenRowDto[]
  expenseFromOffice: DailyStationAmountRowDto[]
  exchangeFromOffice: DailyStationExchangeRowDto[]
  /** Salary cash-outs for the whole business in the report range (not station-scoped; same as office sections). */
  salaryPayments: DailyStationSalaryPaymentRowDto[]
}

export interface DailyStationSalaryPaymentRowDto {
  /** Distinct employees paid in that group. */
  employees: number
  amount: number
  recordedBy: string
  date: string
}

export interface Inventory {
  id: number
  /** Parent batch (one reference + evidence file per sale). */
  inventorySaleId?: number
  referenceNumber?: string | null
  evidenceFilePath?: string | null
  nozzleId: number
  openingLiters: number
  closingLiters: number
  usageLiters: number
  sspLiters: number
  usdLiters: number
  /** SSP lane: sspLiters × SSP-configured fuel price (server). */
  sspAmount: number
  /** USD lane: usdLiters × USD-configured fuel price (server). */
  usdAmount: number
  /** Saved SSP fuel price per liter at inventory save time. */
  sspFuelPrice: number
  /** Saved USD fuel price per liter at inventory save time. */
  usdFuelPrice: number
  /** SSP per USD at save time; reporting only. */
  exchangeRate: number
  userId: number
  /** Creator/editor name from API (not always present on older clients). */
  userName?: string | null
  date: string
  businessId: number
  stationId: number
}

export interface InventoryBatchCreateResponse {
  referenceNumber: string
  saleId: number
  items: Inventory[]
}

export interface InventorySaleDetail {
  saleId: number
  referenceNumber: string
  businessId: number
  stationId: number
  userId: number
  userName?: string | null
  recordedDate: string
  evidenceFilePath?: string | null
  originalFileName?: string | null
  items: Inventory[]
}

export interface LatestInventoryForPump {
  openingLiters?: number | null
  closingLiters: number | null
  usageLiters: number | null
}

export interface Rate {
  id: number
  rateNumber: number
  businessId: number
  usersId: number
  /** Creator display name from API (Users join); optional fallback to user list. */
  userName?: string | null
  date: string
  active: boolean
}

export interface GeneratorUsage {
  id: number
  ltrUsage: number
  usersId: number
  businessId: number
  stationId: number
  fuelTypeId?: number | null
  date: string
}

export interface CustomerFuelGiven {
  id: number
  customerId?: number
  name: string
  phone: string
  /** "Fuel" (uses fuel fields) or "Cash" (uses cashAmount). */
  type: string
  /** FK to Currencies — denomination for price / cash amount. */
  currencyId?: number
  fuelTypeId: number
  givenLiter: number
  price: number
  usdAmount: number
  /** Local-currency cash advanced to the customer (Type === "Cash"). */
  cashAmount: number
  remark?: string | null
  stationId: number
  businessId: number
  date: string
}

export interface CustomerFuelGivenCustomer {
  id: number
  name: string
  phone: string
  totalDue: number
  totalPaid: number
  balance: number
  lastDate: string
  stationId: number
  businessId: number
}

export interface CustomerIdentityWriteRequest {
  name: string
  phone?: string
}

export interface CustomerWriteRequest {
  name: string
  phone?: string
  stationId?: number
  businessId?: number
}

export interface Account {
  id: number
  name: string
  code: string
  chartsOfAccountsId: number
  chartsOfAccounts?: ChartsOfAccounts
  parentAccountId?: number | null
  /** Null = global chart parent; otherwise scoped to that business. */
  businessId?: number | null
}

export interface AccountWriteRequest {
  name: string
  code: string
  chartsOfAccountsId: number
  parentAccountId?: number | null
  businessId?: number | null
}

export interface ChartsOfAccounts {
  id: number
  type: string
}

export interface JournalEntryLine {
  id: number
  journalEntryId: number
  accountId: number
  debit: number
  credit: number
  remark?: string | null
  /** Subledger: CustomerFuelGivens id for AR lines. */
  customerId?: number | null
  supplierId?: number | null
  customer?: Pick<CustomerFuelGiven, 'id' | 'name' | 'phone'> | null
  supplier?: Pick<Supplier, 'id' | 'name'> | null
}

export interface JournalEntry {
  id: number
  date: string
  description: string
  businessId: number
  userId: number
  stationId?: number | null
  /** Normal / Adjusting / Closing / RecurringAuto — API may send byte or camelCase enum string. */
  entryKind?: number | string
  lines: JournalEntryLine[]
}

export interface ProfitLossAccountRow {
  code: string
  name: string
  amount: number
}

export interface ProfitLossReportDto {
  incomeAccounts: ProfitLossAccountRow[]
  incomeTotal: number
  cogsAccounts: ProfitLossAccountRow[]
  cogsTotal: number
  expenseAccounts: ProfitLossAccountRow[]
  expenseTotal: number
  grossProfit: number
  netOrdinaryIncome: number
  netIncome: number
}

export interface BalanceSheetAccountRow {
  code: string
  name: string
  balance: number
}

export interface BalanceSheetReportDto {
  assets: number
  liabilities: number
  equity: number
  /** Unclosed earnings plug; 0 when already in equity or post-closing view. */
  netIncome?: number
  liabilitiesAndEquity: number
  assetAccounts: BalanceSheetAccountRow[]
  liabilityAccounts: BalanceSheetAccountRow[]
  equityAccounts: BalanceSheetAccountRow[]
}

export interface CapitalStatementEquityRow {
  accountId: number
  code: string
  name: string
  beginning: number
  change: number
  ending: number
}

export interface CapitalStatementReportDto {
  equityRows: CapitalStatementEquityRow[]
  /** Owner drawings accounts (32xx / name contains "drawing") with activity in the period. */
  drawingRows?: CapitalStatementEquityRow[]
  totalBeginning: number
  totalChange: number
  totalEnding: number
  netIncome: number
  /** Sum of [drawingRows] (legacy aggregate fields). */
  drawingsBeginning: number
  drawingsChange: number
  drawingsEnding: number
}

export interface ReportPeriodViewDto {
  incomeStatement: {
    incomeAccounts: ProfitLossAccountRow[]
    cogsAccounts: ProfitLossAccountRow[]
    expenseAccounts: ProfitLossAccountRow[]
    sales: number
    cogs: number
    grossProfit: number
    totalExpense: number
    netIncome: number
  }
  balanceSheet: {
    totalAsset: number
    totalEquity: number
    netIncome: number
    assets: BalanceSheetAccountRow[]
    liabilities: BalanceSheetAccountRow[]
    equity: BalanceSheetAccountRow[]
  }
  cashFlowStatement: {
    /** When present, cash flow is direct-method from journal cash/bank legs. */
    method?: 'direct' | string
    openingCashBalance?: number
    directDetails?: {
      lineKey: string
      accountCode: string
      accountName: string
      amount: number
    }[]
    operatingActivities?: {
      description: string
      code: string
      name: string
      amount: number
    }[]
    investingActivities?: {
      description: string
      code: string
      name: string
      amount: number
    }[]
    financingActivities?: {
      description: string
      code: string
      name: string
      amount: number
    }[]
    receivedAccounts: ProfitLossAccountRow[]
    paidAccounts: ProfitLossAccountRow[]
    cashReceivedFromFuelSales: number
    cashPaidForExpense: number
    netCashFromOperating: number
    netCashFromInvesting?: number
    netCashFromFinancing?: number
    netIncreaseInCash?: number
    endingCashBalance?: number
  }
}

export interface AccountingDashboardKpiDto {
  totalRevenue: number
  netProfit: number
  totalExpenses: number
  cashBalance: number
  bankBalance: number
  inventoryValue: number
}

export interface AccountingDashboardPlBarDto {
  label: string
  revenue: number
  expenses: number
  profit: number
}

export interface AccountingDashboardPlCompareDto {
  thisMonth: AccountingDashboardPlBarDto
  previousMonth: AccountingDashboardPlBarDto
}

export interface AccountingDashboardCashFlowDto {
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netCashChange: number
}

export interface AccountingDashboardCashTrendPointDto {
  label: string
  netCashChange: number
}

export interface AccountingDashboardExpenseBreakdownDto {
  salaries: number
  rent: number
  utilities: number
  supplies: number
  other: number
}

export interface AccountingDashboardRecentLineDto {
  journalEntryId: number
  kind: string
  date: string
  account: string
  accountCode?: string | null
  amount: number
  description?: string | null
}

export interface AccountingDashboardRecentTransactionsPagedDto {
  items: AccountingDashboardRecentLineDto[]
  totalCount: number
  page: number
  pageSize: number
}

export interface AccountingDashboardAlertDto {
  code: string
  message: string
  severity: string
}

export interface AccountingDashboardOverviewDto {
  asOfDate: string
  businessId: number
  stationId: number | null
  kpis: AccountingDashboardKpiDto
  profitLossCompare: AccountingDashboardPlCompareDto
  cashFlowThisMonth: AccountingDashboardCashFlowDto
  cashTrend: AccountingDashboardCashTrendPointDto[]
  expenseBreakdownThisMonth: AccountingDashboardExpenseBreakdownDto
  recentTransactions: AccountingDashboardRecentLineDto[]
  alerts: AccountingDashboardAlertDto[]
}

export interface JournalEntryLineWriteRequest {
  accountId: number
  debit: string
  credit: string
  remark?: string
  customerId?: number | null
  supplierId?: number | null
}

export interface JournalEntryWriteRequest {
  date?: string
  description: string
  businessId?: number
  stationId?: number | null
  /** 0 Normal, 1 Adjusting, 2 Closing, 3 RecurringAuto (optional). */
  entryKind?: number
  lines: JournalEntryLineWriteRequest[]
}

/** PATCH api/JournalEntries/{id}/description — updates header fields; lines and amounts unchanged. */
export interface JournalEntryDescriptionPatchRequest {
  description: string
  date?: string
  /** 0 Normal, 1 Adjusting, 2 Closing */
  entryKind?: number
}

export interface CustomerPayment {
  id: number
  customerId: number
  referenceNo?: string | null
  /** "Charged" | "Payment" */
  description: string
  customerName?: string
  customerPhone?: string
  chargedAmount: number
  amountPaid: number
  balance: number
  paymentDate: string
  businessId: number
  userId: number
  /** Set on list API responses */
  userName?: string | null
  /** Customer-level remaining (sum charged - sum paid for this customer); list API */
  remainingBalance?: number | null
  /** Paid | Half-paid | Unpaid | — (list API) */
  paymentStatus?: string | null
}

export interface CustomerPaymentWriteRequest {
  customerId: number
  amountPaid: string
  paymentDate?: string
  businessId?: number
}

/** GET CustomerPayments/preview-balance */
export interface CustomerPaymentPreviewBalance {
  name: string
  phone: string
  totalDue: number
  totalPaid: number
  balance: number
}

/** GET CustomerFuelGivens/outstanding — one row per customer with positive ledger balance */
export interface OutstandingCustomerFuelGivenRow {
  customerId: number
  /** Same as customerId; kept for backward compatibility. */
  id: number
  name: string
  phone: string
  totalDue: number
  totalPaid: number
  balance: number
  date: string
  stationId: number
}

export interface ExpenseWriteRequest {
  type: 'Expense' | 'Exchange' | 'cashOrUsdTaken'
  sideAction: 'Operation' | 'Management'
  description: string
  currencyId: number
  localAmount: string
  rate: string
  amountUsd: string
  /** Required for Operation entries; null/omit for Management entries. */
  stationId: number | null
  businessId?: number
  /** Posting date (ISO); maps to API `date`. */
  date?: string
}

export interface InventoryWriteRequest {
  nozzleId: number
  stationId: number
  openingLiters: string
  closingLiters: string
  sspLiters: string
  usdLiters: string
  recordedAt?: string
  businessId?: number
}

export interface RateWriteRequest {
  rateNumber: string
  active: boolean
  businessId?: number
}

export interface GeneratorUsageWriteRequest {
  ltrUsage: string
  stationId: number
  fuelTypeId: number
  businessId?: number
  /** Posting date (ISO); maps to API `date`. */
  date?: string
}

export interface CustomerFuelGivenWriteRequest {
  /** When set, server binds to this customer (POST) or validates (PUT). */
  customerId?: number
  name: string
  phone: string
  /** "Fuel" (default) or "Cash". Backend ignores fuel fields when "Cash" and vice versa. */
  type?: 'Fuel' | 'Cash'
  /** FK to Currencies; omit or 0 to let the server default (e.g. SSP). */
  currencyId?: number
  fuelTypeId: number
  givenLiter: string
  price: string
  amountUsd?: string
  /** Provide when type === "Cash". */
  cashAmount?: string
  remark?: string
  stationId: number
  businessId?: number
  date?: string
}

/** GET OperationReports/customer-report */
export interface CustomerReportRowDto {
  id: number
  customerId: number
  name: string
  phone: string
  description: string
  type?: string | null
  fuelTypeId?: number | null
  fuelTypeName?: string | null
  liters?: number | null
  price?: number | null
  cashTaken: number
  charged: number
  paid: number
  balance: number
  date: string
  referenceNo?: string | null
}

export interface CustomerReportDto {
  from: string
  to: string
  customerId: number
  customerName?: string | null
  customerPhone?: string | null
  rows: CustomerReportRowDto[]
  totalCharged: number
  totalCashTaken: number
  totalLiters: number
  totalPaid: number
  balance: number
}

/** GET OperationReports/customers — distinct customers (name+phone) for a business */
export interface CustomerOption {
  customerId: number
  name: string
  phone: string
  lastDate: string
}

export interface Employee {
  id: number
  name: string
  phone: string
  email: string
  address: string
  position: string
  baseSalary: number
  isActive: boolean
  businessId: number
  stationId: number | null
}

export interface EmployeeWriteRequest {
  name: string
  phone?: string
  email?: string
  address?: string
  position?: string
  baseSalary: string
  isActive: boolean
  businessId?: number
  stationId?: number | null
}

export interface EmployeeOption {
  id: number
  name: string
  phone: string
  position: string
  baseSalary: number
  stationId: number | null
  /** True when a Salary accrual already exists for this employee in the requested payroll period. */
  hasSalaryForPeriod?: boolean
}

export interface EmployeePayment {
  id: number
  employeeId: number
  referenceNo?: string | null
  description: string
  chargedAmount: number
  paidAmount: number
  balance: number
  paymentDate: string
  periodLabel?: string | null
  businessId: number
  userId: number
  stationId: number | null
  userName?: string | null
  employeeName?: string | null
  remainingBalance?: number | null
}

export interface EmployeePaymentWriteRequest {
  employeeId: number
  description?: string
  amountPaid: string
  chargedAmount?: string
  paymentDate?: string
  periodLabel?: string
  businessId?: number
  stationId?: number | null
}

export interface EmployeePaymentPreviewBalance {
  employeeId: number
  name: string
  phone: string
  position: string
  baseSalary: number
  totalDue: number
  totalPaid: number
  balance: number
}

export interface PayrollRunItem {
  employeeId: number
  chargedAmount: string
  amountPaid: string
  excluded: boolean
}

export interface PayrollRunWriteRequest {
  period: string
  paymentDate?: string
  businessId: number
  stationId?: number | null
  items: PayrollRunItem[]
}

export interface PayrollRunResult {
  period: string
  paymentDate: string
  stationId: number | null
  createdRowCount: number
  paidEmployeeCount: number
  totalCharged: number
  totalPaid: number
  rows: EmployeePayment[]
  skippedEmployeeCount?: number
  skippedEmployees?: { employeeId: number; name: string; reason: string }[]
}

export interface PayrollEmployeeStatusRow {
  employeeId: number
  name: string
  phone: string
  position: string
  stationId: number | null
  baseSalary: number
  totalCharged: number
  totalPaid: number
  balance: number
  lastPaymentDate?: string | null
}

export interface PayrollStatusReportDto {
  businessId: number
  period: string
  stationId: number | null
  paid: PayrollEmployeeStatusRow[]
  unpaid: PayrollEmployeeStatusRow[]
}

export interface EmployeePaymentHistoryRowDto {
  id: number
  date: string
  description: string
  periodLabel?: string | null
  charged: number
  paid: number
  balance: number
  referenceNo?: string | null
  stationId: number | null
}

export interface EmployeePaymentHistoryDto {
  from: string
  to: string
  employeeId: number
  employeeName: string
  employeePhone: string
  employeePosition: string
  baseSalary: number
  rows: EmployeePaymentHistoryRowDto[]
  totalCharged: number
  totalPaid: number
  outstandingBalance: number
}

export interface PumpWriteRequest {
  pumpNumber: string
  stationId: number
  /** SuperAdmin must set; others can omit (server uses JWT business). */
  businessId?: number
}

export interface NozzleWriteRequest {
  name: string
  pumpId: number
  stationId: number
  businessId?: number
}

export interface DippingPump {
  id: number
  nozzleId: number
  dippingId: number
  stationId: number
  businessId: number
  userId: number
}

export interface DippingPumpWriteRequest {
  nozzleId: number
  dippingId: number
  stationId: number
  businessId?: number
}

export interface Station {
  id: number
  name: string
  address: string
  isActive: boolean
  businessId: number
  userId: number
}

export interface StationWriteRequest {
  name: string
  address: string
  isActive: boolean
  /** SuperAdmin must set; others can omit (server uses JWT business). */
  businessId?: number
}

export interface Dipping {
  id: number
  name: string
  fuelTypeId: number
  amountLiter: number
  stationId: number
  businessId: number
  userId: number
}

export interface DippingWriteRequest {
  name: string
  fuelTypeId: number
  amountLiter: string
  stationId: number
  businessId?: number
}

export type LiterFlowType = 'In' | 'Out'

export interface LiterReceived {
  id: number
  createdAt?: string
  updatedAt?: string
  /** Business date for the movement (server). */
  date?: string
  /** In = delivery into station; Out = transfer out to another station. */
  type: string
  targo: string
  driverName: string
  /** Legacy; often mirrors driver name. */
  name: string
  fuelTypeId: number
  receivedLiter: number
  stationId: number
  toStationId?: number | null
  /** In (delivery): optional origin station (same business). */
  fromStationId?: number | null
  businessId: number
  userId: number
}

export interface LiterReceivedWriteRequest {
  type: LiterFlowType
  targo: string
  driverName: string
  fuelTypeId: number
  receivedLiter: string
  /** SuperAdmin In (receiving) or Out (sending). Ignored for staff In when JWT has station. */
  stationId: number
  /** Required for Out: destination station. */
  toStationId?: number
  /** Optional for In: origin station; omit or null if unknown. */
  fromStationId?: number | null
  businessId?: number
  /** Maps to API `recordedAt`. */
  recordedAt?: string
  /** Out: confirm a pending business pool transfer as received at destination. */
  confirmBusinessPoolTransferReceived?: boolean
  /** Out: pending transfer id when confirming receipt. */
  confirmTransferInventoryId?: number | null
}

export interface Supplier {
  id: number
  name: string
  phone: string
  address: string
  email: string
  businessId: number
  createdAt: string
  updatedAt: string
}

export interface SupplierWriteRequest {
  name: string
  phone: string
  address?: string
  email?: string
  businessId?: number
}

export interface Purchase {
  id: number
  supplierId: number
  invoiceNo: string
  businessId: number
  purchaseDate: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseItem {
  id: number
  purchaseId: number
  fuelTypeId: number
  liters: number
  pricePerLiter: number
  totalAmount: number
  /** Soft-deleted line; saving an edit restores it. */
  isDeleted?: boolean
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[]
}

export interface PurchaseLineWrite {
  fuelTypeId: number
  liters: string
  pricePerLiter: string
  totalAmount: string
}

/** Create purchase; optional line items (usually empty—items added on detail page). */
export interface PurchaseWriteRequest {
  supplierId: number
  invoiceNo: string
  items?: PurchaseLineWrite[]
  purchaseDate?: string
  businessId?: number
}

/** Update purchase header only (no line items). */
export interface PurchaseHeaderWriteRequest {
  supplierId: number
  invoiceNo: string
  purchaseDate?: string
  businessId?: number
}

export interface SupplierPayment {
  id: number
  referenceNo?: string | null
  supplierId: number
  description: string
  chargedAmount: number
  paidAmount: number
  balance: number
  purchaseId?: number | null
  date: string
  businessId: number
  userId: number
  createdAt: string
  updatedAt: string
}

export interface SupplierPaymentWriteRequest {
  supplierId: number
  amount: string
  date?: string
  businessId?: number
}

export interface SupplierReportRowDto {
  id: number
  name: string
  description: string
  liters: number | null
  amount: number
  paid: number
  balance: number
  date: string
  purchaseId: number | null
  referenceNo?: string | null
}

export interface SupplierReportDto {
  from: string
  to: string
  supplierId?: number | null
  supplierName?: string | null
  rows: SupplierReportRowDto[]
  totalCharged: number
  totalPaid: number
  balance: number
}

export interface BulkPermissionItem {
  menuId: number
  subMenuId?: number | null
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface AuthResponse {
  accessToken: string
  userId: number
  name: string
  email: string
  role: string
  expiresAtUtc: string
  businessId?: number | null
  stationId?: number | null
  isSupportPool?: boolean
  businessInactive?: boolean
}

/** Business-level fuel pool (separate from nozzle / dipping inventory). */
export interface BusinessFuelInventoryBalance {
  id: number
  businessId: number
  fuelTypeId: number
  fuelName: string
  liters: number
}

export interface BusinessFuelInventoryCredit {
  id: number
  businessId: number
  fuelTypeId: number
  fuelName: string
  liters: number
  date: string
  creatorId: number
  creatorName?: string | null
  reference: string
  note?: string | null
}

export type TransferInventoryStatus = 'pending' | 'received'

export interface TransferInventory {
  id: number
  businessFuelInventoryId: number
  businessId: number
  fuelTypeId: number
  fuelName: string
  toStationId: number
  stationName: string
  liters: number
  date: string
  creatorId: number
  creatorName?: string | null
  note?: string | null
  /** Present once API is migrated; treat missing as pending. */
  status?: TransferInventoryStatus
}

export interface TransferPendingConfirm {
  id: number
  liters: number
  date: string
  fuelName: string
  stationName: string
}

export interface AppNotificationItem {
  id: number
  businessId: number
  stationId: number
  stationName: string
  title: string
  body: string
  createdAt: string
  isRead: boolean
  transferInventoryId?: number | null
  confirmedByName?: string | null
  liters: number
  fuelName: string
  transferDate: string
}

export interface TransferInventoryAudit {
  id: number
  transferInventoryId: number
  action: string
  changedAt: string
  changedByUserId: number
  changedByName?: string | null
  toStationId: number
  liters: number
  date: string
  reason?: string | null
  businessId: number
}

/** Business-wide transfer audit rows (table on Transfer audit trail page). */
export interface TransferInventoryAuditListRow {
  id: number
  transferInventoryId: number
  action: string
  changedAt: string
  changedByUserId: number
  changedByName?: string | null
  toStationId: number
  liters: number
  date: string
  reason?: string | null
  businessId: number
  fuelName: string
  stationName: string
}
