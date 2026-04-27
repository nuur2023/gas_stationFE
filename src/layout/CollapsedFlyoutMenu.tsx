import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../lib/cn'

const VIEW_MARGIN = 12
const ANCHOR_GAP = 8

function clampFlyoutToViewport(anchor: DOMRect, panelWidth: number, panelHeight: number): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = anchor.right + ANCHOR_GAP
  let top = anchor.top

  if (top + panelHeight > vh - VIEW_MARGIN) {
    top = vh - VIEW_MARGIN - panelHeight
  }
  if (top < VIEW_MARGIN) {
    top = VIEW_MARGIN
  }

  if (left + panelWidth > vw - VIEW_MARGIN) {
    left = anchor.left - ANCHOR_GAP - panelWidth
  }
  if (left < VIEW_MARGIN) {
    left = VIEW_MARGIN
  }

  return { top, left }
}

/** Match NavLink-style active state; when `to` includes `?`, compare pathname and query params. */
export function navTargetIsActive(pathname: string, search: string, to: string): boolean {
  const q = to.indexOf('?')
  if (q === -1) return pathname === to || pathname.startsWith(`${to}/`)
  const path = to.slice(0, q)
  if (pathname !== path) return false
  const want = new URLSearchParams(to.slice(q + 1))
  const have = new URLSearchParams(search)
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false
  }
  return true
}

export type FlyoutItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface CollapsedFlyoutMenuProps {
  open: boolean
  title: string
  items: readonly FlyoutItem[]
  anchorRef: React.RefObject<HTMLElement | null>
  onRequestClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function CollapsedFlyoutMenu({
  open,
  title,
  items,
  anchorRef,
  onRequestClose,
  onMouseEnter,
  onMouseLeave,
}: CollapsedFlyoutMenuProps) {
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return

    const sync = () => {
      const anchorEl = anchorRef.current
      const panelEl = panelRef.current
      if (!anchorEl || !panelEl) return
      const ar = anchorEl.getBoundingClientRect()
      const pr = panelEl.getBoundingClientRect()
      setPos(clampFlyoutToViewport(ar, pr.width, pr.height))
    }

    sync()
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [open, anchorRef, items, title])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className={cn(
        'flex min-w-[13.5rem] max-h-[80vh] flex-col rounded-xl border border-slate-700 bg-slate-950 shadow-2xl',
        /* min-h-0 so the scroll region can shrink inside max-h */
        'min-h-0',
      )}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="menu"
    >
      <p className="shrink-0 border-b border-slate-800 px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onRequestClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 text-sm',
                (to.includes('?')
                  ? navTargetIsActive(location.pathname, location.search, to)
                  : isActive)
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-200 hover:bg-slate-800',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>,
    document.body,
  )
}
