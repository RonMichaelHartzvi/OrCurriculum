import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { useSession } from '../hooks/useSession'
import { useCourses } from '../hooks/useCourses'
import { useGoals } from '../hooks/useGoals'
import { sessionElapsedMinutes } from '../lib/time'
import { SessionTimer } from './SessionTimer'

export function SessionBanner({ user }: { user: User }) {
  const uid = user.uid
  const {
    active,
    startSession,
    completeSession,
    cancelSession,
    endNow
  } = useSession(uid)
  const { courses } = useCourses(uid)
  const { goals } = useGoals(uid)
  const [now, setNow] = useState<number>(Date.now())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!active) {
      setOpen(false)
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])

  const course = useMemo(
    () => (active ? courses.find((c) => c.id === active.courseId) : undefined),
    [active, courses]
  )

  const elapsed = active ? sessionElapsedMinutes(active, now) : 0
  const totalRemainingSeconds = active
    ? Math.max(0, Math.round(active.plannedMinutes * 60 - elapsed * 60))
    : 0
  const mm = Math.floor(totalRemainingSeconds / 60)
  const ss = totalRemainingSeconds % 60
  const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const overtime = active && elapsed >= active.plannedMinutes

  return (
    <>
      <AnimatePresence>
        {active && course && (
          <motion.button
            key="session-banner"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            onClick={() => setOpen(true)}
            className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 rounded-full shadow-petal px-4 py-2 font-display font-semibold flex items-center gap-3 border ${
              overtime
                ? 'bg-deepRose text-white border-deepRose animate-pulse'
                : 'bg-white text-berry border-petal/60'
            }`}
            aria-label="Open running session"
          >
            <span className="text-xl">{course.emoji}</span>
            <span className="max-w-[8rem] truncate hidden sm:inline">{course.name}</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                overtime ? 'text-white' : 'text-deepRose'
              }`}
            >
              {overtime ? "Time's up!" : timeStr}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {active && course && (
        <SessionTimer
          open={open}
          onClose={() => setOpen(false)}
          course={course}
          goals={goals}
          active={active}
          onStart={startSession}
          onComplete={completeSession}
          onCancel={cancelSession}
          onEndNow={endNow}
        />
      )}
    </>
  )
}
