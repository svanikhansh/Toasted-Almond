import { describe, expect, it } from 'vitest'
import { atMinute } from './dates'
import { parseDay, parseQuickAdd, parseTime } from './quickAdd'
import type { Split } from './types'

const splits: Split[] = [
  { id: 'h', name: 'Homework', color: '#CA895F', order: 0, archived: false },
  { id: 't', name: 'Tests', color: '#A15E49', order: 1, archived: false },
  { id: 'p', name: 'Projects', color: '#E3D26F', order: 2, archived: false },
  { id: 'old', name: 'Tutoring', color: '#4E3822', order: 3, archived: true },
]

// Wednesday 2026-10-14, 10:00 local.
const NOW = new Date(2026, 9, 14, 10, 0).getTime()

describe('parseTime', () => {
  it('reads am/pm, 24-hour, and noon', () => {
    expect(parseTime('3pm')).toBe(15 * 60)
    expect(parseTime('3:30 PM')).toBe(15 * 60 + 30)
    expect(parseTime('12am')).toBe(0)
    expect(parseTime('15:00')).toBe(15 * 60)
    expect(parseTime('noon')).toBe(12 * 60)
  })

  it('does not read bare numbers or invalid times', () => {
    expect(parseTime('3')).toBeUndefined()
    expect(parseTime('25:00')).toBeUndefined()
    expect(parseTime('13pm')).toBeUndefined()
    expect(parseTime('10/24')).toBeUndefined()
  })
})

describe('parseDay', () => {
  const today = '2026-10-14' // Wednesday
  it('reads relative words and weekdays', () => {
    expect(parseDay('today', today)).toBe('2026-10-14')
    expect(parseDay('tomorrow', today)).toBe('2026-10-15')
    expect(parseDay('fri', today)).toBe('2026-10-16')
    expect(parseDay('wed', today)).toBe('2026-10-14')
    expect(parseDay('monday', today)).toBe('2026-10-19')
  })

  it('reads ISO and month/day dates, rolling past dates into next year', () => {
    expect(parseDay('2026-11-02', today)).toBe('2026-11-02')
    expect(parseDay('11/2', today)).toBe('2026-11-02')
    expect(parseDay('10/1', today)).toBe('2027-10-01')
  })
})

describe('parseQuickAdd', () => {
  it('parses "chem test fri 3pm #tests" into a timed test in Tests', () => {
    const r = parseQuickAdd('chem test fri 3pm #tests', splits, NOW)
    expect(r).not.toBeNull()
    expect(r!.title).toBe('chem test')
    expect(r!.splitId).toBe('t')
    expect(r!.kind).toBe('test')
    expect(r!.startsAt).toBe(atMinute('2026-10-16', 15 * 60))
    expect(r!.endsAt).toBe(atMinute('2026-10-16', 16 * 60 + 30))
    expect(r!.dueAt).toBeUndefined()
  })

  it('gives non-test items a deadline with end-of-day default', () => {
    const r = parseQuickAdd('essay draft tomorrow #homework', splits, NOW)
    expect(r!.kind).toBe('homework')
    expect(r!.splitId).toBe('h')
    expect(r!.dueAt).toBe(atMinute('2026-10-15', 23 * 60 + 59))
    expect(r!.startsAt).toBeUndefined()
  })

  it('reads a time without a day as today', () => {
    const r = parseQuickAdd('call coach 5pm #proj', splits, NOW)
    expect(r!.splitId).toBe('p')
    expect(r!.kind).toBe('project')
    expect(r!.dueAt).toBe(atMinute('2026-10-14', 17 * 60))
  })

  it('ignores archived splits and leaves the split unset when none matches', () => {
    const r = parseQuickAdd('tutor prep #tutoring', splits, NOW)
    expect(r!.splitId).toBeUndefined()
    expect(r!.kind).toBe('homework')
    expect(r!.title).toBe('tutor prep #tutoring')
  })

  it('returns null when there is no title', () => {
    expect(parseQuickAdd('fri 3pm #tests', splits, NOW)).toBeNull()
    expect(parseQuickAdd('   ', splits, NOW)).toBeNull()
  })

  it('summarizes what it understood', () => {
    const r = parseQuickAdd('chem test fri 3pm #tests', splits, NOW)
    expect(r!.summary).toBe('Test 2026-10-16 3:00 pm in Tests')
  })
})
