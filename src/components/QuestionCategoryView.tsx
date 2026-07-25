import { useMemo, useState } from 'react'
import { Dialog } from './ui/Dialog'
import {
  QUESTION_STATUS_META,
  QUESTION_STATUS_ORDER,
  type QuestionCategory,
  type QuestionRef,
  type QuestionStatus,
  type Task
} from '../types'

interface ResolvedQuestion {
  ref: QuestionRef
  task: Task
  status: QuestionStatus
  note: string
}

interface Props {
  open: boolean
  category: QuestionCategory
  tasks: Task[]
  onClose: () => void
  onUpdateQuestion: (task: Task, index: number, status: QuestionStatus, note: string) => Promise<void>
  onToggleQuestion: (categoryId: string, ref: QuestionRef, add: boolean) => Promise<void>
}

export function QuestionCategoryView({
  open,
  category,
  tasks,
  onClose,
  onUpdateQuestion,
  onToggleQuestion
}: Props) {
  const [pickingEntry, setPickingEntry] = useState<ResolvedQuestion | null>(null)
  const [noteText, setNoteText] = useState('')

  const resolvedQuestions = useMemo(() => {
    return category.questions
      .map((ref): ResolvedQuestion | null => {
        const task = tasks.find((t) => t.id === ref.taskId)
        if (!task || !task.questions || ref.questionIndex >= task.questions.length) return null
        return {
          ref,
          task,
          status: task.questions[ref.questionIndex],
          note: task.questionNotes?.[ref.questionIndex] ?? ''
        }
      })
      .filter((x): x is ResolvedQuestion => x !== null)
  }, [category.questions, tasks])

  const byTask = useMemo(() => {
    const map = new Map<string, ResolvedQuestion[]>()
    for (const item of resolvedQuestions) {
      const list = map.get(item.task.id) ?? []
      list.push(item)
      map.set(item.task.id, list)
    }
    return map
  }, [resolvedQuestions])

  function openPicker(item: ResolvedQuestion) {
    setPickingEntry(item)
    setNoteText(item.note)
  }

  async function chooseStatus(status: QuestionStatus) {
    if (!pickingEntry) return
    const { task, ref } = pickingEntry
    setPickingEntry(null)
    await onUpdateQuestion(task, ref.questionIndex, status, noteText)
  }

  async function removeFromCategory() {
    if (!pickingEntry) return
    const { ref } = pickingEntry
    setPickingEntry(null)
    await onToggleQuestion(category.id, ref, false)
  }

  function handleClose() {
    setPickingEntry(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title={category.name} size="lg">
      {pickingEntry ? (
        <div className="space-y-3">
          <button className="btn-ghost text-sm" onClick={() => setPickingEntry(null)}>
            ← Back
          </button>
          <div className="text-sm font-semibold text-berry/70 mb-1">
            {pickingEntry.task.title} · Question {pickingEntry.ref.questionIndex + 1}
          </div>
          <div className="space-y-2">
            {QUESTION_STATUS_ORDER.map((s) => {
              const meta = QUESTION_STATUS_META[s]
              const current = pickingEntry.status === s
              return (
                <button
                  key={s}
                  onClick={() => chooseStatus(s)}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 border-2 transition active:scale-[0.99]"
                  style={{
                    background: meta.bg,
                    color: meta.text,
                    borderColor: current ? meta.border : 'transparent'
                  }}
                >
                  <span className="text-xl w-6 text-center">{meta.symbol}</span>
                  <span className="font-display font-semibold flex-1 text-left">{meta.label}</span>
                  {current && <span className="text-xs opacity-70">Current</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-berry/70 mb-1.5">
              Note (optional)
            </label>
            <textarea
              className="input w-full resize-none text-sm"
              rows={3}
              placeholder="Add a note for this question…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <div className="pt-2 border-t border-petal/40">
            <button
              className="btn-ghost text-sm text-deepRose hover:text-deepRose"
              onClick={removeFromCategory}
            >
              Remove from category
            </button>
          </div>
        </div>
      ) : resolvedQuestions.length === 0 ? (
        <div className="text-center text-berry/60 text-sm py-10">
          <div className="text-3xl mb-2">🏷️</div>
          No questions in this category yet — expand a practice test and tap a question to assign it here.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byTask.entries()).map(([, items]) => {
            const taskTitle = items[0].task.title
            return (
              <div key={items[0].task.id}>
                <div className="text-xs font-semibold text-berry/60 uppercase tracking-wide mb-2">
                  {taskTitle}
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                  {items.map((item) => {
                    const meta = QUESTION_STATUS_META[item.status]
                    return (
                      <button
                        key={`${item.ref.taskId}-${item.ref.questionIndex}`}
                        onClick={() => openPicker(item)}
                        className="relative rounded-2xl font-semibold h-14 flex flex-col items-center justify-center leading-tight border-2 transition active:scale-[0.97]"
                        style={{
                          background: meta.bg,
                          color: meta.text,
                          borderColor: meta.border
                        }}
                        aria-label={`Question ${item.ref.questionIndex + 1}: ${meta.label}${item.note ? ' (has note)' : ''}`}
                      >
                        <span className="opacity-70 text-xs">Q{item.ref.questionIndex + 1}</span>
                        <span className="text-xl leading-none mt-0.5">{meta.symbol}</span>
                        {item.note && (
                          <span
                            className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full"
                            style={{ background: meta.border }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
