import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  useGetNotificationsPagedQuery,
  useGetNotificationsUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../app/api/apiSlice'
import { useAppSelector } from '../app/hooks'
import type { AppNotificationItem } from '../types/models'
import { formatDecimal } from '../lib/formatNumber'

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

type PanelPhase = 'closed' | 'preview' | 'list'

export function NotificationBell() {
  const role = useAppSelector((s) => s.auth.role)
  const businessId = useAppSelector((s) => s.auth.businessId)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<PanelPhase>('closed')
  const [preview, setPreview] = useState<AppNotificationItem | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const skip = !businessId || businessId <= 0

  const { data: unreadData } = useGetNotificationsUnreadCountQuery(
    { businessId: businessId ?? undefined },
    { skip, pollingInterval: 45_000, refetchOnMountOrArgChange: true },
  )

  const { data: paged, refetch: refetchList } = useGetNotificationsPagedQuery(
    { businessId: businessId ?? undefined, page: 1, pageSize: 40 },
    { skip: skip || !open, refetchOnMountOrArgChange: true },
  )

  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()

  const unread = unreadData?.count ?? 0

  const clearPreviewTimer = useCallback(() => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current)
      previewTimer.current = null
    }
  }, [])

  const openPanel = useCallback(async () => {
    if (skip) return
    setOpen(true)
    const res = await refetchList()
    const items = res.data?.items ?? []
    const firstUnread = items.find((n) => !n.isRead) ?? null
    if (firstUnread) {
      setPreview(firstUnread)
      setPhase('preview')
      clearPreviewTimer()
      previewTimer.current = setTimeout(() => {
        setPhase('list')
        void markRead({ id: firstUnread.id, businessId: businessId ?? undefined })
        setPreview(null)
      }, 2000)
    } else {
      setPreview(null)
      setPhase('list')
    }
  }, [skip, refetchList, clearPreviewTimer, markRead, businessId])

  const closePanel = useCallback(() => {
    clearPreviewTimer()
    setOpen(false)
    setPhase('closed')
    setPreview(null)
  }, [clearPreviewTimer])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const el = panelRef.current
      if (!el || el.contains(e.target as Node)) return
      closePanel()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, closePanel])

  useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer])

  if (role === 'SuperAdmin' && (businessId == null || businessId <= 0)) {
    return null
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (open ? closePanel() : void openPanel())}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-emerald-700 hover:underline"
                onClick={() =>
                  void markAllRead({ businessId: businessId ?? undefined }).then(() => closePanel())
                }
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {phase === 'preview' && preview ? (
            <div className="space-y-2 px-3 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest</p>
              <p className="text-sm font-semibold text-slate-900">{preview.title}</p>
              <p className="text-sm leading-relaxed text-slate-700">{preview.body}</p>
              <p className="text-xs text-slate-500">
                {preview.stationName} · {formatDecimal(preview.liters)} L {preview.fuelName} ·{' '}
                {formatTimeAgo(preview.createdAt)}
              </p>
              <p className="text-xs text-slate-400">Opening full list in a moment…</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {(paged?.items ?? []).length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet.</li>
              ) : (
                (paged?.items ?? []).map((n) => (
                  <li key={n.id} className="border-b border-slate-50 last:border-0">
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        if (!n.isRead) {
                          void markRead({ id: n.id, businessId: businessId ?? undefined })
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{n.title}</span>
                        {!n.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {n.stationName} · {formatTimeAgo(n.createdAt)}
                        {n.confirmedByName ? ` · by ${n.confirmedByName}` : ''}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
