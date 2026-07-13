import type { Session } from '../types'

// Storage-unit convention: all time-based amounts are integer minutes.
// Display layer converts to "Xh Ym" via formatDuration.

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h === 0) return `${mm}m`
  if (mm === 0) return `${h}h`
  return `${h}h ${mm}m`
}

export function formatHours(minutes: number, digits = 1): string {
  const hours = minutes / 60
  return `${hours.toFixed(digits)}h`
}

// Accepts "1.5", "90m", "90", "1h 30m", "1h30m", "1h". Returns whole minutes.
// Returns NaN for unparseable input; callers should validate.
export function parseHoursInput(str: string): number {
  const s = str.trim().toLowerCase()
  if (!s) return NaN
  const compound = s.match(/^(\d+)\s*h\s*(\d+)\s*m?$/)
  if (compound) return Number(compound[1]) * 60 + Number(compound[2])
  const hOnly = s.match(/^(\d+(?:\.\d+)?)\s*h$/)
  if (hOnly) return Math.round(Number(hOnly[1]) * 60)
  const mOnly = s.match(/^(\d+)\s*m$/)
  if (mOnly) return Number(mOnly[1])
  const num = Number(s)
  if (Number.isFinite(num) && num >= 0) return Math.round(num * 60)
  return NaN
}

export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}

export function minutesToHours(minutes: number): number {
  return minutes / 60
}

export function sessionElapsedMinutes(session: Session, now: number = Date.now()): number {
  const start = session.startedAt?.toMillis?.() ?? null
  if (start == null) return 0
  return Math.max(0, (now - start) / 60000)
}

export function sessionRemainingMinutes(session: Session, now: number = Date.now()): number {
  return Math.max(0, session.plannedMinutes - sessionElapsedMinutes(session, now))
}
