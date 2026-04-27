import { Calendar } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  /** Field label shown above the control. */
  label?: string
  /** Value as `yyyy-MM-dd` for `input type="date"`. */
  value: string
  onChange: (isoDate: string) => void
  disabled?: boolean
  className?: string
}

/** Styled date control with calendar icon (uses native date picker). */
export function DateField({ label = 'Date', value, onChange, disabled, className }: Props) {
  return (
    <div className={clsx(className)}>
      <label className="mb-1 block text-sm font-medium text-slate-800">{label}</label>
      <div className="relative">
        <input
          type="date"
          lang="en-US"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-sky-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Calendar
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700"
          aria-hidden
        />
      </div>
    </div>
  )
}
