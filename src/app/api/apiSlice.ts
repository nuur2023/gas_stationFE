import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { logout, setSupportsPool } from '../authSlice'
import type {
  AuthResponse,
  Account,
  ChartsOfAccounts,
  AccountWriteRequest,
  BulkPermissionItem,
  Business,
  BusinessUser,
  Currency,
  CustomerFuelGiven,
  CustomerFuelGivenCustomer,
  CustomerIdentityWriteRequest,
  CustomerWriteRequest,
  CustomerFuelGivenWriteRequest,
  OutstandingCustomerFuelGivenRow,
  CustomerOption,
  CustomerPayment,
  CustomerPaymentPreviewBalance,
  CustomerPaymentWriteRequest,
  CustomerReportDto,
  Employee,
  EmployeeOption,
  EmployeePayment,
  EmployeePaymentHistoryDto,
  EmployeePaymentPreviewBalance,
  EmployeePaymentWriteRequest,
  EmployeeWriteRequest,
  Expense,
  ExpenseWriteRequest,
  Dipping,
  DippingWriteRequest,
  FuelType,
  FuelTypeWriteRequest,
  FuelPrice,
  FuelPriceWriteRequest,
  GeneratorUsage,
  GeneratorUsageWriteRequest,
  JournalEntry,
  JournalEntryDescriptionPatchRequest,
  JournalEntryWriteRequest,
  ProfitLossReportDto,
  BalanceSheetReportDto,
  CapitalStatementReportDto,
  ReportPeriodViewDto,
  AccountingDashboardOverviewDto,
  AccountingDashboardRecentTransactionsPagedDto,
  CashOutDailyReportDto,
  DailySummaryReportDto,
  DailyFuelGivenRowDto,
  DailyStationReportDto,
  Inventory,
  InventoryBatchCreateResponse,
  InventorySaleDetail,
  InventoryWriteRequest,
  LatestInventoryForPump,
  LiterReceived,
  LiterReceivedWriteRequest,
  AppNotificationItem,
  TransferPendingConfirm,
  Menu,
  PayrollRunResult,
  PayrollRunWriteRequest,
  PayrollStatusReportDto,
  Purchase,
  PurchaseHeaderWriteRequest,
  PurchaseItem,
  PurchaseLineWrite,
  PurchaseWithItems,
  PurchaseWriteRequest,
  SupplierPayment,
  SupplierPaymentWriteRequest,
  SupplierReportDto,
  PagedResult,
  BusinessFuelInventoryBalance,
  BusinessFuelInventoryCredit,
  TransferInventory,
  TransferInventoryAudit,
  TransferInventoryAuditListRow,
  Permission,
  PermissionMeResponse,
  Pump,
  PumpWriteRequest,
  NozzleWriteRequest,
  DippingPump,
  DippingPumpWriteRequest,
  NozzleStationRow,
  NozzleForPumpRow,
  Rate,
  RateWriteRequest,
  Role,
  Supplier,
  SupplierWriteRequest,
  Station,
  StationWriteRequest,
  SubMenu,
  User,
} from '../../types/models'

function normalizePurchaseItemRow(row: unknown): PurchaseItem {
  if (row == null || typeof row !== 'object') {
    return {
      id: 0,
      purchaseId: 0,
      fuelTypeId: 0,
      liters: 0,
      pricePerLiter: 0,
      totalAmount: 0,
      isDeleted: false,
    }
  }
  const r = row as Record<string, unknown>
  return {
    id: Number(r.id ?? r.Id ?? 0),
    purchaseId: Number(r.purchaseId ?? r.PurchaseId ?? 0),
    fuelTypeId: Number(r.fuelTypeId ?? r.FuelTypeId ?? 0),
    liters: Number(r.liters ?? r.Liters ?? 0),
    pricePerLiter: Number(r.pricePerLiter ?? r.PricePerLiter ?? 0),
    totalAmount: Number(r.totalAmount ?? r.TotalAmount ?? 0),
    isDeleted: Boolean(r.isDeleted ?? r.IsDeleted),
  }
}

function normalizePurchaseWithItems(raw: unknown): PurchaseWithItems {
  const o = raw as Partial<PurchaseWithItems> & { Items?: unknown[] } & Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizePurchaseItemRow) : []
  return {
    ...(o as PurchaseWithItems),
    items,
  }
}

function normalizeSupplierPaymentRow(raw: unknown): SupplierPayment {
  if (raw == null || typeof raw !== 'object') {
    return {
      id: 0,
      referenceNo: null,
      supplierId: 0,
      description: 'Payment',
      chargedAmount: 0,
      paidAmount: 0,
      balance: 0,
      purchaseId: null,
      date: '',
      businessId: 0,
      userId: 0,
      createdAt: '',
      updatedAt: '',
    }
  }
  const r = raw as Record<string, unknown>
  return {
    id: Number(r.id ?? r.Id ?? 0),
    referenceNo: (r.referenceNo ?? r.ReferenceNo) as string | null | undefined,
    supplierId: Number(r.supplierId ?? r.SupplierId ?? 0),
    description: String(r.description ?? r.Description ?? 'Payment'),
    chargedAmount: Number(r.chargedAmount ?? r.ChargedAmount ?? r.amount ?? r.Amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.PaidAmount ?? 0),
    balance: Number(r.balance ?? r.Balance ?? 0),
    purchaseId: (r.purchaseId ?? r.PurchaseId) != null ? Number(r.purchaseId ?? r.PurchaseId) : null,
    date: String(r.date ?? r.Date ?? ''),
    businessId: Number(r.businessId ?? r.BusinessId ?? 0),
    userId: Number(r.userId ?? r.UserId ?? 0),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? ''),
    updatedAt: String(r.updatedAt ?? r.UpdatedAt ?? ''),
  }
}

function normalizeSupplierPaymentsPaged(raw: unknown): PagedResult<SupplierPayment> {
  const o = raw as Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeSupplierPaymentRow) : []
  return {
    items,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0),
    page: Number(o.page ?? o.Page ?? 1),
    pageSize: Number(o.pageSize ?? o.PageSize ?? 50),
  }
}

function normalizeCustomerPaymentRow(raw: unknown): CustomerPayment {
  const x = (raw as Record<string, unknown>) ?? {}
  const customer = ((x.customer ?? x.Customer) as Record<string, unknown> | undefined) ?? {}
  return {
    id: Number(x.id ?? x.Id ?? 0),
    customerId: Number(x.customerId ?? x.CustomerId ?? 0),
    referenceNo: (x.referenceNo ?? x.ReferenceNo) as string | null | undefined,
    description: String(x.description ?? x.Description ?? 'Payment'),
    customerName: String(x.customerName ?? x.CustomerName ?? customer.name ?? customer.Name ?? ''),
    customerPhone: String(x.customerPhone ?? x.CustomerPhone ?? customer.phone ?? customer.Phone ?? ''),
    chargedAmount: Number(x.chargedAmount ?? x.ChargedAmount ?? 0),
    amountPaid: Number(x.amountPaid ?? x.AmountPaid ?? 0),
    balance: Number(x.balance ?? x.Balance ?? 0),
    paymentDate: String(x.paymentDate ?? x.PaymentDate ?? ''),
    businessId: Number(x.businessId ?? x.BusinessId ?? 0),
    userId: Number(x.userId ?? x.UserId ?? 0),
    userName: (x.userName ?? x.UserName) as string | null | undefined,
    remainingBalance:
      (x.remainingBalance ?? x.RemainingBalance) == null
        ? null
        : Number(x.remainingBalance ?? x.RemainingBalance),
    paymentStatus: (x.paymentStatus ?? x.PaymentStatus) as string | null | undefined,
  }
}

function normalizeCustomerPaymentsPaged(raw: unknown): PagedResult<CustomerPayment> {
  const o = raw as Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeCustomerPaymentRow) : []
  return {
    items,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0),
    page: Number(o.page ?? o.Page ?? 1),
    pageSize: Number(o.pageSize ?? o.PageSize ?? 50),
  }
}

function normalizeCustomerFuelGivenRow(raw: unknown): CustomerFuelGiven {
  const x = (raw as Record<string, unknown>) ?? {}
  const customer = ((x.customer ?? x.Customer) as Record<string, unknown> | undefined) ?? {}
  const currencyIdNum = Number(x.currencyId ?? x.CurrencyId ?? 0)
  const customerIdNum = Number(x.customerId ?? x.CustomerId ?? customer.id ?? customer.Id ?? 0)
  return {
    id: Number(x.id ?? x.Id ?? 0),
    customerId: customerIdNum > 0 ? customerIdNum : undefined,
    name: String(x.name ?? x.Name ?? customer.name ?? customer.Name ?? ''),
    phone: String(x.phone ?? x.Phone ?? customer.phone ?? customer.Phone ?? ''),
    type: String(x.type ?? x.Type ?? 'Fuel'),
    currencyId: currencyIdNum > 0 ? currencyIdNum : undefined,
    fuelTypeId: Number(x.fuelTypeId ?? x.FuelTypeId ?? 0),
    givenLiter: Number(x.givenLiter ?? x.GivenLiter ?? 0),
    price: Number(x.price ?? x.Price ?? 0),
    usdAmount: Number(x.usdAmount ?? x.UsdAmount ?? 0),
    cashAmount: Number(x.cashAmount ?? x.CashAmount ?? 0),
    remark: (x.remark ?? x.Remark) as string | null | undefined,
    stationId: Number(x.stationId ?? x.StationId ?? 0),
    businessId: Number(x.businessId ?? x.BusinessId ?? 0),
    date: String(x.date ?? x.Date ?? ''),
  }
}

function normalizeCustomerFuelGivensPaged(raw: unknown): PagedResult<CustomerFuelGiven> {
  const o = raw as Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeCustomerFuelGivenRow) : []
  return {
    items,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0),
    page: Number(o.page ?? o.Page ?? 1),
    pageSize: Number(o.pageSize ?? o.PageSize ?? 50),
  }
}

function normalizeEmployeeRow(raw: unknown): Employee {
  const x = (raw as Record<string, unknown>) ?? {}
  const sid = x.stationId ?? x.StationId
  return {
    id: Number(x.id ?? x.Id ?? 0),
    name: String(x.name ?? x.Name ?? ''),
    phone: String(x.phone ?? x.Phone ?? ''),
    email: String(x.email ?? x.Email ?? ''),
    address: String(x.address ?? x.Address ?? ''),
    position: String(x.position ?? x.Position ?? ''),
    baseSalary: Number(x.baseSalary ?? x.BaseSalary ?? 0),
    isActive: Boolean(x.isActive ?? x.IsActive ?? true),
    businessId: Number(x.businessId ?? x.BusinessId ?? 0),
    stationId: sid == null ? null : Number(sid),
  }
}

