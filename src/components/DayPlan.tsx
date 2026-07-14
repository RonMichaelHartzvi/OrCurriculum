import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from './ui/Dialog'
import { SessionTimer } from './SessionTimer'
import type { Course, Goal, PlannedBlock, Session } from '../types'
import { startOfDay } from '../lib/periods'
import { formatDuration } from '../lib/time'
import { useCalendarSync } from '../hooks/useCalendarSync'

interface Props {
  courses: Course[]
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

// Default calendar window; extended in 2-hour steps if blocks fall outside.
const DEFAULT_START_HOUR = 9
const DEFAULT_END_HOUR = 21
const EXTEND_HOURS = 2

interface PendingSave {
  payload: {
    courseId: string
    title: string
    startAt: Date
    endAt: Date
    notes?: string
  }
  syncToCalendar: boolean
  editingId?: string
  conflicts: PlannedBlock[]
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function DayPlan({
  courses,
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
  const [pending, setPending] = useState<PendingSave | null>(null)

  const filtered = useMemo(() => {
    return blocks
      .filter((b) => sameDay(b.startAt.toDate(), date))
      .filter((b) => (courseFilter ? b.courseId === courseFilter : true))
  }, [blocks, date, courseFilter])

  const sessionCourse = runningBlock ? courses.find((c) => c.id === runningBlock.courseId) : null

  function findConflicts(
    startAt: Date,
    endAt: Date,
    ignoreId?: string
  ): PlannedBlock[] {
    const s = startAt.getTime()
    const e = endAt.getTime()
    return filtered.filter(
      (b) => b.id !== ignoreId && overlaps(s, e, b.startAt.toMillis(), b.endAt.toMillis())
    )
  }

  async function persistAdd(
    payload: PendingSave['payload'],
    syncToCalendar: boolean
  ) {
    let calendarEventId: string | undefined
    if (syncToCalendar) {
      const course = courses.find((c) => c.id === payload.courseId) ?? null
      const created = await sync.createEvent({ ...payload, course })
      calendarEventId = created ?? undefined
    }
    await onAddBlock({ ...payload, calendarEventId })
  }

  async function persistUpdate(
    block: PlannedBlock,
    payload: PendingSave['payload'],
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

  async function removeConflicts(conflicts: PlannedBlock[]) {
    for (const c of conflicts) {
      if (c.calendarEventId) {
        try {
          await sync.deleteEvent(c.calendarEventId)
        } catch {
          /* ignore */
        }
      }
      await onRemoveBlock(c.id)
    }
  }

  async function handleFormSave(
    payload: PendingSave['payload'],
    syncToCalendar: boolean,
    editingBlock: PlannedBlock | null
  ) {
    const conflicts = findConflicts(payload.startAt, payload.endAt, editingBlock?.id)
    if (conflicts.length > 0) {
      setPending({
        payload,
        syncToCalendar,
        editingId: editingBlock?.id,
        conflicts
      })
      return
    }
    if (editingBlock) await persistUpdate(editingBlock, payload, syncToCalendar)
    else await persistAdd(payload, syncToCalendar)
  }

  async function resolveConflict(action: 'merge' | 'replace') {
    if (!pending) return
    const { payload, syncToCalendar, editingId, conflicts } = pending

    const editingBlock = editingId
      ? blocks.find((b) => b.id === editingId) ?? null
      : null

    let finalPayload = payload
    if (action === 'merge') {
      // Extend the new block's range to cover the union with every conflict.
      let start = payload.startAt.getTime()
      let end = payload.endAt.getTime()
      for (const c of conflicts) {
        start = Math.min(start, c.startAt.toMillis())
        end = Math.max(end, c.endAt.toMillis())
      }
      finalPayload = {
        ...payload,
        startAt: new Date(start),
        endAt: new Date(end)
      }
    }

    await removeConflicts(conflicts)
    if (editingBlock && !conflicts.some((c) => c.id === editingBlock.id)) {
      await persistUpdate(editingBlock, finalPayload, syncToCalendar)
    } else {
      // If editing block was itself removed as a conflict (shouldn't happen — we
      // excluded it), or plain add path.
      await persistAdd(finalPayload, syncToCalendar)
    }

    setPending(null)
    setShowForm(false)
    setEditing(null)
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

      <CalendarGrid
        date={date}
        blocks={filtered}
        courses={courses}
        activeSession={activeSession}
        compact={Boolean(compact)}
        onEdit={(b) => setEditing(b)}
        onStart={(b) => setRunningBlock(b)}
      />

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
          await handleFormSave(payload, syncToCalendar, null)
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
            await handleFormSave(payload, syncToCalendar, editing)
          }}
          onDelete={async () => {
            await handleRemove(editing)
            setEditing(null)
          }}
        />
      )}

