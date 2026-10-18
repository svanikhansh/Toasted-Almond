import { addDays, atMinute, dayKey, HOUR } from './dates'
import type { ItemKind, Split } from './types'

export type QuickAddResult = {
  title: string
  splitId?: string
  kind: ItemKind
  dueAt?: number
  startsAt?: number
  endsAt?: number
  /** Human-readable summary of what was understood, for the preview line. */
  summary: string
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const KIND_BY_SPLIT: Record<string, ItemKind> = {
  homework: 'homework',
  tests: 'test',
  test: 'test',
  projects: 'project',
  project: 'project',
  tournaments: 'tournament',
  tournament: 'tournament',
  club: 'club',
}

/** Parse "3pm", "3:30 pm", "15:00", "noon". Returns minutes from midnight. */
export function parseTime(token: string): number | undefined {
  const t = token.toLowerCase()
  if (t === 'noon') return 12 * 60
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t)
  if (!m) return undefined
  // Require a colon or am/pm so that a bare number is never read as a time.
  if (m[2] === undefined && m[3] === undefined) return undefined
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const ampm = m[3]
  if (min > 59) return undefined
  if (ampm) {
    if (h < 1 || h > 12) return undefined
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
  } else if (h > 23) return undefined
  return h * 60 + min
}

/** Parse a day word into a day key relative to today. */
export function parseDay(token: string, todayKey: string): string | undefined {
  const t = token.toLowerCase()
  if (t === 'today') return todayKey
  if (t === 'tomorrow' || t === 'tmr' || t === 'tmrw') return addDays(todayKey, 1)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return t
  const md = /^(\d{1,2})\/(\d{1,2})$/.exec(t)
  if (md) {
    const year = Number(todayKey.slice(0, 4))
    const key = `${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
    return key < todayKey ? `${year + 1}${key.slice(4)}` : key
  }
  const idx = WEEKDAYS.findIndex((w) => t === w || t === fullWeekday(w))
  if (idx >= 0) {
    const todayIdx = new Date(`${todayKey}T12:00:00`).getDay()
    const delta = (idx - todayIdx + 7) % 7
    return addDays(todayKey, delta)
  }
  return undefined
}

function fullWeekday(short: string): string {
  return {
    sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
    thu: 'thursday', fri: 'friday', sat: 'saturday',
  }[short] as string
}

/**
 * Parse one line of shorthand into an item draft. The split is matched by
 * `#name` (case-insensitive prefix) or left unset when no split matches.
 */
export function parseQuickAdd(
  input: string,
  splits: Split[],
  now: number = Date.now(),
): QuickAddResult | null {
  const todayKey = dayKey(now)
  const words: string[] = []
  let splitId: string | undefined
  let dayKeyValue: string | undefined
  let minutes: number | undefined

  for (const raw of input.trim().split(/\s+/)) {
    if (!raw) continue
    if (raw.startsWith('#') && raw.length > 1) {
      const name = raw.slice(1).toLowerCase()
      const match = splits.find(
        (s) => !s.archived && s.name.toLowerCase().startsWith(name),
      )
      if (match) {
        splitId = match.id
        continue
      }
    }
    const day = parseDay(raw, todayKey)
    if (day && dayKeyValue === undefined) {
      dayKeyValue = day
      continue
    }
    const time = parseTime(raw)
    if (time !== undefined && minutes === undefined) {
      minutes = time
      continue
    }
    words.push(raw)
  }

  const title = words.join(' ').trim()
  if (!title) return null

  const split = splits.find((s) => s.id === splitId)
  const kind: ItemKind = (split && KIND_BY_SPLIT[split.name.toLowerCase()]) || 'homework'

  const result: QuickAddResult = { title, splitId, kind, summary: '' }
  const parts: string[] = [kind === 'test' ? 'Test' : 'Due']

  if (dayKeyValue) {
    if (kind === 'test') {
      const startMin = minutes ?? 9 * 60
      result.startsAt = atMinute(dayKeyValue, startMin)
      result.endsAt = result.startsAt + 90 * 60_000
    } else {
      result.dueAt = atMinute(dayKeyValue, minutes ?? 23 * 60 + 59)
    }
    parts.push(dayKeyValue)
  }
  if (minutes !== undefined && dayKeyValue === undefined) {
    // A time without a day means today.
    if (kind === 'test') {
      result.startsAt = atMinute(todayKey, minutes)
      result.endsAt = result.startsAt + HOUR
    } else {
      result.dueAt = atMinute(todayKey, minutes)
    }
  }
  if (minutes !== undefined) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    parts.push(`${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`)
  }
  result.summary = split ? `${parts.join(' ')} in ${split.name}` : parts.join(' ')
  return result
}
