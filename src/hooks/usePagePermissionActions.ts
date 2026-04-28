import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavAccess, type RouteActionFlags } from './useNavAccess'

/** Action flags for the current URL (View follows nav rules; CRUD from matching permission rows). */
export function usePagePermissionActions(): RouteActionFlags {
  const { pathname, search } = useLocation()
  const { getRouteActionFlags } = useNavAccess()
  return useMemo(() => getRouteActionFlags(pathname, search), [getRouteActionFlags, pathname, search])
}
