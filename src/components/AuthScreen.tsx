import { useEffect, useState } from 'react'
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink
} from 'firebase/auth'
import { auth } from '../firebase'
import { motion } from 'framer-motion'

const STORAGE_KEY = 'or.pendingEmail'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  // If the page loaded from an email sign-in link, finish sign-in automatically.
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return
    setFinishing(true)
    let stored = window.localStorage.getItem(STORAGE_KEY) || ''
    if (!stored) {
      stored = window.prompt('Please confirm the email you signed in with') || ''
    }
    if (!stored) {
      setFinishing(false)
      setError('We need the email you used to send the link.')
      return
    }
    signInWithEmailLink(auth, stored, window.location.href)
      .then(() => {
        window.localStorage.removeItem(STORAGE_KEY)
        // Clean the URL so the sign-in params don't linger.
        window.history.replaceState({}, document.title, window.location.pathname)
      })
      .catch((err) => {
        setError(prettyAuthError(err))
        setFinishing(false)
      })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const url = window.location.origin + window.location.pathname
      await sendSignInLinkToEmail(auth, email.trim(), {
        url,
        handleCodeInApp: true
      })
      window.localStorage.setItem(STORAGE_KEY, email.trim())
      setSent(true)
    } catch (err) {
      setError(prettyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  if (finishing) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">🌸</div>
          <p className="text-berry font-display font-semibold">Signing you in…</p>
        </div>
      </div>
    )
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

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">💌</div>
            <h2 className="font-display font-bold text-deepRose text-lg">Check your inbox</h2>
            <p className="text-sm text-berry/80">
              We sent a magic link to <span className="font-semibold">{email}</span>. Open it on this
              device and you're in — no password needed.
            </p>
            <button
              className="btn-soft w-full"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs text-berry/70 text-center mb-1">
              Type your email — we'll send you a magic sign-in link. No password to remember.
            </p>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && (
              <div className="text-sm text-berry bg-petal/70 rounded-2xl px-3 py-2">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy || !email}>
              {busy ? '…' : 'Send me a magic link 💗'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

function prettyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks off.'
    case 'auth/operation-not-allowed':
      return 'Email-link sign-in isn\'t enabled yet in the Firebase console.'
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'That sign-in link is expired or has already been used. Request a new one.'
    case 'auth/unauthorized-continue-uri':
      return 'This domain isn\'t in the Firebase authorised list yet.'
    default:
      return (err as Error)?.message ?? 'Something went wrong.'
  }
}
