import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog } from './ui/Dialog'
import { SessionTimer } from './SessionTimer'
import type { Course, Goal, PlannedBlock, Session } from '../types'
import { startOfDay } from '../lib/periods'
import { formatDuration } from '../lib/time'
import { useCalendarSync } from '../hooks/useCalendarSync'

interface Props {
  courses: Course[]
  goals: Goal[]
  blocks: PlannedBlock[]
  activeSession: Session | null
  onAddBlock: (input: {
    courseId: string
    title: string
    startAt: Date
    endAt: Date
    notes?: string
    calendarEventId?: string
  }) => Promise<string | undefined>
  onUpdateBlock: (
    id: string,
    patch: Partial<{
      courseId: string
      title: string
      startAt: Date
      endAt: Date
      notes: string
      calendarEventId: string | null
    }>
  ) => Promise<void>
  onRemoveBlock: (id: string) => Promise<void>
  onStartSession: (input: {
    courseId: string
    goalId: string | null
    plannedMinutes: number
  }) => Promise<void>
  onCompleteSession: (session: Session, goal: Goal | null, loggedMinutes: number) => Promise<void>
  onCancelSession: (session: Session) => Promise<void>
  onEndNowSession: (session: Session, goal: Goal | null) => Promise<void>
  courseFilter?: string
  compact?: boolean
}

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset()
  const shifted = new Date(d.getTime() - off * 60_000)
  return shifted.toISOString().slice(0, 16)
}

