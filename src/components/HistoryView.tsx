import type { Course, HistoryRecord } from '../types'
import { Dialog } from './ui/Dialog'
import { formatDuration } from '../lib/time'

interface Props {
  open: boolean
  onClose: () => void
  history: HistoryRecord[]
  courses: Course[]
}

export function HistoryView({ open, onClose, history, courses }: Props) {
  const byCourse = new Map<string, HistoryRecord[]>()
  for (const h of history) {
    if (!byCourse.has(h.courseId)) byCourse.set(h.courseId, [])
    byCourse.get(h.courseId)!.push(h)
  }

  return (
    <Dialog open={open} onClose={onClose} title="History">
      {history.length === 0 ? (
        <div className="text-center text-berry/70 py-6">
          <div className="text-4xl mb-2">✨</div>
          Past periods will show up here once a week (or day) wraps up.
        </div>
      ) : (
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {courses.map((c) => {
            const list = byCourse.get(c.id)
            if (!list?.length) return null
            return (
              <div key={c.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: c.color }}
                  >
                    {c.emoji}
                  </span>
                  <h4 className="font-display font-bold text-deepRose">{c.name}</h4>
                </div>
                <div className="space-y-2">
                  {list
                    .sort((a, b) => (b.periodEnd?.toMillis() ?? 0) - (a.periodEnd?.toMillis() ?? 0))
                    .map((h) => {
                      const pct = h.target > 0 ? Math.round((h.achieved / h.target) * 100) : 0
                      const done = h.achieved >= h.target
                      return (
                        <div
                          key={h.id}
                          className="bg-petal/40 rounded-2xl px-3 py-2 flex items-center gap-3"
                        >
                          <div className="text-xs text-berry/70 flex-1">
                            <div className="font-semibold text-berry capitalize">
                              {h.period} · {h.periodKey}
                            </div>
                            <div>
                              {h.metric === 'minutes'
                                ? `${formatDuration(h.achieved)} / ${formatDuration(h.target)} studied`
                                : `${h.achieved} / ${h.target} ${h.metric}`}
                            </div>
                          </div>
                          <div
                            className={`text-sm font-display font-bold ${
                              done ? 'text-berry' : 'text-berry/60'
                            }`}
                          >
                            {done ? '🎉' : `${pct}%`}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
