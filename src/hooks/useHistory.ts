import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { HistoryRecord } from '../types'

export function useHistory(uid: string | null) {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setHistory([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'history')
    const unsub = onSnapshot(query(ref, orderBy('periodEnd', 'desc')), (snap) => {
      setHistory(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryRecord, 'id'>) }))
      )
      setLoading(false)
    })
    return unsub
  }, [uid])

  return { history, loading }
}
