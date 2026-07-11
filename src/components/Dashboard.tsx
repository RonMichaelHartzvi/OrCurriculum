import { useEffect, useMemo, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { useCourses } from '../hooks/useCourses'
import { useGoals } from '../hooks/useGoals'
import { useEntries } from '../hooks/useEntries'
import { useHistory } from '../hooks/useHistory'
import { archivePastPeriods } from '../lib/archive'
import { CourseCard } from './CourseCard'
import { CourseFormDialog } from './CourseFormDialog'
import { HistoryView } from './HistoryView'
import { periodKey } from '../lib/periods'
import type { Course, Goal, PeriodKind } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

export function Dashboard({ user }: { user: User }) {
  const uid = user.uid
  const { courses, addCourse, updateCourse, removeCourse } = useCourses(uid)
  const { goals, addGoal, updateGoal, removeGoal } = useGoals(uid)
  const { entries, addEntry } = useEntries(uid)
  const { history } = useHistory(uid)

  const [showNewCourse, setShowNewCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Auto-archive past periods once we have the goal list.
  useEffect(() => {
    if (goals.length) archivePastPeriods(uid, goals).catch((e) => console.warn('archive:', e))
  }, [uid, goals])

  const goalsByCourse = useMemo(() => {
    const m = new Map<string, Goal[]>()
    for (const g of goals) {
      if (!m.has(g.courseId)) m.set(g.courseId, [])
      m.get(g.courseId)!.push(g)
    }
    return m
  }, [goals])

  return (
    <div className="min-h-full">
      <header className="max-w-4xl mx-auto px-5 pt-8 pb-4 flex items-center gap-3">
        <div className="text-3xl">🌸</div>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-deepRose">
            OrCurriculum
          </h1>
          <p className="text-xs sm:text-sm text-berry/70">
            Hi {user.email?.split('@')[0]} — let's crush this week 💗
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setShowHistory(true)}>
          History
        </button>
        <button className="btn-ghost" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-5 pb-24">
        {courses.length === 0 ? (
          <div className="card p-10 text-center mt-6">
            <div className="text-5xl mb-3">🌷</div>
            <h2 className="text-xl font-display font-bold text-deepRose">
              No courses yet
            </h2>
            <p className="text-berry/70 mt-1 mb-5">
              Add your first course to start setting goals.
            </p>
            <button className="btn-primary" onClick={() => setShowNewCourse(true)}>
              + New course
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <AnimatePresence>
              {courses.map((c) => (
                <motion.div layout key={c.id}>
                  <CourseCard
                    course={c}
                    goals={goalsByCourse.get(c.id) ?? []}
                    entries={entries}
                    onEdit={() => setEditingCourse(c)}
                    onAddGoal={(data) => addGoal({ courseId: c.id, ...data })}
                    onUpdateGoal={(id, patch) => updateGoal(id, patch)}
                    onRemoveGoal={(id) => removeGoal(id)}
                    onLog={(goal, amount) =>
                      addEntry({
                        courseId: goal.courseId,
                        goalId: goal.id,
                        metric: goal.metric,
                        amount,
                        periodKey: periodKey(goal.period as PeriodKind)
                      })
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn-primary shadow-petal text-base px-6 py-3"
          onClick={() => setShowNewCourse(true)}
        >
          + Course
        </motion.button>
      </div>

      <CourseFormDialog
        open={showNewCourse}
        onClose={() => setShowNewCourse(false)}
        onSave={(data) => addCourse(data)}
      />

      {editingCourse && (
        <CourseFormDialog
          open={!!editingCourse}
          onClose={() => setEditingCourse(null)}
          initial={editingCourse}
          onSave={(data) => updateCourse(editingCourse.id, data)}
          onDelete={() => removeCourse(editingCourse.id)}
        />
      )}

      <HistoryView
        open={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        courses={courses}
      />
    </div>
  )
}
