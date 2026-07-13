import { useMemo, useState } from 'react'
import type { Course, Entry, Session } from '../types'
import { Dialog } from './ui/Dialog'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { formatDuration } from '../lib/time'

interface Props {
  open: boolean
  onClose: () => void
  courses: Course[]
  sessions: Session[]
  entries: Entry[]
  onDiscardSession: (session: Session) => Promise<void>
  onDiscardEntry: (entryId: string) => Promise<void>
}

interface Row {
  key: string
  courseId: string
  minutes: number
  timestampMs: number
  source: 'session' | 'manual'
  session?: Session
  entryId?: string
  // For session rows: true when the linked entry has already been archived
  // away (period rollover). Discard still removes the session record but
  // does NOT edit the history aggregate.
  archived?: boolean
}

export function HistoryView({
  open,
  onClose,
  courses,
  sessions,
  entries,
  onDiscardSession,
  onDiscardEntry
}: Props) {
  const [pendingDiscard, setPendingDiscard] = useState<Row | null>(null)

  const rows: Row[] = useMemo(() => {
    const entryById = new Map(entries.map((e) => [e.id, e]))
    const sessionEntryIds = new Set(
      sessions.map((s) => s.entryId).filter((id): id is string => Boolean(id))
    )

    const out: Row[] = []

    for (const s of sessions) {
      if (s.outcome !== 'completed') continue
      const minutes = s.loggedMinutes ?? 0
      if (minutes <= 0) continue
      const timestampMs = s.endedAt?.toMillis?.() ?? s.startedAt?.toMillis?.() ?? 0
      const archived = Boolean(s.entryId && !entryById.has(s.entryId))
      out.push({
        key: `s:${s.id}`,
        courseId: s.courseId,
        minutes,
        timestampMs,
        source: 'session',
        session: s,
        archived
      })
    }

    for (const e of entries) {
      if (e.metric !== 'minutes') continue
      if (sessionEntryIds.has(e.id)) continue // shown as a session row
      const timestampMs = e.at?.toMillis?.() ?? 0
      out.push({
        key: `e:${e.id}`,
        courseId: e.courseId,
        minutes: e.amount || 0,
        timestampMs,
        source: 'manual',
        entryId: e.id
      })
    }

    out.sort((a, b) => b.timestampMs - a.timestampMs)
    return out
  }, [sessions, entries])

  const coursesById = useMemo(() => {
    const m = new Map<string, Course>()
    for (const c of courses) m.set(c.id, c)
    return m
  }, [courses])

  async function handleConfirmDiscard() {
    const row = pendingDiscard
    if (!row) return
    if (row.source === 'session' && row.session) {
      await onDiscardSession(row.session)
    } else if (row.source === 'manual' && row.entryId) {
      await onDiscardEntry(row.entryId)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title="History">
        {rows.length === 0 ? (
          <div className="text-center text-berry/70 py-6">
            <div className="text-4xl mb-2">✨</div>
            Your study sessions and time logs will show up here as you record them.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {rows.map((row) => {
              const course = coursesById.get(row.courseId)
              return (
                <div
                  key={row.key}
                  className="bg-petal/40 rounded-2xl px-3 py-2 flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: course?.color ?? '#F5D0E4' }}
                  >
                    {course?.emoji ?? '📚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-berry text-sm truncate">
                      {course?.name ?? 'Unknown course'}
                    </div>
                    <div className="text-xs text-berry/70 flex items-center gap-2 flex-wrap">
                      <span>{formatDuration(row.minutes)}</span>
                      <span>·</span>
                      <span>{formatTimestamp(row.timestampMs)}</span>
                      {row.source === 'session' ? (
                        <span className="chip !text-[10px] !py-0 !px-2">session</span>
                      ) : (
                        <span className="chip !text-[10px] !py-0 !px-2">manual</span>
                      )}
                      {row.archived && (
                        <span className="chip !text-[10px] !py-0 !px-2 !bg-cream">
                          archived
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn-soft text-xs shrink-0"
                    onClick={() => setPendingDiscard(row)}
                  >
                    Discard
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDiscard)}
        onClose={() => setPendingDiscard(null)}
        onConfirm={handleConfirmDiscard}
        title="Discard this entry?"
        confirmLabel="Discard"
        danger
        message={
          pendingDiscard ? (
            <>
              <div>
                {formatDuration(pendingDiscard.minutes)} on{' '}
                <span className="font-semibold">
                  {coursesById.get(pendingDiscard.courseId)?.name ?? 'this course'}
                </span>{' '}
                at {formatTimestamp(pendingDiscard.timestampMs)}.
              </div>
              <div className="mt-2 text-berry/70">
                {pendingDiscard.archived
                  ? "This session's minutes are already rolled into past history, so only the session record will be removed — the historic aggregate stays as is."
                  : 'The minutes will be uncounted from your time goals for this period.'}
              </div>
            </>
          ) : null
        }
      />
    </>
  )
}

function formatTimestamp(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
