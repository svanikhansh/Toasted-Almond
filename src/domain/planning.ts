import { atMinute, addDays, dayKey, MIN } from './dates'
import type { Item, ItemKind, PrepTemplate, Split, WorkBlock } from './types'

export type { PrepTemplate }

/** Hours of planned work on one day above which the day is flagged, gently. */
export const HEAVY_DAY_MINUTES = 6 * 60

export const TEST_PREP: PrepTemplate[] = [
  { id: 'review', title: 'Review notes', daysBefore: 7 },
  { id: 'practice', title: 'Practice set', daysBefore: 3 },
  { id: 'light', title: 'Light review the night before', daysBefore: 1 },
]

export const TOURNAMENT_PREP: PrepTemplate[] = [
  { id: 'packing', title: 'Packing list', daysBefore: 3 },
  { id: 'logistics', title: 'Logistics check', daysBefore: 1 },
]

/** Default prep templates for a kind, or none for kinds without prep. */
export function defaultPrepTemplates(kind: ItemKind): PrepTemplate[] {
  if (kind === 'test') return TEST_PREP
  if (kind === 'tournament') return TOURNAMENT_PREP
  return []
}

/** A split's own prep templates for a kind, falling back to the defaults. */
export function prepTemplatesFor(split: Split | null | undefined, kind: ItemKind): PrepTemplate[] {
  if (kind !== 'test' && kind !== 'tournament') return []
  return split?.prepTemplates?.[kind] ?? defaultPrepTemplates(kind)
}

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
