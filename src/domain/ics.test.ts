import { describe, expect, it } from 'vitest'
import { parseIcs } from './ics'

const wrap = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n')

describe('parseIcs', () => {
  it('reads timed events, using local time for floating values and UTC for Z values', () => {
    const text = wrap(
      'BEGIN:VEVENT',
      'SUMMARY:Biology lab',
      'DTSTART:20261020T090000',
      'DTEND:20261020T103000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Standup',
      'DTSTART:20261021T140000Z',
      'DTEND:20261021T143000Z',
      'END:VEVENT',
    )
    const { events, skipped } = parseIcs(text)
    expect(skipped).toBe(0)
    expect(events).toEqual([
      {
        title: 'Biology lab',
        startsAt: new Date(2026, 9, 20, 9, 0, 0).getTime(),
        endsAt: new Date(2026, 9, 20, 10, 30, 0).getTime(),
      },
      {
        title: 'Standup',
        startsAt: Date.UTC(2026, 9, 21, 14, 0, 0),
        endsAt: Date.UTC(2026, 9, 21, 14, 30, 0),
      },
    ])
  })

  it('skips all-day events and events without a start, and counts them', () => {
    const text = wrap(
      'BEGIN:VEVENT',
      'SUMMARY:Holiday',
      'DTSTART;VALUE=DATE:20261026',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:No start',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Kept',
      'DTSTART:20261022T080000',
      'END:VEVENT',
    )
    const { events, skipped } = parseIcs(text)
    expect(skipped).toBe(2)
    expect(events.map((e) => e.title)).toEqual(['Kept'])
  })

  it('unfolds long lines and unescapes commas and semicolons in the summary', () => {
    const text = wrap(
      'BEGIN:VEVENT',
      'SUMMARY:Chemistry\\, room 4\\; bring ',
      ' goggles',
      'DTSTART:20261022T080000',
      'END:VEVENT',
    )
    expect(parseIcs(text).events[0].title).toBe('Chemistry, room 4; bring goggles')
  })

  it('defaults the end to one hour after the start when DTEND is missing or earlier', () => {
    const start = new Date(2026, 9, 22, 8, 0, 0).getTime()
    const text = wrap(
      'BEGIN:VEVENT',
      'SUMMARY:No end',
      'DTSTART:20261022T080000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Bad end',
      'DTSTART:20261022T080000',
      'DTEND:20261022T070000',
      'END:VEVENT',
    )
    const { events } = parseIcs(text)
    expect(events.map((e) => e.endsAt - e.startsAt)).toEqual([60 * 60_000, 60 * 60_000])
    expect(events[0].startsAt).toBe(start)
  })

  it('uses "Untitled event" when the summary is empty', () => {
    const text = wrap('BEGIN:VEVENT', 'SUMMARY:', 'DTSTART:20261022T080000', 'END:VEVENT')
    expect(parseIcs(text).events[0].title).toBe('Untitled event')
  })

  it('returns nothing for a file with no events', () => {
    expect(parseIcs(wrap())).toEqual({ events: [], skipped: 0 })
  })
})
