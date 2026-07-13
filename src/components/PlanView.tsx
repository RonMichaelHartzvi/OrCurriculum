import type { User } from 'firebase/auth'
import { useCourses } from '../hooks/useCourses'
import { useGoals } from '../hooks/useGoals'
import { useSession } from '../hooks/useSession'
import { usePlannedBlocks } from '../hooks/usePlannedBlocks'
import { openDashboard } from '../hooks/useRoute'
import { DayPlan } from './DayPlan'

export function PlanView({ user }: { user: User }) {
  const uid = user.uid
  const { courses } = useCourses(uid)
  const { goals } = useGoals(uid)
  const { blocks, addBlock, updateBlock, removeBlock } = usePlannedBlocks(uid)
  const { active, startSession, completeSession, cancelSession, endNow } = useSession(uid)

  return (
    <div className="min-h-full pb-24">
      <header className="max-w-3xl mx-auto px-5 pt-8 pb-4 flex items-center gap-2">
        <button className="btn-ghost" onClick={openDashboard}>
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-deepRose">
            Day plan
          </h1>
          <p className="text-xs text-berry/70">
            Schedule study blocks and start sessions from them.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5">
        <div className="card p-6">
          {courses.length === 0 ? (
            <div className="text-center text-berry/70 py-8">
              <div className="text-3xl mb-2">🌷</div>
              Add a course first, then you can plan blocks for it.
            </div>
          ) : (
            <DayPlan
              courses={courses}
              goals={goals}
              blocks={blocks}
              activeSession={active}
              onAddBlock={addBlock}
              onUpdateBlock={updateBlock}
              onRemoveBlock={removeBlock}
              onStartSession={startSession}
              onCompleteSession={completeSession}
              onCancelSession={cancelSession}
              onEndNowSession={endNow}
            />
          )}
        </div>
      </main>
    </div>
  )
}
