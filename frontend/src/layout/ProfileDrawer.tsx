import { Building2, FuelIcon, LogOut, Mail, Settings, ShieldCheck, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../app/authSlice'
import { useAppDispatch } from '../app/hooks'
import { cn } from '../lib/cn'

interface ProfileDrawerProps {
  open: boolean
  onClose: () => void
  userName: string | null
  userEmail: string | null
  role: string | null
  businessName: string
  stationName: string
}

export function ProfileDrawer({
  open,
  onClose,
  userName,
  userEmail,
  role,
  businessName,
  stationName,
}: ProfileDrawerProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const roleName = (role ?? '').toLowerCase()
  const canOpenSettings = roleName === 'admin' || roleName === 'superadmin'

  function handleLogout() {
    dispatch(logout())
    onClose()
    navigate('/login')
  }

  function handleSettings() {
    onClose()
    navigate('/setup/settings')
  }
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[10020] bg-slate-900/30 backdrop-blur-[1px]"
          aria-label="Close profile"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed right-0 top-0 z-[10021] flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#009966] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 space-between flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-4 py-5 h-full">
            <div className="w-40 h-48 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col items-center space-between gap-7">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-800 ring-4 ring-emerald-50">
                  {(userName?.[0] ?? 'U').toUpperCase()}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {role ?? 'User'}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <UserRound className="h-4 w-4" />
                </div>
                <p className="truncate text-base font-semibold text-slate-900">{userName ?? '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <Mail className="h-4 w-4" />
                </div>
                <p className="truncate text-sm text-slate-700">{userEmail ?? '—'}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <p className="truncate text-base font-semibold text-slate-900">{businessName}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <FuelIcon className="h-4 w-4" />
                </div>
                <p className="truncate text-sm text-slate-700">{stationName}</p>
              </div>
            </div>
            {canOpenSettings ? (
              <button
                type="button"
                onClick={handleSettings}
                className="inline-flex w-full bg-white items-center justify-start gap-2 shadow-sm rounded-xl border border-slate-200 px-4 py-4 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            ) : null}
          </div>
          <div className="mt-auto space-y-2 border-t border-slate-200 bg-white px-4 py-4">
           
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center cursor-pointer justify-center gap-2 rounded-md bg-[#009966] px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
