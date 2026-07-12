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
import type { QuestionStatus, Task } from '../types'

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
      type: 'regular',
      done: false,
      createdAt: serverTimestamp(),
      completedAt: null
    })
  }

  async function addPracticeTest(input: {
    courseId: string
    title: string
    questionCount: number
  }) {
    if (!uid) return
    const count = Math.max(1, Math.floor(input.questionCount))
    await addDoc(collection(db, 'users', uid, 'tasks'), {
      courseId: input.courseId,
      title: input.title,
      type: 'practiceTest',
      questionCount: count,
      questions: Array(count).fill('unanswered' as QuestionStatus),
      done: false,
      createdAt: serverTimestamp(),
      completedAt: null
    })
  }

  async function updateQuestionStatus(task: Task, index: number, status: QuestionStatus) {
    if (!uid) return
    const questions = [...(task.questions ?? [])]
    if (index < 0 || index >= questions.length) return
    questions[index] = status
    // Test is "done" only when every question is definitively answered
    // (succeeded or failed). Retry and unanswered keep it in the Open group.
    const done =
      questions.length > 0 &&
      questions.every((q) => q === 'succeeded' || q === 'failed')
    await updateDoc(doc(db, 'users', uid, 'tasks', task.id), {
      questions,
      done,
      completedAt: done ? serverTimestamp() : null
    })
  }

  async function resetPracticeTest(task: Task) {
    if (!uid || !task.questionCount) return
    await updateDoc(doc(db, 'users', uid, 'tasks', task.id), {
      questions: Array(task.questionCount).fill('unanswered' as QuestionStatus),
      done: false,
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

  return {
    tasks,
    loading,
    addTask,
    addPracticeTest,
    toggleTask,
    updateTaskTitle,
    updateQuestionStatus,
    resetPracticeTest,
    removeTask
  }
}
