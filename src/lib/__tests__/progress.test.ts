/**
 * Tests for src/lib/progress.ts
 *
 * Covered: computeProgress (count goals and time goals)
 *
 * Why: computeProgress is the single source of truth for ring-progress
 *      percentages shown on every CourseCard and CoursePage. A filtering
 *      bug would silently show wrong progress without any visible error.
 *
 * Run:   npm test
 * Watch: npm run test:watch
 */

import { describe, it, expect } from 'vitest'
import { computeProgress } from '../progress'
import { periodKey } from '../periods'
import type { Goal, Entry } from '../../types'

// Minimal mock for Entry.at (Timestamp). computeProgress calls e.at?.toDate()
// for time goals only.
function at(d: Date): Entry['at'] {
  return { toDate: () => d } as any
}

// Helpers for building minimal Goal and Entry fixtures.
function countGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    courseId: 'course-1',
    metric: 'questions',
    target: 10,
    period: 'daily',
    active: true,
    createdAt: null,
    unit: 'count',
    ...overrides,
  }
}

function timeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-time',
    courseId: 'course-1',
    metric: 'minutes',
    target: 60,
    period: 'daily',
    active: true,
    createdAt: null,
    unit: 'minutes',
    ...overrides,
  }
}

function countEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    courseId: 'course-1',
    goalId: 'goal-1',
    metric: 'questions',
    amount: 5,
    at: null,
    periodKey: periodKey('daily'),
    ...overrides,
  }
}

function timeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-t1',
    courseId: 'course-1',
    goalId: 'goal-time',
    metric: 'minutes',
    amount: 30,
    at: at(new Date()),
    periodKey: periodKey('daily'),
    ...overrides,
  }
}

// A date far in the past — guaranteed to be outside the current daily/weekly period.
const PAST = new Date('2020-01-01T12:00:00Z')

describe('computeProgress — count goals', () => {
  it('sums amounts for matching goalId and current periodKey', () => {
    const goal = countGoal()
    const entries = [
      countEntry({ amount: 3 }),
      countEntry({ id: 'e2', amount: 7 }),
    ]
    expect(computeProgress(goal, entries)).toBe(10)
  })

  it('excludes entries with a different goalId', () => {
    const goal = countGoal({ id: 'goal-A' })
    const entries = [
      countEntry({ goalId: 'goal-B', amount: 5 }),
    ]
    expect(computeProgress(goal, entries)).toBe(0)
  })

  it('excludes entries with a stale periodKey', () => {
    const goal = countGoal()
    const staleKey = '2020-01-01'
    const entries = [
      countEntry({ periodKey: staleKey, amount: 10 }),
    ]
    expect(computeProgress(goal, entries)).toBe(0)
  })

  it('returns 0 for empty entries', () => {
    expect(computeProgress(countGoal(), [])).toBe(0)
  })

  it('handles weekly count goals', () => {
    const goal = countGoal({ period: 'weekly' })
    const entries = [
      countEntry({ periodKey: periodKey('weekly'), amount: 4 }),
      countEntry({ id: 'e2', periodKey: periodKey('weekly'), amount: 6 }),
    ]
    expect(computeProgress(goal, entries)).toBe(10)
  })
})

describe('computeProgress — time goals (unit: "minutes")', () => {
  it('sums minute entries for the same course within the current period', () => {
    const goal = timeGoal()
    const entries = [
      timeEntry({ amount: 20 }),
      timeEntry({ id: 'e2', amount: 25 }),
    ]
    expect(computeProgress(goal, entries)).toBe(45)
  })

  it('pools across different goalIds — any minute entry for the course counts', () => {
    const goal = timeGoal({ id: 'goal-time-2' })
    const entries = [
      timeEntry({ goalId: 'goal-time-other', amount: 30 }),
    ]
    // Time goals pool by courseId, not goalId
    expect(computeProgress(goal, entries)).toBe(30)
  })

  it('excludes entries from a different course', () => {
    const goal = timeGoal({ courseId: 'course-A' })
    const entries = [
      timeEntry({ courseId: 'course-B', amount: 30 }),
    ]
    expect(computeProgress(goal, entries)).toBe(0)
  })

  it('excludes entries with metric other than "minutes"', () => {
    const goal = timeGoal()
    const entries = [
      countEntry({ metric: 'questions', amount: 30 }),
    ]
    expect(computeProgress(goal, entries)).toBe(0)
  })

  it('excludes entries whose at timestamp is outside the current period', () => {
    const goal = timeGoal()
    const entries = [
      timeEntry({ at: at(PAST), amount: 60 }),
    ]
    expect(computeProgress(goal, entries)).toBe(0)
  })

  it('includes an entry with at: null (defaults to now, within current period)', () => {
    const goal = timeGoal()
    const entries = [
      timeEntry({ at: null, amount: 15 }),
    ]
    expect(computeProgress(goal, entries)).toBe(15)
  })

  it('returns 0 for empty entries', () => {
    expect(computeProgress(timeGoal(), [])).toBe(0)
  })

  it('works for weekly time goals', () => {
    const goal = timeGoal({ period: 'weekly' })
    const entries = [
      timeEntry({ at: at(new Date()), amount: 45 }),
    ]
    expect(computeProgress(goal, entries)).toBe(45)
  })
})
