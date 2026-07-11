import type { Timestamp } from 'firebase/firestore'

export type PeriodKind = 'weekly' | 'daily'

export interface Course {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Timestamp | null
}

export interface Goal {
  id: string
  courseId: string
  metric: string
  target: number
  period: PeriodKind
  active: boolean
  createdAt: Timestamp | null
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
