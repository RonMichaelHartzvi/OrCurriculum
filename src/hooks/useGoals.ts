import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Goal, GoalUnit, PeriodKind } from '../types'

export function useGoals(uid: string | null) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setGoals([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'goals')
    const unsub = onSnapshot(query(ref, where('active', '==', true)), (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) })))
      setLoading(false)
    })
    return unsub
  }, [uid])

  async function addGoal(input: {
    courseId: string
    metric: string
    target: number
    period: PeriodKind
    unit?: GoalUnit
  }) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'goals'), {
      ...input,
      unit: input.unit ?? 'count',
      active: true,
      createdAt: serverTimestamp()
    })
  }

  async function updateGoal(
    id: string,
    patch: Partial<Omit<Goal, 'id' | 'courseId' | 'createdAt'>>
  ) {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'goals', id), patch)
  }

  async function removeGoal(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'goals', id))
  }

  return { goals, loading, addGoal, updateGoal, removeGoal }
}
