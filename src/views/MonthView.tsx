import { useMemo } from 'react'
import { addDays, dayKey, occurrenceOn, parseDayKey, weekDays } from '../domain/dates'
import { dueOn } from '../domain/items'
import type { Item, Split } from '../domain/types'
import { EmptyState, splitStyle } from '../components/common'

const MAX_PILLS = 3

type Props = {
  date: string
  onDateChange: (key: string) => void
  items: Item[]
  splits: Split[]
  onOpen: (item: Item) => void
}

export function MonthView({ date, onDateChange, items, splits, onOpen }: Props) {
  const monthStart = useMemo(() => {
    const d = parseDayKey(date)
    return dayKey(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [date])

  const monthLabel = parseDayKey(monthStart).toLocaleDateString([], { month: 'long', year: 'numeric' })
  const gridStart = weekDays(monthStart)[0]
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])
  const splitById = useMemo(() => new Map(splits.map((s) => [s.id, s])), [splits])
  const today = dayKey()

  // Pills for each day: fixed events first (by start time), then deadlines.
  const pillsByDay = useMemo(() => {
    const map = new Map<string, { id: string; item: Item; label: string }[]>()
    for (const key of days) {
      const events = items
        .flatMap((item) => {
          const o = occurrenceOn(item, key)
          return o && o.startsAt != null ? [{ item, startsAt: o.startsAt }] : []
        })
        .sort((a, b) => a.startsAt - b.startsAt)
        .map(({ item, startsAt }) => ({
          id: `ev-${item.id}-${key}`,
          item,
          label: `${new Date(startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ${item.title}`,
        }))
      const deadlines = dueOn(items, key).map((item) => ({ id: `due-${item.id}-${key}`, item, label: item.title }))
      const all = [...events, ...deadlines]
      if (all.length) map.set(key, all)
    }
    return map
  }, [days, items])

  const hasAny = pillsByDay.size > 0

  const shift = (months: number) => {
    const d = parseDayKey(monthStart)
    onDateChange(dayKey(new Date(d.getFullYear(), d.getMonth() + months, 1)))
  }

  return (
    <section aria-labelledby="month-heading">
      <div className="week-header">
        <div>
          <h1 id="month-heading" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>
            {monthLabel}
          </h1>
        </div>
        <div className="nav-buttons" role="group" aria-label="Change month">
          <button type="button" className="btn" onClick={() => shift(-1)}>
            Previous month
          </button>
          <button type="button" className="btn" onClick={() => onDateChange(today)}>
            This month
          </button>
          <button type="button" className="btn" onClick={() => shift(1)}>
            Next month
          </button>
        </div>
      </div>

      {!hasAny && (
        <div style={{ marginTop: 16 }}>
          <EmptyState title="Nothing due this month.">
            Add a homework, test, or tournament with the quick add bar and it will appear here.
          </EmptyState>
        </div>
      )}

      <div className="month-grid" role="grid" aria-label={monthLabel} style={{ marginTop: 16 }}>
        <div className="month-row month-weekdays" role="row">
          {days.slice(0, 7).map((k) => (
            <div key={k} role="columnheader" className="month-weekday">
              {parseDayKey(k).toLocaleDateString([], { weekday: 'short' })}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} className="month-row" role="row">
            {days.slice(week * 7, week * 7 + 7).map((key) => {
              const inMonth = key.slice(0, 7) === monthStart.slice(0, 7)
              const pills = pillsByDay.get(key) ?? []
              const shown = pills.slice(0, MAX_PILLS)
              const extra = pills.length - shown.length
              return (
                <div
                  key={key}
                  role="gridcell"
                  className={`month-cell${inMonth ? '' : ' outside'}${key === today ? ' today' : ''}`}
                  aria-label={parseDayKey(key).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                >
                  <span className="month-daynum">{parseDayKey(key).getDate()}</span>
                  {shown.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pill"
                      style={splitStyle(splitById.get(p.item.splitId))}
                      onClick={() => onOpen(p.item)}
                    >
                      {p.label}
                    </button>
                  ))}
                  {extra > 0 && <span className="muted pill-more">{extra} more</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
