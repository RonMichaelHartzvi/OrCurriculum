import { useEffect, useState } from 'react'
import { Dialog } from './ui/Dialog'
import { RingProgress } from './RingProgress'
import type { Course, Goal, Session } from '../types'
import { formatDuration, sessionElapsedMinutes, sessionRemainingMinutes } from '../lib/time'
import { primeAudio, requestNotificationPermission, stopAlarm, useWakeLock } from '../lib/alarm'

const DURATION_PRESETS = [25, 45, 60, 90, 120]

interface Props {
  open: boolean
  onClose: () => void
  course: Course
  active: Session | null
  initialMinutes?: number
  onStart: (input: {
    courseId: string
    goalId: string | null
    plannedMinutes: number
  }) => Promise<void>
  onComplete: (session: Session, goal: Goal | null, loggedMinutes: number) => Promise<void>
  onCancel: (session: Session) => Promise<void>
  onEndNow: (session: Session, goal: Goal | null) => Promise<void>
}

export function SessionTimer({
  open,
  onClose,
  course,
  active,
  initialMinutes,
  onStart,
  onComplete,
  onCancel,
  onEndNow
}: Props) {
  const [minutes, setMinutes] = useState<number>(initialMinutes ?? 60)
  const [customMin, setCustomMin] = useState<string>('')
  const [now, setNow] = useState<number>(Date.now())
  const [askConfirm, setAskConfirm] = useState<Session | null>(null)
  const [logAmount, setLogAmount] = useState<number>(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const isActiveForThisCourse = active && active.courseId === course.id

  // Hold the screen awake only during the countdown. Once the chime has
  // fired (`alarmedAt` set) the user has been nudged, so we release the
  // wake lock even if they haven't yet Log'd or Discarded — otherwise a
  // forgotten stale session pins the display on indefinitely.
  useWakeLock(Boolean(isActiveForThisCourse && !active?.alarmedAt))

  useEffect(() => {
    if (!open) return
    setMinutes(initialMinutes ?? 60)
    setCustomMin('')
  }, [open, initialMinutes])

  useEffect(() => {
    if (!isActiveForThisCourse) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isActiveForThisCourse])

  // When the session hits zero, switch to the confirm step. The chime + OS
  // notification are fired by SessionBanner (which is always mounted); we only
  // handle the log-confirm UI here, so an unmounted SessionTimer never misses
  // firing the alarm.
  useEffect(() => {
    if (!active || active.courseId !== course.id) return
    if (askConfirm) return
    const remaining = sessionRemainingMinutes(active, now)
    if (remaining <= 0 && active.outcome === 'running') {
      setAskConfirm(active)
      setLogAmount(active.plannedMinutes)
    }
  }, [active, course.id, now, askConfirm])


  async function handleStart() {
    if (starting) return
    setStarting(true)
    setStartError(null)
    try {
      primeAudio()
    } catch {
      /* ignore */
    }
    void requestNotificationPermission().catch(() => {})
    try {
      await onStart({
        courseId: course.id,
        goalId: null,
        plannedMinutes: minutes
      })
      // Success: close the setup modal so the persistent SessionBanner takes
      // over as the running-session UI.
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStartError(msg || 'Unknown error')
    } finally {
      setStarting(false)
    }
  }

  async function handleConfirm() {
    if (!askConfirm) return
    stopAlarm()
    await onComplete(askConfirm, null, Math.max(0, Math.round(logAmount)))
    setAskConfirm(null)
    onClose()
  }

  async function handleEndNow() {
    if (!active) return
    await onEndNow(active, null)
    onClose()
  }

  async function handleCancel() {
    if (!active) return
    const ok = confirm(
      'Discard this session? Your study time will not be recorded toward any goal.'
    )
    if (!ok) return
    await onCancel(active)
    onClose()
  }

  // Confirmation step: session hit zero, ask user how many minutes to log.
  if (askConfirm) {
    return (
      <Dialog
        open={open}
        onClose={() => {
          stopAlarm()
          setAskConfirm(null)
        }}
        title="Log this session"
      >
        <div className="space-y-4">
          <div className="text-sm text-berry/80">
            Great work! You planned {formatDuration(askConfirm.plannedMinutes)} on{' '}
            <span className="font-semibold">{course.name}</span>. How many minutes should we credit?
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={logAmount}
              onChange={(e) => setLogAmount(Number(e.target.value))}
              className="input w-28 text-center text-lg font-semibold"
            />
            <span className="text-berry/70 font-display font-semibold">minutes</span>
            <span className="text-xs text-berry/60">({formatDuration(logAmount)})</span>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost text-berry/70"
              onClick={async () => {
                const ok = confirm(
                  'Discard this session? Your study time will not be recorded toward any goal.'
                )
                if (!ok) return
                stopAlarm()
                await onCancel(askConfirm)
                setAskConfirm(null)
                onClose()
              }}
            >
              Discard
            </button>
            <button className="btn-primary" onClick={handleConfirm}>
              Log {formatDuration(logAmount)}
            </button>
          </div>
        </div>
      </Dialog>
    )
  }

  // Running session view — even if the modal was reopened, if active belongs to this course, resume UI.
  if (isActiveForThisCourse && active) {
    const elapsed = sessionElapsedMinutes(active, now)
    const remaining = Math.max(0, active.plannedMinutes - elapsed)
    const mm = Math.floor(remaining)
    const ss = Math.max(0, Math.round((remaining - mm) * 60))
    return (
      <Dialog open={open} onClose={onClose} title="Study session">
        <div className="space-y-5 flex flex-col items-center">
          <div className="text-sm text-berry/80 text-center font-semibold">
            {course.name}
          </div>
          <RingProgress
            value={elapsed}
            target={active.plannedMinutes}
            color={course.color}
            size={200}
            strokeWidth={16}
            label={`${mm}:${String(ss).padStart(2, '0')}`}
            sublabel={`of ${formatDuration(active.plannedMinutes)}`}
          />
          <div className="flex flex-wrap justify-center gap-2 w-full">
            <button className="btn-soft" onClick={handleCancel}>
              Discard
            </button>
            <button className="btn-primary" onClick={handleEndNow}>
              End now & log
            </button>
          </div>
          <p className="text-xs text-berry/60 text-center">
            Keep this tab open so the alarm fires on time.
          </p>
        </div>
      </Dialog>
    )
  }

  // Setup step
  return (
    <Dialog open={open} onClose={onClose} title={`Study ${course.name}`}>
      <div className="space-y-4">
        {active && active.courseId !== course.id && (
          <div className="text-sm text-berry/80 bg-petal/40 rounded-2xl px-3 py-2">
            A session is already running on another course. Finish or cancel it first.
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Duration
          </label>
          <div className="mt-1 grid grid-cols-5 gap-2">
            {DURATION_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`btn-soft text-sm py-2 flex-col leading-tight ${
                  minutes === m ? '!bg-white !text-berry shadow-soft' : ''
                }`}
                onClick={() => {
                  setMinutes(m)
                  setCustomMin('')
                }}
              >
                {m}
                <span className="text-[10px] opacity-70">min</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <input
              type="number"
              min={1}
              placeholder="Custom minutes"
              value={customMin}
              onChange={(e) => {
                setCustomMin(e.target.value)
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0) setMinutes(n)
              }}
              className="input flex-1"
            />
          </div>
        </div>
        {startError && (
          <div className="text-sm text-white bg-red-500/95 rounded-2xl px-3 py-3 font-semibold shadow-soft">
            Couldn't start the session: {startError}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={starting || Boolean(active && active.courseId !== course.id)}
            onClick={handleStart}
          >
            {starting ? 'Starting…' : `Start ${formatDuration(minutes)}`}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
