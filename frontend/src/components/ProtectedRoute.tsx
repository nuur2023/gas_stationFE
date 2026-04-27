import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { useNavAccess } from '../hooks/useNavAccess'

export function ProtectedRoute() {
  const token = useAppSelector((s) => s.auth.token)
  const location = useLocation()
  const { navSettled, hasAnyPermission, pathnameAllowed } = useNavAccess()

  if (!token) {
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
