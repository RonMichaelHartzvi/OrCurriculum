import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Session } from '../types'

// Streams every session doc, not just the running one — used by the
// History dialog. Kept separate from `useSession` so SessionBanner /
// CoursePage don't pay to load the whole log.
export function useSessions(uid: string | null) {
  const [all, setAll] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setAll([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'sessions')
    const unsub = onSnapshot(
      query(ref),
      (snap) => {
        setAll(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) }))
        )
        setLoading(false)
      },
      (err) => {
        console.error('useSessions onSnapshot error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  // Delete the linked entry (if it still exists — same-period sessions still
  // have their entry, past-period ones have been archived away) and the
  // session doc. History aggregates are intentionally not touched: for the
  // archived case we're removing the session record only.
  async function discardSession(session: Session): Promise<void> {
    if (!uid) return
    if (session.entryId) {
      try {
        await deleteDoc(doc(db, 'users', uid, 'entries', session.entryId))
      } catch {
        /* entry already gone (archived) — nothing to do */
      }
    }
    await deleteDoc(doc(db, 'users', uid, 'sessions', session.id))
  }

  async function discardEntry(entryId: string): Promise<void> {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'entries', entryId))
  }

  return { all, loading, discardSession, discardEntry }
}