function normalizeEmployeesPaged(raw: unknown): PagedResult<Employee> {
  const o = raw as Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeEmployeeRow) : []
  return {
    items,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0),
    page: Number(o.page ?? o.Page ?? 1),
    pageSize: Number(o.pageSize ?? o.PageSize ?? 50),
  }
}

function normalizeEmployeePaymentRow(raw: unknown): EmployeePayment {
  const x = (raw as Record<string, unknown>) ?? {}
  const sid = x.stationId ?? x.StationId
  return {
    id: Number(x.id ?? x.Id ?? 0),
    employeeId: Number(x.employeeId ?? x.EmployeeId ?? 0),
    referenceNo: (x.referenceNo ?? x.ReferenceNo) as string | null | undefined,
    description: String(x.description ?? x.Description ?? 'Payment'),
    chargedAmount: Number(x.chargedAmount ?? x.ChargedAmount ?? 0),
    paidAmount: Number(x.paidAmount ?? x.PaidAmount ?? 0),
    balance: Number(x.balance ?? x.Balance ?? 0),
    paymentDate: String(x.paymentDate ?? x.PaymentDate ?? ''),
    periodLabel: (x.periodLabel ?? x.PeriodLabel) as string | null | undefined,
    businessId: Number(x.businessId ?? x.BusinessId ?? 0),
    userId: Number(x.userId ?? x.UserId ?? 0),
    stationId: sid == null ? null : Number(sid),
    userName: (x.userName ?? x.UserName) as string | null | undefined,
    employeeName: (x.employeeName ?? x.EmployeeName) as string | null | undefined,
    remainingBalance:
      (x.remainingBalance ?? x.RemainingBalance) == null
        ? null
        : Number(x.remainingBalance ?? x.RemainingBalance),
  }
}

function normalizeEmployeePaymentsPaged(raw: unknown): PagedResult<EmployeePayment> {
  const o = raw as Record<string, unknown>
  const rawItems = o.items ?? o.Items
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeEmployeePaymentRow) : []
  return {
    items,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0),
    page: Number(o.page ?? o.Page ?? 1),
    pageSize: Number(o.pageSize ?? o.PageSize ?? 50),
  }
}

function normalizeEmployeePaymentPreviewBalance(raw: unknown): EmployeePaymentPreviewBalance {
  const x = (raw as Record<string, unknown>) ?? {}
  return {
    employeeId: Number(x.employeeId ?? x.EmployeeId ?? 0),
    name: String(x.name ?? x.Name ?? ''),
    phone: String(x.phone ?? x.Phone ?? ''),
    position: String(x.position ?? x.Position ?? ''),
    baseSalary: Number(x.baseSalary ?? x.BaseSalary ?? 0),
    totalDue: Number(x.totalDue ?? x.TotalDue ?? 0),
    totalPaid: Number(x.totalPaid ?? x.TotalPaid ?? 0),
    balance: Number(x.balance ?? x.Balance ?? 0),
  }
}

function normalizeEmployeePaymentHistoryDto(raw: unknown): EmployeePaymentHistoryDto {
  const o = raw as Record<string, unknown>
  const rowsRaw = o.rows ?? o.Rows ?? []
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((r) => {
        const x = r as Record<string, unknown>
        const sid = x.stationId ?? x.StationId
        return {
          id: Number(x.id ?? x.Id ?? 0),
          date: String(x.date ?? x.Date ?? ''),
          description: String(x.description ?? x.Description ?? ''),
          periodLabel: (x.periodLabel ?? x.PeriodLabel) as string | null | undefined,
          charged: Number(x.charged ?? x.Charged ?? 0),
          paid: Number(x.paid ?? x.Paid ?? 0),
          balance: Number(x.balance ?? x.Balance ?? 0),
          referenceNo: (x.referenceNo ?? x.ReferenceNo) as string | null | undefined,
          stationId: sid == null ? null : Number(sid),
        }
      })
    : []
  return {
    from: String(o.from ?? o.From ?? ''),
    to: String(o.to ?? o.To ?? ''),
    employeeId: Number(o.employeeId ?? o.EmployeeId ?? 0),
    employeeName: String(o.employeeName ?? o.EmployeeName ?? ''),
    employeePhone: String(o.employeePhone ?? o.EmployeePhone ?? ''),
    employeePosition: String(o.employeePosition ?? o.EmployeePosition ?? ''),
    baseSalary: Number(o.baseSalary ?? o.BaseSalary ?? 0),
    rows,
    totalCharged: Number(o.totalCharged ?? o.TotalCharged ?? 0),
    totalPaid: Number(o.totalPaid ?? o.TotalPaid ?? 0),
    outstandingBalance: Number(o.outstandingBalance ?? o.OutstandingBalance ?? 0),
  }
}

function normalizePayrollStatusReportDto(raw: unknown): PayrollStatusReportDto {
  const o = raw as Record<string, unknown>
  const mapRows = (arr: unknown) =>
    Array.isArray(arr)
      ? arr.map((r) => {
          const x = r as Record<string, unknown>
          const sid = x.stationId ?? x.StationId
          return {
            employeeId: Number(x.employeeId ?? x.EmployeeId ?? 0),
            name: String(x.name ?? x.Name ?? ''),
            phone: String(x.phone ?? x.Phone ?? ''),
            position: String(x.position ?? x.Position ?? ''),
            stationId: sid == null ? null : Number(sid),
            baseSalary: Number(x.baseSalary ?? x.BaseSalary ?? 0),
            totalCharged: Number(x.totalCharged ?? x.TotalCharged ?? 0),
            totalPaid: Number(x.totalPaid ?? x.TotalPaid ?? 0),
            balance: Number(x.balance ?? x.Balance ?? 0),
            lastPaymentDate: (x.lastPaymentDate ?? x.LastPaymentDate) as string | null | undefined,
          }
        })
      : []
  const st = o.stationId ?? o.StationId
  return {
    businessId: Number(o.businessId ?? o.BusinessId ?? 0),
    period: String(o.period ?? o.Period ?? ''),
    stationId: st == null ? null : Number(st),
    paid: mapRows(o.paid ?? o.Paid),
    unpaid: mapRows(o.unpaid ?? o.Unpaid),
  }
}

function normalizeEmployeeOptionRow(raw: unknown): EmployeeOption {
  const x = (raw as Record<string, unknown>) ?? {}
  const sid = x.stationId ?? x.StationId
  return {
    id: Number(x.id ?? x.Id ?? 0),
    name: String(x.name ?? x.Name ?? ''),
    phone: String(x.phone ?? x.Phone ?? ''),
    position: String(x.position ?? x.Position ?? ''),
    baseSalary: Number(x.baseSalary ?? x.BaseSalary ?? 0),
    stationId: sid == null ? null : Number(sid),
    hasSalaryForPeriod: Boolean(x.hasSalaryForPeriod ?? x.HasSalaryForPeriod ?? false),
  }
}

function normalizePayrollRunResult(raw: unknown): PayrollRunResult {
  const o = raw as Record<string, unknown>
  const rowsRaw = o.rows ?? o.Rows ?? []
  const rows = Array.isArray(rowsRaw) ? rowsRaw.map(normalizeEmployeePaymentRow) : []
  const st = o.stationId ?? o.StationId
  const skippedRaw = o.skippedEmployees ?? o.SkippedEmployees
  const skippedEmployees = Array.isArray(skippedRaw)
    ? skippedRaw.map((s) => {
        const r = s as Record<string, unknown>
        return {
          employeeId: Number(r.employeeId ?? r.EmployeeId ?? 0),
          name: String(r.name ?? r.Name ?? ''),
          reason: String(r.reason ?? r.Reason ?? ''),
        }
      })
    : undefined
  return {
    period: String(o.period ?? o.Period ?? ''),
    paymentDate: String(o.paymentDate ?? o.PaymentDate ?? ''),
    stationId: st == null ? null : Number(st),
    createdRowCount: Number(o.createdRowCount ?? o.CreatedRowCount ?? 0),
    paidEmployeeCount: Number(o.paidEmployeeCount ?? o.PaidEmployeeCount ?? 0),
    totalCharged: Number(o.totalCharged ?? o.TotalCharged ?? 0),
    totalPaid: Number(o.totalPaid ?? o.TotalPaid ?? 0),
    rows,
    skippedEmployeeCount:
      o.skippedEmployeeCount != null || o.SkippedEmployeeCount != null
        ? Number(o.skippedEmployeeCount ?? o.SkippedEmployeeCount ?? 0)
        : skippedEmployees?.length,
    skippedEmployees,
  }
}

function normalizeCustomerReportDto(raw: unknown): CustomerReportDto {
  const o = raw as Record<string, unknown>
  const rowsRaw = o.rows ?? o.Rows ?? []
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((r) => {
        const x = r as Record<string, unknown>
        return {
          id: Number(x.id ?? x.Id ?? 0),
          customerId: Number(x.customerId ?? x.CustomerId ?? 0),
          name: String(x.name ?? x.Name ?? ''),
          phone: String(x.phone ?? x.Phone ?? ''),
          description: String(x.description ?? x.Description ?? ''),
          type: (x.type ?? x.Type) as string | null | undefined,
          fuelTypeId: (x.fuelTypeId ?? x.FuelTypeId) == null ? null : Number(x.fuelTypeId ?? x.FuelTypeId),
          fuelTypeName: (x.fuelTypeName ?? x.FuelTypeName) as string | null | undefined,
          liters: (x.liters ?? x.Liters) == null ? null : Number(x.liters ?? x.Liters),
          price: (x.price ?? x.Price) == null ? null : Number(x.price ?? x.Price),
          cashTaken: Number(x.cashTaken ?? x.CashTaken ?? 0),
          charged: Number(x.charged ?? x.Charged ?? 0),
          paid: Number(x.paid ?? x.Paid ?? 0),
          balance: Number(x.balance ?? x.Balance ?? 0),
          date: String(x.date ?? x.Date ?? ''),
          referenceNo: (x.referenceNo ?? x.ReferenceNo) as string | null | undefined,
        }
      })
    : []
  return {
    from: String(o.from ?? o.From ?? ''),
    to: String(o.to ?? o.To ?? ''),
    customerId: Number(o.customerId ?? o.CustomerId ?? 0),
    customerName: (o.customerName ?? o.CustomerName) as string | null | undefined,
    customerPhone: (o.customerPhone ?? o.CustomerPhone) as string | null | undefined,
    rows,
    totalCharged: Number(o.totalCharged ?? o.TotalCharged ?? 0),
    totalCashTaken: Number(o.totalCashTaken ?? o.TotalCashTaken ?? 0),
    totalLiters: Number(o.totalLiters ?? o.TotalLiters ?? 0),
    totalPaid: Number(o.totalPaid ?? o.TotalPaid ?? 0),
    balance: Number(o.balance ?? o.Balance ?? 0),
  }
}

