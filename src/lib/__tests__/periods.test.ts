/**
 * Tests for src/lib/periods.ts
 *
 * Covered: startOfDay, startOfWeek, endOfDay, endOfWeek, periodStart,
 *          periodEnd, periodKey, formatPeriodRange
 *
 * Why: periodKey drives entry grouping and archival. A wrong week boundary
 *      or off-by-one in the week index would silently bucket entries into the
 *      wrong period, causing progress to show 0 even when goals are met.
 *
 * Run:   npm test
 * Watch: npm run test:watch
 */

import { describe, it, expect } from 'vitest'
import {
  startOfDay,
  startOfWeek,
  endOfDay,
  endOfWeek,
  periodStart,
  periodEnd,
  periodKey,
  formatPeriodRange,
} from '../periods'

// Pinned dates used throughout — chosen to cover mid-week, start-of-week,
// end-of-week, and a year-start edge case.
const FRIDAY_2024_03_15 = new Date(2024, 2, 15, 14, 30, 45, 123) // Fri 15 Mar 2024
const SUNDAY_2024_03_10 = new Date(2024, 2, 10, 9, 0, 0)         // Sun 10 Mar 2024
const SATURDAY_2024_03_16 = new Date(2024, 2, 16, 23, 0, 0)      // Sat 16 Mar 2024
const MONDAY_2024_01_01 = new Date(2024, 0, 1, 8, 0, 0)          // Mon 1 Jan 2024

describe('startOfDay', () => {
  it('zeroes hours, minutes, seconds, and milliseconds', () => {
    const result = startOfDay(FRIDAY_2024_03_15)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('preserves the calendar date', () => {
    const result = startOfDay(FRIDAY_2024_03_15)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(2) // 0-indexed March
    expect(result.getDate()).toBe(15)
  })

  it('does not mutate the input', () => {
    const d = new Date(FRIDAY_2024_03_15)
    startOfDay(d)
    expect(d.getHours()).toBe(14)
  })
})

describe('startOfWeek', () => {
  it('returns Sunday for a Friday input', () => {
    const result = startOfWeek(FRIDAY_2024_03_15)
    expect(result.getDay()).toBe(0) // 0 = Sunday
    expect(result.getDate()).toBe(10) // Sunday 10 Mar
  })

  it('returns the same Sunday for a Sunday input', () => {
    const result = startOfWeek(SUNDAY_2024_03_10)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(10)
  })

  it('returns Sunday for a Saturday input', () => {
    const result = startOfWeek(SATURDAY_2024_03_16)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(10)
  })

  it('is midnight on that Sunday', () => {
    const result = startOfWeek(FRIDAY_2024_03_15)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })
})

describe('endOfDay', () => {
  it('sets time to 23:59:59.999', () => {
    const result = endOfDay(FRIDAY_2024_03_15)
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('preserves the calendar date', () => {
    const result = endOfDay(FRIDAY_2024_03_15)
    expect(result.getDate()).toBe(15)
    expect(result.getMonth()).toBe(2)
    expect(result.getFullYear()).toBe(2024)
  })
})

describe('endOfWeek', () => {
  it('returns the Saturday of the same week', () => {
    const result = endOfWeek(FRIDAY_2024_03_15)
    expect(result.getDay()).toBe(6) // 6 = Saturday
    expect(result.getDate()).toBe(16) // Sat 16 Mar
  })

  it('ends at 23:59:59.999', () => {
    const result = endOfWeek(FRIDAY_2024_03_15)
    expect(result.getHours()).toBe(23)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('start and end of same week span 7 days', () => {
    const start = startOfWeek(FRIDAY_2024_03_15)
    const end = endOfWeek(FRIDAY_2024_03_15)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(7, 0)
  })
})

describe('periodStart', () => {
  it("'daily' returns start of the reference day", () => {
    const result = periodStart('daily', FRIDAY_2024_03_15)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(0)
  })

  it("'weekly' returns start of the reference week (Sunday)", () => {
    const result = periodStart('weekly', FRIDAY_2024_03_15)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(10)
  })
})

describe('periodEnd', () => {
  it("'daily' returns end of the reference day", () => {
    const result = periodEnd('daily', FRIDAY_2024_03_15)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(23)
    expect(result.getSeconds()).toBe(59)
  })

  it("'weekly' returns end of the reference week (Saturday 23:59:59.999)", () => {
    const result = periodEnd('weekly', FRIDAY_2024_03_15)
    expect(result.getDay()).toBe(6)
    expect(result.getDate()).toBe(16)
    expect(result.getHours()).toBe(23)
  })
})

describe('periodKey', () => {
  describe('daily', () => {
    it('formats as YYYY-MM-DD', () => {
      expect(periodKey('daily', FRIDAY_2024_03_15)).toBe('2024-03-15')
    })

    it('zero-pads single-digit month and day', () => {
      const jan5 = new Date(2024, 0, 5)
      expect(periodKey('daily', jan5)).toBe('2024-01-05')
    })
  })

  describe('weekly', () => {
    it('Sun 10 Mar 2024 → 2024-W11', () => {
      expect(periodKey('weekly', SUNDAY_2024_03_10)).toBe('2024-W11')
    })

    it('Fri 15 Mar 2024 (same week) → 2024-W11', () => {
      expect(periodKey('weekly', FRIDAY_2024_03_15)).toBe('2024-W11')
    })

    it('Mon 1 Jan 2024 → 2023-W53 (its Sunday is Dec 31 2023, so year = 2023)', () => {
      // startOfWeek(Jan 1 2024) = Dec 31 2023 → year 2023
      // firstSunday = startOfWeek(Jan 1 2023) = Jan 1 2023 (2023 started on a Sunday)
      // weekIndex = floor(364 days / 7) + 1 = 53
      expect(periodKey('weekly', MONDAY_2024_01_01)).toBe('2023-W53')
    })

    it('formats the week index with zero-padding', () => {
      const key = periodKey('weekly', MONDAY_2024_01_01)
      expect(key).toMatch(/^\d{4}-W\d{2}$/)
    })
  })
})

describe('formatPeriodRange', () => {
  it('returns a non-empty string for daily', () => {
    const result = formatPeriodRange('daily', FRIDAY_2024_03_15)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for weekly', () => {
    const result = formatPeriodRange('weekly', FRIDAY_2024_03_15)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('weekly range contains an en-dash separator', () => {
    const result = formatPeriodRange('weekly', FRIDAY_2024_03_15)
    expect(result).toContain('–')
  })
})
