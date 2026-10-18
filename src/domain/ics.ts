import { MIN } from './dates'

export type IcsEvent = { title: string; startsAt: number; endsAt: number }

export type IcsParseResult = {
  events: IcsEvent[]
  /** Events left out because they have no usable start time (for example, all-day events). */
  skipped: number
}

type Prop = { value: string; params: string }

const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/

/** Join folded lines: a line starting with a space or tab continues the previous one. */
function unfold(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

/**
 * Parse an iCalendar date-time. Values ending in Z are UTC; others are read as
 * local time, since time zone ids are not resolved. Date-only values return undefined.
 */
function parseDateTime(value: string): number | undefined {
  const m = DATE_TIME.exec(value.trim())
  if (!m) return undefined
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = Number(m[6] ?? 0)
  const ms = m[7]
    ? Date.UTC(year, month, day, hour, minute, second)
    : new Date(year, month, day, hour, minute, second).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

function eventFrom(props: Map<string, Prop>, defaultMinutes: number): IcsEvent | null {
  const start = props.get('DTSTART')
  const startsAt = start ? parseDateTime(start.value) : undefined
  if (startsAt === undefined) return null
  const end = props.get('DTEND')
  const endAt = end ? parseDateTime(end.value) : undefined
  const endsAt = endAt !== undefined && endAt > startsAt ? endAt : startsAt + defaultMinutes * MIN
  const summary = props.get('SUMMARY')
  const title = summary ? unescapeText(summary.value).trim() : ''
  return { title: title || 'Untitled event', startsAt, endsAt }
}

/**
 * Read the VEVENT blocks of an .ics file. Timed events are returned; events
 * without a usable DTSTART are counted as skipped. A missing or invalid end
 * time becomes `defaultMinutes` after the start. Recurrence rules are ignored,
 * so a recurring event is imported as its first occurrence only.
 */
export function parseIcs(text: string, defaultMinutes = 60): IcsParseResult {
  const events: IcsEvent[] = []
  let skipped = 0
  let props: Map<string, Prop> | null = null

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      props = new Map()
      continue
    }
    if (line === 'END:VEVENT') {
      if (props) {
        const event = eventFrom(props, defaultMinutes)
        if (event) events.push(event)
        else skipped++
      }
      props = null
      continue
    }
    if (!props) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const head = line.slice(0, colon)
    const name = head.split(';')[0].toUpperCase()
    props.set(name, { value: line.slice(colon + 1), params: head })
  }

  return { events, skipped }
}
