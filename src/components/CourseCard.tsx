import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Course, Entry, Goal, GoalUnit, PeriodKind } from '../types'
import { RingProgress } from './RingProgress'
import { QuickAddSheet } from './QuickAddSheet'
import { GoalFormDialog } from './GoalFormDialog'
import { formatPeriodRange } from '../lib/periods'
import { formatDuration } from '../lib/time'
import { computeProgress } from '../lib/progress'

interface Props {
  course: Course
  goals: Goal[]
  entries: Entry[]
  onOpen: () => void
  onAddGoal: (data: {
    metric: string
    target: number
    period: PeriodKind
    unit: GoalUnit
  }) => Promise<void>
  onLog: (goal: Goal, amount: number) => Promise<void>
  openTaskCount?: number
}

export function CourseCard({
  course,
  goals,
  entries,
  onOpen,
  onAddGoal,
  onLog,
  openTaskCount
}: Props) {
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [logGoal, setLogGoal] = useState<Goal | null>(null)

  const progressFor = (goal: Goal) => computeProgress(goal, entries)

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <motion.div
      layout
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onOpen}
      className="card p-6 cursor-pointer text-left"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-soft"
          style={{ background: course.color }}
        >
          {course.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-display font-bold text-deepRose truncate">
            {course.name}
          </h3>
          <p className="text-xs text-berry/70">
            {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
            {typeof openTaskCount === 'number' && openTaskCount > 0 && (
              <> · {openTaskCount} open {openTaskCount === 1 ? 'task' : 'tasks'}</>
            )}
          </p>
        </div>
        <div className="text-berry/40 text-xl leading-none pt-1">›</div>
      </div>

      {goals.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-4 text-center">
          <div className="text-berry/60 text-sm">No goals yet.</div>
          <button className="btn-primary" onClick={stop(() => setShowGoalForm(true))}>
            + Add a goal
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {goals.map((g) => {
            const p = progressFor(g)
            const isTime = g.unit === 'minutes'
            const label = isTime
              ? `${formatDuration(p)} / ${formatDuration(g.target)}`
              : `${p} / ${g.target}`
            const sublabel = isTime ? 'study time' : g.metric
            return (
              <div key={g.id} className="flex items-center gap-4">
                <RingProgress
                  value={p}
                  target={g.target}
                  color={course.color}
                  size={110}
                  strokeWidth={10}
                  label={label}
                  sublabel={sublabel}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip capitalize">{g.period}</span>
                    <span className="text-xs text-berry/60">
                      {formatPeriodRange(g.period)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button
                      className="btn-primary text-sm"
                      onClick={stop(() => setLogGoal(g))}
                    >
                      + Log
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GoalFormDialog
        open={showGoalForm}
        onClose={() => setShowGoalForm(false)}
        courseName={course.name}
        onSave={onAddGoal}
      />

      {logGoal && (
        <QuickAddSheet
          open={!!logGoal}
          onClose={() => setLogGoal(null)}
          goal={logGoal}
          courseName={course.name}
          progress={progressFor(logGoal)}
          onLog={(amount) => onLog(logGoal, amount)}
        />
      )}
    </motion.div>
  )
}
