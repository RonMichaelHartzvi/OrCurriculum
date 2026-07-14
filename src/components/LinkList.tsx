import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { CourseLink } from '../types'

interface Props {
  links: CourseLink[]
  onAdd: (data: { url: string; label: string }) => Promise<void>
  onUpdate: (id: string, data: { url?: string; label?: string }) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function LinkList({ links, onAdd, onUpdate, onRemove }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [draftUrl, setDraftUrl] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editLabel, setEditLabel] = useState('')

  function startEdit(link: CourseLink) {
    setEditingId(link.id)
    setEditUrl(link.url)
    setEditLabel(link.label)
  }

  async function commitEdit() {
    if (!editingId) return
    const id = editingId
    setEditingId(null)
    if (editUrl.trim()) {
      await onUpdate(id, { url: editUrl, label: editLabel })
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    const url = draftUrl.trim()
    const label = draftLabel.trim()
    if (!url || !label) return
    setBusy(true)
    try {
      await onAdd({ url, label })
      setDraftUrl('')
      setDraftLabel('')
      setShowForm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && !showForm && (
        <div className="text-center text-berry/60 text-sm py-6">
          <div className="text-2xl mb-1">🔗</div>
          No links yet — add one below.
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {links.map((link) =>
            editingId === link.id ? (
              <motion.li
                key={link.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-petal bg-white/90 p-3 space-y-2"
              >
                <input
                  autoFocus
                  className="input w-full !py-1.5 text-sm"
                  placeholder="URL"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <input
                  className="input w-full !py-1.5 text-sm"
                  placeholder="Label"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" onClick={commitEdit}>
                    Save
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </motion.li>
            ) : (
              <motion.li
                key={link.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                className="group flex items-start gap-3 rounded-2xl border border-petal bg-white/80 shadow-soft px-3 py-2.5"
              >
                <span className="mt-0.5 text-lg leading-none select-none" aria-hidden>
                  🔗
                </span>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => window.open(link.url, '_blank')}
                    className="block text-left w-full font-body font-semibold text-berry hover:text-deepRose transition leading-snug truncate"
                  >
                    {link.label}
                  </button>
                  <span className="block text-xs text-berry/50 truncate mt-0.5">{link.url}</span>
                </div>
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button
                    onClick={() => startEdit(link)}
                    className="text-berry/50 hover:text-berry transition text-xs px-1.5 py-1 rounded-lg hover:bg-petal/40"
                    aria-label="Edit link"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(link.id)}
                    className="text-berry/40 hover:text-berry transition text-lg px-1 flex items-center justify-center"
                    aria-label="Delete link"
                  >
                    ×
                  </button>
                </div>
              </motion.li>
            )
          )}
        </AnimatePresence>
      </ul>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={submitAdd}
          >
            <div className="pt-1 space-y-2">
              <input
                autoFocus
                className="input w-full text-sm"
                placeholder="URL (e.g. https://example.com)"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
              />
              <input
                className="input w-full text-sm"
                placeholder="Label — what is this link for?"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={busy || !draftUrl.trim() || !draftLabel.trim()}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => {
                    setShowForm(false)
                    setDraftUrl('')
                    setDraftLabel('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose/60 bg-white/70 hover:bg-petal/60 text-berry font-display font-semibold py-3 text-base transition active:scale-[0.99]"
          onClick={() => setShowForm(true)}
        >
          <span className="text-xl leading-none">🔗</span>
          Add a link
        </button>
      )}
    </div>
  )
}
