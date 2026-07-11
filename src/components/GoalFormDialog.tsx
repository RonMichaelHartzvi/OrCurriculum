import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import type { Goal, PeriodKind } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  courseName: string
  onSave: (data: { metric: string; target: number; period: PeriodKind }) => Promise<void>
  onDelete?: () => Promise<void>
  initial?: Goal
}

const METRIC_SUGGESTIONS = ['questions', 'tests', 'chapters', 'pages', 'hours', 'flashcards']

export function GoalFormDialog({ open, onClose, courseName, onSave, onDelete, initial }: Props) {
  const [metric, setMetric] = useState('questions')
  const [target, setTarget] = useState<number>(20)
  const [period, setPeriod] = useState<PeriodKind>('weekly')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMetric(initial?.metric ?? 'questions')
      setTarget(initial?.target ?? 20)
      setPeriod(initial?.period ?? 'weekly')
    }
  }, [open, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!metric.trim() || target <= 0) return
    setBusy(true)
    try {
      await onSave({ metric: metric.trim(), target, period })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit goal' : `New goal for ${courseName}`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            I want to do
          </label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              className="input w-24 text-center text-lg font-semibold"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              required
            />
            <input
              className="input flex-1"
              placeholder="questions"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              list="metric-list"
              required
            />
            <datalist id="metric-list">
              {METRIC_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Every
          </label>
          <div className="mt-1 flex bg-petal/60 rounded-full p-1 text-sm font-display font-semibold">
            {(['weekly', 'daily'] as PeriodKind[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`flex-1 rounded-full py-2 capitalize transition ${
                  period === p ? 'bg-white text-berry shadow-soft' : 'text-berry/70'
                }`}
                onClick={() => setPeriod(p)}
              >
                {p === 'weekly' ? 'week' : 'day'}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-berry/70 bg-petal/40 rounded-2xl px-3 py-2">
          Progress resets automatically at the start of each {period === 'weekly' ? 'week' : 'day'}.
          Past periods are saved in history.
        </div>

        <div className="flex items-center gap-2 pt-1">
          {initial && onDelete && (
            <button
              type="button"
              className="btn-ghost text-berry/70 hover:text-berry"
              onClick={async () => {
                if (confirm('Delete this goal?')) {
                  await onDelete()
                  onClose()
                }
              }}
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? '…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
