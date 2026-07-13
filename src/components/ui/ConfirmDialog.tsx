import { useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false
}: Props) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-berry/80">{message}</div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-soft" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-primary !bg-deepRose' : 'btn-primary'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
