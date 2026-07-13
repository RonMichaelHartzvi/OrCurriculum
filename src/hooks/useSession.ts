import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Goal, Session } from '../types'
import { periodKey } from '../lib/periods'
import { sessionElapsedMinutes } from '../lib/time'

export function useSession(uid: string | null) {
  const [active, setActive] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setActive(null)
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'sessions')
    // Query only by outcome to avoid needing a Firestore composite index.
    // There is at most one running session per user (enforced in startSession),
    // so no ordering is required.
    const unsub = onSnapshot(
      query(ref, where('outcome', '==', 'running')),
      (snap) => {
        const first = snap.docs[0]
        setActive(first ? ({ id: first.id, ...(first.data() as Omit<Session, 'id'>) }) : null)
        setLoading(false)
      },
      (err) => {
        console.error('useSession onSnapshot error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  async function startSession(input: {
    courseId: string
    goalId: string | null
    plannedMinutes: number
  }): Promise<void> {
    if (!uid) return
    if (active) return // one running session at a time
    const minutes = Math.max(1, Math.round(input.plannedMinutes))
    await addDoc(collection(db, 'users', uid, 'sessions'), {
      courseId: input.courseId,
      goalId: input.goalId,
      plannedMinutes: minutes,
      startedAt: serverTimestamp(),
      endedAt: null,
      outcome: 'running',
      loggedMinutes: null,
      entryId: null
    })
  }

  async function completeSession(
    session: Session,
    goal: Goal | null,
    loggedMinutes: number
  ): Promise<void> {
    if (!uid) return
    const minutes = Math.max(0, Math.round(loggedMinutes))
    let entryId: string | null = null
    if (minutes > 0) {
      const entryRef = await addDoc(collection(db, 'users', uid, 'entries'), {
        courseId: session.courseId,
        goalId: goal?.id ?? session.goalId ?? '',
        metric: 'minutes',
        amount: minutes,
        periodKey: goal ? periodKey(goal.period) : periodKey('daily'),
        at: serverTimestamp()
      })
      entryId = entryRef.id
    }
    await updateDoc(doc(db, 'users', uid, 'sessions', session.id), {
      outcome: 'completed',
      endedAt: serverTimestamp(),
      loggedMinutes: minutes,
      entryId
    })
  }

  async function cancelSession(session: Session): Promise<void> {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'sessions', session.id), {
      outcome: 'canceled',
      endedAt: serverTimestamp(),
      loggedMinutes: 0,
      entryId: null
    })
  }

  // "End now": credit the actual elapsed minutes (rounded to nearest minute)
  // rather than the planned duration.
  async function endNow(session: Session, goal: Goal | null): Promise<void> {
    const elapsed = Math.round(sessionElapsedMinutes(session))
    return completeSession(session, goal, elapsed)
  }

  async function markAlarmed(session: Session): Promise<void> {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'sessions', session.id), {
      alarmedAt: serverTimestamp()
    })
  }

  return {
    active,
    loading,
    startSession,
    completeSession,
    cancelSession,
    endNow,
    markAlarmed
  }
}
