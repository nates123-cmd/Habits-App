import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { todayRange, thisWeekDays, formatDate } from '../src/lib/dateUtils.js'

// These are the REAL exported pure helpers from src/lib/dateUtils.js.
// They are the foundation of every "today" / "this week" bucketing in the app.

describe('todayRange()', () => {
  afterEach(() => vi.useRealTimers())

  it('returns a 24h window whose start is local midnight of "today"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T13:45:00')) // local wall-clock
    const { start, end } = todayRange()
    const s = new Date(start)
    const e = new Date(end)
    // start is local midnight
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(s.getSeconds()).toBe(0)
    expect(s.getMilliseconds()).toBe(0)
    expect(s.getDate()).toBe(15)
    // window is exactly one day wide (86400000 ms as built by source)
    expect(e.getTime() - s.getTime()).toBe(86400000)
  })

  it('returns ISO strings (round-trippable)', () => {
    const { start, end } = todayRange()
    expect(typeof start).toBe('string')
    expect(() => new Date(start).toISOString()).not.toThrow()
    expect(new Date(end) > new Date(start)).toBe(true)
  })

  it('a log made just before local midnight falls inside today, just after falls outside', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T09:00:00'))
    const { start, end } = todayRange()
    const justBeforeMidnightTonight = new Date(2026, 5, 1, 23, 59, 59).toISOString()
    const justAfterMidnight = new Date(2026, 5, 2, 0, 0, 1).toISOString()
    // emulate the app's own predicate: logged_at >= start && < end
    expect(justBeforeMidnightTonight >= start && justBeforeMidnightTonight < end).toBe(true)
    expect(justAfterMidnight >= start && justAfterMidnight < end).toBe(false)
  })
})

describe('thisWeekDays()', () => {
  afterEach(() => vi.useRealTimers())

  it('always returns 7 days', () => {
    expect(thisWeekDays()).toHaveLength(7)
  })

  it('starts on Monday and ends on Sunday regardless of today (week starts Mon per source)', () => {
    vi.useFakeTimers()
    // 2026-06-03 is a Wednesday
    vi.setSystemTime(new Date('2026-06-03T10:00:00'))
    const days = thisWeekDays()
    expect(days[0].label).toBe('Mon')
    expect(days[6].label).toBe('Sun')
    // Monday of that week is 2026-06-01
    expect(new Date(days[0].start).getDate()).toBe(1)
    expect(new Date(days[6].start).getDate()).toBe(7)
  })

  it('handles Sunday correctly — source uses (dow+6)%7 so Sunday maps to end of week, not start', () => {
    vi.useFakeTimers()
    // 2026-06-07 is a Sunday
    vi.setSystemTime(new Date('2026-06-07T10:00:00'))
    const days = thisWeekDays()
    // The Monday of Sunday-the-7th's week should be 2026-06-01
    expect(new Date(days[0].start).getDate()).toBe(1)
    expect(days[0].label).toBe('Mon')
    expect(new Date(days[6].start).getDate()).toBe(7) // Sunday itself
  })

  it('each day window is contiguous and non-overlapping (day[i].end === day[i+1].start)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T10:00:00'))
    const days = thisWeekDays()
    for (let i = 0; i < 6; i++) {
      expect(days[i].end).toBe(days[i + 1].start)
    }
  })

  it('every day window is exactly 24h wide', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T10:00:00'))
    for (const d of thisWeekDays()) {
      const w = new Date(d.end).getTime() - new Date(d.start).getTime()
      expect(w).toBe(86400000)
    }
  })

  it('a single log lands in exactly one of the 7 day buckets (the app bucketing invariant)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T10:00:00'))
    const days = thisWeekDays()
    const log = new Date(2026, 5, 4, 14, 30).toISOString() // Thursday afternoon
    const matches = days.filter(d => log >= d.start && log < d.end)
    expect(matches).toHaveLength(1)
    expect(matches[0].label).toBe('Thu')
  })
})

describe('formatDate()', () => {
  it('formats a Date into weekday/month/day', () => {
    const out = formatDate(new Date(2026, 5, 1)) // Monday June 1 2026
    expect(out).toMatch(/Monday/)
    expect(out).toMatch(/June/)
    expect(out).toMatch(/1/)
  })

  it('accepts an ISO string too (source coerces)', () => {
    const out = formatDate('2026-06-01T12:00:00')
    expect(out).toMatch(/June/)
  })
})
