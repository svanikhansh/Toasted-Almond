import type { Recurrence } from './types'

/** Repeat choices offered in the item editor. */
export type Repeat = 'none' | 'daily' | 'weekly' | 'biweeklyA' | 'biweeklyB' | 'monthly'

/** How a repeating series ends. */
export type EndMode = 'never' | 'until' | 'count'

export function repeatOf(rec?: Recurrence): Repeat {
  if (!rec) return 'none'
  if (rec.freq === 'daily') return 'daily'
  if (rec.freq === 'monthly') return 'monthly'
  if (rec.rotation === 'A') return 'biweeklyA'
  if (rec.rotation === 'B') return 'biweeklyB'
  return 'weekly'
}

/** Whether a repeat choice picks specific weekdays. */
export function usesWeekdays(repeat: Repeat): boolean {
  return repeat === 'weekly' || repeat === 'biweeklyA' || repeat === 'biweeklyB'
}

/** Build the stored rule from editor choices. Returns undefined for no repeat. */
export function buildRecurrence(
  repeat: Repeat,
  weekdays: number[],
  ends: EndMode,
  until: string,
  count: number,
): Recurrence | undefined {
  if (repeat === 'none') return undefined
  const rec: Recurrence = usesWeekdays(repeat)
    ? {
        freq: 'weekly',
        interval: 1,
        byWeekday: [...weekdays].sort((a, b) => a - b),
        ...(repeat === 'biweeklyA' ? { rotation: 'A' as const } : {}),
        ...(repeat === 'biweeklyB' ? { rotation: 'B' as const } : {}),
      }
    : repeat === 'daily'
      ? { freq: 'daily', interval: 1 }
      : { freq: 'monthly', interval: 1 }
  if (ends === 'until' && until) rec.until = until
  if (ends === 'count' && count > 0) rec.count = count
  return rec
}
