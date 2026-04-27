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
  date: string
  description: string
  currencyCode: string
  localAmount: number
  rate: number
  amountUsd: number
  userId: number
  businessId: number
  stationId: number
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
  stationId: number
}

export interface CashOutDailyReportDto {
  lines: CashOutDailyLineDto[]
  totalCashOut: number
  /** Sum of line USD amounts; optional for older API responses. */
  totalCashOutUsd?: number
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
  name: string
  phone: string
  fuelTypeId: number
  givenLiter: number
  price: number
  usdAmount: number
  remark?: string | null
  stationId: number
  businessId: number
  date: string
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
  liabilitiesAndEquity: number
  assetAccounts: BalanceSheetAccountRow[]
  liabilityAccounts: BalanceSheetAccountRow[]
  equityAccounts: BalanceSheetAccountRow[]
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
  lines: JournalEntryLineWriteRequest[]
}

export interface CustomerPayment {
  id: number
  customerFuelGivenId: number
  amountPaid: number
  paymentDate: string
  businessId: number
  userId: number
  /** Set on list API responses */
  userName?: string | null
  /** Remaining on linked fuel given (list API) */
  remainingBalance?: number | null
  /** Paid | Half-paid | Unpaid | — (list API) */
  paymentStatus?: string | null
}

export interface CustomerPaymentWriteRequest {
  customerFuelGivenId: number
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

/** GET CustomerFuelGivens/outstanding — rows still owing money */
export interface OutstandingCustomerFuelGivenRow {
  id: number
  name: string
  phone: string
  totalDue: number
  totalPaid: number
  balance: number
  date: string
  stationId: number
  fuelTypeId: number
  givenLiter: number
  price: number
  usdAmount: number
}

export interface ExpenseWriteRequest {
  description: string
  currencyCode: string
  localAmount: string
  rate: string
  amountUsd: string
  stationId: number
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
  name: string
  phone: string
  fuelTypeId: number
  givenLiter: string
  price: string
  amountUsd?: string
  remark?: string
  stationId: number
  businessId?: number
  date?: string
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
  status: 'Paid' | 'Half-paid' | 'Unpaid'
  amountPaid: number
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
  status?: 'Paid' | 'Half-paid' | 'Unpaid'
  amountPaid?: string
  businessId?: number
}

/** Update purchase header only (no line items). */
export interface PurchaseHeaderWriteRequest {
  supplierId: number
  invoiceNo: string
  purchaseDate?: string
  status?: 'Paid' | 'Half-paid' | 'Unpaid'
  amountPaid?: string
  businessId?: number
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
}
