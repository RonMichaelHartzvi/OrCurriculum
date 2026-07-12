import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'

interface Props {
  tasks: Task[]
  color: string
  onAdd: (title: string) => Promise<void>
  onToggle: (id: string, done: boolean) => Promise<void>
  onEdit: (id: string, title: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function TaskList({ tasks, color, onAdd, onToggle, onEdit, onRemove }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const openTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setBusy(true)
    try {
      await onAdd(title)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  async function commitEdit(id: string) {
    const t = editingText.trim()
    if (t) await onEdit(id, t)
    setEditingId(null)
    setEditingText('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitAdd} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Add a task…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn-primary" disabled={busy || !draft.trim()}>
          Add
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="text-center text-berry/60 text-sm py-8">
          🌱 No tasks yet — add one above.
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {openTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  color={color}
                  editing={editingId === t.id}
                  editingText={editingText}
                  onStartEdit={() => {
                    setEditingId(t.id)
                    setEditingText(t.title)
                  }}
                  onChangeEditText={setEditingText}
                  onCommitEdit={() => commitEdit(t.id)}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setEditingText('')
                  }}
                  onToggle={() => onToggle(t.id, true)}
                  onRemove={() => onRemove(t.id)}
                />
              ))}
            </AnimatePresence>
          </ul>

          {doneTasks.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-berry/60 uppercase tracking-wide mt-6 mb-2">
                Done · {doneTasks.length}
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {doneTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      color={color}
                      editing={editingId === t.id}
                      editingText={editingText}
                      onStartEdit={() => {
                        setEditingId(t.id)
                        setEditingText(t.title)
                      }}
                      onChangeEditText={setEditingText}
                      onCommitEdit={() => commitEdit(t.id)}
                      onCancelEdit={() => {
                        setEditingId(null)
                        setEditingText('')
                      }}
                      onToggle={() => onToggle(t.id, false)}
                      onRemove={() => onRemove(t.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface RowProps {
  task: Task
  color: string
  editing: boolean
  editingText: string
  onStartEdit: () => void
  onChangeEditText: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onToggle: () => void
  onRemove: () => void
}

function TaskRow({
  task,
  color,
  editing,
  editingText,
  onStartEdit,
  onChangeEditText,
  onCommitEdit,
  onCancelEdit,
  onToggle,
  onRemove
}: RowProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition ${
        task.done
          ? 'bg-white/60 border-petal/60'
          : 'bg-white/80 border-petal shadow-soft hover:shadow-petal'
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
          task.done ? 'text-white' : 'bg-white hover:bg-petal/40'
        }`}
        style={
          task.done
            ? { background: color, borderColor: color }
            : { borderColor: color }
        }
      >
        {task.done && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M5 10.5l3.5 3.5L15 6.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </button>

      {editing ? (
        <input
          autoFocus
          className="input flex-1 !py-1.5"
          value={editingText}
          onChange={(e) => onChangeEditText(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit()
            if (e.key === 'Escape') onCancelEdit()
          }}
        />
      ) : (
        <button
          onClick={onStartEdit}
          className={`flex-1 text-left font-body text-berry hover:text-deepRose transition ${
            task.done ? 'line-through text-berry/50' : ''
          }`}
        >
          {task.title}
        </button>
      )}

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-berry/50 hover:text-berry transition text-sm px-1"
        aria-label="Delete task"
      >
        ×
      </button>
    </motion.li>
  )
}