function fromLocalInput(s: string): Date {
  return new Date(s)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function blockMinutes(b: PlannedBlock): number {
  const start = b.startAt.toMillis()
  const end = b.endAt.toMillis()
  return Math.max(0, (end - start) / 60000)
}

export function DayPlan({
  courses,
  goals,
  blocks,
  activeSession,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onStartSession,
  onCompleteSession,
  onCancelSession,
  onEndNowSession,
  courseFilter,
  compact
}: Props) {
  const sync = useCalendarSync()
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlannedBlock | null>(null)
  const [runningBlock, setRunningBlock] = useState<PlannedBlock | null>(null)

  const filtered = useMemo(() => {
    return blocks
      .filter((b) => sameDay(b.startAt.toDate(), date))
      .filter((b) => (courseFilter ? b.courseId === courseFilter : true))
  }, [blocks, date, courseFilter])

  const sessionCourse = runningBlock ? courses.find((c) => c.id === runningBlock.courseId) : null

  async function handleAdd(payload: {
    courseId: string
    title: string
    startAt: Date
    endAt: Date
    notes?: string
  }, syncToCalendar: boolean) {
    let calendarEventId: string | undefined
    if (syncToCalendar) {
      const course = courses.find((c) => c.id === payload.courseId) ?? null
      const created = await sync.createEvent({ ...payload, course })
      calendarEventId = created ?? undefined
    }
    await onAddBlock({ ...payload, calendarEventId })
  }

  async function handleUpdate(
    block: PlannedBlock,
    payload: {
      courseId: string
      title: string
      startAt: Date
      endAt: Date
      notes?: string
    },
    syncToCalendar: boolean
  ) {
    const course = courses.find((c) => c.id === payload.courseId) ?? null
    let calendarEventId: string | null | undefined = undefined
    if (syncToCalendar && !block.calendarEventId) {
      const created = await sync.createEvent({ ...payload, course })
      calendarEventId = created ?? null
    } else if (!syncToCalendar && block.calendarEventId) {
      await sync.deleteEvent(block.calendarEventId)
      calendarEventId = null
    } else if (syncToCalendar && block.calendarEventId) {
      // Update the existing event in place.
      const synthetic = {
        ...block,
        title: payload.title,
        notes: payload.notes,
        startAt: { toDate: () => payload.startAt } as unknown as PlannedBlock['startAt'],
        endAt: { toDate: () => payload.endAt } as unknown as PlannedBlock['endAt']
      } as PlannedBlock & { course?: Course | null }
      synthetic.course = course
      await sync.updateEvent(synthetic)
    }
    const patch: Parameters<typeof onUpdateBlock>[1] = { ...payload }
    if (calendarEventId !== undefined) patch.calendarEventId = calendarEventId
    await onUpdateBlock(block.id, patch)
  }

  async function handleRemove(block: PlannedBlock) {
    if (block.calendarEventId) await sync.deleteEvent(block.calendarEventId)
    await onRemoveBlock(block.id)
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center gap-2">
          <button
            className="btn-soft text-sm"
            onClick={() => {
              const d = new Date(date)
              d.setDate(d.getDate() - 1)
              setDate(startOfDay(d))
            }}
          >
            ←
          </button>
          <div className="flex-1 text-center font-display font-semibold text-berry">
            {sameDay(date, startOfDay(new Date()))
              ? 'Today'
              : date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
          </div>
          <button
            className="btn-soft text-sm"
            onClick={() => {
              const d = new Date(date)
              d.setDate(d.getDate() + 1)
              setDate(startOfDay(d))
            }}
          >
            →
          </button>
          <button
            className="btn-ghost text-sm"
            onClick={() => setDate(startOfDay(new Date()))}
          >
            Today
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-berry/70 py-6">
          <div className="text-3xl mb-2">📅</div>
          Nothing planned yet.
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence>
            {filtered.map((b) => {
              const course = courses.find((c) => c.id === b.courseId)
              const mins = blockMinutes(b)
              return (
                <motion.li
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-2xl bg-petal/40 px-3 py-2"
                >
                  <div
                    className="w-2 self-stretch rounded-full"
                    style={{ background: course?.color ?? '#F9A8D4' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-berry text-sm truncate">
                      {course?.emoji} {b.title}
                    </div>
                    <div className="text-xs text-berry/70">
                      {fmtTime(b.startAt.toDate())} – {fmtTime(b.endAt.toDate())} ·{' '}
                      {formatDuration(mins)}
                      {b.calendarEventId && <> · 📅 synced</>}
                    </div>
                  </div>
                  <button
                    className="btn-primary text-xs px-3 py-1.5"
                    disabled={Boolean(activeSession)}
                    onClick={() => setRunningBlock(b)}
                  >
                    Start
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setEditing(b)}
                    aria-label="Edit block"
                  >
                    ✎
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="pt-1">
        <button className="btn-soft text-sm" onClick={() => setShowForm(true)}>
          + Add block
        </button>
      </div>

      <BlockFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        courses={courses}
        lockCourseId={courseFilter}
        defaultDate={date}
        calendarConfigured={sync.configured}
        onAuthorize={sync.authorize}
        onSave={async (payload, syncToCalendar) => {
          await handleAdd(payload, syncToCalendar)
        }}
      />

      {editing && (
        <BlockFormDialog
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          courses={courses}
          lockCourseId={courseFilter}
          initial={editing}
          defaultDate={date}
          calendarConfigured={sync.configured}
          onAuthorize={sync.authorize}
          onSave={async (payload, syncToCalendar) => {
            await handleUpdate(editing, payload, syncToCalendar)
            setEditing(null)
          }}
          onDelete={async () => {
            await handleRemove(editing)
            setEditing(null)
          }}
        />
      )}

      {runningBlock && sessionCourse && (
        <SessionTimer
          open={Boolean(runningBlock)}
          onClose={() => setRunningBlock(null)}
          course={sessionCourse}
          goals={goals}
          active={activeSession}
          initialMinutes={Math.max(1, Math.round(blockMinutes(runningBlock)))}
          onStart={onStartSession}
          onComplete={onCompleteSession}
          onCancel={onCancelSession}
          onEndNow={onEndNowSession}
        />
      )}
    </div>
  )
}

// ---------------- BlockFormDialog ----------------

interface FormProps {
  open: boolean
  onClose: () => void
  courses: Course[]
  lockCourseId?: string
  initial?: PlannedBlock
  defaultDate: Date
  calendarConfigured: boolean
  onAuthorize: () => Promise<boolean>
  onSave: (
    payload: {
      courseId: string
      title: string
      startAt: Date
      endAt: Date
      notes?: string
    },
    syncToCalendar: boolean
  ) => Promise<void>
  onDelete?: () => Promise<void>
}

function defaultStart(date: Date): Date {
  const now = new Date()
  const start = new Date(date)
  if (sameDay(date, startOfDay(now))) {
    start.setHours(now.getHours())
    start.setMinutes(now.getMinutes() < 30 ? 30 : 0)
    if (now.getMinutes() >= 30) start.setHours(start.getHours() + 1)
  } else {
    start.setHours(9, 0, 0, 0)
  }
  start.setSeconds(0, 0)
  return start
}

function BlockFormDialog({
  open,
  onClose,
  courses,
  lockCourseId,
  initial,
  defaultDate,
  calendarConfigured,
  onAuthorize,
  onSave,
  onDelete
}: FormProps) {
  const [courseId, setCourseId] = useState<string>(lockCourseId ?? initial?.courseId ?? courses[0]?.id ?? '')
  const [title, setTitle] = useState<string>('')
  const [startStr, setStartStr] = useState<string>(toLocalInput(defaultStart(defaultDate)))
  const [endStr, setEndStr] = useState<string>(
    toLocalInput(new Date(defaultStart(defaultDate).getTime() + 60 * 60 * 1000))
  )
  const [notes, setNotes] = useState<string>('')
  const [syncCal, setSyncCal] = useState<boolean>(false)
  const [busy, setBusy] = useState(false)
  const [authWarn, setAuthWarn] = useState(false)

  useEffect(() => {
    if (!open) return
    const cid = lockCourseId ?? initial?.courseId ?? courses[0]?.id ?? ''
    setCourseId(cid)
    const course = courses.find((c) => c.id === cid)
    setTitle(initial?.title ?? course?.name ?? '')
    setStartStr(
      initial ? toLocalInput(initial.startAt.toDate()) : toLocalInput(defaultStart(defaultDate))
    )
    setEndStr(
      initial
        ? toLocalInput(initial.endAt.toDate())
        : toLocalInput(new Date(defaultStart(defaultDate).getTime() + 60 * 60 * 1000))
    )
    setNotes(initial?.notes ?? '')
    setSyncCal(Boolean(initial?.calendarEventId))
    setAuthWarn(false)
  }, [open, initial, lockCourseId, courses, defaultDate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const start = fromLocalInput(startStr)
    const end = fromLocalInput(endStr)
    if (!courseId || !title.trim() || end <= start) return
    if (syncCal && !calendarConfigured) {
      setAuthWarn(true)
      return
    }
    if (syncCal && calendarConfigured) {
      const ok = await onAuthorize()
      if (!ok) {
        setAuthWarn(true)
        return
      }
    }
    setBusy(true)
    try {
      await onSave(
        {
          courseId,
          title: title.trim(),
          startAt: start,
          endAt: end,
          notes: notes.trim() || undefined
        },
        syncCal
      )
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit block' : 'New block'}>
      <form onSubmit={submit} className="space-y-4">
        {!lockCourseId && (
          <div>
            <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
              Course
            </label>
            <select
              className="input mt-1"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                if (!initial) {
                  const c = courses.find((c) => c.id === e.target.value)
                  if (c) setTitle(c.name)
                }
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Title
          </label>
          <input
            className="input mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
              Start
            </label>
            <input
              type="datetime-local"
              className="input mt-1"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
              End
            </label>
            <input
              type="datetime-local"
              className="input mt-1"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-berry/80 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            className="input mt-1 min-h-[60px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-berry/80">
          <input
            type="checkbox"
            checked={syncCal}
            onChange={(e) => setSyncCal(e.target.checked)}
          />
          Add to Google Calendar
        </label>
        {authWarn && (
          <div className="text-xs text-deepRose bg-petal/60 rounded-2xl px-3 py-2">
            {calendarConfigured
              ? 'Google Calendar needs permission. Try again to grant access.'
              : 'Google Calendar is not configured. Set VITE_GOOGLE_CLIENT_ID in .env to enable sync.'}
          </div>
        )}
        {initial && onDelete && (
          <button
            type="button"
            className="btn-ghost text-berry/70 hover:text-berry w-full justify-start"
            onClick={async () => {
              if (confirm('Delete this block?')) {
                await onDelete()
                onClose()
              }
            }}
          >
            Delete block
          </button>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button type="button" className="btn-soft text-base py-3" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-base py-3" disabled={busy}>
            {busy ? '…' : initial ? 'Save changes' : 'Add block'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
