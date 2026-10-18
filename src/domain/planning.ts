import { atMinute, addDays, dayKey, MIN } from './dates'
import type { Item, WorkBlock } from './types'

/** Hours of planned work on one day above which the day is flagged, gently. */
export const HEAVY_DAY_MINUTES = 6 * 60

export type PrepTemplate = { id: string; title: string; daysBefore: number }

export const TEST_PREP: PrepTemplate[] = [
  { id: 'gather', title: 'Gather notes and topics', daysBefore: 7 },
  { id: 'practice', title: 'Practice problems', daysBefore: 4 },
  { id: 'weak', title: 'Review weak topics', daysBefore: 2 },
  { id: 'light', title: 'Light review and sleep', daysBefore: 1 },
]

export const TOURNAMENT_PREP: PrepTemplate[] = [
  { id: 'travel', title: 'Confirm travel and lodging', daysBefore: 7 },
  { id: 'scout', title: 'Scout the bracket', daysBefore: 3 },
  { id: 'pack', title: 'Pack gear and checklist', daysBefore: 1 },
]

/** Prep deadlines spaced backward from an anchor date, due at 5 pm the day before each step. */
export function backwardPlan(
  anchorKey: string,
  templates: PrepTemplate[],
): { templateId: string; title: string; dueAt: number }[] {
  return templates.map((t) => ({
    templateId: t.id,
    title: t.title,
    dueAt: atMinute(addDays(anchorKey, -t.daysBefore), 17 * 60),
  }))
}

export type StudyStep = { topic: string; dayKey: string; dueAt: number }

/**
 * Spread a test's topics evenly across the days from today up to the day
 * before the test. Each step is due at 5 pm on its study day. Returns nothing
 * when there are no topics or no days left to study.
 */
export function studyPlan(testStartsAt: number, topics: string[], todayKey: string): StudyStep[] {
  const lastDay = addDays(dayKey(testStartsAt), -1)
  const days: string[] = []
  for (let k = todayKey; k <= lastDay; k = addDays(k, 1)) days.push(k)
  if (topics.length === 0 || days.length === 0) return []
  return topics.map((topic, i) => {
    const day = days[Math.floor((i * days.length) / topics.length)]
    return { topic, dayKey: day, dueAt: atMinute(day, 17 * 60) }
  })
}

export type DayLoad = {
  key: string
  totalMinutes: number
  bySplit: Record<string, number>
  heavy: boolean
}

/** Planned work minutes per day and per split, from scheduled work blocks. */
export function dailyLoad(blocks: WorkBlock[], items: Item[], days: string[]): DayLoad[] {
  const splitOf = new Map(items.map((i) => [i.id, i.splitId]))
  return days.map((key) => {
    const bySplit: Record<string, number> = {}
    let totalMinutes = 0
    for (const b of blocks) {
      if (dayKey(b.start) !== key) continue
      const splitId = splitOf.get(b.itemId)
      const minutes = Math.round((b.end - b.start) / MIN)
      if (!splitId || minutes <= 0) continue
      bySplit[splitId] = (bySplit[splitId] ?? 0) + minutes
      totalMinutes += minutes
    }
    return { key, totalMinutes, bySplit, heavy: totalMinutes > HEAVY_DAY_MINUTES }
  })
}

/** Sum of daily load per split across the given days. */
export function weekTotalsBySplit(load: DayLoad[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const day of load) {
    for (const [splitId, minutes] of Object.entries(day.bySplit)) {
      totals[splitId] = (totals[splitId] ?? 0) + minutes
    }
  }
  return totals
}
