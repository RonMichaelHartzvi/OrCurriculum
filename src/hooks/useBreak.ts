import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Break } from '../types'

export function useBreak(uid: string | null) {
  const [active, setActive] = useState<Break | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setActive(null)
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'breaks')
    const unsub = onSnapshot(
      query(ref, where('outcome', '==', 'running'), orderBy('startedAt', 'desc')),
      (snap) => {
        const first = snap.docs[0]
        setActive(first ? ({ id: first.id, ...(first.data() as Omit<Break, 'id'>) }) : null)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [uid])

  async function startBreak(plannedMinutes: number): Promise<void> {
    if (!uid || active) return
    const minutes = Math.max(1, Math.round(plannedMinutes))
    await addDoc(collection(db, 'users', uid, 'breaks'), {
      plannedMinutes: minutes,
      startedAt: serverTimestamp(),
      endedAt: null,
      outcome: 'running'
    })
  }

  async function endBreak(brk: Break, outcome: 'completed' | 'canceled' = 'completed'): Promise<void> {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'breaks', brk.id), {
      outcome,
      endedAt: serverTimestamp()
    })
  }

  return { active, loading, startBreak, endBreak }
}
