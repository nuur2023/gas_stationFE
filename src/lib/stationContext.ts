import { useAppSelector } from '../app/hooks'

export function isStationSelectableRole(role: string | null): boolean {
  return !!role
}

/** Only SuperAdmin sees Business / Station dropdowns on operational forms. */
export function showBusinessPickerInForms(role: string | null): boolean {
  return role === 'SuperAdmin'
}

/** Only SuperAdmin sees Station dropdown on operational forms (others use Settings or JWT). */
export function showStationPickerInForms(role: string | null): boolean {
  return role === 'SuperAdmin'
}

/** Data tables: Business column — SuperAdmin only (Admin and below never). */
export function showBusinessColumnInTables(role: string | null): boolean {
  return role === 'SuperAdmin'
}

/** Data tables: Station column — SuperAdmin and Admin (other roles never). */
export function showStationColumnInTables(role: string | null): boolean {
  return role === 'SuperAdmin' || role === 'Admin'
}

/**
 * Station id sent with API when the form hides the station picker.
 * SuperAdmin uses the value from the form control; everyone else uses workspace / JWT station.
 */
export function resolveFormStationId(
  role: string | null,
  formStationId: number,
  effectiveStationId: number | null,
): number {
  if (showStationPickerInForms(role)) return formStationId
  if (effectiveStationId != null && effectiveStationId > 0) return effectiveStationId
  return 0
}

/** Admin must pick a working station under Settings before station-scoped actions. */
export function adminNeedsSettingsStation(role: string | null, effectiveStationId: number | null): boolean {
  return role === 'Admin' && (effectiveStationId == null || effectiveStationId <= 0)
}

export const SETTINGS_STATION_HINT =
  'Choose a working station under Settings (Workspace) before saving.'

export function useEffectiveStationId(): number | null {
  const role = useAppSelector((s) => s.auth.role)
  const stationId = useAppSelector((s) => s.auth.stationId)
  const selectedStationId = useAppSelector((s) => s.auth.selectedStationId)

  if (isStationSelectableRole(role)) {
    return selectedStationId ?? stationId ?? null
  }
  return stationId ?? null
}
