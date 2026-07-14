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
import type { CourseLink } from '../types'

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function useLinks(uid: string | null) {
  const [links, setLinks] = useState<CourseLink[]>([])

  useEffect(() => {
    if (!uid) {
      setLinks([])
      return
    }
    const ref = collection(db, 'users', uid, 'links')
    const unsub = onSnapshot(query(ref, orderBy('createdAt', 'asc')), (snap) => {
      setLinks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CourseLink, 'id'>) })))
    })
    return unsub
  }, [uid])

  async function addLink(input: { courseId: string; url: string; label: string }) {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'links'), {
      courseId: input.courseId,
      url: normalizeUrl(input.url),
      label: input.label.trim(),
      createdAt: serverTimestamp()
    })
  }

  async function updateLink(id: string, data: { url?: string; label?: string }) {
    if (!uid) return
    const patch: Record<string, string> = {}
    if (data.url !== undefined) patch.url = normalizeUrl(data.url)
    if (data.label !== undefined) patch.label = data.label.trim()
    await updateDoc(doc(db, 'users', uid, 'links', id), patch)
  }

  async function removeLink(id: string) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'links', id))
  }

  return { links, addLink, updateLink, removeLink }
}
