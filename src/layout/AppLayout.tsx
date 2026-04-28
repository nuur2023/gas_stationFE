import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useGetBusinessesQuery, useGetStationsQuery } from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
import { useNavAccess } from '../hooks/useNavAccess'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/hooks'
import { Navbar } from './Navbar'
import { ProfileDrawer } from './ProfileDrawer'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const location = useLocation()
  const isMd = useMediaQuery('(min-width: 768px)')
  const { name, email, role, businessId, stationId, selectedStationId } = useAppSelector((s) => s.auth)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const activeStationId = selectedStationId ?? stationId

  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 300, q: undefined }, { skip: !businessId })
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 300, q: undefined, businessId: businessId ?? undefined },
    { skip: !businessId },
  )

  const businessName = businessesData?.items.find((b) => b.id === businessId)?.name ?? 'Gas Station'
  const stationName =
    stationsData?.items.find((s) => s.id === activeStationId)?.name ?? (activeStationId ? `Station #${activeStationId}` : 'Menu')

  const { navSettled, getRouteActionFlags } = useNavAccess()
  const pageFlags = useMemo(
    () => getRouteActionFlags(location.pathname, location.search),
    [getRouteActionFlags, location.pathname, location.search],
  )
  const mainContentBlocked = navSettled && !pageFlags.canView

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (isMd) setMobileNavOpen(false)
  }, [isMd])

  return (
    <div className="flex h-screen min-h-0 bg-slate-50">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-slate-900/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          'flex h-full shrink-0 transition-transform duration-200 ease-out',
          'fixed left-0 top-0 z-[100] md:relative md:z-auto',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Sidebar
          collapsed={isMd ? collapsed : false}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          userName={name}
          userEmail={email}
          role={role}
          stationName={stationName}
        />
      </div>
      <div className="relative z-0 flex min-w-0 flex-1 flex-col">
        <Navbar
          businessName={businessName}
          onMenuClick={() => setMobileNavOpen(true)}
          onProfileClick={() => setProfileOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        {mainContentBlocked ? (
          <div
            className="pointer-events-auto absolute inset-0 z-20 flex items-start justify-center bg-slate-50/50 px-4 pb-24 pt-16 backdrop-blur-sm"
            role="presentation"
          >
            <p className="max-w-md rounded-xl border border-slate-200 bg-white/95 px-5 py-4 text-center text-sm leading-relaxed text-slate-700 shadow-lg">
              You do not have permission to view this page. Use the menu on the left to open an area you are allowed to access.
            </p>
          </div>
        ) : null}
      </div>
      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={name}
        userEmail={email}
        role={role}
        businessName={businessName}
        stationName={stationName}
      />
    </div>
  )
}
