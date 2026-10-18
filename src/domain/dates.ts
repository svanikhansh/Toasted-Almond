import type { Item, Recurrence, WorkBlock } from './types'

export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

/** Local-time day key, YYYY-MM-DD. */
export function dayKey(ms: number | Date = Date.now()): string {
  const d = ms instanceof Date ? ms : new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local midnight for a day key. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Whole calendar days from a to b (b - a). Uses calendar math, so DST is safe. */
export function daysBetween(a: string, b: string): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime()
  return Math.round(ms / DAY)
}

/** Monday-based week containing the given day key. */
export function weekDays(key: string): string[] {
  const d = parseDayKey(key)
  const mondayOffset = (d.getDay() + 6) % 7
  const monday = addDays(key, -mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Move a timestamp onto another day, keeping its time of day. */
export function shiftToDay(ms: number, targetKey: string): number {
  const src = new Date(ms)
  const dst = parseDayKey(targetKey)
  dst.setHours(src.getHours(), src.getMinutes(), src.getSeconds(), src.getMilliseconds())
  return dst.getTime()
}

/** Ms timestamp at a local day key plus minutes from midnight. */
export function atMinute(key: string, minutes: number): number {
  const d = parseDayKey(key)
  d.setMinutes(minutes)
  return d.getTime()
}

export function minutesOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

function recurrenceMatches(rec: Recurrence, baseKey: string, key: string): boolean {
  if (key < baseKey) return false
  if (rec.until && key > rec.until) return false
  const days = daysBetween(baseKey, key)
  const base = parseDayKey(baseKey)
  const target = parseDayKey(key)
  const step = Math.max(1, rec.interval)
  switch (rec.freq) {
    case 'daily':
      return days % step === 0
    case 'weekly': {
      const weeks = Math.floor((days + ((base.getDay() + 6) % 7)) / 7)
      const weekdays = rec.byWeekday?.length ? rec.byWeekday : [base.getDay()]
      return weeks % step === 0 && weekdays.includes(target.getDay())
    }
    case 'monthly': {
      const months =
        (target.getFullYear() - base.getFullYear()) * 12 + (target.getMonth() - base.getMonth())
      return months % step === 0 && target.getDate() === base.getDate()
    }
  }
}

/** The anchor day for an item: where its fixed time or deadline lives. */
export function anchorKey(item: Item): string {
  const ms = item.startsAt ?? item.dueAt ?? item.createdAt
  return dayKey(ms)
}

export type Occurrence = {
  item: Item
  key: string
  startsAt?: number
  endsAt?: number
  dueAt?: number
  done: boolean
}

/** Whether an item has an occurrence on the given day. */
export function occursOn(item: Item, key: string): boolean {
  if (!item.recurrence) {
    if (item.kind === 'tournament') {
      return key >= item.startDate && key <= item.endDate
    }
    if (item.startsAt != null) return dayKey(item.startsAt) === key
    if (item.dueAt != null) return dayKey(item.dueAt) === key
    return false
  }
  return recurrenceMatches(item.recurrence, anchorKey(item), key)
}

/** Expand an item into the occurrence for one day, or null. */
export function occurrenceOn(item: Item, key: string): Occurrence | null {
  if (!occursOn(item, key)) return null
  const recurring = item.recurrence != null
  const shift = (ms?: number) =>
    ms == null || !recurring ? ms : shiftToDay(ms, key)
  const done = recurring ? item.completedOccurrences.includes(key) : item.completed
  return {
    item,
    key,
    startsAt: shift(item.startsAt),
    endsAt: shift(item.endsAt),
    dueAt: shift(item.dueAt),
    done,
  }
}

export type Interval = { start: number; end: number }

/**
 * Free intervals within [dayStart, dayEnd] not covered by busy intervals.
 * Gaps shorter than minGapMin are dropped.
 */
export function computeGaps(
  busy: Interval[],
  dayStart: number,
  dayEnd: number,
  minGapMin = 15,
): Interval[] {
  const sorted = busy
    .map((b) => ({ start: Math.max(b.start, dayStart), end: Math.min(b.end, dayEnd) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const b of sorted) {
    const last = merged[merged.length - 1]
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end)
    else merged.push({ ...b })
  }

  const gaps: Interval[] = []
  let cursor = dayStart
  for (const b of merged) {
    if (b.start - cursor >= minGapMin * MIN) gaps.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (dayEnd - cursor >= minGapMin * MIN) gaps.push({ start: cursor, end: dayEnd })
  return gaps
}

/** Busy intervals for one day from fixed events and work blocks. */
export function busyIntervals(occurrences: Occurrence[], blocks: WorkBlock[]): Interval[] {
  const out: Interval[] = []
  for (const o of occurrences) {
    if (o.startsAt != null) out.push({ start: o.startsAt, end: o.endsAt ?? o.startsAt + HOUR })
  }
  for (const b of blocks) out.push({ start: b.start, end: b.end })
  return out
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatDayLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
