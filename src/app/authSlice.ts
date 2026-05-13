import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const STORAGE_KEY = 'gas-auth'

export interface AuthState {
  token: string | null
  userId: number | null
  /** Display name of the signed-in user */
  name: string | null
  email: string | null
  role: string | null
  businessId: number | null
  stationId: number | null
  selectedStationId: number | null
  /** JWT business: fuel pool / transfer menus; false when business does not support pooling */
  supportsPool: boolean
}

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return {
        token: null,
        userId: null,
        name: null,
        email: null,
        role: null,
        businessId: null,
        stationId: null,
        selectedStationId: null,
        supportsPool: true,
      }
    const parsed = JSON.parse(raw) as AuthState & { userName?: string | null }
    return {
      token: parsed.token ?? null,
      userId: parsed.userId ?? null,
      name: parsed.name ?? parsed.userName ?? null,
      email: parsed.email ?? null,
      role: parsed.role ?? null,
      businessId: parsed.businessId ?? null,
      stationId: parsed.stationId ?? null,
      selectedStationId: (parsed as AuthState).selectedStationId ?? null,
      supportsPool: (parsed as AuthState).supportsPool !== false,
    }
  } catch {
    return {
      token: null,
      userId: null,
      name: null,
      email: null,
      role: null,
      businessId: null,
      stationId: null,
      selectedStationId: null,
      supportsPool: true,
    }
  }
}

function saveToStorage(state: AuthState) {
  if (!state.token) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const initialState: AuthState = loadFromStorage()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(_state, action: PayloadAction<AuthState>) {
      saveToStorage(action.payload)
      return action.payload
    },
    logout() {
      localStorage.removeItem(STORAGE_KEY)
      return { token: null, userId: null, name: null, email: null, role: null, businessId: null, stationId: null, selectedStationId: null, supportsPool: true }
    },
    setSupportsPool(state, action: PayloadAction<boolean>) {
      const next = { ...state, supportsPool: action.payload }
      saveToStorage(next)
      return next
    },
    setSelectedStationId(state, action: PayloadAction<number | null>) {
      const next = { ...state, selectedStationId: action.payload }
      saveToStorage(next)
      return next
    },
  },
})

export const { setCredentials, logout, setSelectedStationId, setSupportsPool } = authSlice.actions
export default authSlice.reducer
