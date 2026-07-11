import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  doc
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry, Goal } from '../types'
import { periodEnd, periodKey, periodStart } from './periods'

/**
 * For each active goal, roll up any entries whose periodKey is older than the
 * goal's current periodKey into a `history` document, then delete those
 * entries so the live view stays lean. Idempotent — safe to run on every load.
 */
export async function archivePastPeriods(uid: string, goals: Goal[]): Promise<void> {
  if (!goals.length) return

  const entriesRef = collection(db, 'users', uid, 'entries')
  const historyRef = collection(db, 'users', uid, 'history')

  for (const goal of goals) {
    const currentKey = periodKey(goal.period)
    const snap = await getDocs(query(entriesRef, where('goalId', '==', goal.id)))
    const stale = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) }))
      .filter((e) => e.periodKey && e.periodKey !== currentKey)
    if (!stale.length) continue

    const byKey = new Map<string, Entry[]>()
    for (const e of stale) {
      if (!byKey.has(e.periodKey)) byKey.set(e.periodKey, [])
      byKey.get(e.periodKey)!.push(e)
    }

    const batch = writeBatch(db)
    for (const [key, entries] of byKey) {
      const achieved = entries.reduce((s, e) => s + (e.amount || 0), 0)
      const ref = entries[0].at?.toDate() ?? new Date()
      const historyDoc = doc(historyRef)
      batch.set(historyDoc, {
        courseId: goal.courseId,
        goalId: goal.id,
        metric: goal.metric,
        target: goal.target,
        achieved,
        period: goal.period,
        periodKey: key,
        periodStart: Timestamp.fromDate(periodStart(goal.period, ref)),
        periodEnd: Timestamp.fromDate(periodEnd(goal.period, ref))
      })
      for (const e of entries) {
        batch.delete(doc(entriesRef, e.id))
      }
    }
    await batch.commit()
  }
}
