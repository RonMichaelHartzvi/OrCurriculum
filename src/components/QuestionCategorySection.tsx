import { useState } from 'react'
import { ConfirmDialog } from './ui/ConfirmDialog'
import type { QuestionCategory } from '../types'

interface Props {
  categories: QuestionCategory[]
  onAdd: (name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onView: (category: QuestionCategory) => void
}

export function QuestionCategorySection({ categories, onAdd, onDelete, onView }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<QuestionCategory | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    setBusy(true)
    try {
      await onAdd(name)
      setDraft('')
      setShowForm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {categories.length === 0 && !showForm ? (
        <div className="text-center text-berry/60 text-sm py-6">
          🏷️ No categories yet — add one below.
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-petal/40 border border-petal"
            >
              <span className="text-base shrink-0">🏷️</span>
              <button
                className="flex-1 text-left font-body text-berry hover:text-deepRose transition"
                onClick={() => onView(cat)}
              >
                {cat.name}
              </button>
              <span className="text-xs text-berry/50 shrink-0">
                {cat.questions.length} {cat.questions.length === 1 ? 'question' : 'questions'}
              </span>
              <button
                onClick={() => setPendingDelete(cat)}
                className="shrink-0 text-berry/40 hover:text-deepRose transition text-base px-1"
                aria-label={`Delete category ${cat.name}`}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            autoFocus
            className="input flex-1"
            placeholder="Category name…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowForm(false)
                setDraft('')
              }
            }}
          />
          <button className="btn-primary" disabled={busy || !draft.trim()}>
            Add
          </button>
          <button
            type="button"
            className="btn-soft"
            onClick={() => {
              setShowForm(false)
              setDraft('')
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose/60 bg-white/70 hover:bg-petal/60 text-berry font-display font-semibold py-3 text-base transition active:scale-[0.99]"
          onClick={() => setShowForm(true)}
        >
          <span className="text-xl leading-none">🏷️</span>
          Add a category
        </button>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => onDelete(pendingDelete!.id)}
        title="Delete category"
        message={`Delete "${pendingDelete?.name}"? This won't affect the questions themselves.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
