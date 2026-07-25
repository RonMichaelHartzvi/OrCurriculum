import { useEffect, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import type { QuestionCategory, QuestionRef } from '../types'

export function useQuestionCategories(uid: string | null) {
  const [categories, setCategories] = useState<QuestionCategory[]>([])

  useEffect(() => {
    if (!uid) {
      setCategories([])
      return
    }
    const ref = collection(db, 'users', uid, 'questionCategories')
    const unsub = onSnapshot(query(ref, orderBy('createdAt', 'asc')), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestionCategory, 'id'>) })))
    })
    return unsub
  }, [uid])

  async function addCategory(courseId: string, name: string) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'questionCategories'), {
      courseId,
      name: name.trim(),
      questions: [],
      createdAt: serverTimestamp()
    })
  }

  async function removeCategory(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'questionCategories', id))
  }

  async function toggleQuestionInCategory(categoryId: string, ref: QuestionRef, add: boolean) {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'questionCategories', categoryId), {
      questions: add ? arrayUnion(ref) : arrayRemove(ref)
    })
  }

  return { categories, addCategory, removeCategory, toggleQuestionInCategory }
}