function normalizeSupplierReportDto(raw: unknown): SupplierReportDto {
  const o = raw as Record<string, unknown>
  const rowsRaw = o.rows ?? o.Rows ?? []
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((r) => {
        const x = r as Record<string, unknown>
        return {
          id: Number(x.id ?? x.Id ?? 0),
          name: String(x.name ?? x.Name ?? ''),
          description: String(x.description ?? x.Description ?? ''),
          liters: (x.liters ?? x.Liters) == null ? null : Number(x.liters ?? x.Liters),
          amount: Number(x.amount ?? x.Amount ?? 0),
          paid: Number(x.paid ?? x.Paid ?? 0),
          balance: Number(x.balance ?? x.Balance ?? 0),
          date: String(x.date ?? x.Date ?? ''),
          purchaseId: (x.purchaseId ?? x.PurchaseId) == null ? null : Number(x.purchaseId ?? x.PurchaseId),
          referenceNo: (x.referenceNo ?? x.ReferenceNo) as string | null | undefined,
        }
      })
    : []
  return {
    from: String(o.from ?? o.From ?? ''),
    to: String(o.to ?? o.To ?? ''),
    supplierId: (o.supplierId ?? o.SupplierId) == null ? null : Number(o.supplierId ?? o.SupplierId),
    supplierName: (o.supplierName ?? o.SupplierName) as string | null | undefined,
    rows,
    totalCharged: Number(o.totalCharged ?? o.TotalCharged ?? 0),
    totalPaid: Number(o.totalPaid ?? o.TotalPaid ?? 0),
    balance: Number(o.balance ?? o.Balance ?? 0),
  }
}

export type PagedArg = { page: number; pageSize: number; q?: string }

export type StationsPagedArg = PagedArg & { businessId?: number }

export type InventoriesPagedArg = PagedArg & { filterBusinessId?: number; filterStationId?: number }

export type DippingsPagedArg = PagedArg & { businessId?: number; filterStationId?: number }
export type AccountsPagedArg = PagedArg & { businessId?: number }

export type SuppliersPagedArg = PagedArg & { businessId?: number }
export type EmployeesPagedArg = PagedArg & {
  businessId?: number
  filterStationId?: number
  includeInactive?: boolean
}
export type EmployeePaymentsPagedArg = PagedArg & {
  businessId?: number
  filterStationId?: number
  employeeId?: number
  period?: string
}

export type SupplierPaymentsPagedArg = PagedArg & { businessId?: number }

export type CustomerPaymentsPagedArg = PagedArg & { filterStationId?: number }

/** Date-only strings `yyyy-MM-dd` for `CreatedAt` range (UTC day bounds on the API). */
export type LiterReceivedsPagedArg = PagedArg & { from?: string; to?: string; filterStationId?: number }

