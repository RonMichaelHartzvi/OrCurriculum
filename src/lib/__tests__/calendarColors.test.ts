/**
 * Tests for src/lib/calendarColors.ts
 *
 * Covered: calendarColorFor, COURSE_COLOR_TO_CALENDAR
 *
 * Why: If a course color maps to the wrong calendar color ID, Google Calendar
 *      events will show visually mismatched colors — a subtle but persistent
 *      UX bug that's hard to notice without checking the mapping table.
 *
 * Run:   npm test
 * Watch: npm run test:watch
 */

import { describe, it, expect } from 'vitest'
import { calendarColorFor, COURSE_COLOR_TO_CALENDAR } from '../calendarColors'
import { COURSE_COLORS } from '../../types'

describe('COURSE_COLOR_TO_CALENDAR', () => {
  it('covers all COURSE_COLORS entries', () => {
    for (const color of COURSE_COLORS) {
      expect(
        COURSE_COLOR_TO_CALENDAR[color],
        `Missing mapping for COURSE_COLORS entry ${color}`
      ).toBeDefined()
    }
  })

  it('maps only to valid Google Calendar color IDs (1–11)', () => {
    const validIds = new Set(['1','2','3','4','5','6','7','8','9','10','11'])
    for (const [hex, id] of Object.entries(COURSE_COLOR_TO_CALENDAR)) {
      expect(validIds.has(id), `Color ${hex} maps to invalid calendar ID "${id}"`).toBe(true)
    }
  })
})

describe('calendarColorFor', () => {
  it('#F9A8D4 (light pink) → "4" (Flamingo)', () => {
    expect(calendarColorFor('#F9A8D4')).toBe('4')
  })

  it('#86EFAC (green) → "2" (Sage)', () => {
    expect(calendarColorFor('#86EFAC')).toBe('2')
  })

  it('#C4B5FD (lavender) → "1" (Lavender)', () => {
    expect(calendarColorFor('#C4B5FD')).toBe('1')
  })

  it('#FCD34D (yellow) → "5" (Banana)', () => {
    expect(calendarColorFor('#FCD34D')).toBe('5')
  })

  it('#67E8F9 (cyan) → "7" (Peacock)', () => {
    expect(calendarColorFor('#67E8F9')).toBe('7')
  })

  it('returns undefined for an unknown hex color', () => {
    expect(calendarColorFor('#FFFFFF')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(calendarColorFor('')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(calendarColorFor(undefined)).toBeUndefined()
  })
})
