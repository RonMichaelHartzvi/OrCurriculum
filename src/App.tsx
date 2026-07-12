import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { CoursePage } from './components/CoursePage'
import { TimeDashboard } from './components/TimeDashboard'
import { PlanView } from './components/PlanView'
import { UpdatePrompt } from './components/UpdatePrompt'
import { isAllowed } from './firebase'
import { useRoute } from './hooks/useRoute'

export default function App() {
  const { user, loading } = useAuth()
  const route = useRoute()

  return (
    <>
      {loading ? (
        <div className="min-h-full flex items-center justify-center">
          <div className="text-4xl animate-pulse">🌸</div>
        </div>
      ) : !user || !isAllowed(user.email) ? (
        <AuthScreen />
      ) : route.view === 'course' ? (
        <CoursePage user={user} courseId={route.courseId} />
      ) : route.view === 'time' ? (
        <TimeDashboard user={user} />
      ) : route.view === 'plan' ? (
        <PlanView user={user} />
      ) : (
        <Dashboard user={user} />
      )}
      <UpdatePrompt />
    </>
  )
}
