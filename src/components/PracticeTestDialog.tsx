import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'

interface Props {
  open: boolean
  onClose: () => void
  defaultQuestionCount: number
  onSave: (data: { title: string; questionCount: number }) => Promise<void>
}

export function PracticeTestDialog({ open, onClose, defaultQuestionCount, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [count, setCount] = useState<number>(defaultQuestionCount)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setCount(defaultQuestionCount)
    }
  }, [open, defaultQuestionCount])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t || count < 1) return
    setBusy(true)
    try {
      await onSave({ title: t, questionCount: Math.max(1, Math.floor(count)) })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New practice test">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Test name
          </label>
          <input
            className="input mt-1"
            placeholder="e.g. Chapter 4 practice"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Number of questions
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              className="btn-soft !px-3 !py-2 text-lg"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              aria-label="Decrease"
            >
              −
            </button>
            <input
              className="input flex-1 text-center text-lg font-semibold"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              required
            />
            <button
              type="button"
              className="btn-soft !px-3 !py-2 text-lg"
              onClick={() => setCount((c) => c + 1)}
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <p className="text-xs text-berry/60 mt-1">
            Next time on this course we'll default to {count}.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1" />
          <button type="button" className="btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || !title.trim() || count < 1}>
            {busy ? '…' : 'Create test'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
