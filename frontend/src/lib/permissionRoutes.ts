/**
 * Whether the current URL is allowed by a single permission route string from the API.
 * Stricter than {@link navTargetIsActive}: the Reports menu uses `/reports`, which must not
 * imply access to Financial reports (`/reports/financial` or `/financial-reports/...`), which is a separate menu in the UI.
 */
export function permissionRouteMatches(
  pathname: string,
  search: string,
  allowedRoute: string,
): boolean {
  const r = allowedRoute.trim()
  if (!r) return false

  const q = r.indexOf('?')
  if (q !== -1) {
    const path = r.slice(0, q)
    if (pathname !== path) return false
    const want = new URLSearchParams(r.slice(q + 1))
    const have = new URLSearchParams(search)
    for (const [k, v] of want.entries()) {
      if (have.get(k) !== v) return false
    }
    return true
  }

  if (pathname === r) return true
  if (pathname.startsWith(`${r}/`)) {
    if (
      r === '/reports' &&
      (pathname.startsWith('/reports/financial') || pathname.startsWith('/financial-reports'))
    ) {
      return false
    }
    return true
  }
  return false
}
