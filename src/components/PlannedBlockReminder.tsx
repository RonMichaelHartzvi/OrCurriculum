import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { usePlannedBlocks } from '../hooks/usePlannedBlocks'
import { useCourses } from '../hooks/useCourses'
import { useGoals } from '../hooks/useGoals'
import { useSession } from '../hooks/useSession'
import { Dialog } from './ui/Dialog'
import { openPlan } from '../hooks/useRoute'
import { primeAudio, requestNotificationPermission, fireAlarm } from '../lib/alarm'
import { formatDuration } from '../lib/time'
import type { Course, PlannedBlock } from '../types'

const REMINDER_WINDOW_MS = 10 * 60 * 1000

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function PlannedBlockReminder({ user }: { user: User }) {
  const { blocks } = usePlannedBlocks(user.uid)
  const { courses } = useCourses(user.uid)
  const { goals, addGoal } = useGoals(user.uid)
  const { active, startSession } = useSession(user.uid)
  const fired = useRef(new Set<string>())
  const dismissed = useRef(new Set<string>())
  const [pending, setPending] = useState<{ block: PlannedBlock; course: Course } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const nowMs = now
    for (const block of blocks) {
      if (dismissed.current.has(block.id)) continue
      const startMs = block.startAt.toMillis()
      if (startMs > nowMs) continue
      if (startMs < nowMs - REMINDER_WINDOW_MS) continue
      const course = courses.find((c) => c.id === block.courseId)
      if (!course) continue

      setPending((prev) => prev ?? { block, course })

      if (!fired.current.has(block.id)) {
        fired.current.add(block.id)
        fireAlarm({
          title: `Time to study: ${block.title}`,
          body: `${course.name} · ${formatTime(block.startAt.toDate())}`,
          silent: true
        })
      }
      break
    }
  }, [now, blocks, courses])

  if (!pending) return null

  const { block, course } = pending
  const plannedMinutes = Math.max(
    1,
    Math.round((block.endAt.toMillis() - block.startAt.toMillis()) / 60_000)
  )
  const sessionRunning = Boolean(active)

  function dismiss() {
    dismissed.current.add(block.id)
    setPending(null)
  }

  async function handleStart() {
    if (starting || sessionRunning) return
    setStarting(true)
    try {
      primeAudio()
    } catch { /* ignore */ }
    void requestNotificationPermission().catch(() => {})
    try {
      const hasTimeGoal = goals.some(
        (g) => g.courseId === course.id && (g.unit ?? 'count') === 'minutes'
      )
      if (!hasTimeGoal) {
        await addGoal({ courseId: course.id, metric: 'minutes', target: 1, period: 'daily', unit: 'minutes' })
      }
      await startSession({ courseId: course.id, goalId: null, plannedMinutes })
      dismiss()
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog open onClose={dismiss} title="Time to study! 📚">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-soft flex-shrink-0"
            style={{ background: course.color }}
          >
            {course.emoji}
          </div>
          <div>
            <div className="font-display font-bold text-deepRose text-lg leading-tight">
              {block.title}
            </div>
            <div className="text-sm text-berry/70">{course.name}</div>
          </div>
        </div>
        <div className="bg-petal/40 rounded-2xl px-3 py-2 text-sm text-berry/80">
          🕐 {formatTime(block.startAt.toDate())} – {formatTime(block.endAt.toDate())}
        </div>
        {block.notes && (
          <div className="text-sm text-berry/70 italic">{block.notes}</div>
        )}
        {sessionRunning && (
          <div className="text-xs text-berry/60 bg-petal/40 rounded-2xl px-3 py-2">
            A session is already running — finish or cancel it first.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost text-berry/70" onClick={dismiss}>
            Dismiss
          </button>
          <button className="btn-soft text-sm" onClick={() => { dismiss(); openPlan() }}>
            Open plan
          </button>
          <button
            className="btn-primary"
            disabled={starting || sessionRunning}
            onClick={handleStart}
          >
            {starting ? 'Starting…' : `▶ Start ${formatDuration(plannedMinutes)}`}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
