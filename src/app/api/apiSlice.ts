import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { logout } from '../authSlice'
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
  CustomerFuelGivenWriteRequest,
  OutstandingCustomerFuelGivenRow,
  CustomerPayment,
  CustomerPaymentPreviewBalance,
  CustomerPaymentWriteRequest,
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
  JournalEntryWriteRequest,
  ProfitLossReportDto,
  BalanceSheetReportDto,
  CashOutDailyReportDto,
  DailySummaryReportDto,
  DailyFuelGivenRowDto,
  Inventory,
  InventoryBatchCreateResponse,
  InventorySaleDetail,
  InventoryWriteRequest,
  LatestInventoryForPump,
  LiterReceived,
  LiterReceivedWriteRequest,
  Menu,
  Purchase,
  PurchaseHeaderWriteRequest,
  PurchaseItem,
  PurchaseLineWrite,
  PurchaseWithItems,
  PurchaseWriteRequest,
  PagedResult,
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
    status: String(o.status ?? o.Status ?? 'Unpaid') as PurchaseWithItems['status'],
    amountPaid: Number(o.amountPaid ?? o.AmountPaid ?? 0),
    items,
  }
}

export type PagedArg = { page: number; pageSize: number; q?: string }

export type StationsPagedArg = PagedArg & { businessId?: number }

export type InventoriesPagedArg = PagedArg & { filterBusinessId?: number; filterStationId?: number }

export type DippingsPagedArg = PagedArg & { businessId?: number; filterStationId?: number }
export type AccountsPagedArg = PagedArg & { businessId?: number }

