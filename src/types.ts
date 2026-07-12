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
