import { Fuel, Menu, UserCircle, X } from 'lucide-react'

interface NavbarProps {
  businessName: string
  mobileNavOpen: boolean
  onMenuClick: () => void
  onProfileClick: () => void
}

export function Navbar({ businessName, mobileNavOpen, onMenuClick, onProfileClick }: NavbarProps) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Fuel className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Gas Station</p>
          <p className="max-w-[22rem] truncate text-xs text-slate-500" title={businessName}>
            {businessName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button> */}
        <button
          type="button"
          onClick={onProfileClick}
          className="rounded-full p-1.5 text-emerald-700 ring-2 ring-emerald-100 hover:bg-emerald-50"
          title="Profile"
        >
          <UserCircle className="h-7 w-7" />
        </button>
      </div>
    </header>
  )
}
