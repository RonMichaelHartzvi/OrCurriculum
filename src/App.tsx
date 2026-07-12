import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { CoursePage } from './components/CoursePage'
import { isAllowed } from './firebase'
import { useRoute } from './hooks/useRoute'

export default function App() {
  const { user, loading } = useAuth()
  const route = useRoute()

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌸</div>
      </div>
    )
  }

  if (!user || !isAllowed(user.email)) {
    return <AuthScreen />
  }

  if (route.view === 'course') {
    return <CoursePage user={user} courseId={route.courseId} />
  }
  return <Dashboard user={user} />
}
