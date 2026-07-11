import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry } from '../types'

export function useEntries(uid: string | null) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setEntries([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'entries')
    const unsub = onSnapshot(query(ref), (snap) => {
      setEntries(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) }))
      )
      setLoading(false)
    })
    return unsub
  }, [uid])

  async function addEntry(input: {
    courseId: string
    goalId: string
    metric: string
    amount: number
    periodKey: string
  }) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'entries'), {
      ...input,
      at: serverTimestamp()
    })
  }

  async function removeEntry(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'entries', id))
  }

  return { entries, loading, addEntry, removeEntry }
}
