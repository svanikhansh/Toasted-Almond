import { dayKey, MIN, occurrenceOn, parseDayKey, type Occurrence } from './dates'
import type { QuickAddResult } from './quickAdd'
import type { Item, Split, WorkBlock } from './types'

/** Turn a parsed quick-add line into a stored item with kind-specific defaults. */
export function itemFromQuickAdd(r: QuickAddResult, splits: Split[], now = Date.now()): Item {
  const splitId = r.splitId ?? splits.find((s) => !s.archived)?.id ?? ''
  const day = dayKey(r.startsAt ?? r.dueAt ?? now)
  const common = {
    id: crypto.randomUUID(),
    splitId,
    title: r.title,
    notes: '',
    priority: 0 as const,
    subtasks: [],
    dueAt: r.dueAt,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    completed: false,
    completedOccurrences: [],
    createdAt: now,
    updatedAt: now,
  }
  switch (r.kind) {
    case 'test':
      return { ...common, kind: 'test', topics: [] }
    case 'project':
      return { ...common, kind: 'project', milestones: [] }
    case 'tournament':
      return {
        ...common,
        kind: 'tournament',
        startDate: day,
        endDate: day,
        location: '',
        packing: [],
        rounds: [],
      }
    case 'club':
      return { ...common, kind: 'club', meetingTodos: {} }
    default:
      return { ...common, kind: 'homework', className: '', estimateMin: 0 }
  }
}

/** Items with a fixed time are timeline events, not tasks to schedule. */
export function isFixedEvent(item: Item): boolean {
  return item.startsAt != null
}

/** Mark an item (or one occurrence of a recurring item) done or open. */
export function toggleDone(item: Item, key: string, now = Date.now()): Item {
  if (item.recurrence) {
    const has = item.completedOccurrences.includes(key)
    const completedOccurrences = has
      ? item.completedOccurrences.filter((k) => k !== key)
      : [...item.completedOccurrences, key]
    return { ...item, completedOccurrences, updatedAt: now }
  }
  const completed = !item.completed
  return { ...item, completed, completedAt: completed ? now : undefined, updatedAt: now }
}

/**
 * Open deadline occurrences due on the given day. Recurring items expand by
 * their rule and split's rotation anchor, and each occurrence has its own done state.
 */
export function dueOn(
  items: Item[],
  key: string,
  rotationAnchorOf: (item: Item) => string | undefined = () => undefined,
): Occurrence[] {
  return items.flatMap((i): Occurrence[] => {
    if (isFixedEvent(i) || i.dueAt == null) return []
    if (!i.recurrence) {
      if (i.completed || dayKey(i.dueAt) !== key) return []
      return [{ item: i, key, title: i.title, dueAt: i.dueAt, done: false }]
    }
    const o = occurrenceOn(i, key, rotationAnchorOf(i))
    return o && o.dueAt != null ? [o] : []
  })
}

/** Open deadline items whose day is before the given day. */
export function overdueBefore(items: Item[], key: string): Item[] {
  return items.filter(
    (i) =>
      !i.completed &&
      !i.recurrence &&
      !isFixedEvent(i) &&
      i.dueAt != null &&
      dayKey(i.dueAt) < key,
  )
}

/** Open tasks that are not yet fixed events, for the unscheduled tray. */
export function unscheduledTasks(items: Item[]): Item[] {
  return items
    .filter((i) => !i.completed && !isFixedEvent(i) && !i.recurrence)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
}

/** Default block length for an item. */
export function defaultBlockMinutes(item: Item): number {
  if (item.kind === 'homework' && item.estimateMin > 0) return item.estimateMin
  return 60
}

/** Snap a minute-of-day to the nearest slot. */
export function snapMinutes(min: number, step = 30): number {
  return Math.max(0, Math.round(min / step) * step)
}

export function makeBlock(itemId: string, start: number, minutes: number): WorkBlock {
  return {
    id: crypto.randomUUID(),
    itemId,
    start,
    end: start + minutes * MIN,
  }
}

/** Occurrences of all items on one day, excluding nothing. */
export function occurrencesOn(items: Item[], key: string) {
  return items.flatMap((i) => {
    const o = occurrenceOn(i, key)
    return o ? [o] : []
  })
}

export function dayWindow(key: string, startHour = 7, endHour = 22) {
  const day = parseDayKey(key)
  const start = new Date(day)
  start.setHours(startHour, 0, 0, 0)
  const end = new Date(day)
  end.setHours(endHour, 0, 0, 0)
  return { start: start.getTime(), end: end.getTime() }
}
