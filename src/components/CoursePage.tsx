import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { motion } from 'framer-motion'
import { useCourses } from '../hooks/useCourses'
import { useGoals } from '../hooks/useGoals'
import { useEntries } from '../hooks/useEntries'
import { useHistory } from '../hooks/useHistory'
import { useTasks } from '../hooks/useTasks'
import { useSession } from '../hooks/useSession'
import { usePlannedBlocks } from '../hooks/usePlannedBlocks'
import { openDashboard } from '../hooks/useRoute'
import { archivePastPeriods } from '../lib/archive'
import { formatPeriodRange, periodKey } from '../lib/periods'
import { formatDuration } from '../lib/time'
import { computeProgress } from '../lib/progress'
import { RingProgress } from './RingProgress'
import { QuickAddSheet } from './QuickAddSheet'
import { CourseFormDialog } from './CourseFormDialog'
import { GoalFormDialog } from './GoalFormDialog'
import { TaskList } from './TaskList'
import { SessionTimer } from './SessionTimer'
import { DayPlan } from './DayPlan'
import type { Goal, GoalUnit, PeriodKind } from '../types'

interface LogGroup {
  unit: GoalUnit
  metric: string
  goals: Goal[]
}

interface Props {
  user: User
  courseId: string
}

export function CoursePage({ user, courseId }: Props) {
  const uid = user.uid
  const { courses, updateCourse, removeCourse } = useCourses(uid)
  const { goals, addGoal, updateGoal, removeGoal } = useGoals(uid)
  const { entries, addEntry } = useEntries(uid)
  const { history } = useHistory(uid)
  const {
    tasks,
    addTask,
    addPracticeTest,
    toggleTask,
    updateTaskTitle,
    updateQuestionStatus,
    resetPracticeTest,
    removeTask
  } = useTasks(uid)

  const [showEditCourse, setShowEditCourse] = useState(false)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [logGroup, setLogGroup] = useState<LogGroup | null>(null)
  const [sessionForGoal, setSessionForGoal] = useState<Goal | null | 'freeform'>(null)

  const {
    active: activeSession,
    startSession,
    completeSession,
    cancelSession,
    endNow: endNowSession
  } = useSession(uid)
  const {
    blocks: plannedBlocks,
    addBlock,
    updateBlock,
    removeBlock
  } = usePlannedBlocks(uid)

  const course = courses.find((c) => c.id === courseId)
  const courseGoals = useMemo(
    () => goals.filter((g) => g.courseId === courseId),
    [goals, courseId]
  )
  const courseTasks = useMemo(
    () => tasks.filter((t) => t.courseId === courseId),
    [tasks, courseId]
  )
  const courseHistory = useMemo(
    () =>
      history
        .filter((h) => h.courseId === courseId)
        .sort((a, b) => (b.periodEnd?.toMillis() ?? 0) - (a.periodEnd?.toMillis() ?? 0)),
    [history, courseId]
  )

  // Dedupe goals into one row of log/session actions per unique metric.
  // A course with weekly+daily time goals should show ONE "+ Log study time"
  // and ONE "▶ Start session" — not one per goal.
  const logGroups = useMemo<LogGroup[]>(() => {
    const map = new Map<string, LogGroup>()
    for (const g of courseGoals) {
      const unit: GoalUnit = g.unit ?? 'count'
      const key = `${unit}|${g.metric}`
      let group = map.get(key)
      if (!group) {
        group = { unit, metric: g.metric, goals: [] }
        map.set(key, group)
      }
      group.goals.push(g)
    }
    return Array.from(map.values())
  }, [courseGoals])
  const hasTimeGoal = logGroups.some((g) => g.unit === 'minutes')

  useEffect(() => {
    if (courseGoals.length) {
      archivePastPeriods(uid, courseGoals).catch((e) => console.warn('archive:', e))
    }
  }, [uid, courseGoals])

  // If the course was deleted / doesn't exist, bounce back to dashboard once loaded.
  useEffect(() => {
    if (courses.length > 0 && !course) openDashboard()
  }, [courses, course])

  if (!course) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌸</div>
      </div>
    )
  }

  const progressFor = (g: Goal) => computeProgress(g, entries)

  return (
    <div className="min-h-full pb-24">
      {/* Colored header */}
      <div
        className="relative overflow-hidden pt-6 pb-10"
        style={{
          background: `linear-gradient(135deg, ${course.color}55 0%, #FCE7F3 100%)`
        }}
      >
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-center justify-between mb-6">
            <button className="btn-ghost !bg-white/70 !text-berry" onClick={openDashboard}>
              ← Back
            </button>
            <button className="btn-soft !bg-white/70" onClick={() => setShowEditCourse(true)}>
              Edit course
            </button>
          </div>
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-petal"
              style={{ background: course.color }}
            >
              {course.emoji}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-deepRose">{course.name}</h1>
              <p className="text-sm text-berry/70">
                {courseGoals.length} {courseGoals.length === 1 ? 'goal' : 'goals'} ·{' '}
                {courseTasks.filter((t) => !t.done).length} open{' '}
                {courseTasks.filter((t) => !t.done).length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-5 -mt-4 space-y-6">
        {/* Goals section */}
        <section className="card p-6">
          <SectionHeader
            title="Goals"
            action={
              <button className="btn-soft text-sm" onClick={() => setShowNewGoal(true)}>
                + Add goal
              </button>
            }
          />
          {courseGoals.length === 0 ? (
            <div className="text-center text-berry/70 py-8">
              <div className="text-3xl mb-2">🎯</div>
              No goals yet. Tap “Add goal” to set a target.
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                {logGroups.map((group) => {
                  const label =
                    group.unit === 'minutes' ? 'study time' : group.metric
                  return (
                    <button
                      key={`${group.unit}|${group.metric}`}
                      className="btn-primary text-sm"
                      onClick={() => setLogGroup(group)}
                    >
                      + Log {label}
                    </button>
                  )
                })}
                {hasTimeGoal && (
                  <button
                    className="btn-soft text-sm"
                    onClick={() => setSessionForGoal('freeform')}
                    disabled={Boolean(activeSession && activeSession.courseId !== courseId)}
                  >
                    ▶ Start session
                  </button>
                )}
              </div>
              <div className="space-y-5">
                {courseGoals.map((g) => {
                  const p = progressFor(g)
                  const isTime = g.unit === 'minutes'
                  const ringLabel = isTime
                    ? `${formatDuration(p)} / ${formatDuration(g.target)}`
                    : `${p} / ${g.target}`
                  const ringSublabel = isTime ? 'study time' : g.metric
                  return (
                    <motion.div
                      key={g.id}
                      layout
                      className="flex items-center gap-5 rounded-3xl bg-blush/50 p-4"
                    >
                      <RingProgress
                        value={p}
                        target={g.target}
                        color={course.color}
                        size={124}
                        strokeWidth={12}
                        label={ringLabel}
                        sublabel={ringSublabel}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="chip capitalize">{g.period}</span>
                          <span className="text-xs text-berry/60">
                            {formatPeriodRange(g.period)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="btn-soft text-sm"
                            onClick={() => setEditingGoal(g)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* Day plan section */}
        <section className="card p-6">
          <SectionHeader
            title="Day plan"
            subtitle="Time blocks for today. Push them to Google Calendar if you like."
          />
          <DayPlan
            courses={courses}
            goals={goals}
            blocks={plannedBlocks}
            activeSession={activeSession}
            onAddBlock={addBlock}
            onUpdateBlock={updateBlock}
            onRemoveBlock={removeBlock}
            onStartSession={startSession}
            onCompleteSession={completeSession}
            onCancelSession={cancelSession}
            onEndNowSession={endNowSession}
            courseFilter={courseId}
            compact
          />
        </section>

        {/* Tasks section */}
        <section className="card p-6">
          <SectionHeader title="Tasks" subtitle="Untimed to-dos — check them off as you go." />
          <TaskList
            tasks={courseTasks}
            color={course.color}
            onAddRegular={(title) => addTask({ courseId, title })}
            onAddPracticeTest={({ title, questionCount }) =>
              addPracticeTest({ courseId, title, questionCount })
            }
            onToggle={(id, done) => toggleTask(id, done)}
            onEdit={(id, title) => updateTaskTitle(id, title)}
            onRemove={(id) => removeTask(id)}
            onUpdateQuestion={(task, index, status) =>
              updateQuestionStatus(task, index, status)
            }
            onResetPracticeTest={(task) => resetPracticeTest(task)}
          />
        </section>

        {/* History section */}
        <section className="card p-6">
          <SectionHeader title="History" subtitle="Past weeks and days for this course." />
          {courseHistory.length === 0 ? (
            <div className="text-center text-berry/70 py-8">
              <div className="text-3xl mb-2">✨</div>
              Past periods will appear here once a week or day wraps up.
            </div>
          ) : (
            <ul className="space-y-2">
              {courseHistory.map((h) => {
                const pct = h.target > 0 ? Math.round((h.achieved / h.target) * 100) : 0
                const done = h.achieved >= h.target
                const isTime = h.metric === 'minutes'
                const achievedText = isTime ? formatDuration(h.achieved) : `${h.achieved}`
                const targetText = isTime ? formatDuration(h.target) : `${h.target}`
                const metricText = isTime ? 'studied' : h.metric
                return (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl bg-petal/40 px-3 py-2"
                  >
                    <div
                      className="w-2 h-10 rounded-full"
                      style={{ background: done ? course.color : '#F5D0E4' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-berry capitalize text-sm">
                        {h.period} · {h.periodKey}
                      </div>
                      <div className="text-xs text-berry/70">
                        {achievedText} / {targetText} {metricText}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-display font-bold ${
                        done ? 'text-berry' : 'text-berry/60'
                      }`}
                    >
                      {done ? '🎉' : `${pct}%`}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      <CourseFormDialog
        open={showEditCourse}
        onClose={() => setShowEditCourse(false)}
        initial={course}
        onSave={(data) => updateCourse(course.id, data)}
        onDelete={async () => {
          await removeCourse(course.id)
          openDashboard()
        }}
      />

      <GoalFormDialog
        open={showNewGoal}
        onClose={() => setShowNewGoal(false)}
        courseName={course.name}
        onSave={(data) => addGoal({ courseId: course.id, ...data })}
      />

      {editingGoal && (
        <GoalFormDialog
          open={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          courseName={course.name}
          initial={editingGoal}
          onSave={(data) => updateGoal(editingGoal.id, data)}
          onDelete={() => removeGoal(editingGoal.id)}
        />
      )}

      {sessionForGoal && (
        <SessionTimer
          open={Boolean(sessionForGoal)}
          onClose={() => setSessionForGoal(null)}
          course={course}
          goals={courseGoals}
          active={activeSession}
          initialGoalId={sessionForGoal === 'freeform' ? null : sessionForGoal.id}
          onStart={startSession}
          onComplete={completeSession}
          onCancel={cancelSession}
          onEndNow={endNowSession}
        />
      )}

      {logGroup && (
        <QuickAddSheet
          open={!!logGroup}
          onClose={() => setLogGroup(null)}
          goal={logGroup.goals[0]}
          courseName={course.name}
          progress={progressFor(logGroup.goals[0])}
          onLog={async (amount) => {
            if (logGroup.unit === 'minutes') {
              // Time progress is pooled across the course — one entry credits
              // every time goal in the current period.
              const g = logGroup.goals[0]
              await addEntry({
                courseId: g.courseId,
                goalId: g.id,
                metric: g.metric,
                amount,
                periodKey: periodKey(g.period as PeriodKind)
              })
            } else {
              // Count progress is per-goal, so we write one entry per goal in
              // the group so both weekly and daily goals of the same metric
              // get credit.
              for (const g of logGroup.goals) {
                await addEntry({
                  courseId: g.courseId,
                  goalId: g.id,
                  metric: g.metric,
                  amount,
                  periodKey: periodKey(g.period as PeriodKind)
                })
              }
            }
          }}
        />
      )}
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-display font-bold text-deepRose">{title}</h2>
        {subtitle && <p className="text-xs text-berry/60 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
