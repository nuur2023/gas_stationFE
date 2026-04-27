/** Display a rate without unnecessary trailing zeros (e.g. 0.4 not 0.4000). */
export function formatRateNumber(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return String(parseFloat(n.toFixed(10)))
}
