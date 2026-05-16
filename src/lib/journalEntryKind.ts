/**
 * API returns `entryKind` as a byte in some paths, but `JsonStringEnumConverter`
 * (see gas_station Program.cs) serializes `JournalEntryKind` as camelCase strings
 * on journal entities (e.g. "adjusting", "normal").
 */

export type JournalEntryKindParsed = 0 | 1 | 2 | 3

const labels: Record<JournalEntryKindParsed, string> = {
  0: 'Normal',
  1: 'Adjusting',
  2: 'Closing',
  3: 'Recurring',
}

/** Full enum including RecurringAuto (3). */
export function parseJournalEntryKind(v: unknown): JournalEntryKindParsed {
  if (v == null || v === '') return 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase().replace(/_/g, '')
    if (s === 'adjusting') return 1
    if (s === 'closing') return 2
    if (s === 'recurringauto') return 3
    if (s === 'normal') return 0
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= 3) return n as JournalEntryKindParsed
    return 0
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v === 1) return 1
    if (v === 2) return 2
    if (v === 3) return 3
    return 0
  }
  const n = Number(v)
  if (Number.isFinite(n) && n >= 0 && n <= 3) return n as JournalEntryKindParsed
  return 0
}

/** For manual-journal dropdowns (Normal / Adjusting / Closing only). */
export function journalEntryKindForForm(v: unknown): 0 | 1 | 2 {
  const k = parseJournalEntryKind(v)
  if (k === 3) return 0
  return k === 1 ? 1 : k === 2 ? 2 : 0
}

export function journalEntryKindTableLabel(v: unknown): string {
  return labels[parseJournalEntryKind(v)] ?? 'Normal'
}
