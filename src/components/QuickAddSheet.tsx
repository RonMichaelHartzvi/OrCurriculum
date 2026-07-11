import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import type { Goal } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  goal: Goal
  courseName: string
  progress: number
  onLog: (amount: number) => Promise<void>
}

export function QuickAddSheet({ open, onClose, goal, courseName, progress, onLog }: Props) {
  const [custom, setCustom] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setCustom('')
  }, [open])

  async function log(amount: number) {
    if (amount <= 0) return
    setBusy(true)
    try {
      await onLog(amount)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const remaining = Math.max(goal.target - progress, 0)

  return (
    <Dialog open={open} onClose={onClose} title={`Log ${goal.metric}`}>
      <div className="space-y-4">
        <div className="text-sm text-berry/80">
          <span className="font-semibold">{courseName}</span> — {progress} of {goal.target}{' '}
          {goal.metric} done. {remaining > 0 ? `${remaining} to go!` : 'Goal met — keep going 💗'}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 5, 10].map((n) => (
            <button
              key={n}
              className="btn-soft text-lg py-3 flex-col leading-tight"
              onClick={() => log(n)}
              disabled={busy}
            >
              +{n}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(custom)
            if (Number.isFinite(n) && n > 0) log(n)
          }}
          className="flex gap-2"
        >
          <input
            className="input flex-1"
            type="number"
            min={1}
            placeholder="Custom amount"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button className="btn-primary" disabled={busy || !custom}>
            Log
          </button>
        </form>
      </div>
    </Dialog>
  )
}
