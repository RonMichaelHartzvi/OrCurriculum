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
  Timestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import type { PlannedBlock } from '../types'

export function usePlannedBlocks(uid: string | null) {
  const [blocks, setBlocks] = useState<PlannedBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setBlocks([])
      setLoading(false)
      return
    }
    const ref = collection(db, 'users', uid, 'plannedBlocks')
    const unsub = onSnapshot(
      query(ref, orderBy('startAt', 'asc')),
      (snap) => {
        setBlocks(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlannedBlock, 'id'>) }))
        )
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [uid])

  async function addBlock(input: {
    courseId: string
    title: string
    startAt: Date
    endAt: Date
    notes?: string
    calendarEventId?: string
  }): Promise<string | undefined> {
    if (!uid) return
    const ref = await addDoc(collection(db, 'users', uid, 'plannedBlocks'), {
      courseId: input.courseId,
      title: input.title,
      startAt: Timestamp.fromDate(input.startAt),
      endAt: Timestamp.fromDate(input.endAt),
      notes: input.notes ?? '',
      calendarEventId: input.calendarEventId ?? null,
      createdAt: serverTimestamp()
    })
    return ref.id
  }

  async function updateBlock(
    id: string,
    patch: Partial<{
      courseId: string
      title: string
      startAt: Date
      endAt: Date
      notes: string
      calendarEventId: string | null
    }>
  ): Promise<void> {
    if (!uid) return
    const payload: Record<string, unknown> = {}
    if (patch.courseId !== undefined) payload.courseId = patch.courseId
    if (patch.title !== undefined) payload.title = patch.title
    if (patch.startAt !== undefined) payload.startAt = Timestamp.fromDate(patch.startAt)
    if (patch.endAt !== undefined) payload.endAt = Timestamp.fromDate(patch.endAt)
    if (patch.notes !== undefined) payload.notes = patch.notes
    if (patch.calendarEventId !== undefined) payload.calendarEventId = patch.calendarEventId
    await updateDoc(doc(db, 'users', uid, 'plannedBlocks', id), payload)
  }

  async function removeBlock(id: string): Promise<void> {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'plannedBlocks', id))
  }

  return { blocks, loading, addBlock, updateBlock, removeBlock }
}