      {pending && (
        <ConflictDialog
          open={Boolean(pending)}
          onClose={() => setPending(null)}
          conflicts={pending.conflicts}
          courses={courses}
          newRange={{ startAt: pending.payload.startAt, endAt: pending.payload.endAt }}
          onMerge={() => resolveConflict('merge')}
          onReplace={() => resolveConflict('replace')}
        />
      )}

      {runningBlock && sessionCourse && (
        <SessionTimer
          open={Boolean(runningBlock)}
          onClose={() => setRunningBlock(null)}
          course={sessionCourse}
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

// ---------------- CalendarGrid ----------------

interface GridProps {
  date: Date
  blocks: PlannedBlock[]
  courses: Course[]
  activeSession: Session | null
  compact: boolean
  onEdit: (b: PlannedBlock) => void
  onStart: (b: PlannedBlock) => void
}

interface LaidOutBlock {
  block: PlannedBlock
  topPx: number
  heightPx: number
  col: number
  colCount: number
}

function minutesSinceMidnight(d: Date, ref: Date): number {
  // Clamp to [0, 24*60] within the reference day so cross-midnight blocks
  // render truncated instead of overflowing.
  const dayStart = new Date(ref)
  dayStart.setHours(0, 0, 0, 0)
  const mins = (d.getTime() - dayStart.getTime()) / 60000
  return Math.max(0, Math.min(24 * 60, mins))
}

function layoutBlocks(blocks: PlannedBlock[]): Map<string, { col: number; colCount: number }> {
  // Sweep: assign each block the lowest column index whose previous block
  // ended before this one starts. Then, within each transitive-overlap
  // cluster, everyone in the cluster shares the max column count for even
  // side-by-side widths.
  const sorted = [...blocks].sort(
    (a, b) => a.startAt.toMillis() - b.startAt.toMillis()
  )
  const cols: number[] = [] // end time (ms) per column
  const colOf = new Map<string, number>()
  for (const b of sorted) {
    const s = b.startAt.toMillis()
    let col = cols.findIndex((end) => end <= s)
    if (col === -1) col = cols.length
    cols[col] = b.endAt.toMillis()
    colOf.set(b.id, col)
  }
  // For each block, compute the peak column count among all blocks that
  // overlap it (directly or transitively via a shared overlap).
  const result = new Map<string, { col: number; colCount: number }>()
  for (const b of sorted) {
    const s = b.startAt.toMillis()
    const e = b.endAt.toMillis()
    let peak = (colOf.get(b.id) ?? 0) + 1
    for (const o of sorted) {
      if (o.id === b.id) continue
      const os = o.startAt.toMillis()
      const oe = o.endAt.toMillis()
      if (overlaps(s, e, os, oe)) {
        peak = Math.max(peak, (colOf.get(o.id) ?? 0) + 1)
      }
    }
    result.set(b.id, { col: colOf.get(b.id) ?? 0, colCount: peak })
  }
  return result
}

function CalendarGrid({
  date,
  blocks,
  courses,
  activeSession,
  compact,
  onEdit,
  onStart
}: GridProps) {
  const pxPerHour = compact ? 56 : 72
  const railWidth = 56

  // Derive the visible hour window: 9–21 by default, extended in 2h steps
  // to cover any block that spills outside.
  const [startHour, endHour] = useMemo(() => {
    let startH = DEFAULT_START_HOUR
    let endH = DEFAULT_END_HOUR
    for (const b of blocks) {
      const s = minutesSinceMidnight(b.startAt.toDate(), date) / 60
      const e = minutesSinceMidnight(b.endAt.toDate(), date) / 60
      if (s < startH) startH = Math.max(0, Math.floor(s) - EXTEND_HOURS)
      if (e > endH) endH = Math.min(24, Math.ceil(e) + EXTEND_HOURS)
    }
    return [Math.max(0, startH), Math.min(24, endH)]
  }, [blocks, date])

  const totalMinutes = (endHour - startHour) * 60
  const totalHeight = totalMinutes * (pxPerHour / 60)
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  )

  const layout = useMemo(() => layoutBlocks(blocks), [blocks])

  // Live "now" indicator — only shown when viewing today.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!sameDay(date, startOfDay(new Date()))) return
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [date])
  const isToday = sameDay(date, startOfDay(new Date()))
  const nowMinutes = isToday ? minutesSinceMidnight(now, date) : null
  const nowTop =
    nowMinutes != null && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60
      ? (nowMinutes - startHour * 60) * (pxPerHour / 60)
      : null

  // Auto-scroll so "now" (or 9:00 default) is visible on first mount.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const didInitScroll = useRef(false)
  useEffect(() => {
    if (didInitScroll.current) return
    const el = scrollerRef.current
    if (!el) return
    const targetMinutes =
      nowMinutes != null ? nowMinutes - 60 : DEFAULT_START_HOUR * 60 - startHour * 60
    const top = Math.max(0, (targetMinutes - startHour * 60) * (pxPerHour / 60))
    el.scrollTop = top
    didInitScroll.current = true
  }, [nowMinutes, startHour, pxPerHour])

  const laid: LaidOutBlock[] = blocks.map((b) => {
    const startMin = minutesSinceMidnight(b.startAt.toDate(), date)
    const endMin = minutesSinceMidnight(b.endAt.toDate(), date)
    const topPx = (startMin - startHour * 60) * (pxPerHour / 60)
    const heightPx = Math.max(20, (endMin - startMin) * (pxPerHour / 60))
    const l = layout.get(b.id) ?? { col: 0, colCount: 1 }
    return { block: b, topPx, heightPx, col: l.col, colCount: l.colCount }
  })

  const maxViewport = compact ? 380 : 620

  return (
    <div
      ref={scrollerRef}
      className="rounded-3xl border border-petal/60 bg-white/70 overflow-y-auto"
      style={{ maxHeight: maxViewport }}
    >
      <div className="relative" style={{ height: totalHeight, minHeight: 200 }}>
        {/* Hour rail + horizontal lines */}
        {hours.map((h, i) => {
          const top = (h - startHour) * pxPerHour
          const isLast = i === hours.length - 1
          return (
            <div key={h} className="absolute left-0 right-0" style={{ top }}>
              <div
                className={`absolute left-0 right-0 ${isLast ? '' : 'border-t border-petal/60'}`}
              />
              <span
                className="absolute left-1 -top-2 text-[10px] font-semibold text-berry/60 tabular-nums"
                style={{ width: railWidth - 8 }}
              >
                {h.toString().padStart(2, '0')}:00
              </span>
            </div>
          )
        })}
        {/* Half-hour dashed lines */}
        {hours.slice(0, -1).map((h) => {
          const top = (h - startHour) * pxPerHour + pxPerHour / 2
          return (
            <div
              key={`half-${h}`}
              className="absolute border-t border-dashed border-petal/40"
              style={{ top, left: railWidth, right: 4 }}
            />
          )
        })}

        {/* Now line */}
        {nowTop != null && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ top: nowTop, left: railWidth - 4, right: 4 }}
          >
            <div className="relative">
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-deepRose shadow-sm" />
              <div className="border-t-2 border-deepRose/80" />
            </div>
          </div>
        )}

