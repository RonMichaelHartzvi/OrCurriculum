import type { Entry, Goal } from '../types'
import { periodEnd, periodKey, periodStart } from './periods'

// Count goals track their own goalId. Time goals pool every minute entry
// logged against the course in the goal's period — so a session credits every
// active time goal in that course/period, and a time goal added later can
// still see minutes that were logged earlier in the same window.
export function computeProgress(goal: Goal, entries: Entry[]): number {
  if (goal.unit === 'minutes') {
    const start = periodStart(goal.period).getTime()
    const end = periodEnd(goal.period).getTime()
    return entries
      .filter((e) => {
        if (e.courseId !== goal.courseId) return false
        if (e.metric !== 'minutes') return false
        const t = (e.at?.toDate() ?? new Date()).getTime()
        return t >= start && t <= end
      })
      .reduce((s, e) => s + (e.amount || 0), 0)
  }
  const key = periodKey(goal.period)
  return entries
    .filter((e) => e.goalId === goal.id && e.periodKey === key)
    .reduce((s, e) => s + (e.amount || 0), 0)
}
