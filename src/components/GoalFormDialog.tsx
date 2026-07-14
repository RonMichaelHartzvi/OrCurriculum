import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import type { Goal, GoalUnit, PeriodKind } from '../types'
import { formatDuration, hoursToMinutes, minutesToHours } from '../lib/time'

interface Props {
  open: boolean
  onClose: () => void
  courseName: string
  onSave: (data: {
    metric: string
    target: number
    period: PeriodKind
    unit: GoalUnit
  }) => Promise<void>
  onDelete?: () => Promise<void>
  initial?: Goal
}

const METRIC_SUGGESTIONS = ['questions', 'tests', 'chapters', 'pages', 'flashcards']

function initialUnit(g?: Goal): GoalUnit {
  if (!g) return 'minutes'
  return g.unit === 'minutes' ? 'minutes' : 'count'
}

export function GoalFormDialog({ open, onClose, courseName, onSave, onDelete, initial }: Props) {
  const [unit, setUnit] = useState<GoalUnit>('minutes')
  const [metric, setMetric] = useState('questions')
  const [target, setTarget] = useState<number>(20)
  const [hours, setHours] = useState<number>(2)
  const [period, setPeriod] = useState<PeriodKind>('weekly')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setUnit(initialUnit(initial))
    setPeriod(initial?.period ?? 'weekly')
    setMetric(initial?.unit !== 'minutes' ? (initial?.metric ?? 'questions') : 'questions')
    setTarget(initial?.unit !== 'minutes' ? (initial?.target ?? 5) : 5)
    setHours(initial?.unit === 'minutes' ? Number(minutesToHours(initial.target).toFixed(2)) : 2)
  }, [open, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (unit === 'minutes') {
      const minutes = hoursToMinutes(hours)
      if (!Number.isFinite(minutes) || minutes <= 0) return
      setBusy(true)
      try {
        await onSave({ metric: 'minutes', target: minutes, period, unit: 'minutes' })
        onClose()
      } finally {
        setBusy(false)
      }
      return
    }
    if (!metric.trim() || target <= 0) return
    setBusy(true)
    try {
      await onSave({ metric: metric.trim(), target, period, unit: 'count' })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const summaryTarget =
    unit === 'minutes' ? formatDuration(hoursToMinutes(hours)) : `${target} ${metric || 'items'}`

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit goal' : `New goal for ${courseName}`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Kind
          </label>
          <div className="mt-1 flex bg-petal/60 rounded-full p-1 text-sm font-display font-semibold">
            {(['minutes', 'count'] as GoalUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                className={`flex-1 rounded-full py-2 capitalize transition ${
                  unit === u ? 'bg-white text-berry shadow-soft' : 'text-berry/70'
                }`}
                onClick={() => setUnit(u)}
              >
                {u === 'count' ? 'Count' : 'Time'}
              </button>
            ))}
          </div>
        </div>

        {unit === 'count' ? (
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
        ) : (
          <div>
            <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
              I want to study for
            </label>
            <div className="mt-1 flex gap-2 items-center">
              <input
                className="input w-28 text-center text-lg font-semibold"
                type="number"
                min={0.25}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                required
              />
              <span className="text-berry/70 font-display font-semibold">hours</span>
            </div>
            <div className="mt-1 text-xs text-berry/60">
              That's {formatDuration(hoursToMinutes(hours))} total.
            </div>
          </div>
        )}

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
          {summaryTarget} every {period === 'weekly' ? 'week' : 'day'}. Progress resets automatically;
          past periods are saved in history.
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
