import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { motion } from 'framer-motion'
import { useCourses } from '../hooks/useCourses'
import { useEntries } from '../hooks/useEntries'
import { useHistory } from '../hooks/useHistory'
import { openDashboard } from '../hooks/useRoute'
import type { Course, Entry, HistoryRecord } from '../types'
import { formatDuration } from '../lib/time'
import { startOfDay } from '../lib/periods'

type RangeKey = '7d' | '30d' | '90d' | 'all'

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All-time' }
]

function rangeStart(key: RangeKey): Date | null {
  if (key === 'all') return null
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90
  const d = startOfDay(new Date())
  d.setDate(d.getDate() - (days - 1))
  return d
}

function entryDate(e: Entry): Date | null {
  return e.at?.toDate?.() ?? null
}

function entryMinutes(e: Entry): number {
  if (e.metric === 'minutes' && Number.isFinite(e.amount)) return e.amount
  return 0
}

function historyMinutes(h: HistoryRecord): number {
  if (h.metric === 'minutes' && Number.isFinite(h.achieved)) return h.achieved
  return 0
}

function historyMidpoint(h: HistoryRecord): Date | null {
  const start = h.periodStart?.toDate?.()
  const end = h.periodEnd?.toDate?.()
  if (!start || !end) return null
  return new Date((start.getTime() + end.getTime()) / 2)
}

export function TimeDashboard({ user }: { user: User }) {
  const uid = user.uid
  const { courses } = useCourses(uid)
  const { entries } = useEntries(uid)
  const { history } = useHistory(uid)
  const [range, setRange] = useState<RangeKey>('7d')

  const cutoff = rangeStart(range)

  const totals = useMemo(() => {
    const perCourse = new Map<string, number>()
    for (const e of entries) {
      const mins = entryMinutes(e)
      if (mins <= 0) continue
      const d = entryDate(e)
      if (cutoff && (!d || d < cutoff)) continue
      perCourse.set(e.courseId, (perCourse.get(e.courseId) ?? 0) + mins)
    }
    for (const h of history) {
      const mins = historyMinutes(h)
      if (mins <= 0) continue
      const d = historyMidpoint(h)
      if (cutoff && (!d || d < cutoff)) continue
      perCourse.set(h.courseId, (perCourse.get(h.courseId) ?? 0) + mins)
    }
    return perCourse
  }, [entries, history, cutoff])

  const total = useMemo(
    () => Array.from(totals.values()).reduce((s, v) => s + v, 0),
    [totals]
  )

  const dayCount = useMemo(() => {
    if (range === 'all') {
      const dates = new Set<string>()
      for (const e of entries) {
        if (entryMinutes(e) <= 0) continue
        const d = entryDate(e)
        if (!d) continue
        dates.add(startOfDay(d).toISOString().slice(0, 10))
      }
      for (const h of history) {
        if (historyMinutes(h) <= 0) continue
        const d = historyMidpoint(h)
        if (!d) continue
        dates.add(startOfDay(d).toISOString().slice(0, 10))
      }
      return Math.max(dates.size, 1)
    }
    return range === '7d' ? 7 : range === '30d' ? 30 : 90
  }, [range, entries, history])

  const dailyAvg = total / dayCount
  const maxCourse = Math.max(1, ...Array.from(totals.values()))
  const sortedCourses = useMemo(() => {
    return courses
      .map((c) => ({ course: c, minutes: totals.get(c.id) ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [courses, totals])

  return (
    <div className="min-h-full pb-24">
      <header className="max-w-3xl mx-auto px-5 pt-8 pb-4 flex items-center gap-2">
        <button className="btn-ghost" onClick={openDashboard}>
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-deepRose">
            Time dashboard
          </h1>
          <p className="text-xs text-berry/70">Hours spent per course, per range.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 space-y-5">
        <div className="flex bg-petal/60 rounded-full p-1 text-sm font-display font-semibold">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`flex-1 rounded-full py-2 transition ${
                range === r.key ? 'bg-white text-berry shadow-soft' : 'text-berry/70'
              }`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <section className="card p-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-berry/70 uppercase tracking-wide">
              Total
            </div>
            <div className="text-2xl font-display font-bold text-deepRose mt-1">
              {formatDuration(Math.round(total))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-berry/70 uppercase tracking-wide">
              Daily average
            </div>
            <div className="text-2xl font-display font-bold text-deepRose mt-1">
              {formatDuration(Math.round(dailyAvg))}
            </div>
            <div className="text-[10px] text-berry/50 mt-0.5">
              over {dayCount} day{dayCount === 1 ? '' : 's'}
            </div>
          </div>
        </section>

        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-display font-bold text-deepRose">By course</h2>
          {sortedCourses.length === 0 ? (
            <div className="text-berry/70 text-sm">No courses yet.</div>
          ) : (
            sortedCourses.map(({ course, minutes }) => (
              <CourseBar
                key={course.id}
                course={course}
                minutes={minutes}
                dayCount={dayCount}
                max={maxCourse}
              />
            ))
          )}
        </section>
      </main>
    </div>
  )
}

function CourseBar({
  course,
  minutes,
  dayCount,
  max
}: {
  course: Course
  minutes: number
  dayCount: number
  max: number
}) {
  const pct = max > 0 ? Math.round((minutes / max) * 100) : 0
  const avg = minutes / dayCount
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg">{course.emoji}</span>
        <span className="font-display font-semibold text-berry">{course.name}</span>
        <div className="flex-1" />
        <span className="text-sm text-berry font-semibold">{formatDuration(Math.round(minutes))}</span>
        <span className="text-[10px] text-berry/60">
          · {formatDuration(Math.round(avg))}/day
        </span>
      </div>
      <div className="h-3 mt-1 rounded-full bg-petal/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', damping: 22, stiffness: 120 }}
          className="h-full rounded-full"
          style={{ background: course.color }}
        />
      </div>
    </div>
  )
}