        {/* Blocks */}
        {laid.map(({ block: b, topPx, heightPx, col, colCount }) => {
          const course = courses.find((c) => c.id === b.courseId)
          const color = course?.color ?? '#F9A8D4'
          const contentWidth = `calc((100% - ${railWidth + 8}px) / ${colCount})`
          const left = `calc(${railWidth + 4}px + ${col} * ((100% - ${railWidth + 8}px) / ${colCount}))`
          const mins = blockMinutes(b)
          const tiny = heightPx < 34
          const short = heightPx < 60
          const synced = Boolean(b.calendarEventId)
          return (
            <div
              key={b.id}
              className="absolute rounded-2xl shadow-sm cursor-pointer overflow-hidden"
              style={{
                top: topPx + 1,
                height: heightPx - 2,
                left,
                width: contentWidth,
                background: `${color}66`,
                borderLeft: `4px solid ${color}`
              }}
              onClick={() => onEdit(b)}
              role="button"
              tabIndex={0}
            >
              <div className="px-2.5 py-1.5 h-full flex flex-col gap-0.5 relative">
                <div
                  className={`font-semibold text-berry leading-tight break-words ${
                    tiny ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
                  }`}
                >
                  {course?.emoji} {b.title}
                </div>
                {!short && (
                  <div className="text-[11px] text-berry/80 leading-tight pr-16">
                    {fmtTime(b.startAt.toDate())} – {fmtTime(b.endAt.toDate())} ·{' '}
                    {formatDuration(mins)}
                    {synced && <> · 📅</>}
                  </div>
                )}
                {!tiny && (
                  <button
                    className="absolute bottom-1.5 right-1.5 rounded-full bg-deepRose/90 hover:bg-deepRose text-white text-[11px] font-semibold px-2 py-0.5 shadow-sm disabled:opacity-40"
                    disabled={Boolean(activeSession)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStart(b)
                    }}
                  >
                    ▶ Start
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {blocks.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ left: railWidth }}
          >
            <div className="text-center text-berry/60">
              <div className="text-2xl mb-1">📅</div>
              <div className="text-xs">Nothing planned yet.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- ConflictDialog ----------------

interface ConflictProps {
  open: boolean
  onClose: () => void
  conflicts: PlannedBlock[]
  courses: Course[]
  newRange: { startAt: Date; endAt: Date }
  onMerge: () => void | Promise<void>
  onReplace: () => void | Promise<void>
}

function ConflictDialog({
  open,
  onClose,
  conflicts,
  courses,
  newRange,
  onMerge,
  onReplace
}: ConflictProps) {
  const [busy, setBusy] = useState(false)
  async function run(fn: () => void | Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  const mergedStart = new Date(
    Math.min(
      newRange.startAt.getTime(),
      ...conflicts.map((c) => c.startAt.toMillis())
    )
  )
  const mergedEnd = new Date(
    Math.max(
      newRange.endAt.getTime(),
      ...conflicts.map((c) => c.endAt.toMillis())
    )
  )
  return (
    <Dialog open={open} onClose={onClose} title="Overlapping block">
      <div className="space-y-4 text-sm text-berry/80">
        <p>
          This block overlaps {conflicts.length === 1 ? 'an existing block' : `${conflicts.length} existing blocks`}:
        </p>
        <ul className="space-y-1">
          {conflicts.map((c) => {
            const course = courses.find((cc) => cc.id === c.courseId)
            return (
              <li
                key={c.id}
                className="rounded-2xl bg-petal/40 px-3 py-2 flex items-center gap-2"
              >
                <span
                  className="inline-block w-2 h-6 rounded-full"
                  style={{ background: course?.color ?? '#F9A8D4' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-berry truncate">
                    {course?.emoji} {c.title}
                  </div>
                  <div className="text-xs text-berry/70">
                    {fmtTime(c.startAt.toDate())} – {fmtTime(c.endAt.toDate())}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="rounded-2xl bg-cream/60 px-3 py-2 text-xs text-berry/80">
          <div>
            <strong>Merge</strong> replaces the existing {conflicts.length === 1 ? 'block' : 'blocks'} with a
            single block covering <span className="tabular-nums">{fmtTime(mergedStart)} – {fmtTime(mergedEnd)}</span>.
          </div>
          <div className="mt-1">
            <strong>Replace</strong> deletes the existing {conflicts.length === 1 ? 'block' : 'blocks'} and keeps
            the new one exactly as entered.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button className="btn-soft" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-soft"
            onClick={() => run(onMerge)}
            disabled={busy}
          >
            Merge
          </button>
          <button
            className="btn-primary"
            onClick={() => run(onReplace)}
            disabled={busy}
          >
            Replace
          </button>
        </div>
      </div>
    </Dialog>
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
    setSyncCal(initial ? Boolean(initial.calendarEventId) : true)
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
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit block' : 'New block'} size="lg">
      <form onSubmit={submit} className="space-y-5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            className="input mt-1 min-h-[120px] sm:min-h-[280px]"
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
