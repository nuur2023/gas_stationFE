import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Building2, MapPin, Settings2 } from 'lucide-react'
import { useGetBusinessesQuery, useGetStationsQuery } from '../../app/api/apiSlice'
import { setSelectedStationId } from '../../app/authSlice'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { FormSelect, type SelectOption } from '../../components/FormSelect'
import { cn } from '../../lib/cn'
import { isStationSelectableRole } from '../../lib/stationContext'

function SettingsSelectRow(props: {
  icon: ReactNode
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-1xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/4 transition-shadow p-2',
        'focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500/20',
        props.disabled && 'opacity-60',
      )}
    >
      <div
        className={cn(
          'flex w-12 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-emerald-600',
          props.disabled && 'bg-slate-100 text-slate-400',
        )}
        aria-hidden
      >
        {props.icon}
      </div>
      <div className="min-w-0 flex-1 self-center py-0.5">{props.children}</div>
      {/* <div className="flex w-10 shrink-0 items-center justify-center border-l border-slate-100 text-slate-300">
        <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div> */}
    </div>
  )
}

export function SettingsPage() {
  const dispatch = useAppDispatch()
  const role = useAppSelector((s) => s.auth.role)
  const authBusinessId = useAppSelector((s) => s.auth.businessId)
  const selectedStationId = useAppSelector((s) => s.auth.selectedStationId)
  const isSuperAdmin = role === 'SuperAdmin'
  const canSelectStation = isStationSelectableRole(role)

  const [businessId, setBusinessId] = useState<number | null>(isSuperAdmin ? null : authBusinessId)
  const { data: businessesData } = useGetBusinessesQuery({ page: 1, pageSize: 500, q: undefined }, { skip: !isSuperAdmin })
  const { data: stationsData } = useGetStationsQuery(
    { page: 1, pageSize: 500, q: undefined, businessId: (isSuperAdmin ? businessId : authBusinessId) ?? undefined },
    { skip: (isSuperAdmin ? businessId : authBusinessId) == null || (isSuperAdmin ? businessId : authBusinessId)! <= 0 },
  )

  const businessOptions: SelectOption[] = useMemo(
    () => (businessesData?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    [businessesData?.items],
  )
  const stationOptions: SelectOption[] = useMemo(
    () => (stationsData?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [stationsData?.items],
  )

  useEffect(() => {
    const stations = stationsData?.items ?? []
    if (!canSelectStation) return
    if (stations.length === 1) {
      dispatch(setSelectedStationId(stations[0].id))
      return
    }
    if (stations.length > 1 && selectedStationId && !stations.some((s) => s.id === selectedStationId)) {
      dispatch(setSelectedStationId(null))
    }
  }, [canSelectStation, stationsData?.items, selectedStationId, dispatch])

  const stationSel = stationOptions.find((o) => o.value === String(selectedStationId ?? '')) ?? null
  const businessSel = businessOptions.find((o) => o.value === String(businessId ?? '')) ?? null

  const stationDisabled =
    stationOptions.length === 1 || (isSuperAdmin && (businessId == null || businessId <= 0))

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Workspace
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          switch your required stations to review reports and operations.
        </p>
        {/* {summaryLine ? (
          <p className="mt-2 text-sm font-medium text-emerald-800">{summaryLine}</p>
        ) : null} */}
      </div>

      <div className="space-y-3">
        {!canSelectStation && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            You have permission to open Settings, but station switching is disabled for your role.
          </div>
        )}
        {isSuperAdmin && (
          <SettingsSelectRow icon={<Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />}>
            <FormSelect
              embedded
              aria-label="Business"
              options={businessOptions}
              value={businessSel}
              onChange={(o) => {
                setBusinessId(o ? Number(o.value) : null)
                dispatch(setSelectedStationId(null))
              }}
              placeholder="Select business…"
            />
          </SettingsSelectRow>
        )}

        <SettingsSelectRow disabled={stationDisabled} icon={<MapPin className="h-5 w-5" strokeWidth={2} aria-hidden />}>
          <FormSelect
            embedded
            aria-label="Station"
            options={stationOptions}
            value={stationSel}
            onChange={(o) => dispatch(setSelectedStationId(o ? Number(o.value) : null))}
            placeholder={
              isSuperAdmin && (businessId == null || businessId <= 0) ? 'Select a business first…' : 'Select station…'
            }
            isDisabled={!canSelectStation || stationDisabled}
            isClearable={true}
          />
        </SettingsSelectRow>
      </div>

      <p className="text-center text-xs text-slate-500">
        Applies immediately for users who are granted access to this page.
      </p>
    </div>
  )
}