export type SuppliersPagedArg = PagedArg & { businessId?: number }

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
    'CustomerFuelGiven',
    'Account',
    'JournalEntry',
    'CustomerPayment',
    'ChartsOfAccounts',
    'FinancialReport',
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
      invalidatesTags: ['Business'],
    }),
    updateBusiness: builder.mutation<Business, { id: number; body: Partial<Business> }>({
      query: ({ id, body }) => ({ url: `Businesses/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Business'],
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

    getExpenses: builder.query<PagedResult<Expense>, StationScopedPagedArg>({
      query: ({ page, pageSize, q, filterStationId }) => ({
        url: 'Expenses',
        params: {
          page,
          pageSize,
          q,
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
      providesTags: ['CustomerFuelGiven'],
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

    getCustomerPayments: builder.query<PagedResult<CustomerPayment>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'CustomerPayments',
        params: { page, pageSize, q },
      }),
      providesTags: ['CustomerPayment'],
    }),
    getCustomerPaymentPreviewBalance: builder.query<
      CustomerPaymentPreviewBalance,
      { customerFuelGivenId: number; businessId?: number }
    >({
      query: ({ customerFuelGivenId, businessId }) => ({
        url: 'CustomerPayments/preview-balance',
        params: {
          customerFuelGivenId,
          ...(businessId != null && businessId > 0 ? { businessId } : {}),
        },
      }),
    }),
    createCustomerPayment: builder.mutation<CustomerPayment, CustomerPaymentWriteRequest>({
      query: (body) => ({ url: 'CustomerPayments', method: 'POST', body }),
      invalidatesTags: ['CustomerPayment', 'CustomerFuelGiven', 'JournalEntry', 'FinancialReport'],
    }),
    deleteCustomerPayment: builder.mutation<void, number>({
      query: (id) => ({ url: `CustomerPayments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerPayment', 'CustomerFuelGiven'],
    }),

    getTrialBalanceReport: builder.query<any[], { businessId: number; from?: string; to?: string; stationId?: number }>({
      query: (params) => ({ url: 'FinancialReports/trial-balance', params }),
      providesTags: ['FinancialReport'],
    }),
    getGeneralLedgerReport: builder.query<any[], { businessId: number; accountId: number; from?: string; to?: string; stationId?: number }>({
      query: (params) => ({ url: 'FinancialReports/general-ledger', params }),
      providesTags: ['FinancialReport'],
    }),
    getProfitLossReport: builder.query<ProfitLossReportDto, { businessId: number; from?: string; to?: string; stationId?: number }>({
      query: (params) => ({ url: 'FinancialReports/profit-loss', params }),
      providesTags: ['FinancialReport'],
    }),
    getBalanceSheetReport: builder.query<BalanceSheetReportDto, { businessId: number; to?: string; stationId?: number }>({
      query: (params) => ({ url: 'FinancialReports/balance-sheet', params }),
      providesTags: ['FinancialReport'],
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
      { businessId: number; from?: string; to?: string; stationId?: number }
    >({
      query: ({ businessId, from, to, stationId }) => ({
        url: 'OperationReports/cash-out-daily',
        params: {
          businessId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
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
    getDailySummaryReport: builder.query<
      DailySummaryReportDto,
      { businessId: number; from: string; to: string; stationId?: number }
    >({
      query: ({ businessId, from, to, stationId }) => ({
        url: 'OperationReports/daily-summary-report',
        params: {
          businessId,
          from,
          to,
          ...(stationId != null && stationId > 0 ? { stationId } : {}),
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
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'Dipping'],
    }),
    updateCustomerFuelGiven: builder.mutation<CustomerFuelGiven, { id: number; body: CustomerFuelGivenWriteRequest }>({
      query: ({ id, body }) => ({ url: `CustomerFuelGivens/${id}`, method: 'PUT', body }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'Dipping'],
    }),
    deleteCustomerFuelGiven: builder.mutation<void, number>({
      query: (id) => ({ url: `CustomerFuelGivens/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerFuelGiven', 'CustomerPayment', 'Dipping'],
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
      invalidatesTags: ['LiterReceived'],
    }),
    updateLiterReceived: builder.mutation<LiterReceived, { id: number; body: LiterReceivedWriteRequest }>({
      query: ({ id, body }) => ({ url: `LiterReceiveds/${id}`, method: 'PUT', body }),
      invalidatesTags: ['LiterReceived'],
    }),
    deleteLiterReceived: builder.mutation<void, number>({
      query: (id) => ({ url: `LiterReceiveds/${id}`, method: 'DELETE' }),
      invalidatesTags: ['LiterReceived'],
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

    getPurchases: builder.query<PagedResult<Purchase>, PagedArg>({
      query: ({ page, pageSize, q }) => ({
        url: 'Purchases',
        params: { page, pageSize, q },
      }),
      providesTags: ['Purchase'],
    }),
    getPurchase: builder.query<PurchaseWithItems, number>({
      query: (id) => ({ url: `Purchases/${id}` }),
      transformResponse: normalizePurchaseWithItems,
      providesTags: (_r, _e, id) => [{ type: 'Purchase', id }],
    }),
    createPurchase: builder.mutation<PurchaseWithItems, PurchaseWriteRequest>({
      query: (body) => ({ url: 'Purchases', method: 'POST', body }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: ['Purchase'],
    }),
    updatePurchase: builder.mutation<PurchaseWithItems, { id: number; body: PurchaseHeaderWriteRequest }>({
      query: ({ id, body }) => ({ url: `Purchases/${id}`, method: 'PUT', body }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', { type: 'Purchase', id: arg.id }],
    }),
    addPurchaseItem: builder.mutation<PurchaseWithItems, { purchaseId: number; body: PurchaseLineWrite }>({
      query: ({ purchaseId, body }) => ({
        url: `Purchases/${purchaseId}/items`,
        method: 'POST',
        body,
      }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', { type: 'Purchase', id: arg.purchaseId }],
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
      invalidatesTags: (_r, _e, arg) => ['Purchase', { type: 'Purchase', id: arg.purchaseId }],
    }),
    deletePurchaseItem: builder.mutation<PurchaseWithItems, { purchaseId: number; itemId: number }>({
      query: ({ purchaseId, itemId }) => ({
        url: `Purchases/${purchaseId}/items/${itemId}`,
        method: 'DELETE',
      }),
      transformResponse: normalizePurchaseWithItems,
      invalidatesTags: (_r, _e, arg) => ['Purchase', { type: 'Purchase', id: arg.purchaseId }],
    }),
    deletePurchase: builder.mutation<void, number>({
      query: (id) => ({ url: `Purchases/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Purchase'],
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
  useGetOutstandingCustomerFuelGivensQuery,
  useGetAccountsQuery,
  useGetAccountParentCandidatesQuery,
  useGetChartsOfAccountsQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useAutoGenerateDefaultParentAccountsMutation,
  useGetJournalEntriesQuery,
  useGetJournalEntryQuery,
  useCreateJournalEntryMutation,
  useDeleteJournalEntryMutation,
  useGetCustomerPaymentsQuery,
  useGetCustomerPaymentPreviewBalanceQuery,
  useCreateCustomerPaymentMutation,
  useDeleteCustomerPaymentMutation,
  useGetTrialBalanceReportQuery,
  useGetGeneralLedgerReportQuery,
  useGetProfitLossReportQuery,
  useGetBalanceSheetReportQuery,
  useGetCustomerBalancesReportQuery,
  useGetSupplierBalancesReportQuery,
  useGetCashOutDailyReportQuery,
  useGetDailySummaryReportQuery,
  useGetDailyFuelGivenReportQuery,
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
  useUpdateCustomerFuelGivenMutation,
  useDeleteCustomerFuelGivenMutation,
  useCreatePumpMutation,
  useUpdatePumpMutation,
  useDeletePumpMutation,
  useGetDippingPumpsByBusinessQuery,
  useCreateDippingPumpMutation,
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
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useGetPurchasesQuery,
  useGetPurchaseQuery,
  useLazyGetPurchaseQuery,
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
  useAddPurchaseItemMutation,
  useUpdatePurchaseItemMutation,
  useDeletePurchaseItemMutation,
  useDeletePurchaseMutation,
} = apiSlice
