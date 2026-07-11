import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Course, Entry, Goal } from '../types'
import { RingProgress } from './RingProgress'
import { GoalFormDialog } from './GoalFormDialog'
import { QuickAddSheet } from './QuickAddSheet'
import { formatPeriodRange, periodKey } from '../lib/periods'

interface Props {
  course: Course
  goals: Goal[]
  entries: Entry[]
  onEdit: () => void
  onAddGoal: (data: { metric: string; target: number; period: 'weekly' | 'daily' }) => Promise<void>
  onUpdateGoal: (goalId: string, patch: Partial<Goal>) => Promise<void>
  onRemoveGoal: (goalId: string) => Promise<void>
  onLog: (goal: Goal, amount: number) => Promise<void>
}

export function CourseCard({
  course,
  goals,
  entries,
  onEdit,
  onAddGoal,
  onUpdateGoal,
  onRemoveGoal,
  onLog
}: Props) {
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [logGoal, setLogGoal] = useState<Goal | null>(null)

  const progressFor = (goal: Goal) => {
    const currentKey = periodKey(goal.period)
    return entries
      .filter((e) => e.goalId === goal.id && e.periodKey === currentKey)
      .reduce((s, e) => s + (e.amount || 0), 0)
  }

  return (
    <motion.div
      layout
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="card p-6"
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
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={onEdit}>
          Edit
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
          <div className="text-berry/60 text-sm">No goals yet.</div>
          <button className="btn-primary" onClick={() => setShowGoalForm(true)}>
            + Add a goal
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {goals.map((g) => {
            const p = progressFor(g)
            return (
              <div key={g.id} className="flex items-center gap-4">
                <RingProgress
                  value={p}
                  target={g.target}
                  color={course.color}
                  size={110}
                  strokeWidth={10}
                  label={`${p} / ${g.target}`}
                  sublabel={g.metric}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip capitalize">{g.period}</span>
                    <span className="text-xs text-berry/60">
                      {formatPeriodRange(g.period)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button className="btn-primary text-sm" onClick={() => setLogGoal(g)}>
                      + Log
                    </button>
                    <button className="btn-soft text-sm" onClick={() => setEditingGoal(g)}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <button className="btn-ghost w-full mt-2" onClick={() => setShowGoalForm(true)}>
            + Another goal
          </button>
        </div>
      )}

      <GoalFormDialog
        open={showGoalForm}
        onClose={() => setShowGoalForm(false)}
        courseName={course.name}
        onSave={onAddGoal}
      />

      {editingGoal && (
        <GoalFormDialog
          open={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          courseName={course.name}
          initial={editingGoal}
          onSave={async (data) => onUpdateGoal(editingGoal.id, data)}
          onDelete={async () => onRemoveGoal(editingGoal.id)}
        />
      )}

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
