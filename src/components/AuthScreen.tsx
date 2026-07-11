import { useState } from 'react'
import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isAllowed } from '../firebase'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'

export function AuthScreen() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notAllowed = user != null && !isAllowed(user.email)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(prettyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="card w-full max-w-sm p-8"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🌸</div>
          <h1 className="text-3xl font-display font-bold text-deepRose">OrCurriculum</h1>
          <p className="text-sm text-berry/70 mt-1 font-body">
            Cute little goal tracker for your studies.
          </p>
        </div>

        {notAllowed ? (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl bg-petal/70 border border-rose/40 p-4 text-sm text-berry">
              <p className="font-semibold">{user!.email} isn't on the allowlist.</p>
              <p className="mt-1 text-berry/80">
                Ask the owner to add your email to the app's allowlist.
              </p>
            </div>
            <button className="btn-soft w-full" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-berry/70 text-center">
              Sign in with your Google account — one tap, no password 💗
            </p>
            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleSignIn}
              disabled={busy}
            >
              {busy ? '…' : 'Sign in with Google'}
            </button>
            {error && (
              <div className="text-sm text-berry bg-petal/70 rounded-2xl px-3 py-2">
                {error}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function prettyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the popup — allow popups and try again.'
    case 'auth/operation-not-allowed':
      return "Google sign-in isn't enabled in the Firebase console yet."
    case 'auth/unauthorized-domain':
      return "This domain isn't in the Firebase authorised list yet."
    default:
      return (err as Error)?.message ?? 'Something went wrong.'
  }
}
