import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Course } from '../types'

export function useCourses(uid: string | null) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setCourses([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'courses')
    const unsub = onSnapshot(query(ref, orderBy('createdAt', 'asc')), (snap) => {
      setCourses(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, 'id'>) }))
      )
      setLoading(false)
    })
    return unsub
  }, [uid])

  async function addCourse(input: { name: string; emoji: string; color: string }) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'courses'), {
      ...input,
      createdAt: serverTimestamp()
    })
  }

  async function updateCourse(id: string, patch: Partial<Omit<Course, 'id' | 'createdAt'>>) {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'courses', id), patch)
  }

  async function removeCourse(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'courses', id))
  }

  return { courses, loading, addCourse, updateCourse, removeCourse }
}
