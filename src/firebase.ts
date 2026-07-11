import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const missing = Object.entries(cfg)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length) {
  console.warn(
    `Missing Firebase env vars: ${missing.join(', ')}. Copy .env.example to .env and fill values.`
  )
}

export const app = initializeApp(cfg as Record<string, string>)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

const rawAllowed = import.meta.env.VITE_ALLOWED_EMAILS ?? ''
export const ALLOWED_EMAILS: string[] = rawAllowed
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  if (ALLOWED_EMAILS.length === 0) return true
  return ALLOWED_EMAILS.includes(email.toLowerCase())
}
