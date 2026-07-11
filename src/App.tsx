import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { isAllowed } from './firebase'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌸</div>
      </div>
    )
  }

  return user && isAllowed(user.email) ? <Dashboard user={user} /> : <AuthScreen />
}
