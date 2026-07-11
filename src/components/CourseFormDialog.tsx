import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import { COURSE_COLORS, COURSE_EMOJIS, type Course } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: { name: string; emoji: string; color: string }) => Promise<void>
  onDelete?: () => Promise<void>
  initial?: Course
}

export function CourseFormDialog({ open, onClose, onSave, onDelete, initial }: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string>(COURSE_EMOJIS[0])
  const [color, setColor] = useState<string>(COURSE_COLORS[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setEmoji(initial?.emoji ?? COURSE_EMOJIS[0])
      setColor(initial?.color ?? COURSE_COLORS[0])
    }
  }, [open, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSave({ name: name.trim(), emoji, color })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit course' : 'New course'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Name
          </label>
          <input
            className="input mt-1"
            placeholder="e.g. Anatomy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Emoji
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COURSE_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-10 h-10 rounded-2xl text-xl flex items-center justify-center transition ${
                  emoji === e
                    ? 'bg-white ring-2 ring-rose shadow-soft'
                    : 'bg-petal/60 hover:bg-petal'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Color
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COURSE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full transition ${
                  color === c ? 'ring-2 ring-offset-2 ring-berry' : ''
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {initial && onDelete && (
            <button
              type="button"
              className="btn-ghost text-berry/70 hover:text-berry"
              onClick={async () => {
                if (confirm(`Delete "${initial.name}" and all its goals?`)) {
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
