import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog } from './ui/Dialog'
import {
  QUESTION_STATUS_META,
  QUESTION_STATUS_ORDER,
  type QuestionStatus,
  type Task
} from '../types'

interface Props {
  task: Task
  color: string
  onUpdateQuestion: (task: Task, index: number, status: QuestionStatus) => Promise<void>
  onReset: (task: Task) => Promise<void>
  onEditTitle: (id: string, title: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function PracticeTestRow({
  task,
  color,
  onUpdateQuestion,
  onReset,
  onEditTitle,
  onRemove
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.title)
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)

  const questions = task.questions ?? []
  const total = questions.length || task.questionCount || 0
  const counts = tallyStatuses(questions)
  const answered = counts.succeeded + counts.failed
  const overallPct = total > 0 ? Math.round((answered / total) * 100) : 0

  async function commitEdit() {
    const t = editText.trim()
    if (t && t !== task.title) await onEditTitle(task.id, t)
    setEditing(false)
  }

  async function chooseStatus(status: QuestionStatus) {
    if (pickingIndex == null) return
    const idx = pickingIndex
    setPickingIndex(null)
    await onUpdateQuestion(task, idx, status)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      className={`group rounded-3xl border transition ${
        task.done
          ? 'bg-white/70 border-petal/60'
          : 'bg-white/85 border-petal shadow-soft'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Test-level status donut */}
        <div className="shrink-0" aria-hidden>
          <StatusDonut color={color} pct={overallPct} done={task.done} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              className="input !py-1.5 text-base"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') {
                  setEditing(false)
                  setEditText(task.title)
                }
              }}
            />
          ) : (
            <button
              onClick={() => {
                setEditText(task.title)
                setEditing(true)
              }}
              className={`text-left w-full font-body font-semibold text-base sm:text-lg text-berry hover:text-deepRose transition leading-tight ${
                task.done ? 'line-through text-berry/60' : ''
              }`}
            >
              {task.title}
            </button>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-sm">
            <span className="chip !text-xs !py-1">Practice test</span>
            <span className="text-berry/70 font-semibold">{total} Qs</span>
            <StatusSummary counts={counts} />
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 w-10 h-10 rounded-full bg-petal/70 hover:bg-mauve text-berry text-xl font-bold flex items-center justify-center transition active:scale-95"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="inline-block leading-none"
          >
            ⌄
          </motion.span>
        </button>
        <button
          onClick={() => onRemove(task.id)}
          className="shrink-0 w-8 h-8 rounded-full text-berry/40 hover:text-berry hover:bg-petal/40 transition text-xl flex items-center justify-center"
          aria-label="Delete practice test"
        >
          ×
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                {questions.map((q, i) => {
                  const meta = QUESTION_STATUS_META[q]
                  return (
                    <button
                      key={i}
                      onClick={() => setPickingIndex(i)}
                      className="rounded-2xl font-semibold h-14 flex flex-col items-center justify-center leading-tight border-2 transition active:scale-[0.97]"
                      style={{
                        background: meta.bg,
                        color: meta.text,
                        borderColor: meta.border
                      }}
                      aria-label={`Question ${i + 1}: ${meta.label}`}
                    >
                      <span className="opacity-70 text-xs">Q{i + 1}</span>
                      <span className="text-xl leading-none mt-0.5">{meta.symbol}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  className="btn-soft text-sm"
                  onClick={() => {
                    if (confirm('Reset all questions to Not done yet?')) onReset(task)
                  }}
                >
                  Reset all
                </button>
                <div className="flex-1" />
                <button className="btn-ghost text-sm" onClick={() => setExpanded(false)}>
                  Collapse
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={pickingIndex != null}
        onClose={() => setPickingIndex(null)}
        title={pickingIndex != null ? `Question ${pickingIndex + 1}` : ''}
      >
        <div className="space-y-2">
          {QUESTION_STATUS_ORDER.map((s) => {
            const meta = QUESTION_STATUS_META[s]
            const current =
              pickingIndex != null && questions[pickingIndex] === s
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
                <span className="font-display font-semibold flex-1 text-left">
                  {meta.label}
                </span>
                {current && <span className="text-xs opacity-70">Current</span>}
              </button>
            )
          })}
        </div>
      </Dialog>
    </motion.li>
  )
}

function tallyStatuses(qs: QuestionStatus[]): Record<QuestionStatus, number> {
  const out: Record<QuestionStatus, number> = {
    succeeded: 0,
    failed: 0,
    retry: 0,
    unanswered: 0
  }
  for (const q of qs) out[q]++
  return out
}

function StatusSummary({ counts }: { counts: Record<QuestionStatus, number> }) {
  const parts: Array<{ key: QuestionStatus; n: number }> = [
    { key: 'succeeded', n: counts.succeeded },
    { key: 'retry', n: counts.retry },
    { key: 'failed', n: counts.failed },
    { key: 'unanswered', n: counts.unanswered }
  ].filter((p) => p.n > 0) as Array<{ key: QuestionStatus; n: number }>

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

function StatusDonut({
  color,
  pct,
  done
}: {
  color: string
  pct: number
  done: boolean
}) {
  const size = 44
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - pct / 100)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#FCE7F3"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      {done && (
        <span
          className="absolute inset-0 flex items-center justify-center text-base font-bold"
          style={{ color }}
        >
          ✓
        </span>
      )}
    </div>
  )
}
