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
import type { Task } from '../types'

export function useTasks(uid: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setTasks([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'tasks')
    const unsub = onSnapshot(query(ref, orderBy('createdAt', 'desc')), (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) })))
      setLoading(false)
    })
    return unsub
  }, [uid])

  async function addTask(input: { courseId: string; title: string }) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'tasks'), {
      ...input,
      done: false,
      createdAt: serverTimestamp(),
      completedAt: null
    })
  }

  async function toggleTask(id: string, done: boolean) {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'tasks', id), {
      done,
      completedAt: done ? serverTimestamp() : null
    })
  }

  async function updateTaskTitle(id: string, title: string) {
    if (!uid) return
    await updateDoc(doc(db, 'users', uid, 'tasks', id), { title })
  }

  async function removeTask(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'tasks', id))
  }

  return { tasks, loading, addTask, toggleTask, updateTaskTitle, removeTask }
}
