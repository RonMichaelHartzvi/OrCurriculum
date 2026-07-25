/**
 * Tests for src/lib/time.ts
 *
 * Covered: formatDuration, formatHours, parseHoursInput, hoursToMinutes,
 *          minutesToHours, sessionElapsedMinutes, sessionRemainingMinutes
 *
 * Why: formatDuration and parseHoursInput are the primary UI-facing
 *      time converters. A rounding or format bug here would cause incorrect
 *      values everywhere time is displayed or entered.
 *
 * Run:   npm test
 * Watch: npm run test:watch
 */

import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatHours,
  parseHoursInput,
  hoursToMinutes,
  minutesToHours,
  sessionElapsedMinutes,
  sessionRemainingMinutes,
} from '../time'
import type { Session } from '../../types'

// Minimal mock for Session.startedAt — only toMillis() is called.
function mockSession(startedAtMs: number | null, plannedMinutes: number): Session {
  return {
    id: 'test',
    courseId: 'c1',
    goalId: null,
    plannedMinutes,
    startedAt: startedAtMs !== null ? ({ toMillis: () => startedAtMs } as any) : null,
    endedAt: null,
    outcome: 'running',
    loggedMinutes: null,
    entryId: null,
  }
}

describe('formatDuration', () => {
  it('formats 0 minutes as "0m"', () => expect(formatDuration(0)).toBe('0m'))
  it('formats 30 minutes as "30m"', () => expect(formatDuration(30)).toBe('30m'))
  it('formats 59 minutes as "59m"', () => expect(formatDuration(59)).toBe('59m'))
  it('formats exactly 1 hour as "1h"', () => expect(formatDuration(60)).toBe('1h'))
  it('formats 90 minutes as "1h 30m"', () => expect(formatDuration(90)).toBe('1h 30m'))
  it('formats 119 minutes as "1h 59m"', () => expect(formatDuration(119)).toBe('1h 59m'))
  it('formats 120 minutes as "2h"', () => expect(formatDuration(120)).toBe('2h'))
  it('formats 121 minutes as "2h 1m"', () => expect(formatDuration(121)).toBe('2h 1m'))

  it('rounds fractional minutes', () => {
    expect(formatDuration(29.6)).toBe('30m')
    expect(formatDuration(59.4)).toBe('59m')
  })

  it('clamps negative input to "0m"', () => {
    expect(formatDuration(-5)).toBe('0m')
  })
})

describe('formatHours', () => {
  it('formats 60 minutes as "1.0h" with default 1 decimal', () => {
    expect(formatHours(60)).toBe('1.0h')
  })

  it('formats 90 minutes as "1.5h"', () => {
    expect(formatHours(90)).toBe('1.5h')
  })

  it('respects the digits parameter', () => {
    expect(formatHours(90, 2)).toBe('1.50h')
  })
})

describe('parseHoursInput', () => {
  it('"1.5" → 90 minutes', () => expect(parseHoursInput('1.5')).toBe(90))
  it('"0.25" → 15 minutes', () => expect(parseHoursInput('0.25')).toBe(15))
  it('"1" → 60 minutes (treated as hours)', () => expect(parseHoursInput('1')).toBe(60))
  it('"0" → 0 minutes', () => expect(parseHoursInput('0')).toBe(0))

  it('"90m" → 90 minutes', () => expect(parseHoursInput('90m')).toBe(90))
  it('"30m" → 30 minutes', () => expect(parseHoursInput('30m')).toBe(30))

  it('"1h" → 60 minutes', () => expect(parseHoursInput('1h')).toBe(60))
  it('"2h" → 120 minutes', () => expect(parseHoursInput('2h')).toBe(120))

  it('"1h 30m" → 90 minutes', () => expect(parseHoursInput('1h 30m')).toBe(90))
  it('"1h30m" → 90 minutes (no space)', () => expect(parseHoursInput('1h30m')).toBe(90))
  it('"2h 0m" → 120 minutes', () => expect(parseHoursInput('2h 0m')).toBe(120))

  it('empty string → NaN', () => expect(parseHoursInput('')).toBeNaN())
  it('"xyz" → NaN', () => expect(parseHoursInput('xyz')).toBeNaN())
  it('"abc123" → NaN', () => expect(parseHoursInput('abc123')).toBeNaN())
  it('whitespace only → NaN', () => expect(parseHoursInput('   ')).toBeNaN())
})

describe('hoursToMinutes', () => {
  it('1.5 hours → 90 minutes', () => expect(hoursToMinutes(1.5)).toBe(90))
  it('0 hours → 0 minutes', () => expect(hoursToMinutes(0)).toBe(0))
  it('rounds fractional results', () => expect(hoursToMinutes(1 / 3)).toBe(20))
})

describe('minutesToHours', () => {
  it('90 minutes → 1.5 hours', () => expect(minutesToHours(90)).toBe(1.5))
  it('60 minutes → 1 hour', () => expect(minutesToHours(60)).toBe(1))
  it('0 minutes → 0 hours', () => expect(minutesToHours(0)).toBe(0))
})

describe('sessionElapsedMinutes', () => {
  it('returns elapsed minutes based on startedAt', () => {
    const startMs = Date.now() - 30 * 60 * 1000 // 30 minutes ago
    const session = mockSession(startMs, 60)
    const elapsed = sessionElapsedMinutes(session, Date.now())
    expect(elapsed).toBeCloseTo(30, 0)
  })

  it('returns 0 when startedAt is null', () => {
    const session = mockSession(null, 60)
    expect(sessionElapsedMinutes(session)).toBe(0)
  })

  it('clamps to 0 if now is before startedAt (clock skew)', () => {
    const futureMs = Date.now() + 60 * 1000
    const session = mockSession(futureMs, 60)
    expect(sessionElapsedMinutes(session, Date.now())).toBe(0)
  })
})

describe('sessionRemainingMinutes', () => {
  it('returns planned minus elapsed', () => {
    const startMs = Date.now() - 10 * 60 * 1000 // 10 min ago
    const session = mockSession(startMs, 60)
    const remaining = sessionRemainingMinutes(session, Date.now())
    expect(remaining).toBeCloseTo(50, 0)
  })

  it('clamps to 0 when elapsed exceeds planned', () => {
    const startMs = Date.now() - 90 * 60 * 1000 // 90 min ago, 60 min session
    const session = mockSession(startMs, 60)
    expect(sessionRemainingMinutes(session, Date.now())).toBe(0)
  })
})
