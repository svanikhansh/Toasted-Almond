import { describe, expect, it } from 'vitest'
import { atMinute, dayKey, minutesOfDay, occurrenceOn, occursOn } from './dates'
import { dueOn } from './items'
import type { Item } from './types'

// Run the DST assertions in a zone that changes clocks in 2026.
;(globalThis as { process?: { env: Record<string, string> } }).process!.env.TZ = 'America/New_York'

const base = {
  id: 'x',
  splitId: 's',
  title: 'Club',
  notes: '',
  priority: 0 as const,
  subtasks: [],
  completed: false,
  completedOccurrences: [],
  createdAt: 0,
  updatedAt: 0,
}

function series(startKey: string, minute: number, recurrence: NonNullable<Item['recurrence']>): Item {
  return {
    ...base,
    kind: 'club',
    meetingTodos: {},
    startsAt: atMinute(startKey, minute),
    endsAt: atMinute(startKey, minute + 60),
    recurrence,
  } as Item
}

describe('time zone', () => {
  it('observes US daylight saving time, so the DST tests below are meaningful', () => {
    expect(new Date(2026, 2, 7, 12).getTimezoneOffset()).toBe(300)
    expect(new Date(2026, 2, 9, 12).getTimezoneOffset()).toBe(240)
  })
})

describe('A/B rotation across a year boundary', () => {
  const tuesdayA = series('2026-12-01', 9 * 60, { freq: 'weekly', interval: 1, byWeekday: [2], rotation: 'A' })
  const tuesdayB = { ...tuesdayA, recurrence: { ...tuesdayA.recurrence!, rotation: 'B' as const } }
  // Monday 2026-12-28 starts an A week for the split.
  const anchor = '2026-12-28'

  it('keeps A-week items on A weeks through New Year', () => {
    expect(occursOn(tuesdayA, '2026-12-29', anchor)).toBe(true) // A week
    expect(occursOn(tuesdayA, '2027-01-05', anchor)).toBe(false) // B week
    expect(occursOn(tuesdayA, '2027-01-12', anchor)).toBe(true) // A week
  })

  it('keeps B-week items on the opposite weeks', () => {
    expect(occursOn(tuesdayB, '2026-12-29', anchor)).toBe(false)
    expect(occursOn(tuesdayB, '2027-01-05', anchor)).toBe(true)
  })

  it('swaps weeks when the split anchor moves by one week', () => {
    const moved = '2026-12-21'
    expect(occursOn(tuesdayA, '2026-12-29', moved)).toBe(false)
    expect(occursOn(tuesdayA, '2027-01-05', moved)).toBe(true)
  })
})

describe('daylight saving time', () => {
  const daily = series('2026-03-06', 15 * 60, { freq: 'daily', interval: 1 })

  it('keeps a 3:00 PM occurrence at 3:00 PM across spring forward', () => {
    for (const key of ['2026-03-07', '2026-03-08', '2026-03-09']) {
      const o = occurrenceOn(daily, key)!
      expect(dayKey(o.startsAt!)).toBe(key)
      expect(minutesOfDay(o.startsAt!)).toBe(15 * 60)
      expect(minutesOfDay(o.endsAt!)).toBe(16 * 60)
    }
  })

  it('keeps a 3:00 PM occurrence at 3:00 PM across fall back', () => {
    for (const key of ['2026-10-31', '2026-11-01', '2026-11-02']) {
      const o = occurrenceOn(daily, key)!
      expect(dayKey(o.startsAt!)).toBe(key)
      expect(minutesOfDay(o.startsAt!)).toBe(15 * 60)
    }
  })
})

