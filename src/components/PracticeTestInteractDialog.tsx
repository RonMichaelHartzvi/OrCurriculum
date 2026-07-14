import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import {
  QUESTION_STATUS_META,
  QUESTION_STATUS_ORDER,
  type QuestionStatus,
  type Task
} from '../types'

interface Props {
  task: Task | null
  color: string
  onUpdateQuestion: (task: Task, index: number, status: QuestionStatus, note: string) => Promise<void>
  onReset: (task: Task) => Promise<void>
  onClose: () => void
}

export function PracticeTestInteractDialog({
  task,
  color,
  onUpdateQuestion,
  onReset,
  onClose
}: Props) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  // Sync note when navigating to a question
  useEffect(() => {
    if (pickingIndex != null && task) {
      setNoteText(task.questionNotes?.[pickingIndex] ?? '')
    }
  }, [pickingIndex, task])

  // Return to grid when the dialog closes
  useEffect(() => {
    if (!task) setPickingIndex(null)
  }, [task])

  const questions = task?.questions ?? []
  const total = questions.length || task?.questionCount || 0
  const counts = tallyStatuses(questions)
  const answered = counts.succeeded + counts.failed
  const overallPct = total > 0 ? Math.round((answered / total) * 100) : 0

  async function chooseStatus(status: QuestionStatus) {
    if (pickingIndex == null || !task) return
    const idx = pickingIndex
    const note = noteText
    setPickingIndex(null)
    await onUpdateQuestion(task, idx, status, note)
  }

  return (
    <Dialog open={!!task} onClose={onClose} title={task?.title ?? ''}>
      {pickingIndex === null ? (
        <>
          {/* Summary header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-petal/40">
            <StatusDonut color={color} pct={overallPct} done={task?.done ?? false} />
            <div>
              <div className="font-semibold text-berry">{total} questions</div>
              <StatusSummary counts={counts} />
            </div>
          </div>

          {/* Question grid */}
          <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
            {questions.map((q, i) => {
              const meta = QUESTION_STATUS_META[q]
              return (
                <button
                  key={i}
                  onClick={() => setPickingIndex(i)}
                  className="relative rounded-2xl font-semibold h-14 flex flex-col items-center justify-center leading-tight border-2 transition active:scale-[0.97]"
                  style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                  aria-label={`Question ${i + 1}: ${meta.label}${task?.questionNotes?.[i] ? ' (has note)' : ''}`}
                >
                  <span className="opacity-70 text-xs">Q{i + 1}</span>
                  <span className="text-xl leading-none mt-0.5">{meta.symbol}</span>
                  {task?.questionNotes?.[i] && (
                    <span
                      className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: meta.border }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="btn-soft text-sm"
              onClick={() => {
                if (task && confirm('Reset all questions to Not done yet?')) onReset(task)
              }}
            >
              Reset all
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Status picker for a specific question */}
          <button
            className="btn-ghost text-sm mb-3"
            onClick={() => setPickingIndex(null)}
          >
            ← Back to questions
          </button>
          <div className="font-semibold text-berry mb-3">Question {pickingIndex + 1}</div>
          <div className="space-y-2">
            {QUESTION_STATUS_ORDER.map((s) => {
              const meta = QUESTION_STATUS_META[s]
              const current = questions[pickingIndex] === s
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
        </>
      )}
    </Dialog>
  )
}

function tallyStatuses(qs: QuestionStatus[]): Record<QuestionStatus, number> {
  const out: Record<QuestionStatus, number> = {
    succeeded: 0, failed: 0, retry: 0, unanswered: 0
  }
  for (const q of qs) out[q]++
  return out
}

function StatusSummary({ counts }: { counts: Record<QuestionStatus, number> }) {
  const parts = (
    [
      { key: 'succeeded' as QuestionStatus, n: counts.succeeded },
      { key: 'retry' as QuestionStatus, n: counts.retry },
      { key: 'failed' as QuestionStatus, n: counts.failed },
      { key: 'unanswered' as QuestionStatus, n: counts.unanswered }
    ] as Array<{ key: QuestionStatus; n: number }>
  ).filter((p) => p.n > 0)

  if (parts.length === 0) return null

  return (
    <span className="inline-flex items-center gap-2 text-sm text-berry/80">
      {parts.map((p, i) => {
        const meta = QUESTION_STATUS_META[p.key]
        return (
          <span key={p.key} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: meta.border }}
              aria-hidden
            />
            <span className="tabular-nums font-semibold">{p.n}</span>
            <span className="opacity-70">{meta.symbol}</span>
            {i < parts.length - 1 && <span className="opacity-40">·</span>}
          </span>
        )
      })}
    </span>
  )
}

function StatusDonut({ color, pct, done }: { color: string; pct: number; done: boolean }) {
  const size = 44
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - pct / 100)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FCE7F3" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      {done && (
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold" style={{ color }}>
          ✓
        </span>
      )}
    </div>
  )
}
