import { describe, expect, it } from 'vitest'
import {
  addDays,
  atMinute,
  computeGaps,
  dayKey,
  occurrenceOn,
  occursOn,
  sameRotationWeek,
  weekDays,
} from './dates'
import type { Item } from './types'

const base = {
  id: 'x',
  splitId: 's',
  title: 't',
  notes: '',
  priority: 0 as const,
  subtasks: [],
  completed: false,
  completedOccurrences: [],
  createdAt: 0,
  updatedAt: 0,
}

describe('day keys', () => {
  it('formats local day keys and adds days across month boundaries', () => {
    expect(dayKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('returns a Monday-based week containing the given day', () => {
    // 2026-10-17 is a Saturday, so the week runs Mon 12 to Sun 18.
    expect(weekDays('2026-10-17')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      '2026-10-16', '2026-10-17', '2026-10-18',
    ])
    expect(weekDays('2026-10-12')[0]).toBe('2026-10-12')
  })
})

describe('A/B rotation', () => {
  // Anchor week is Mon 2026-10-12 (A). Mon 10-19 is B, Mon 10-26 is A.
  const rotating = (rotation?: 'A' | 'B'): Item => ({
    ...base,
    kind: 'homework',
    className: '',
    estimateMin: 0,
    dueAt: atMinute('2026-10-12', 23 * 60),
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], rotation },
  })

  it('marks alternating weeks A and B from the anchor week', () => {
    expect(sameRotationWeek('2026-10-12', '2026-10-18')).toBe(true)
    expect(sameRotationWeek('2026-10-12', '2026-10-19')).toBe(false)
    expect(sameRotationWeek('2026-10-12', '2026-10-26')).toBe(true)
    expect(sameRotationWeek('2026-10-12', '2026-10-05')).toBe(false)
  })

  it('occurs only in A weeks for an A item', () => {
    const a = rotating('A')
    expect(occursOn(a, '2026-10-12', '2026-10-12')).toBe(true)
    expect(occursOn(a, '2026-10-19', '2026-10-12')).toBe(false)
    expect(occursOn(a, '2026-10-26', '2026-10-12')).toBe(true)
  })

  it('occurs only in B weeks for a B item', () => {
    const b = rotating('B')
    expect(occursOn(b, '2026-10-12', '2026-10-12')).toBe(false)
    expect(occurrenceOn(b, '2026-10-19', '2026-10-12')).not.toBeNull()
  })

  it('follows each split anchor separately', () => {
    // Same item, anchor moved one week later: the A week is now Oct 19.
    const a = rotating('A')
    expect(occursOn(a, '2026-10-19', '2026-10-19')).toBe(true)
    expect(occursOn(a, '2026-10-12', '2026-10-19')).toBe(false)
  })

  it('uses the item date as the A week when no split anchor is given', () => {
    expect(occursOn(rotating('A'), '2026-10-12')).toBe(true)
    expect(occursOn(rotating('A'), '2026-10-19')).toBe(false)
  })

  it('occurs every week when no rotation is set', () => {
    expect(occursOn(rotating(), '2026-10-12', '2026-10-12')).toBe(true)
    expect(occursOn(rotating(), '2026-10-19', '2026-10-12')).toBe(true)
  })
})

describe('recurrence', () => {
  const weekly: Item = {
    ...base,
    kind: 'club',
    meetingTodos: {},
    startsAt: atMinute('2026-10-12', 18 * 60), // Monday
    endsAt: atMinute('2026-10-12', 19 * 60),
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3] }, // Mon, Wed
  }

  it('expands weekly meetings on the chosen weekdays only', () => {
    expect(occursOn(weekly, '2026-10-12')).toBe(true)
    expect(occursOn(weekly, '2026-10-14')).toBe(true)
    expect(occursOn(weekly, '2026-10-13')).toBe(false)
    expect(occursOn(weekly, '2026-10-05')).toBe(false) // before the anchor
  })

  it('keeps the time of day on expanded occurrences', () => {
    const occ = occurrenceOn(weekly, '2026-10-14')
    expect(occ?.startsAt).toBe(atMinute('2026-10-14', 18 * 60))
    expect(occ?.endsAt).toBe(atMinute('2026-10-14', 19 * 60))
  })

  it('tracks completion per occurrence', () => {
    const item: Item = { ...weekly, completedOccurrences: ['2026-10-12'] }
    expect(occurrenceOn(item, '2026-10-12')?.done).toBe(true)
    expect(occurrenceOn(item, '2026-10-14')?.done).toBe(false)
  })

  it('honors until and interval', () => {
    const biweekly: Item = {
      ...weekly,
      recurrence: { freq: 'weekly', interval: 2, byWeekday: [1], until: '2026-10-30' },
    }
    expect(occursOn(biweekly, '2026-10-12')).toBe(true)
    expect(occursOn(biweekly, '2026-10-19')).toBe(false)
    expect(occursOn(biweekly, '2026-10-26')).toBe(true)
    expect(occursOn(biweekly, '2026-11-09')).toBe(false) // past until
  })
})

describe('computeGaps', () => {
  const day0 = atMinute('2026-10-17', 8 * 60)
  const day1 = atMinute('2026-10-17', 22 * 60)
  const at = (h: number, m = 0) => atMinute('2026-10-17', h * 60 + m)

  it('returns the whole window when nothing is busy', () => {
    expect(computeGaps([], day0, day1)).toEqual([{ start: day0, end: day1 }])
  })

  it('returns free time between busy intervals and drops gaps under 15 minutes', () => {
    const gaps = computeGaps(
      [
        { start: at(9), end: at(10) },
        { start: at(10, 10), end: at(12) }, // 10 min gap, dropped
        { start: at(13), end: at(14) },
      ],
      day0,
      day1,
    )
    expect(gaps).toEqual([
      { start: day0, end: at(9) },
      { start: at(12), end: at(13) },
      { start: at(14), end: day1 },
    ])
  })

  it('merges overlapping busy intervals and clips to the window', () => {
    const gaps = computeGaps(
      [
        { start: at(7), end: at(9) },
        { start: at(8, 30), end: at(11) },
        { start: at(21), end: at(23) },
      ],
      day0,
      day1,
    )
    expect(gaps).toEqual([{ start: at(11), end: at(21) }])
  })

  it('handles a fully booked day', () => {
    expect(computeGaps([{ start: day0, end: day1 }], day0, day1)).toEqual([])
  })
})
