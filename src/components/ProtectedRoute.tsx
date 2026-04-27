import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { logout } from '../app/authSlice'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { useNavAccess } from '../hooks/useNavAccess'

function tokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (payloadRaw.length % 4)) % 4
    const normalized = payloadRaw + '='.repeat(padLen)
    const payload = JSON.parse(atob(normalized)) as { exp?: number }
    if (typeof payload.exp !== 'number') return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return false
  }
}

export function ProtectedRoute() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const location = useLocation()
  const { navSettled, hasAnyPermission, pathnameAllowed } = useNavAccess()
  const expired = token ? tokenExpired(token) : false

  useEffect(() => {
    if (!expired) return
    dispatch(logout())
  }, [dispatch, expired])

  if (!token || expired) {
    return <Navigate to="/login" replace />
  }

  if (!navSettled) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  // Users with no granted view permissions see a dedicated blank page (no app shell).
  if (!hasAnyPermission) {
    if (location.pathname !== '/no-permission') {
      return <Navigate to="/no-permission" replace />
    }
    return <Outlet />
  }

  if (location.pathname === '/no-permission') {
    return <Navigate to="/" replace />
  }

  if (!pathnameAllowed(location.pathname, location.search)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
