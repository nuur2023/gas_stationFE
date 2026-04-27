/**
 * Readable decimals with grouping (e.g. 6,543,810.00).
 * Uses the built-in `Intl.NumberFormat` API (no extra npm dependency).
 */
export function formatDecimal(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Strip grouping and parse; used before save or math. */
export function parseNumericInput(raw: string): number {
  const s = raw.replace(/,/g, '').replace(/\s/g, '').trim()
  if (s === '' || s === '.' || s === '-') return NaN
  return Number.parseFloat(s)
}

/** Grouped number without forcing 2 decimals (good for exchange rates). */
export function formatDecimalFlexible(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 12,
    minimumFractionDigits: 0,
  }).format(value)
}

/** Formatted money with symbol (default USD). Pass ISO 4217 code when known (e.g. `SOS`). */
export function formatCurrency(value: number, currencyCode = 'USD', fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value)
  } catch {
    return `${currencyCode} ${formatDecimal(value, fractionDigits)}`
  }
}

/** Uses the configured currency symbol from setup (e.g. fuel prices), not ISO formatting. */
export function formatWithCurrencySymbol(
  value: number,
  symbol: string | undefined,
  fractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return '—'
  const num = formatDecimal(value, fractionDigits)
  const s = symbol?.trim() ?? ''
  if (!s) return num
  return s.length === 1 ? `${s}${num}` : `${s} ${num}`
}
