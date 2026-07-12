import { useEffect, useState } from 'react'
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
  const { active, startBreak, endBreak } = useBreak(uid)
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState<number>(15)
  const [customMin, setCustomMin] = useState<string>('')
  const [now, setNow] = useState<number>(Date.now())
  const [alarmed, setAlarmed] = useState(false)

  useWakeLock(Boolean(active))

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])

  useEffect(() => {
    if (!active) {
      setAlarmed(false)
      return
    }
    if (alarmed) return
    const remaining = active.plannedMinutes - breakElapsedMinutes(active, now)
    if (remaining <= 0) {
      setAlarmed(true)
      fireAlarm({
        title: 'Break over 💗',
        body: 'Time to come back to study.'
      })
    }
  }, [active, now, alarmed])

  async function handleStart() {
    await primeAudio()
    await requestNotificationPermission()
    await startBreak(minutes)
  }

  async function handleEnd() {
    if (!active) return
    await endBreak(active, alarmed ? 'completed' : 'canceled')
    setOpen(false)
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

      <Dialog open={open} onClose={() => setOpen(false)} title={active ? 'On a break' : 'Take a break'}>
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
            <button className="btn-primary" onClick={handleEnd}>
              End break
            </button>
            <p className="text-xs text-berry/60 text-center">
              You'll hear a chime when your break's up.
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
