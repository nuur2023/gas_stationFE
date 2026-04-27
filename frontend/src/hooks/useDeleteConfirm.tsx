import { useCallback, useState } from 'react'
import { DeleteConfirmDialog, type DeleteConfirmDialogProps } from '../components/DeleteConfirmDialog'

type RequestOpts = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DeleteConfirmDialogProps['variant']
  action: () => Promise<void>
}

export function useDeleteConfirm() {
  const [pending, setPending] = useState<RequestOpts | null>(null)
  const [loading, setLoading] = useState(false)

  const requestDelete = useCallback((opts: RequestOpts) => {
    setPending(opts)
  }, [])

  const close = useCallback(() => {
    if (!loading) setPending(null)
  }, [loading])

  const handleConfirm = useCallback(async () => {
    if (!pending) return
    setLoading(true)
    try {
      await pending.action()
      setPending(null)
    } finally {
      setLoading(false)
    }
  }, [pending])

  const dialog = (
    <DeleteConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description ?? ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      variant={pending?.variant ?? 'danger'}
      loading={loading}
      onCancel={close}
      onConfirm={handleConfirm}
    />
  )

  return { requestDelete, dialog }
}
