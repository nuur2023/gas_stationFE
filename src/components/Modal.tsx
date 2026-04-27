import { X } from 'lucide-react'
import { cn } from '../lib/cn'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Width/size; defaults to max-w-lg. Pass e.g. max-w-6xl — avoids conflicting with an internal max-width. */
  className?: string
}

export function Modal({ open, title, onClose, children, className = 'max-w-lg' }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 my-4 w-full max-h-[min(92vh,100dvh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:my-8 sm:p-6',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
