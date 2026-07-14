import type { Timestamp } from 'firebase/firestore'

export type PeriodKind = 'weekly' | 'daily'

export interface Course {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Timestamp | null
}

export type GoalUnit = 'count' | 'minutes'

export interface Goal {
  id: string
  courseId: string
  metric: string
  target: number
  period: PeriodKind
  active: boolean
  createdAt: Timestamp | null
  // Absent on legacy goals — treated as 'count'. When 'minutes', target and
  // entry amounts are stored as whole minutes; UI shows hours/minutes.
  unit?: GoalUnit
}

export interface Entry {
  id: string
  courseId: string
  goalId: string
  metric: string
  amount: number
  at: Timestamp | null
  periodKey: string
}

export type TaskType = 'regular' | 'practiceTest'
export type QuestionStatus = 'unanswered' | 'succeeded' | 'failed' | 'retry'

export interface Task {
  id: string
  courseId: string
  title: string
  done: boolean
  createdAt: Timestamp | null
  completedAt: Timestamp | null
  type?: TaskType
  questionCount?: number
  questions?: QuestionStatus[]
  questionNotes?: string[]
}

export interface QuestionStatusMeta {
  label: string
  symbol: string
  bg: string
  border: string
  text: string
}

export const QUESTION_STATUS_META: Record<QuestionStatus, QuestionStatusMeta> = {
  succeeded: {
    label: 'Succeeded',
    symbol: '✓',
    bg: '#A7F3D0',
    border: '#34D399',
    text: '#065F46'
  },
  failed: {
    label: 'Failed',
    symbol: '✗',
    bg: '#FDA4AF',
    border: '#F43F5E',
    text: '#881337'
  },
  retry: {
    label: 'Try again',
    symbol: '↻',
    bg: '#FDBA74',
    border: '#F97316',
    text: '#7C2D12'
  },
  unanswered: {
    label: 'Not done yet',
    symbol: '○',
    bg: '#FCE7F3',
    border: '#F9A8D4',
    text: '#9D174D'
  }
}

export const QUESTION_STATUS_ORDER: QuestionStatus[] = [
  'succeeded',
  'failed',
  'retry',
  'unanswered'
]

export type TimedOutcome = 'running' | 'completed' | 'canceled'

export interface Session {
  id: string
  courseId: string
  goalId: string | null
  plannedMinutes: number
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  outcome: TimedOutcome
  loggedMinutes: number | null
  entryId: string | null
  // Set when the end-of-session chime has fired for this session, so
  // reload / SessionBanner remount doesn't re-fire on an over-elapsed
  // running session.
  alarmedAt?: Timestamp | null
}

export interface Break {
  id: string
  plannedMinutes: number
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  outcome: TimedOutcome
  // Set when the end-of-break chime has fired for this break, so remounting
  // the BreakFab (e.g. after navigating to a course and back) doesn't re-fire.
  alarmedAt?: Timestamp | null
}

export interface PlannedBlock {
  id: string
  courseId: string
  title: string
  startAt: Timestamp
  endAt: Timestamp
  notes?: string
  calendarEventId?: string
  createdAt: Timestamp | null
}

export interface HistoryRecord {
  id: string
  courseId: string
  goalId: string
  metric: string
  target: number
  achieved: number
  periodStart: Timestamp
  periodEnd: Timestamp
  period: PeriodKind
  periodKey: string
}

export const COURSE_COLORS = [
  '#F9A8D4',
  '#F472B6',
  '#F0ABFC',
  '#C4B5FD',
  '#FCA5A5',
  '#FDBA74',
  '#FCD34D',
  '#86EFAC',
  '#67E8F9',
  '#A5B4FC'
] as const

export const COURSE_EMOJIS = [
  '🌸', '📚', '💗', '🧠', '🔬', '🧪', '🩺', '🧮', '🖋️', '🌷',
  '🍒', '🎀', '🦄', '🐰', '✨', '💫'
] as const