describe('occurrence exceptions', () => {
  const monday = series('2026-10-12', 18 * 60, { freq: 'weekly', interval: 1, byWeekday: [1] })

  it('skipping one occurrence removes only that day', () => {
    const item = { ...monday, skippedOccurrences: ['2026-10-19'] }
    expect(occurrenceOn(item, '2026-10-19')).toBeNull()
    expect(occurrenceOn(item, '2026-10-12')).not.toBeNull()
    expect(occurrenceOn(item, '2026-10-26')).not.toBeNull()
  })

  it('a title override applies to its day and nothing else', () => {
    const item = { ...monday, occurrenceTitles: { '2026-10-19': 'Guest speaker' } }
    expect(occurrenceOn(item, '2026-10-19')!.title).toBe('Guest speaker')
    expect(occurrenceOn(item, '2026-10-26')!.title).toBe('Club')
    expect(occurrenceOn(item, '2026-10-19')!.item.title).toBe('Club')
  })
})

describe('end after N occurrences', () => {
  const counted = series('2026-10-12', 18 * 60, { freq: 'weekly', interval: 1, byWeekday: [1], count: 3 })

  it('ends after the Nth scheduled occurrence', () => {
    expect(occursOn(counted, '2026-10-12')).toBe(true)
    expect(occursOn(counted, '2026-10-19')).toBe(true)
    expect(occursOn(counted, '2026-10-26')).toBe(true)
    expect(occursOn(counted, '2026-11-02')).toBe(false)
  })

  it('still counts a skipped occurrence toward N', () => {
    const item = { ...counted, skippedOccurrences: ['2026-10-19'] }
    expect(occursOn(item, '2026-10-19')).toBe(false)
    expect(occursOn(item, '2026-10-26')).toBe(true)
    expect(occursOn(item, '2026-11-02')).toBe(false)
  })

  it('counts only rotation weeks that the series lands on', () => {
    const rotating = series('2026-10-12', 18 * 60, {
      freq: 'weekly',
      interval: 1,
      byWeekday: [1],
      rotation: 'A',
      count: 2,
    })
    // Anchor 2026-10-12 is an A week, so 10-12 and 10-26 are the two occurrences.
    expect(occursOn(rotating, '2026-10-26', '2026-10-12')).toBe(true)
    expect(occursOn(rotating, '2026-11-09', '2026-10-12')).toBe(false)
  })
})

describe('deadline lists expand recurring items', () => {
  const deadline = { ...series('2026-10-09', 23 * 60 + 59, { freq: 'weekly', interval: 1, byWeekday: [5], rotation: 'A' }), kind: 'homework', className: '', estimateMin: 0, startsAt: undefined, endsAt: undefined, dueAt: atMinute('2026-10-09', 23 * 60 + 59) } as Item

  // Split anchor 2026-10-12 is an A week, so 10-16 and 10-30 are A-week Fridays.
  const anchor = () => '2026-10-12'

  it('shows an A-week deadline on its A weeks only, with per-occurrence done state', () => {
    expect(dueOn([deadline], '2026-10-09', anchor)).toEqual([])
    const a = dueOn([deadline], '2026-10-16', anchor)
    expect(a.map((o) => o.key)).toEqual(['2026-10-16'])
    expect(a[0].done).toBe(false)
    const doneOnce = { ...deadline, completedOccurrences: ['2026-10-16'] }
    expect(dueOn([doneOnce], '2026-10-16', anchor)[0].done).toBe(true)
    expect(dueOn([doneOnce], '2026-10-30', anchor)[0].done).toBe(false)
  })

  it('hides a skipped occurrence and honors a title override', () => {
    const edited = { ...deadline, occurrenceTitles: { '2026-10-16': 'Moved' }, skippedOccurrences: ['2026-10-30'] }
    expect(dueOn([edited], '2026-10-16', anchor)[0].title).toBe('Moved')
    expect(dueOn([edited], '2026-10-30', anchor)).toEqual([])
  })

  it('still lists a plain deadline on its own day only', () => {
    const plain = { ...deadline, recurrence: undefined }
    expect(dueOn([plain], '2026-10-09')).toHaveLength(1)
    expect(dueOn([plain], '2026-10-16')).toEqual([])
  })
})
