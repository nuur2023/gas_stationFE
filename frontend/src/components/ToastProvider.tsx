import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  type: ToastType
  message: string
}

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_TTL_MS = 3500

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const text = message?.trim()
      if (!text) return
      const id = nextIdRef.current++
      setToasts((prev) => [...prev, { id, type, message: text }])
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showSuccess: (message: string) => showToast(message, 'success'),
      showError: (message: string) => showToast(message, 'error'),
      showInfo: (message: string) => showToast(message, 'info'),
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-60 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const cls =
            t.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : t.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-800'
          return (
            <div key={t.id} className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow ${cls}`}>
              <div className="flex items-start justify-between gap-3">
                <p>{t.message}</p>
                <button
                  type="button"
                  className="rounded p-0.5 text-current/70 hover:bg-black/5"
                  onClick={() => dismiss(t.id)}
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

