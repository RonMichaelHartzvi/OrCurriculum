import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from './ui/Dialog'
import { RingProgress } from './RingProgress'
import { useBreak } from '../hooks/useBreak'
import type { Break } from '../types'
import { formatDuration } from '../lib/time'
import {
  fireAlarm,
  primeAudio,
  requestNotificationPermission,
  stopAlarm,
  useWakeLock
} from '../lib/alarm'

const BREAK_PRESETS = [5, 10, 15, 20]

interface Props {
  uid: string
}

function breakElapsedMinutes(brk: Break, now: number): number {
  const start = brk.startedAt?.toMillis?.() ?? null
  if (start == null) return 0
  return Math.max(0, (now - start) / 60000)
}

export function BreakFab({ uid }: Props) {
  const { active, startBreak, endBreak, markAlarmed } = useBreak(uid)
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState<number>(15)
  const [customMin, setCustomMin] = useState<string>('')
  const [now, setNow] = useState<number>(Date.now())
  // Local echo of alarmed state so the "break time over" transition is
  // reflected instantly, even if the Firestore markAlarmed write is slow
  // or fails — otherwise the dialog could stay locked when it shouldn't.
  const [alarmedLocal, setAlarmedLocal] = useState<string | null>(null)
  const [endError, setEndError] = useState<string | null>(null)

  // Hold the screen awake only while the break is still counting down.
  // Once the chime has fired (`alarmedAt` set) we release, so a stale
  // running break doesn't pin the display on until it's manually ended.
  useWakeLock(Boolean(active && !active.alarmedAt))

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])

  // `alarmedAt` is stored on the break doc so this survives BreakFab
  // unmount/remount (e.g. navigating Dashboard → CoursePage → Dashboard).
  const alarmed =
    Boolean(active?.alarmedAt) || (active != null && alarmedLocal === active.id)
  // Synchronous guard: markAlarmed's Firestore write is async, so `alarmed`
  // stays false until the snapshot returns (~200 ms). Without this ref the
  // next `now` tick re-runs the effect and fires the chime a second time.
  const firedForBreakIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!active) {
      firedForBreakIdRef.current = null
      return
    }
    if (alarmed || firedForBreakIdRef.current === active.id) return
    const remaining = active.plannedMinutes - breakElapsedMinutes(active, now)
    if (remaining <= 0) {
      firedForBreakIdRef.current = active.id
      setAlarmedLocal(active.id)
      fireAlarm({
        title: 'Break over 💗',
        body: 'Time to come back to study.'
      })
      markAlarmed(active).catch(() => {})
    }
  }, [active, now, alarmed, markAlarmed])

  // Auto-open the popup whenever a break is on and hasn't chimed yet, so
  // the user can't lose sight of it by navigating around. Runs on active
  // changes only — user closes are respected once the timer has expired.
  useEffect(() => {
    if (active && !alarmed) setOpen(true)
  }, [active?.id, alarmed])

  // Clear stale local flag when the break ends.
  useEffect(() => {
    if (!active) setAlarmedLocal(null)
  }, [active])

  async function handleStart() {
    await primeAudio()
    await requestNotificationPermission()
    await startBreak(minutes)
  }

  async function handleEnd() {
    if (!active) return
    // Kill any playing chime up front — mirrors SessionTimer.handleConfirm so
    // the sound stops immediately when the user taps End, even if the
    // Firestore write below is slow or fails.
    stopAlarm()
    try {
      setEndError(null)
      await endBreak(active, alarmed ? 'completed' : 'canceled')
      setOpen(false)
    } catch (err) {
      setEndError(
        err instanceof Error ? err.message : 'Could not end break. Try again.'
      )
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 left-6 sm:bottom-8 sm:left-8 rounded-full shadow-petal px-4 py-2 font-display font-semibold ${
          active
            ? 'bg-white text-berry animate-pulse'
            : 'bg-white/80 text-berry hover:bg-white'
        }`}
        onClick={() => setOpen(true)}
        aria-label={active ? 'Break in progress' : 'Take a break'}
      >
        ☕ {active ? 'On break' : 'Break'}
      </motion.button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={active ? 'On a break' : 'Take a break'}
        // Lock the popup while the break is running so the user can't
        // accidentally lose sight of it — only "End break" closes it.
        // Once the chime has fired the popup is dismissible again.
        dismissible={!(active && !alarmed)}
      >
        {active ? (
          <div className="space-y-4 flex flex-col items-center">
            <RingProgress
              value={breakElapsedMinutes(active, now)}
              target={active.plannedMinutes}
              color="#F9A8D4"
              size={180}
              strokeWidth={14}
              label={formatDuration(
                Math.max(0, active.plannedMinutes - breakElapsedMinutes(active, now))
              )}
              sublabel="left"
            />
            <button className="btn-primary w-full text-base py-3" onClick={handleEnd}>
              End break
            </button>
            {endError && (
              <p className="text-xs text-deepRose text-center">
                {endError} Tap "End break" to try again.
              </p>
            )}
            <p className="text-xs text-berry/60 text-center">
              {alarmed
                ? "Break's up — tap End break, or dismiss the popup."
                : "You'll hear a chime when your break's up."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {BREAK_PRESETS.map((m) => (
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
              className="input"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-soft" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleStart}>
                Start {formatDuration(minutes)} break
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