/** Workspace station filter (Admin / optional SuperAdmin). */
export type StationScopedPagedArg = PagedArg & { filterStationId?: number }

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL}/api/`,
  prepareHeaders: (headers) => {
    try {
      const raw = localStorage.getItem('gas-auth')
      if (raw) {
        const { token } = JSON.parse(raw) as { token?: string }
        if (token) headers.set('Authorization', `Bearer ${token}`)
      }
    } catch {
      /* ignore */
    }
    return headers
  },
})

const baseQueryWithAutoLogout: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status === 401) {
    api.dispatch(logout())
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
  }
  if (result.error?.status === 403) {
    const data = result.error.data as { code?: string } | undefined
    if (data?.code === 'business_inactive') {
      api.dispatch(logout())
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
  }
  return result
}

export const apiSlice = createApi({
  reducerPath: 'gasApi',
  refetchOnFocus: true,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: true,
  baseQuery: baseQueryWithAutoLogout,
  tagTypes: [
    'Role',
    'User',
    'Business',
    'Menu',
    'SubMenu',
    'Permission',
    'BusinessUser',
    'Expense',
    'Inventory',
    'Rate',
    'GeneratorUsage',
    'Pump',
    'FuelType',
    'Currency',
    'FuelPrice',
    'Station',
    'Dipping',
    'LiterReceived',
    'Supplier',
    'Purchase',
    'SupplierPayment',
    'SupplierReport',
    'CustomerReport',
    'CustomerFuelGiven',
    'Account',
    'JournalEntry',
    'CustomerPayment',
    'ChartsOfAccounts',
    'FinancialReport',
    'BusinessFuelInventory',
    'RecurringJournal',
    'AccountingPeriod',
    'Notification',
    'Employee',
    'EmployeePayment',
    'PayrollReport',
  ],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { emailOrPhone: string; password: string }>({
      query: (body) => ({
        url: 'Auth/login',
        method: 'POST',
        body,
      }),
    }),

    getRoles: builder.query<PagedResult<Role>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Roles',
        params: { page, pageSize, q },
      }),
      providesTags: ['Role'],
    }),
    createRole: builder.mutation<Role, { name: string }>({
      query: (body) => ({ url: 'Roles', method: 'POST', body }),
      invalidatesTags: ['Role'],
    }),
    updateRole: builder.mutation<Role, { id: number; body: Partial<Role> }>({
      query: ({ id, body }) => ({ url: `Roles/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: builder.mutation<void, number>({
      query: (id) => ({ url: `Roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Role'],
    }),

    getUsers: builder.query<PagedResult<User>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Users',
        params: { page, pageSize, q },
      }),
      providesTags: ['User'],
    }),
    createUser: builder.mutation<User, Partial<User>>({
      query: (body) => ({ url: 'Users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<User, { id: number; body: Partial<User> }>({
      query: ({ id, body }) => ({ url: `Users/${id}`, method: 'PUT', body }),
      invalidatesTags: ['User'],
    }),
    deleteUser: builder.mutation<void, number>({
      query: (id) => ({ url: `Users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),

    getBusinesses: builder.query<PagedResult<Business>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Businesses',
        params: { page, pageSize, q },
      }),
      providesTags: ['Business'],
    }),
    createBusiness: builder.mutation<Business, Partial<Business>>({
      query: (body) => ({ url: 'Businesses', method: 'POST', body }),
      invalidatesTags: ['Business', 'Permission'],
    }),
    updateBusiness: builder.mutation<Business, { id: number; body: Partial<Business> }>({
      query: ({ id, body }) => ({ url: `Businesses/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Business', 'Permission'],
    }),
    deleteBusiness: builder.mutation<void, number>({
      query: (id) => ({ url: `Businesses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Business'],
    }),

    getMenus: builder.query<PagedResult<Menu>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Menus',
        params: { page, pageSize, q },
      }),
      providesTags: ['Menu'],
    }),
    createMenu: builder.mutation<Menu, Partial<Menu>>({
      query: (body) => ({ url: 'Menus', method: 'POST', body }),
      invalidatesTags: ['Menu'],
    }),
    updateMenu: builder.mutation<Menu, { id: number; body: Partial<Menu> }>({
      query: ({ id, body }) => ({ url: `Menus/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Menu'],
    }),
    deleteMenu: builder.mutation<void, number>({
      query: (id) => ({ url: `Menus/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Menu'],
    }),

    getMenuTree: builder.query<Menu[], void>({
      query: () => ({ url: 'Menus/tree' }),
      providesTags: ['Menu'],
    }),

    getSubMenus: builder.query<PagedResult<SubMenu>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'SubMenus',
        params: { page, pageSize, q },
      }),
      providesTags: ['SubMenu'],
    }),
    createSubMenu: builder.mutation<SubMenu, Partial<SubMenu>>({
      query: (body) => ({ url: 'SubMenus', method: 'POST', body }),
      invalidatesTags: ['SubMenu', 'Menu'],
    }),
    updateSubMenu: builder.mutation<SubMenu, { id: number; body: Partial<SubMenu> }>({
      query: ({ id, body }) => ({ url: `SubMenus/${id}`, method: 'PUT', body }),
      invalidatesTags: ['SubMenu', 'Menu'],
    }),
    deleteSubMenu: builder.mutation<void, number>({
      query: (id) => ({ url: `SubMenus/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SubMenu', 'Menu'],
    }),

    getPermissions: builder.query<PagedResult<Permission>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Permissions',
        params: { page, pageSize, q },
      }),
      providesTags: ['Permission'],
    }),
    createPermission: builder.mutation<Permission, Partial<Permission>>({
      query: (body) => ({ url: 'Permissions', method: 'POST', body }),
      invalidatesTags: ['Permission'],
    }),
    updatePermission: builder.mutation<Permission, { id: number; body: Partial<Permission> }>({
      query: ({ id, body }) => ({ url: `Permissions/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Permission'],
    }),
    deletePermission: builder.mutation<void, number>({
      query: (id) => ({ url: `Permissions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Permission'],
    }),

    getPermissionContextUsers: builder.query<
      { id: number; name: string; email: string; roleId?: number; roleName?: string | null }[],
      { businessId?: number }
    >({
      query: (arg) => ({
        url: 'Permissions/context-users',
        params:
          arg.businessId != null && arg.businessId > 0 ? { businessId: arg.businessId } : {},
      }),
      providesTags: ['Permission'],
    }),

    getPermissionsByUser: builder.query<Permission[], { userId: number; businessId: number }>({
      query: ({ userId, businessId }) => ({
        url: 'Permissions/by-user',
        params: { userId, businessId },
      }),
      providesTags: ['Permission'],
    }),

    getMyPermissions: builder.query<PermissionMeResponse, void>({
      query: () => ({ url: 'Permissions/me' }),
      providesTags: ['Permission'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (!data.fullAccess) {
            dispatch(setSupportsPool(data.supportsPool !== false))
          }
        } catch {
          /* ignore */
        }
      },
    }),

    savePermissionsBulk: builder.mutation<
      void,
      { userId: number; businessId: number; items: BulkPermissionItem[] }
    >({
      query: (body) => ({ url: 'Permissions/bulk', method: 'POST', body }),
      invalidatesTags: ['Permission'],
    }),

    getBusinessUsers: builder.query<PagedResult<BusinessUser>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'BusinessUsers',
        params: { page, pageSize, q },
      }),
      providesTags: ['BusinessUser'],
    }),
    createBusinessUser: builder.mutation<BusinessUser, Partial<BusinessUser>>({
      query: (body) => ({ url: 'BusinessUsers', method: 'POST', body }),
      invalidatesTags: ['BusinessUser', 'User'],
    }),
    updateBusinessUser: builder.mutation<BusinessUser, { id: number; body: Partial<BusinessUser> }>({
      query: ({ id, body }) => ({ url: `BusinessUsers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['BusinessUser', 'User'],
    }),
    deleteBusinessUser: builder.mutation<void, number>({
      query: (id) => ({ url: `BusinessUsers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BusinessUser', 'User'],
    }),

    getFuelTypes: builder.query<FuelType[], void>({
      query: () => ({ url: 'FuelTypes' }),
      providesTags: ['FuelType'],
    }),
    createFuelType: builder.mutation<FuelType, FuelTypeWriteRequest>({
      query: (body) => ({ url: 'FuelTypes', method: 'POST', body }),
      invalidatesTags: ['FuelType'],
    }),
    updateFuelType: builder.mutation<FuelType, { id: number; body: FuelTypeWriteRequest }>({
      query: ({ id, body }) => ({ url: `FuelTypes/${id}`, method: 'PUT', body }),
      invalidatesTags: ['FuelType'],
    }),
    deleteFuelType: builder.mutation<void, number>({
      query: (id) => ({ url: `FuelTypes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FuelType'],
    }),
    getCurrencies: builder.query<Currency[], void>({
      query: () => ({ url: 'Currencies' }),
      providesTags: ['Currency'],
    }),
    createCurrency: builder.mutation<Currency, Omit<Currency, 'id'>>({
      query: (body) => ({ url: 'Currencies', method: 'POST', body }),
      invalidatesTags: ['Currency'],
    }),
    updateCurrency: builder.mutation<Currency, { id: number; body: Omit<Currency, 'id'> }>({
      query: ({ id, body }) => ({ url: `Currencies/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Currency'],
    }),
    deleteCurrency: builder.mutation<void, number>({
      query: (id) => ({ url: `Currencies/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Currency'],
    }),
    getFuelPrices: builder.query<FuelPrice[], { filterBusinessId?: number; filterStationId?: number } | void>({
      query: (params) => ({ url: 'FuelPrices', params: params ?? undefined }),
      providesTags: ['FuelPrice'],
    }),
    createFuelPrice: builder.mutation<FuelPrice, FuelPriceWriteRequest>({
      query: (body) => ({ url: 'FuelPrices', method: 'POST', body }),
      invalidatesTags: ['FuelPrice'],
    }),
    updateFuelPrice: builder.mutation<FuelPrice, { id: number; body: FuelPriceWriteRequest }>({
      query: ({ id, body }) => ({ url: `FuelPrices/${id}`, method: 'PUT', body }),
      invalidatesTags: ['FuelPrice'],
    }),
    deleteFuelPrice: builder.mutation<void, number>({
      query: (id) => ({ url: `FuelPrices/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FuelPrice'],
    }),

    getPumps: builder.query<
      Pump[],
      { fuelTypeId?: number; businessId?: number; stationId?: number; dippingId?: number }
    >({
      query: (params) => ({
        url: 'Pumps',
        params,
      }),
    }),

    getNozzlesByBusiness: builder.query<NozzleStationRow[], number>({
      query: (businessId) => `Nozzles/by-business/${businessId}`,
      providesTags: ['Pump', 'Inventory'],
    }),

    getNozzlesForPump: builder.query<NozzleForPumpRow[], number>({
      query: (pumpId) => `Nozzles/for-pump/${pumpId}`,
      providesTags: ['Pump'],
    }),
    createNozzle: builder.mutation<NozzleStationRow, NozzleWriteRequest>({
      query: (body) => ({ url: 'Nozzles', method: 'POST', body }),
      invalidatesTags: ['Pump', 'Inventory'],
    }),

    getPumpsPaged: builder.query<PagedResult<Pump>, PagedArg & { filterBusinessId?: number; filterStationId?: number }>({
      query: ({ page, pageSize, q, filterBusinessId, filterStationId }) => ({
        url: 'Pumps',
        params: {
          page,
          pageSize,
          q,
          ...(filterBusinessId != null && filterBusinessId > 0 ? { filterBusinessId } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['Pump'],
    }),

    getExpenses: builder.query<PagedResult<Expense>, StationScopedPagedArg & { type?: string; sideAction?: string }>({
      query: ({ page, pageSize, q, filterStationId, type, sideAction }) => ({
        url: 'Expenses',
        params: {
          page,
          pageSize,
          q,
          ...(type ? { type } : {}),
          ...(sideAction ? { sideAction } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['Expense'],
    }),

    getInventories: builder.query<PagedResult<Inventory>, InventoriesPagedArg>({
      query: ({ page, pageSize, q, filterBusinessId, filterStationId }) => ({
        url: 'Inventories',
        params: {
          page,
          pageSize,
          q,
          ...(filterBusinessId != null && filterBusinessId > 0 ? { filterBusinessId } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['Inventory'],
    }),

    getInventoryLatestByPump: builder.query<LatestInventoryForPump, number>({
      query: (pumpId) => ({ url: `Inventories/latest-by-pump/${pumpId}` }),
      providesTags: ['Inventory'],
    }),

    getInventoryLatestByNozzle: builder.query<LatestInventoryForPump, number>({
      query: (nozzleId) => ({ url: `Inventories/latest-by-nozzle/${nozzleId}` }),
      providesTags: ['Inventory'],
    }),

    getRates: builder.query<PagedResult<Rate>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Rates',
        params: { page, pageSize, q },
      }),
      providesTags: ['Rate'],
    }),

    getGeneratorUsages: builder.query<PagedResult<GeneratorUsage>, StationScopedPagedArg>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'GeneratorUsages',
        params: {
          page,
          pageSize,
          q,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['GeneratorUsage'],
    }),

    getCustomerFuelGivens: builder.query<PagedResult<CustomerFuelGiven>, StationScopedPagedArg>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'CustomerFuelGivens',
        params: {
          page,
          pageSize,
          q,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      transformResponse: normalizeCustomerFuelGivensPaged,
      providesTags: ['CustomerFuelGiven'],
    }),
    getCustomerFuelGivenCustomers: builder.query<PagedResult<CustomerFuelGivenCustomer>, StationScopedPagedArg>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'CustomerFuelGivens/customers',
        params: {
          page,
          pageSize,
          q,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['CustomerFuelGiven'],
    }),
    getCustomerFuelGivenCustomerById: builder.query<CustomerFuelGivenCustomer, number>({
      query: (id) => ({ url: `CustomerFuelGivens/customers/${id}` }),
      providesTags: ['CustomerFuelGiven'],
    }),
    createCustomerFuelGivenCustomer: builder.mutation<CustomerFuelGivenCustomer, CustomerWriteRequest>({
      query: (body) => ({ url: 'CustomerFuelGivens/customers', method: 'POST', body }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport'],
    }),
    getCustomerFuelGivenTransactionsByCustomer: builder.query<CustomerFuelGiven[], number>({
      query: (id) => ({ url: `CustomerFuelGivens/customers/${id}/transactions` }),
      transformResponse: (raw: unknown): CustomerFuelGiven[] =>
        Array.isArray(raw) ? raw.map(normalizeCustomerFuelGivenRow) : [],
      providesTags: ['CustomerFuelGiven'],
    }),
    updateCustomerFuelGivenCustomer: builder.mutation<
      { id: number; name: string; phone: string },
      { id: number; body: CustomerIdentityWriteRequest }
    >({
      query: ({ id, body }) => ({ url: `CustomerFuelGivens/customers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport'],
    }),
    deleteCustomerFuelGivenCustomer: builder.mutation<void, number>({
      query: (id) => ({ url: `CustomerFuelGivens/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport', 'Dipping'],
    }),
    getOutstandingCustomerFuelGivens: builder.query<
      OutstandingCustomerFuelGivenRow[],
      { filterBusinessId?: number; filterStationId?: number }
    >({
      query: (arg) => ({
        url: 'CustomerFuelGivens/outstanding',
        params: {
          ...(arg.filterBusinessId != null && arg.filterBusinessId > 0 ? { filterBusinessId: arg.filterBusinessId } : {}),
          ...(arg.filterStationId != null && arg.filterStationId > 0 ? { filterStationId: arg.filterStationId } : {}),
        },
      }),
      providesTags: ['CustomerFuelGiven', 'CustomerPayment'],
    }),

    getAccounts: builder.query<PagedResult<Account>, AccountsPagedArg>({
      query: ({ page, pageSize, q, businessId }) => ({
        url: 'Accounts',
        params: { page, pageSize, q, businessId },
      }),
      providesTags: ['Account'],
    }),
    getAccountParentCandidates: builder.query<Account[], { businessId: number }>({
      query: ({ businessId }) => ({
        url: 'Accounts/parent-candidates',
        params: { businessId },
      }),
      providesTags: ['Account'],
    }),
    getChartsOfAccounts: builder.query<ChartsOfAccounts[], { businessId?: number }>({
      query: ({ businessId }) => ({
        url: 'ChartsOfAccounts',
        params: { businessId },
      }),
      providesTags: ['ChartsOfAccounts'],
    }),
    createChartsOfAccounts: builder.mutation<ChartsOfAccounts, { type: string }>({
      query: (body) => ({ url: 'ChartsOfAccounts', method: 'POST', body }),
      invalidatesTags: ['ChartsOfAccounts'],
    }),
    updateChartsOfAccounts: builder.mutation<ChartsOfAccounts, { id: number; body: { type: string } }>({
      query: ({ id, body }) => ({ url: `ChartsOfAccounts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['ChartsOfAccounts'],
    }),
    deleteChartsOfAccounts: builder.mutation<void, number>({
      query: (id) => ({ url: `ChartsOfAccounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ChartsOfAccounts'],
    }),
    createAccount: builder.mutation<Account, AccountWriteRequest>({
      query: (body) => ({ url: 'Accounts', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
    updateAccount: builder.mutation<Account, { id: number; body: AccountWriteRequest }>({
      query: ({ id, body }) => ({ url: `Accounts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Account'],
    }),
    deleteAccount: builder.mutation<void, number>({
      query: (id) => ({ url: `Accounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Account'],
    }),
    autoGenerateDefaultParentAccounts: builder.mutation<{ created: number; totalDefaults: number }, void>({
      query: () => ({
        url: 'Accounts/auto-generate-default-parents',
        method: 'POST',
      }),
      invalidatesTags: ['Account'],
    }),

    getJournalEntries: builder.query<PagedResult<JournalEntry>, PagedArg & { filterStationId?: number }>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'JournalEntries',
        params: {
          page,
          pageSize,
          q,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['JournalEntry'],
    }),
    getJournalEntry: builder.query<JournalEntry, number>({
      query: (id) => `JournalEntries/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'JournalEntry', id }],
    }),
    createJournalEntry: builder.mutation<JournalEntry, JournalEntryWriteRequest>({
      query: (body) => ({ url: 'JournalEntries', method: 'POST', body }),
      invalidatesTags: ['JournalEntry', 'FinancialReport'],
    }),
    deleteJournalEntry: builder.mutation<void, number>({
      query: (id) => ({ url: `JournalEntries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['JournalEntry', 'FinancialReport'],
    }),
    patchJournalEntryDescription: builder.mutation<
      JournalEntry,
      { id: number; body: JournalEntryDescriptionPatchRequest }
    >({
      query: ({ id, body }) => ({
        url: `JournalEntries/${id}/description`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [
        'JournalEntry',
        'FinancialReport',
        { type: 'JournalEntry', id: arg.id },
      ],
    }),

    getCustomerPayments: builder.query<PagedResult<CustomerPayment>, CustomerPaymentsPagedArg>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'CustomerPayments',
        params: {
          page,
          pageSize,
          q,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      transformResponse: normalizeCustomerPaymentsPaged,
      providesTags: ['CustomerPayment'],
    }),
    getCustomerPaymentPreviewBalance: builder.query<
      CustomerPaymentPreviewBalance,
      { customerId: number; businessId?: number }
    >({
      query: ({ customerId, businessId }) => ({
        url: 'CustomerPayments/preview-balance',
        params: {
          customerId,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
    }),
    getCustomerPaymentBalance: builder.query<
      { businessId: number; customerId: number; name: string; phone: string; balance: number },
      { customerId: number; businessId?: number }
    >({
      query: ({ customerId, businessId }) => ({
        url: 'CustomerPayments/balance',
        params: {
          customerId,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
      providesTags: ['CustomerPayment'],
    }),
    createCustomerPayment: builder.mutation<CustomerPayment, CustomerPaymentWriteRequest>({
      query: (body) => ({ url: 'CustomerPayments', method: 'POST', body }),
      transformResponse: normalizeCustomerPaymentRow,
      invalidatesTags: ['CustomerPayment', 'CustomerFuelGiven', 'CustomerReport', 'JournalEntry', 'FinancialReport'],
    }),
    deleteCustomerPayment: builder.mutation<void, number>({
      query: (id) => ({ url: `CustomerPayments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerPayment', 'CustomerFuelGiven', 'CustomerReport'],
    }),

    getTrialBalanceReport: builder.query<
      any[],
      { businessId: number; from?: string; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/trial-balance', params }),
      providesTags: ['FinancialReport'],
    }),
    /** Type-aware balances for chart-of-accounts tree (GET api/FinancialReports/accounts-with-balances). */
    getAccountsWithBalances: builder.query<
      { id: number; name: string; code: string; type: string; balance: number }[],
      { businessId: number; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/accounts-with-balances', params }),
      providesTags: ['FinancialReport'],
    }),
    getGeneralLedgerReport: builder.query<
      any[],
      {
        businessId: number
        accountId: number
        from?: string
        to?: string
        stationId?: number
        trialBalanceMode?: string
      }
    >({
      query: (params) => ({ url: 'FinancialReports/general-ledger', params }),
      providesTags: ['FinancialReport'],
    }),
    getProfitLossReport: builder.query<
      ProfitLossReportDto,
      { businessId: number; from?: string; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/profit-loss', params }),
      providesTags: ['FinancialReport'],
    }),
    getBalanceSheetReport: builder.query<
      BalanceSheetReportDto,
      { businessId: number; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/balance-sheet', params }),
      providesTags: ['FinancialReport'],
    }),
    getCapitalStatementReport: builder.query<
      CapitalStatementReportDto,
      { businessId: number; from?: string; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/capital-statement', params }),
      providesTags: ['FinancialReport'],
    }),
    getReportPeriodView: builder.query<
      ReportPeriodViewDto,
      { businessId: number; from?: string; to?: string; stationId?: number; trialBalanceMode?: string }
    >({
      query: (params) => ({ url: 'FinancialReports/report-period-view', params }),
      providesTags: ['FinancialReport'],
    }),

    getAccountingDashboardOverview: builder.query<
      AccountingDashboardOverviewDto,
      { businessId: number; stationId?: number }
    >({
      query: (params) => ({ url: 'AccountingDashboard/overview', params }),
      providesTags: ['FinancialReport'],
    }),

    getAccountingDashboardRecentTransactions: builder.query<
      AccountingDashboardRecentTransactionsPagedDto,
      { businessId: number; stationId?: number; from: string; to: string; page?: number; pageSize?: number }
    >({
      query: (params) => ({ url: 'AccountingDashboard/recent-transactions', params }),
      providesTags: ['FinancialReport'],
    }),

    getRecurringJournalEntries: builder.query<
      any[],
      { businessId: number; filterStationId?: number }
    >({
      query: ({ businessId, filterStationId }) => ({
        url: 'recurring-journal-entries',
        params: {
          businessId,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['RecurringJournal'],
    }),
    createRecurringJournalEntry: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: 'recurring-journal-entries', method: 'POST', body }),
      invalidatesTags: ['RecurringJournal', 'JournalEntry'],
    }),
    updateRecurringJournalEntry: builder.mutation<any, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `recurring-journal-entries/${id}`, method: 'PUT', body }),
      invalidatesTags: ['RecurringJournal', 'JournalEntry'],
    }),
    confirmRecurringJournalPost: builder.mutation<
      unknown,
      { id: number; body: { businessId: number; amount: string } }
    >({
      query: ({ id, body }) => ({
        url: `recurring-journal-entries/${id}/confirm-post`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RecurringJournal', 'JournalEntry'],
    }),
    ensureRecurringJournalPendingIfDue: builder.mutation<
      unknown,
      { id: number; body: { businessId: number } }
    >({
      query: ({ id, body }) => ({
        url: `recurring-journal-entries/${id}/ensure-pending-if-due`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RecurringJournal'],
    }),
    deleteRecurringJournalEntry: builder.mutation<void, number>({
      query: (id) => ({ url: `recurring-journal-entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['RecurringJournal'],
    }),

    getAccountingPeriods: builder.query<any[], { businessId: number }>({
      query: ({ businessId }) => ({ url: 'accounting-periods', params: { businessId } }),
      providesTags: ['AccountingPeriod'],
    }),
    createAccountingPeriod: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: 'accounting-periods', method: 'POST', body }),
      invalidatesTags: ['AccountingPeriod'],
    }),
    updateAccountingPeriod: builder.mutation<
      unknown,
      { id: number; body: { name: string; periodStart: string; periodEnd: string } }
    >({
      query: ({ id, body }) => ({ url: `accounting-periods/${id}`, method: 'PUT', body }),
      invalidatesTags: ['AccountingPeriod'],
    }),
    deleteAccountingPeriod: builder.mutation<void, number>({
      query: (id) => ({ url: `accounting-periods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AccountingPeriod'],
    }),
    markAccountingPeriodClosed: builder.mutation<
      { message: string; closeJournalEntryId?: number | null },
      { id: number; body?: { closeJournalEntryId?: number } }
    >({
      query: ({ id, body }) => ({
        url: `accounting-periods/${id}/mark-closed`,
        method: 'POST',
        body: body ?? {},
      }),
      invalidatesTags: ['AccountingPeriod', 'JournalEntry', 'FinancialReport'],
    }),
    reopenAccountingPeriod: builder.mutation<any, number>({
      query: (id) => ({ url: `accounting-periods/${id}/reopen`, method: 'POST' }),
      invalidatesTags: ['AccountingPeriod', 'JournalEntry', 'FinancialReport'],
    }),
    getCustomerBalancesReport: builder.query<
      any[],
      {
        businessId: number
        stationId?: number
        from?: string
        to?: string
        receivableAccountId: number
      }
    >({
      query: (params) => ({ url: 'FinancialReports/customer-balances', params }),
      providesTags: ['FinancialReport'],
    }),
    getSupplierBalancesReport: builder.query<
      any[],
      {
        businessId: number
        stationId?: number
        from?: string
        to?: string
        payableAccountId: number
      }
    >({
      query: (params) => ({ url: 'FinancialReports/supplier-balances', params }),
      providesTags: ['FinancialReport'],
    }),

    getCashOutDailyReport: builder.query<
      CashOutDailyReportDto,
      {
        businessId: number
        from?: string
        to?: string
        stationId?: number
        expenseType?: string
        sideAction?: 'Operation' | 'Management'
      }
    >({
      query: ({ businessId, from, to, stationId, expenseType, sideAction }) => ({
        url: 'OperationReports/cash-out-daily',
        params: {
          businessId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(expenseType ? { expenseType } : {}),
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
          ...(sideAction ? { sideAction } : {}),
        },
      }),
      providesTags: ['Expense', 'FinancialReport'],
    }),
    getDailyFuelGivenReport: builder.query<
      DailyFuelGivenRowDto[],
      { businessId: number; from?: string; to?: string; stationId?: number }
    >({
      query: ({ businessId, from, to, stationId }) => ({
        url: 'OperationReports/daily-fuel-given',
        params: {
          businessId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
        },
      }),
      providesTags: ['CustomerFuelGiven', 'FinancialReport'],
    }),
    getDailyStationReport: builder.query<
      DailyStationReportDto,
      { businessId: number; stationId?: number; from?: string; to?: string }
    >({
      query: ({ businessId, stationId, from, to }) => ({
        url: 'OperationReports/daily-station-report',
        params: {
          businessId,
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      providesTags: ['Expense', 'Inventory', 'FinancialReport'],
    }),
    getSupplierReport: builder.query<
      SupplierReportDto,
      { businessId: number; supplierId: number; from?: string; to?: string }
    >({
      query: ({ businessId, supplierId, from, to }) => ({
        url: 'OperationReports/supplier-report',
        params: {
          businessId,
          supplierId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      transformResponse: normalizeSupplierReportDto,
      providesTags: ['SupplierReport', 'SupplierPayment', 'Purchase'],
    }),
    getSupplierPaymentBalance: builder.query<
      { supplierId: number; businessId: number; balance: number },
      { supplierId: number; businessId?: number }
    >({
      query: ({ supplierId, businessId }) => ({
        url: 'SupplierPayments/balance',
        params: { supplierId, ...(businessId != null && businessId > 0 ? { businessId } : {}) },
      }),
      providesTags: ['SupplierPayment', 'SupplierReport'],
    }),
    getCustomerReport: builder.query<
      CustomerReportDto,
      { businessId: number; customerId: number; from?: string; to?: string }
    >({
      query: ({ businessId, customerId, from, to }) => ({
        url: 'OperationReports/customer-report',
        params: {
          businessId,
          customerId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      transformResponse: normalizeCustomerReportDto,
      providesTags: ['CustomerReport', 'CustomerPayment', 'CustomerFuelGiven'],
    }),
    getOperationReportCustomers: builder.query<CustomerOption[], { businessId: number }>({
      query: ({ businessId }) => ({
        url: 'OperationReports/customers',
        params: { businessId },
      }),
      transformResponse: (raw: unknown): CustomerOption[] => {
        if (!Array.isArray(raw)) return []
        return raw.map((r) => {
          const x = r as Record<string, unknown>
          return {
            customerId: Number(x.customerId ?? x.CustomerId ?? 0),
            name: String(x.name ?? x.Name ?? ''),
            phone: String(x.phone ?? x.Phone ?? ''),
            lastDate: String(x.lastDate ?? x.LastDate ?? ''),
          }
        })
      },
      providesTags: ['CustomerFuelGiven', 'CustomerReport'],
    }),
    getDailySummaryReport: builder.query<
      DailySummaryReportDto,
      {
        businessId: number
        from: string
        to: string
        stationId?: number
        sideAction?: 'Operation' | 'Management'
      }
    >({
      query: ({ businessId, from, to, stationId, sideAction }) => ({
        url: 'OperationReports/daily-summary-report',
        params: {
          businessId,
          from,
          to,
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
          ...(sideAction ? { sideAction } : {}),
        },
      }),
      providesTags: ['Expense', 'Inventory', 'FinancialReport'],
    }),

    createExpense: builder.mutation<Expense, ExpenseWriteRequest>({
      query: (body) => ({ url: 'Expenses', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateExpense: builder.mutation<Expense, { id: number; body: ExpenseWriteRequest }>({
      query: ({ id, body }) => ({ url: `Expenses/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Expense'],
    }),
    deleteExpense: builder.mutation<void, number>({
      query: (id) => ({ url: `Expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense'],
    }),

    createInventoryBatch: builder.mutation<InventoryBatchCreateResponse, FormData>({
      query: (formData) => ({
        url: 'Inventories/batch',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Inventory'],
    }),
    getInventorySaleDetail: builder.query<InventorySaleDetail, number>({
      query: (saleId) => ({ url: `Inventories/sales/${saleId}` }),
      providesTags: ['Inventory'],
    }),
    updateInventorySaleEvidence: builder.mutation<
      { saleId: number; evidenceFilePath: string; originalFileName: string },
      { saleId: number; formData: FormData }
    >({
      query: ({ saleId, formData }) => ({
        url: `Inventories/sales/${saleId}/evidence`,
        method: 'PUT',
        body: formData,
      }),
      invalidatesTags: ['Inventory'],
    }),
    deleteInventorySale: builder.mutation<void, number>({
      query: (saleId) => ({ url: `Inventories/sales/${saleId}`, method: 'DELETE' }),
      invalidatesTags: ['Inventory'],
    }),
    updateInventory: builder.mutation<Inventory, { id: number; body: InventoryWriteRequest }>({
      query: ({ id, body }) => ({ url: `Inventories/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Inventory'],
    }),
    deleteInventory: builder.mutation<void, number>({
      query: (id) => ({ url: `Inventories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Inventory'],
    }),

    createRate: builder.mutation<Rate, RateWriteRequest>({
      query: (body) => ({ url: 'Rates', method: 'POST', body }),
      invalidatesTags: ['Rate'],
    }),
    updateRate: builder.mutation<Rate, { id: number; body: RateWriteRequest }>({
      query: ({ id, body }) => ({ url: `Rates/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Rate'],
    }),
    deleteRate: builder.mutation<void, number>({
      query: (id) => ({ url: `Rates/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Rate'],
    }),

    createGeneratorUsage: builder.mutation<GeneratorUsage, GeneratorUsageWriteRequest>({
      query: (body) => ({ url: 'GeneratorUsages', method: 'POST', body }),
      invalidatesTags: ['GeneratorUsage'],
    }),
    updateGeneratorUsage: builder.mutation<GeneratorUsage, { id: number; body: GeneratorUsageWriteRequest }>({
      query: ({ id, body }) => ({ url: `GeneratorUsages/${id}`, method: 'PUT', body }),
      invalidatesTags: ['GeneratorUsage'],
    }),
    deleteGeneratorUsage: builder.mutation<void, number>({
      query: (id) => ({ url: `GeneratorUsages/${id}`, method: 'DELETE' }),
      invalidatesTags: ['GeneratorUsage'],
    }),

    createCustomerFuelGiven: builder.mutation<CustomerFuelGiven, CustomerFuelGivenWriteRequest>({
      query: (body) => ({ url: 'CustomerFuelGivens', method: 'POST', body }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport', 'Dipping'],
    }),
    updateCustomerFuelGiven: builder.mutation<CustomerFuelGiven, { id: number; body: CustomerFuelGivenWriteRequest }>({
      query: ({ id, body }) => ({ url: `CustomerFuelGivens/${id}`, method: 'PUT', body }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport', 'Dipping'],
    }),
    deleteCustomerFuelGiven: builder.mutation<void, number>({
      query: (id) => ({ url: `CustomerFuelGivens/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'CustomerReport', 'Dipping'],
    }),

    createPump: builder.mutation<Pump, PumpWriteRequest>({
      query: (body) => ({ url: 'Pumps', method: 'POST', body }),
      invalidatesTags: ['Pump', 'Inventory'],
    }),
    updatePump: builder.mutation<Pump, { id: number; body: PumpWriteRequest }>({
      query: ({ id, body }) => ({ url: `Pumps/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Pump', 'Inventory'],
    }),
    deletePump: builder.mutation<void, number>({
      query: (id) => ({ url: `Pumps/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Pump', 'Inventory'],
    }),
    getDippingPumpsByBusiness: builder.query<DippingPump[], number>({
      query: (businessId) => `DippingPumps/by-business/${businessId}`,
      providesTags: ['Pump', 'Dipping'],
    }),
    createDippingPump: builder.mutation<DippingPump, DippingPumpWriteRequest>({
      query: (body) => ({ url: 'DippingPumps', method: 'POST', body }),
      invalidatesTags: ['Pump', 'Dipping', 'Inventory'],
    }),
    updateDippingPump: builder.mutation<DippingPump, { id: number; body: DippingPumpWriteRequest }>({
      query: ({ id, body }) => ({ url: `DippingPumps/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Pump', 'Dipping', 'Inventory'],
    }),
    deleteDippingPump: builder.mutation<void, number>({
      query: (id) => ({ url: `DippingPumps/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Pump', 'Dipping', 'Inventory'],
    }),

    getStations: builder.query<PagedResult<Station>, StationsPagedArg>({
      query: ({ page, pageSize, q, businessId }) => ({
        url: 'Stations',
        params: { page, pageSize, q, businessId },
      }),
      providesTags: ['Station'],
    }),
    createStation: builder.mutation<Station, StationWriteRequest>({
      query: (body) => ({ url: 'Stations', method: 'POST', body }),
      invalidatesTags: ['Station'],
    }),
    updateStation: builder.mutation<Station, { id: number; body: StationWriteRequest }>({
      query: ({ id, body }) => ({ url: `Stations/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Station'],
    }),
    deleteStation: builder.mutation<void, number>({
      query: (id) => ({ url: `Stations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Station'],
    }),

    getDippings: builder.query<PagedResult<Dipping>, DippingsPagedArg>({
      query: ({ page, pageSize, q, businessId, filterStationId }) => ({
        url: 'Dippings',
        params: {
          page,
          pageSize,
          q,
          businessId,
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['Dipping'],
    }),
    createDipping: builder.mutation<Dipping, DippingWriteRequest>({
      query: (body) => ({ url: 'Dippings', method: 'POST', body }),
      invalidatesTags: ['Dipping'],
    }),
    updateDipping: builder.mutation<Dipping, { id: number; body: DippingWriteRequest }>({
      query: ({ id, body }) => ({ url: `Dippings/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Dipping'],
    }),
    deleteDipping: builder.mutation<void, number>({
      query: (id) => ({ url: `Dippings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Dipping'],
    }),

    getLiterReceiveds: builder.query<PagedResult<LiterReceived>, LiterReceivedsPagedArg>({
      query: ({ page, pageSize, q, from, to, filterStationId }) => ({
        url: 'LiterReceiveds',
        params: {
          page,
          pageSize,
          ...(q ? { q } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
        },
      }),
      providesTags: ['LiterReceived'],
    }),
    createLiterReceived: builder.mutation<LiterReceived, LiterReceivedWriteRequest>({
      query: (body) => ({ url: 'LiterReceiveds', method: 'POST', body }),
      invalidatesTags: ['LiterReceived', 'BusinessFuelInventory', 'Notification'],
    }),
    updateLiterReceived: builder.mutation<LiterReceived, { id: number; body: LiterReceivedWriteRequest }>({
      query: ({ id, body }) => ({ url: `LiterReceiveds/${id}`, method: 'PUT', body }),
      invalidatesTags: ['LiterReceived', 'BusinessFuelInventory', 'Notification'],
    }),
    deleteLiterReceived: builder.mutation<void, { id: number; clampDippingToZero?: boolean }>({
      query: ({ id, clampDippingToZero }) => ({
        url: `LiterReceiveds/${id}`,
        method: 'DELETE',
        params: clampDippingToZero ? { clampDippingToZero: true } : undefined,
      }),
      invalidatesTags: ['LiterReceived'],
    }),

    getBusinessFuelInventoryBalances: builder.query<BusinessFuelInventoryBalance[], { businessId?: number }>({
      query: ({ businessId }) => ({
        url: 'business-fuel-inventory/balances',
        params: businessId != null && businessId > 0 ? { businessId } : {},
      }),
      providesTags: ['BusinessFuelInventory'],
    }),
    getBusinessFuelInventoryCredits: builder.query<
      PagedResult<BusinessFuelInventoryCredit>,
      { businessId?: number; page?: number; pageSize?: number }
    >({
      query: ({ businessId, page = 1, pageSize = 50 }) => ({
        url: 'business-fuel-inventory/credits',
        params: {
          page,
          pageSize,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
      providesTags: ['BusinessFuelInventory'],
    }),
    getBusinessFuelInventoryTransfers: builder.query<
      PagedResult<TransferInventory>,
      { businessId?: number; page?: number; pageSize?: number }
    >({
      query: ({ businessId, page = 1, pageSize = 50 }) => ({
        url: 'business-fuel-inventory/transfers',
        params: {
          page,
          pageSize,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
      providesTags: ['BusinessFuelInventory'],
    }),
    getTransferInventoryAudit: builder.query<TransferInventoryAudit[], { id: number; businessId?: number }>({
      query: ({ id, businessId }) => ({
        url: `business-fuel-inventory/transfers/${id}/audit`,
        params: businessId != null && businessId > 0 ? { businessId } : {},
      }),
      providesTags: ['BusinessFuelInventory'],
    }),
    getTransferInventoryAuditTrailPaged: builder.query<
      PagedResult<TransferInventoryAuditListRow>,
      { businessId?: number; page?: number; pageSize?: number; q?: string }
    >({
      query: ({ businessId, page = 1, pageSize = 50, q }) => ({
        url: 'business-fuel-inventory/transfers/audit-trail',
        params: {
          page,
          pageSize,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
          ...(q != null && q.trim() !== '' ? { q: q.trim() } : {}),
        },
      }),
      providesTags: ['BusinessFuelInventory'],
    }),
    createBusinessFuelInventoryCredit: builder.mutation<
      BusinessFuelInventoryCredit,
      { businessId: number; fuelTypeId: number; liters: string; date?: string; reference: string; note?: string }
    >({
      query: (body) => ({
        url: 'business-fuel-inventory/credits',
        method: 'POST',
        body: {
          businessId: body.businessId,
          fuelTypeId: body.fuelTypeId,
          liters: body.liters,
          date: body.date,
          reference: body.reference,
          note: body.note,
        },
      }),
      invalidatesTags: ['BusinessFuelInventory'],
    }),
    deleteBusinessFuelInventoryCredit: builder.mutation<void, { id: number; businessId: number }>({
      query: ({ id, businessId }) => ({
        url: `business-fuel-inventory/credits/${id}`,
        method: 'DELETE',
        body: { businessId },
      }),
      invalidatesTags: ['BusinessFuelInventory'],
    }),
    createBusinessFuelInventoryTransfer: builder.mutation<
      TransferInventory,
      { businessId: number; fuelTypeId: number; toStationId: number; liters: string; date?: string; note?: string }
    >({
      query: (body) => ({
        url: 'business-fuel-inventory/transfers',
        method: 'POST',
        body: {
          businessId: body.businessId,
          fuelTypeId: body.fuelTypeId,
          toStationId: body.toStationId,
          liters: body.liters,
          date: body.date,
          note: body.note,
        },
      }),
      invalidatesTags: ['BusinessFuelInventory'],
    }),
    updateBusinessFuelInventoryTransfer: builder.mutation<
      TransferInventory,
      {
        id: number
        businessId: number
        toStationId: number
        liters: string
        date?: string
        note?: string
        reason: string
      }
    >({
      query: ({ id, ...body }) => ({
        url: `business-fuel-inventory/transfers/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['BusinessFuelInventory'],
    }),
    deleteBusinessFuelInventoryTransfer: builder.mutation<void, { id: number; businessId: number; reason: string }>({
      query: ({ id, businessId, reason }) => ({
        url: `business-fuel-inventory/transfers/${id}`,
        method: 'DELETE',
        body: { businessId, reason },
      }),
      invalidatesTags: ['BusinessFuelInventory'],
    }),

    getPendingPoolTransfersForConfirm: builder.query<
      TransferPendingConfirm[],
      { businessId: number; toStationId: number; fuelTypeId: number }
    >({
      query: ({ businessId, toStationId, fuelTypeId }) => ({
        url: 'business-fuel-inventory/transfers/pending-confirm',
        params: { businessId, toStationId, fuelTypeId },
      }),
      providesTags: ['BusinessFuelInventory'],
    }),

    getNotificationsPaged: builder.query<
      PagedResult<AppNotificationItem>,
      { businessId?: number; page?: number; pageSize?: number }
    >({
      query: ({ businessId, page = 1, pageSize = 30 }) => ({
        url: 'Notifications',
        params: {
          page,
          pageSize,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
      providesTags: ['Notification'],
    }),
    getNotificationsUnreadCount: builder.query<{ count: number }, { businessId?: number }>({
      query: ({ businessId }) => ({
        url: 'Notifications/unread-count',
        params: businessId != null && businessId > 0 ? { businessId } : {},
      }),
      providesTags: ['Notification'],
    }),
    markNotificationRead: builder.mutation<void, { id: number; businessId?: number }>({
      query: ({ id, businessId }) => ({
        url: `Notifications/${id}/read`,
        method: 'POST',
        params: businessId != null && businessId > 0 ? { businessId } : {},
      }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation<{ marked: number }, { businessId?: number }>({
      query: ({ businessId }) => ({
        url: 'Notifications/read-all',
        method: 'POST',
        params: businessId != null && businessId > 0 ? { businessId } : {},
      }),
      invalidatesTags: ['Notification'],
    }),

    getSuppliers: builder.query<PagedResult<Supplier>, SuppliersPagedArg>({
      query: ({ page, pageSize, q, businessId }) => ({
        url: 'Suppliers',
        params: { page, pageSize, q, businessId },
      }),
      providesTags: ['Supplier'],
    }),
    createSupplier: builder.mutation<Supplier, SupplierWriteRequest>({
      query: (body) => ({ url: 'Suppliers', method: 'POST', body }),
      invalidatesTags: ['Supplier'],
    }),
    updateSupplier: builder.mutation<Supplier, { id: number; body: SupplierWriteRequest }>({
      query: ({ id, body }) => ({ url: `Suppliers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Supplier'],
    }),
    deleteSupplier: builder.mutation<Supplier, number>({
      query: (id) => ({ url: `Suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Supplier'],
    }),

    getEmployees: builder.query<PagedResult<Employee>, EmployeesPagedArg>({
      query: ({ page, pageSize, q, businessId, filterStationId, includeInactive }) => ({
        url: 'Employees',
        params: {
          page,
          pageSize,
          q,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
          ...(includeInactive ? { includeInactive: true } : {}),
        },
      }),
      transformResponse: normalizeEmployeesPaged,
      providesTags: ['Employee'],
    }),
    getEmployeeById: builder.query<Employee, number>({
      query: (id) => ({ url: `Employees/${id}` }),
      transformResponse: normalizeEmployeeRow,
      providesTags: (_r, _e, id) => [{ type: 'Employee', id }],
    }),
    createEmployee: builder.mutation<Employee, EmployeeWriteRequest>({
      query: (body) => ({ url: 'Employees', method: 'POST', body }),
      transformResponse: normalizeEmployeeRow,
      invalidatesTags: ['Employee', 'PayrollReport'],
    }),
    updateEmployee: builder.mutation<Employee, { id: number; body: EmployeeWriteRequest }>({
      query: ({ id, body }) => ({ url: `Employees/${id}`, method: 'PUT', body }),
      transformResponse: normalizeEmployeeRow,
      invalidatesTags: (_r, _e, arg) => ['Employee', 'PayrollReport', { type: 'Employee', id: arg.id }],
    }),
    deleteEmployee: builder.mutation<Employee, number>({
      query: (id) => ({ url: `Employees/${id}`, method: 'DELETE' }),
      transformResponse: normalizeEmployeeRow,
      invalidatesTags: ['Employee', 'EmployeePayment', 'PayrollReport'],
    }),

    getEmployeePayments: builder.query<PagedResult<EmployeePayment>, EmployeePaymentsPagedArg>({
      query: ({ page, pageSize, q, businessId, filterStationId, employeeId, period }) => ({
        url: 'EmployeePayments',
        params: {
          page,
          pageSize,
          q,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
          ...(filterStationId != null && filterStationId > 0 ? { filterStationId } : {}),
          ...(employeeId != null && employeeId > 0 ? { employeeId } : {}),
          ...(period ? { period } : {}),
        },
      }),
      transformResponse: normalizeEmployeePaymentsPaged,
      providesTags: ['EmployeePayment'],
    }),
    getEmployeePaymentBalance: builder.query<
      EmployeePaymentPreviewBalance,
      { employeeId: number; businessId?: number }
    >({
      query: ({ employeeId, businessId }) => ({
        url: 'EmployeePayments/balance',
        params: {
          employeeId,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
      transformResponse: normalizeEmployeePaymentPreviewBalance,
      providesTags: ['EmployeePayment', 'Employee'],
    }),
    createEmployeePayment: builder.mutation<EmployeePayment, EmployeePaymentWriteRequest>({
      query: (body) => ({ url: 'EmployeePayments', method: 'POST', body }),
      transformResponse: normalizeEmployeePaymentRow,
      invalidatesTags: ['EmployeePayment', 'Employee', 'PayrollReport'],
    }),
    deleteEmployeePayment: builder.mutation<EmployeePayment, number>({
      query: (id) => ({ url: `EmployeePayments/${id}`, method: 'DELETE' }),
      transformResponse: normalizeEmployeePaymentRow,
      invalidatesTags: ['EmployeePayment', 'Employee', 'PayrollReport'],
    }),
    runPayroll: builder.mutation<PayrollRunResult, PayrollRunWriteRequest>({
      query: (body) => ({ url: 'EmployeePayments/payroll-run', method: 'POST', body }),
      transformResponse: normalizePayrollRunResult,
      invalidatesTags: ['EmployeePayment', 'Employee', 'PayrollReport'],
    }),

    getOperationReportEmployees: builder.query<
      EmployeeOption[],
      { businessId: number; stationId?: number; period?: string }
    >({
      query: ({ businessId, stationId, period }) => ({
        url: 'OperationReports/employees',
        params: {
          businessId,
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
          ...(period != null && period.trim().length > 0 ? { period: period.trim() } : {}),
        },
      }),
      transformResponse: (raw: unknown) =>
        Array.isArray(raw) ? raw.map(normalizeEmployeeOptionRow) : [],
      providesTags: ['Employee', 'PayrollReport'],
    }),
    getPayrollStatusReport: builder.query<
      PayrollStatusReportDto,
      { businessId: number; period: string; stationId?: number }
    >({
      query: ({ businessId, period, stationId }) => ({
        url: 'OperationReports/payroll-status',
        params: {
          businessId,
          period,
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
        },
      }),
      transformResponse: normalizePayrollStatusReportDto,
      providesTags: ['PayrollReport', 'Employee', 'EmployeePayment'],
    }),
    getEmployeePaymentHistoryReport: builder.query<
      EmployeePaymentHistoryDto,
      { businessId: number; employeeId: number; from?: string; to?: string }
    >({
      query: ({ businessId, employeeId, from, to }) => ({
        url: 'OperationReports/employee-payment-history',
        params: {
          businessId,
          employeeId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      transformResponse: normalizeEmployeePaymentHistoryDto,
      providesTags: ['PayrollReport', 'EmployeePayment', 'Employee'],
    }),

    getPurchases: builder.query<PagedResult<Purchase>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Purchases',
        params: { page, pageSize, q },
      }),
      providesTags: ['Purchase'],
    }),
    getSupplierPayments: builder.query<PagedResult<SupplierPayment>, SupplierPaymentsPagedArg>({
      query: ({ page, pageSize, q, businessId }) => ({
        url: 'SupplierPayments',
        params: { page, pageSize, q, ...(businessId != null && businessId > 0 ? { businessId } : {}) },
      }),
      transformResponse: normalizeSupplierPaymentsPaged,
      providesTags: ['SupplierPayment'],
    }),
    createSupplierPayment: builder.mutation<SupplierPayment, SupplierPaymentWriteRequest>({
      query: (body) => ({ url: 'SupplierPayments', method: 'POST', body }),
      transformResponse: normalizeSupplierPaymentRow,
      invalidatesTags: ['SupplierPayment', 'SupplierReport'],
    }),
    getPurchase: builder.query<PurchaseWithItems, number>({
      query: (id) => ({ url: `Purchases/${id}` }),
      transformResponse: normalizePurchaseWithItems,
      providesTags: (_r, _e, id) => [{ type: 'Purchase', id }],
    }),
    createPurchase: builder.mutation<PurchaseWithItems, PurchaseWriteRequest>({
      query: (body) => ({ url: 'Purchases', method: 'POST', body }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: ['Purchase', 'SupplierPayment', 'SupplierReport'],
    }),
    updatePurchase: builder.mutation<PurchaseWithItems, { id: number; body: PurchaseHeaderWriteRequest }>({
      query: ({ id, body }) => ({ url: `Purchases/${id}`, method: 'PUT', body }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', 'SupplierPayment', 'SupplierReport', { type: 'Purchase', id: arg.id }],
    }),
    addPurchaseItem: builder.mutation<PurchaseWithItems, { purchaseId: number; body: PurchaseLineWrite }>({
      query: ({ purchaseId, body }) => ({
        url: `Purchases/${purchaseId}/items`,
        method: 'POST',
        body,
      }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', 'SupplierPayment', 'SupplierReport', { type: 'Purchase', id: arg.purchaseId }],
    }),
    updatePurchaseItem: builder.mutation<
      PurchaseWithItems,
      { purchaseId: number; itemId: number; body: PurchaseLineWrite }
    >({
      query: ({ purchaseId, itemId, body }) => ({
        url: `Purchases/${purchaseId}/items/${itemId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', 'SupplierPayment', 'SupplierReport', { type: 'Purchase', id: arg.purchaseId }],
    }),
    deletePurchaseItem: builder.mutation<PurchaseWithItems, { purchaseId: number; itemId: number }>({
      query: ({ purchaseId, itemId }) => ({
        url: `Purchases/${purchaseId}/items/${itemId}`,
        method: 'DELETE',
      }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', 'SupplierPayment', 'SupplierReport', { type: 'Purchase', id: arg.purchaseId }],
    }),
    deletePurchase: builder.mutation<void, number>({
      query: (id) => ({ url: `Purchases/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Purchase', 'SupplierPayment', 'SupplierReport'],
    }),
  }),
})

export const {
  useLoginMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetBusinessesQuery,
  useCreateBusinessMutation,
  useUpdateBusinessMutation,
  useDeleteBusinessMutation,
  useGetMenusQuery,
  useLazyGetMenusQuery,
  useCreateMenuMutation,
  useUpdateMenuMutation,
  useDeleteMenuMutation,
  useGetSubMenusQuery,
  useLazyGetSubMenusQuery,
  useCreateSubMenuMutation,
  useUpdateSubMenuMutation,
  useDeleteSubMenuMutation,
  useGetPermissionsQuery,
  useCreatePermissionMutation,
  useUpdatePermissionMutation,
  useDeletePermissionMutation,
  useGetBusinessUsersQuery,
  useCreateBusinessUserMutation,
  useUpdateBusinessUserMutation,
  useDeleteBusinessUserMutation,
  useGetMenuTreeQuery,
  useGetPermissionContextUsersQuery,
  useGetPermissionsByUserQuery,
  useGetMyPermissionsQuery,
  useSavePermissionsBulkMutation,
  useGetFuelTypesQuery,
  useCreateFuelTypeMutation,
  useUpdateFuelTypeMutation,
  useDeleteFuelTypeMutation,
  useGetCurrenciesQuery,
  useCreateCurrencyMutation,
  useUpdateCurrencyMutation,
  useDeleteCurrencyMutation,
  useGetFuelPricesQuery,
  useCreateFuelPriceMutation,
  useUpdateFuelPriceMutation,
  useDeleteFuelPriceMutation,
  useGetPumpsQuery,
  useGetPumpsPagedQuery,
  useGetExpensesQuery,
  useGetInventoriesQuery,
  useGetInventoryLatestByPumpQuery,
  useGetInventoryLatestByNozzleQuery,
  useGetNozzlesByBusinessQuery,
  useGetNozzlesForPumpQuery,
  useCreateNozzleMutation,
  useGetRatesQuery,
  useGetGeneratorUsagesQuery,
  useGetCustomerFuelGivensQuery,
  useGetCustomerFuelGivenCustomersQuery,
  useGetCustomerFuelGivenCustomerByIdQuery,
  useGetCustomerFuelGivenTransactionsByCustomerQuery,
  useGetOutstandingCustomerFuelGivensQuery,
  useGetAccountsQuery,
  useGetAccountParentCandidatesQuery,
  useGetChartsOfAccountsQuery,
  useCreateChartsOfAccountsMutation,
  useUpdateChartsOfAccountsMutation,
  useDeleteChartsOfAccountsMutation,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useAutoGenerateDefaultParentAccountsMutation,
  useGetJournalEntriesQuery,
  useGetJournalEntryQuery,
  useCreateJournalEntryMutation,
  useDeleteJournalEntryMutation,
  usePatchJournalEntryDescriptionMutation,
  useGetCustomerPaymentsQuery,
  useGetCustomerPaymentPreviewBalanceQuery,
  useGetCustomerPaymentBalanceQuery,
  useCreateCustomerPaymentMutation,
  useDeleteCustomerPaymentMutation,
  useGetTrialBalanceReportQuery,
  useGetAccountsWithBalancesQuery,
  useGetGeneralLedgerReportQuery,
  useGetProfitLossReportQuery,
  useGetBalanceSheetReportQuery,
  useGetCapitalStatementReportQuery,
  useGetReportPeriodViewQuery,
  useGetAccountingDashboardOverviewQuery,
  useGetAccountingDashboardRecentTransactionsQuery,
  useGetRecurringJournalEntriesQuery,
  useCreateRecurringJournalEntryMutation,
  useUpdateRecurringJournalEntryMutation,
  useConfirmRecurringJournalPostMutation,
  useEnsureRecurringJournalPendingIfDueMutation,
  useDeleteRecurringJournalEntryMutation,
  useGetAccountingPeriodsQuery,
  useCreateAccountingPeriodMutation,
  useUpdateAccountingPeriodMutation,
  useDeleteAccountingPeriodMutation,
  useMarkAccountingPeriodClosedMutation,
  useReopenAccountingPeriodMutation,
  useGetCustomerBalancesReportQuery,
  useGetSupplierBalancesReportQuery,
  useGetCashOutDailyReportQuery,
  useGetDailySummaryReportQuery,
  useGetDailyFuelGivenReportQuery,
  useGetDailyStationReportQuery,
  useGetSupplierReportQuery,
  useGetSupplierPaymentBalanceQuery,
  useGetCustomerReportQuery,
  useGetOperationReportCustomersQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useCreateInventoryBatchMutation,
  useGetInventorySaleDetailQuery,
  useUpdateInventorySaleEvidenceMutation,
  useDeleteInventorySaleMutation,
  useUpdateInventoryMutation,
  useDeleteInventoryMutation,
  useCreateRateMutation,
  useUpdateRateMutation,
  useDeleteRateMutation,
  useCreateGeneratorUsageMutation,
  useUpdateGeneratorUsageMutation,
  useDeleteGeneratorUsageMutation,
  useCreateCustomerFuelGivenMutation,
  useCreateCustomerFuelGivenCustomerMutation,
  useUpdateCustomerFuelGivenCustomerMutation,
  useDeleteCustomerFuelGivenCustomerMutation,
  useUpdateCustomerFuelGivenMutation,
  useDeleteCustomerFuelGivenMutation,
  useCreatePumpMutation,
  useUpdatePumpMutation,
  useDeletePumpMutation,
  useGetDippingPumpsByBusinessQuery,
  useCreateDippingPumpMutation,
  useUpdateDippingPumpMutation,
  useDeleteDippingPumpMutation,
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
  useDeleteStationMutation,
  useGetDippingsQuery,
  useCreateDippingMutation,
  useUpdateDippingMutation,
  useDeleteDippingMutation,
  useGetLiterReceivedsQuery,
  useLazyGetLiterReceivedsQuery,
  useCreateLiterReceivedMutation,
  useUpdateLiterReceivedMutation,
  useDeleteLiterReceivedMutation,
  useGetBusinessFuelInventoryBalancesQuery,
  useGetBusinessFuelInventoryCreditsQuery,
  useGetBusinessFuelInventoryTransfersQuery,
  useGetTransferInventoryAuditQuery,
  useGetTransferInventoryAuditTrailPagedQuery,
  useCreateBusinessFuelInventoryCreditMutation,
  useDeleteBusinessFuelInventoryCreditMutation,
  useCreateBusinessFuelInventoryTransferMutation,
  useUpdateBusinessFuelInventoryTransferMutation,
  useDeleteBusinessFuelInventoryTransferMutation,
  useGetPendingPoolTransfersForConfirmQuery,
  useGetNotificationsPagedQuery,
  useGetNotificationsUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useGetEmployeesQuery,
  useGetEmployeeByIdQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetEmployeePaymentsQuery,
  useGetEmployeePaymentBalanceQuery,
  useCreateEmployeePaymentMutation,
  useDeleteEmployeePaymentMutation,
  useRunPayrollMutation,
  useGetOperationReportEmployeesQuery,
  useGetPayrollStatusReportQuery,
  useGetEmployeePaymentHistoryReportQuery,
  useGetPurchasesQuery,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useGetPurchaseQuery,
  useLazyGetPurchaseQuery,
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
  useAddPurchaseItemMutation,
  useUpdatePurchaseItemMutation,
  useDeletePurchaseItemMutation,
  useDeletePurchaseMutation,
} = apiSlice
