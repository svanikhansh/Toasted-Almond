import { describe, expect, it } from 'vitest'
import { atMinute, dayKey, weekDays } from './dates'
import { itemFromQuickAdd } from './items'
import {
  HEAVY_DAY_MINUTES,
  TEST_PREP,
  TOURNAMENT_PREP,
  backwardPlan,
  dailyLoad,
  prepTemplatesFor,
  studyPlan,
  weekTotalsBySplit,
} from './planning'
import type { Split, WorkBlock } from './types'

const splits: Split[] = [
  { id: 'hw', name: 'Homework', color: '#CA895F', order: 0, archived: false },
  { id: 'tests', name: 'Tests', color: '#A15E49', order: 1, archived: false },
]
const NOW = atMinute('2026-10-12', 8 * 60)

describe('backwardPlan', () => {
  it('spaces prep tasks backward from the anchor at 5 pm', () => {
    const plan = backwardPlan('2026-10-20', TEST_PREP)
    expect(plan.map((p) => dayKey(p.dueAt))).toEqual(['2026-10-13', '2026-10-17', '2026-10-19'])
    expect(new Date(plan[0].dueAt).getHours()).toBe(17)
    expect(plan[0].templateId).toBe('review')
  })

  it('returns nothing for an empty template list', () => {
    expect(backwardPlan('2026-10-20', [])).toEqual([])
  })
})

describe('prepTemplatesFor', () => {
  it('uses the built-in defaults when a split has no override', () => {
    expect(prepTemplatesFor(splits[1], 'test')).toEqual(TEST_PREP)
    expect(prepTemplatesFor(splits[1], 'tournament')).toEqual(TOURNAMENT_PREP)
  })

  it('uses a split override for its kind only', () => {
    const custom = [{ id: 'x', title: 'Flashcards', daysBefore: 5 }]
    const split: Split = { ...splits[1], prepTemplates: { test: custom } }
    expect(prepTemplatesFor(split, 'test')).toEqual(custom)
    expect(prepTemplatesFor(split, 'tournament')).toEqual(TOURNAMENT_PREP)
  })

  it('has no prep for other kinds', () => {
    expect(prepTemplatesFor(splits[1], 'homework')).toEqual([])
  })
})

describe('studyPlan', () => {
  const testAt = atMinute('2026-10-20', 9 * 60)

  it('spreads topics evenly from today to the day before the test', () => {
    const plan = studyPlan(testAt, ['A', 'B', 'C', 'D'], '2026-10-16')
    // Study days: 16, 17, 18, 19. Four topics, one per day.
    expect(plan.map((s) => s.dayKey)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'])
    expect(plan.map((s) => s.topic)).toEqual(['A', 'B', 'C', 'D'])
    expect(new Date(plan[0].dueAt).getHours()).toBe(17)
  })

  it('groups topics when there are more topics than study days', () => {
    const plan = studyPlan(testAt, ['A', 'B', 'C', 'D'], '2026-10-18')
    // Study days: 18, 19. Topics A and B land on 18, C and D on 19.
    expect(plan.map((s) => s.dayKey)).toEqual(['2026-10-18', '2026-10-18', '2026-10-19', '2026-10-19'])
  })

  it('returns nothing without topics', () => {
    expect(studyPlan(testAt, [], '2026-10-16')).toEqual([])
  })

  it('returns nothing when the test is today or already past', () => {
    expect(studyPlan(testAt, ['A'], '2026-10-20')).toEqual([])
    expect(studyPlan(testAt, ['A'], '2026-10-21')).toEqual([])
  })
})

describe('dailyLoad', () => {
  const testItem = itemFromQuickAdd({ title: 'Chem test', kind: 'test', splitId: 'tests', summary: '' }, splits, NOW)
  const hwItem = itemFromQuickAdd({ title: 'Essay', kind: 'homework', splitId: 'hw', summary: '' }, splits, NOW)
  const day = '2026-10-14'
  const block = (itemId: string, startHour: number, hours: number): WorkBlock => ({
    id: `${itemId}-${startHour}`,
    itemId,
    start: atMinute(day, startHour * 60),
    end: atMinute(day, startHour * 60) + hours * 60 * 60_000,
  })

  it('sums block minutes per split and day', () => {
    const load = dailyLoad([block(hwItem.id, 9, 2), block(testItem.id, 14, 1)], [hwItem, testItem], [day])
    expect(load[0].totalMinutes).toBe(180)
    expect(load[0].bySplit).toEqual({ hw: 120, tests: 60 })
    expect(load[0].heavy).toBe(false)
  })

  it('flags days over the heavy threshold', () => {
    const load = dailyLoad([block(hwItem.id, 8, 4), block(testItem.id, 13, 3)], [hwItem, testItem], [day])
    expect(load[0].totalMinutes).toBe(7 * 60)
    expect(load[0].totalMinutes).toBeGreaterThan(HEAVY_DAY_MINUTES)
    expect(load[0].heavy).toBe(true)
  })

  it('ignores blocks for unknown items and on other days', () => {
    const stray = { id: 'x', itemId: 'missing', start: atMinute(day, 9 * 60), end: atMinute(day, 10 * 60) }
    const other = block(hwItem.id, 9, 1)
    const load = dailyLoad([stray, { ...other, start: atMinute('2026-10-15', 9 * 60), end: atMinute('2026-10-15', 10 * 60) }], [hwItem], [day])
    expect(load[0].totalMinutes).toBe(0)
  })

  it('covers every requested day, including empty ones', () => {
    const days = weekDays(day)
    const load = dailyLoad([], [], days)
    expect(load.map((d) => d.key)).toEqual(days)
    expect(load.every((d) => d.totalMinutes === 0)).toBe(true)
  })
})

describe('weekTotalsBySplit', () => {
  it('adds per-split minutes across days', () => {
    const totals = weekTotalsBySplit([
      { key: 'a', totalMinutes: 90, bySplit: { hw: 60, tests: 30 }, heavy: false },
      { key: 'b', totalMinutes: 60, bySplit: { hw: 60 }, heavy: false },
    ])
    expect(totals).toEqual({ hw: 120, tests: 30 })
  })
})
