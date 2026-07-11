import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth'
import { auth } from '../firebase'
import { motion } from 'framer-motion'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      }
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

        <div className="flex bg-petal/60 rounded-full p-1 mb-5 text-sm font-display font-semibold">
          <button
            className={`flex-1 rounded-full py-2 transition ${
              mode === 'signin' ? 'bg-white text-berry shadow-soft' : 'text-berry/70'
            }`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full py-2 transition ${
              mode === 'signup' ? 'bg-white text-berry shadow-soft' : 'text-berry/70'
            }`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {error && (
            <div className="text-sm text-berry bg-petal/70 rounded-2xl px-3 py-2">
              {error}
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function prettyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks off.'
    case 'auth/email-already-in-use':
      return 'This email already has an account — try signing in.'
    case 'auth/weak-password':
      return 'Password needs to be at least 6 characters.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong email or password.'
    case 'auth/user-not-found':
      return 'No account with that email — try creating one.'
    default:
      return (err as Error)?.message ?? 'Something went wrong.'
  }
}
