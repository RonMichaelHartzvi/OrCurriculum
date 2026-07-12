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
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Test-level status donut */}
        <div className="shrink-0" aria-hidden>
          <StatusDonut color={color} pct={overallPct} done={task.done} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              className="input !py-1.5"
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
              className={`text-left w-full font-body font-semibold text-berry hover:text-deepRose transition ${
                task.done ? 'line-through text-berry/60' : ''
              }`}
            >
              {task.title}
            </button>
          )}
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
            <span className="chip !text-[10px] !py-0.5">Practice test</span>
            <span className="text-berry/70">{total} Qs</span>
            <StatusSummary counts={counts} />
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-ghost text-xs !px-3"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▴' : '▾'}
        </button>
        <button
          onClick={() => onRemove(task.id)}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-berry/50 hover:text-berry transition text-sm px-1"
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
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {questions.map((q, i) => {
                  const meta = QUESTION_STATUS_META[q]
                  return (
                    <button
                      key={i}
                      onClick={() => setPickingIndex(i)}
                      className="rounded-xl text-xs font-semibold h-10 flex flex-col items-center justify-center leading-tight border transition active:scale-[0.97]"
                      style={{
                        background: meta.bg,
                        color: meta.text,
                        borderColor: meta.border
                      }}
                      aria-label={`Question ${i + 1}: ${meta.label}`}
                    >
                      <span className="opacity-70 text-[10px]">Q{i + 1}</span>
                      <span className="text-sm leading-none">{meta.symbol}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  className="btn-soft text-xs"
                  onClick={() => {
                    if (confirm('Reset all questions to Not done yet?')) onReset(task)
                  }}
                >
                  Reset all
                </button>
                <div className="flex-1" />
                <button className="btn-ghost text-xs" onClick={() => setExpanded(false)}>
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
    <span className="inline-flex items-center gap-1.5 text-[11px] text-berry/80">
      {parts.map((p, i) => {
        const meta = QUESTION_STATUS_META[p.key]
        return (
          <span key={p.key} className="inline-flex items-center gap-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
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
  const size = 32
  const stroke = 4
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
          className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
          style={{ color }}
        >
          ✓
        </span>
      )}
    </div>
  )
}
