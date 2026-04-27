import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useGetBusinessesQuery, useGetStationsQuery } from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
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
