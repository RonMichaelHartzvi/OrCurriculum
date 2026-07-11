import type { PeriodKind } from '../types'

// Week starts on Sunday (matches most locales; can be adjusted per-user later).
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function endOfWeek(d: Date): Date {
  const x = startOfWeek(d)
  x.setDate(x.getDate() + 6)
  return endOfDay(x)
}

export function periodStart(kind: PeriodKind, ref: Date = new Date()): Date {
  return kind === 'daily' ? startOfDay(ref) : startOfWeek(ref)
}

export function periodEnd(kind: PeriodKind, ref: Date = new Date()): Date {
  return kind === 'daily' ? endOfDay(ref) : endOfWeek(ref)
}

// ISO-ish period key. Daily: YYYY-MM-DD. Weekly: YYYY-Www (week starting Sunday).
export function periodKey(kind: PeriodKind, ref: Date = new Date()): string {
  if (kind === 'daily') {
    const s = startOfDay(ref)
    return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`
  }
  const s = startOfWeek(ref)
  const year = s.getFullYear()
  const firstSunday = startOfWeek(new Date(year, 0, 1))
  const weekIndex = Math.floor((s.getTime() - firstSunday.getTime()) / (7 * 24 * 3600 * 1000)) + 1
  return `${year}-W${pad(weekIndex)}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatPeriodRange(kind: PeriodKind, ref: Date = new Date()): string {
  const s = periodStart(kind, ref)
  const e = periodEnd(kind, ref)
  const fmt: Intl.DateTimeFormatOptions =
    kind === 'daily'
      ? { weekday: 'long', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' }
  if (kind === 'daily') return s.toLocaleDateString(undefined, fmt)
  return `${s.toLocaleDateString(undefined, fmt)} – ${e.toLocaleDateString(undefined, fmt)}`
}
