import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { QuestionCategory, QuestionRef, QuestionStatus, Task } from '../types'
import { PracticeTestDialog } from './PracticeTestDialog'
import { PracticeTestRow } from './PracticeTestRow'

interface Props {
  tasks: Task[]
  color: string
  onAddRegular: (title: string) => Promise<void>
  onAddPracticeTest: (data: { title: string; questionCount: number }) => Promise<void>
  onToggle: (id: string, done: boolean) => Promise<void>
  onToggleGoal: (id: string, isGoal: boolean) => Promise<void>
  onEdit: (id: string, title: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onUnarchive: (id: string) => Promise<void>
  onUpdateQuestion: (task: Task, index: number, status: QuestionStatus, note: string) => Promise<void>
  onResetPracticeTest: (task: Task) => Promise<void>
  categories?: QuestionCategory[]
  onToggleQuestionCategory?: (categoryId: string, ref: QuestionRef, add: boolean) => Promise<void>
}

const DEFAULT_QUESTION_COUNT = 20

export function TaskList({
  tasks,
  color,
  onAddRegular,
  onAddPracticeTest,
  onToggle,
  onToggleGoal,
  onEdit,
  onRemove,
  onArchive,
  onUnarchive,
  onUpdateQuestion,
  onResetPracticeTest,
  categories,
  onToggleQuestionCategory
}: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const activeTasks = tasks.filter((t) => !t.archived)
  const archivedTasks = tasks.filter((t) => t.archived)
  const openTasks = activeTasks.filter((t) => !t.done)
  const doneTasks = activeTasks.filter((t) => t.done)

  // Smart default: most-recent practice test's question count on this course.
  // useTasks orders by createdAt desc, so `find` returns the newest.
  const defaultQuestionCount = useMemo(() => {
    const lastCount = tasks.find(
      (t) => t.type === 'practiceTest' && typeof t.questionCount === 'number'
    )?.questionCount
    return lastCount ?? DEFAULT_QUESTION_COUNT
  }, [tasks])

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setBusy(true)
    try {
      await onAddRegular(title)
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

  const renderRow = (t: Task) => {
    if (t.type === 'practiceTest') {
      return (
        <PracticeTestRow
          key={t.id}
          task={t}
          color={color}
          onUpdateQuestion={onUpdateQuestion}
          onReset={onResetPracticeTest}
          onEditTitle={onEdit}
          onRemove={onRemove}
          onToggleGoal={(isGoal) => onToggleGoal(t.id, isGoal)}
          onArchive={() => onArchive(t.id)}
          categories={categories}
          onToggleCategory={onToggleQuestionCategory}
        />
      )
    }
    return (
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
        onToggle={() => onToggle(t.id, !t.done)}
        onRemove={() => onRemove(t.id)}
        onToggleGoal={() => onToggleGoal(t.id, !t.isGoal)}
        onArchive={() => onArchive(t.id)}
      />
    )
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

      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose/60 bg-white/70 hover:bg-petal/60 text-berry font-display font-semibold py-3 text-base transition active:scale-[0.99]"
        onClick={() => setShowTestDialog(true)}
      >
        <span className="text-xl leading-none">📝</span>
        Add a practice test
      </button>

      {activeTasks.length === 0 ? (
        <div className="text-center text-berry/60 text-sm py-8">
          {archivedTasks.length > 0
            ? '🗂️ All tasks are archived.'
            : '🌱 No tasks yet — add one above.'}
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>{openTasks.map(renderRow)}</AnimatePresence>
          </ul>

          {doneTasks.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-berry/60 uppercase tracking-wide mt-6 mb-2">
                Done · {doneTasks.length}
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>{doneTasks.map(renderRow)}</AnimatePresence>
              </ul>
            </div>
          )}
        </>
      )}

      {archivedTasks.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-berry/50 uppercase tracking-wide mt-4 hover:text-berry/70 transition"
            onClick={() => setShowArchived((v) => !v)}
          >
            <span>Archived · {archivedTasks.length}</span>
            <motion.span
              animate={{ rotate: showArchived ? 180 : 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260 }}
              className="inline-block leading-none text-base"
            >
              ⌄
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showArchived && (
              <motion.ul
                key="archived-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 mt-2 overflow-hidden"
              >
                {archivedTasks.map((t) => (
                  <ArchivedRow
                    key={t.id}
                    task={t}
                    onUnarchive={() => onUnarchive(t.id)}
                    onRemove={() => onRemove(t.id)}
                  />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <PracticeTestDialog
        open={showTestDialog}
        onClose={() => setShowTestDialog(false)}
        defaultQuestionCount={defaultQuestionCount}
        onSave={(data) => onAddPracticeTest(data)}
      />
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
  onToggleGoal: () => void
  onArchive: () => void
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
  onRemove,
  onToggleGoal,
  onArchive
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
        onClick={onToggleGoal}
        className={`shrink-0 transition text-lg px-1 ${
          task.isGoal
            ? 'text-berry'
            : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-berry/40 hover:text-berry'
        }`}
        aria-label={task.isGoal ? 'Remove from goals' : 'Set as goal'}
      >
        {task.isGoal ? '★' : '☆'}
      </button>

      <button
        onClick={onArchive}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-berry/50 hover:text-berry transition flex items-center px-1"
        aria-label="Archive task"
      >
        <ArchiveIcon />
      </button>

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

function ArchivedRow({
  task,
  onUnarchive,
  onRemove
}: {
  task: Task
  onUnarchive: () => void
  onRemove: () => void
}) {
  const isPT = task.type === 'practiceTest'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 border bg-white/40 border-petal/40"
    >
      <span className="text-base shrink-0 opacity-50">{isPT ? '📝' : '✓'}</span>
      <span className="flex-1 font-body text-berry/50 line-through text-sm truncate">
        {task.title}
      </span>
      {isPT && task.questionCount != null && (
        <span className="text-xs text-berry/40 shrink-0">{task.questionCount}Q</span>
      )}
      <button
        onClick={onUnarchive}
        className="shrink-0 text-xs font-semibold text-berry/60 hover:text-berry transition px-2 py-1 rounded-xl hover:bg-petal/50"
      >
        Restore
      </button>
      <button
        onClick={onRemove}
        className="shrink-0 text-berry/40 hover:text-berry transition text-sm px-1"
        aria-label="Delete task"
      >
        ×
      </button>
    </motion.li>
  )
}

function ArchiveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 7v9a1 1 0 001 1h10a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M10 15v-4M8 13l2 2 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
