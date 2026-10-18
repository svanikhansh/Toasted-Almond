import { useMemo } from 'react'
import {
  computeGaps,
  dayKey,
  formatDuration,
  formatTime,
  occurrenceOn,
  parseDayKey,
  type Occurrence,
} from '../domain/dates'
import { dayWindow, dueOn, overdueBefore, toggleDone } from '../domain/items'
import type { Item, Split, WorkBlock } from '../domain/types'
import { EmptyState, ItemRow, SplitMarker } from '../components/common'
import type { Repo } from '../storage/repo'

type Props = {
  date: string
  items: Item[]
  blocks: WorkBlock[]
  splits: Split[]
  repo: Repo | null
  onOpen: (item: Item) => void
}

type Row =
  | { kind: 'event'; start: number; end?: number; item: Item; split?: Split }
  | { kind: 'block'; start: number; end: number; item: Item; split?: Split; block: WorkBlock }
  | { kind: 'gap'; start: number; end: number }

export function TodayView({ date, items, blocks, splits, repo, onOpen }: Props) {
  const splitById = useMemo(() => new Map(splits.map((s) => [s.id, s])), [splits])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const isToday = date === dayKey()

  const due = useMemo(() => dueOn(items, date), [items, date])
  const overdue = useMemo(() => (isToday ? overdueBefore(items, date) : []), [items, date, isToday])

  const rows = useMemo(() => {
    const events: Occurrence[] = []
    for (const item of items) {
      const occ = occurrenceOn(item, date)
      if (occ && occ.startsAt != null) events.push(occ)
    }
    const dayBlocks = blocks.filter((b) => dayKey(b.start) === date && itemById.has(b.itemId))

    const busy = [
      ...events.map((e) => ({ start: e.startsAt!, end: e.endsAt ?? e.startsAt! + 3_600_000 })),
      ...dayBlocks.map((b) => ({ start: b.start, end: b.end })),
    ]
    const win = dayWindow(date, 8, 22)
    const gaps = computeGaps(busy, win.start, win.end)

    const out: Row[] = [
      ...events.map((e): Row => ({
        kind: 'event',
        start: e.startsAt!,
        end: e.endsAt,
        item: e.item,
        split: splitById.get(e.item.splitId),
      })),
      ...dayBlocks.map((b): Row => ({
        kind: 'block',
        start: b.start,
        end: b.end,
        item: itemById.get(b.itemId)!,
        split: splitById.get(itemById.get(b.itemId)!.splitId),
        block: b,
      })),
      ...gaps.map((g): Row => ({ kind: 'gap', start: g.start, end: g.end })),
    ]
    return out.sort((a, b) => a.start - b.start || (a.kind === 'gap' ? 1 : -1))
  }, [items, blocks, date, itemById, splitById])

  const hasTimeline = rows.some((r) => r.kind !== 'gap')

  const toggle = async (item: Item, key: string) => {
    if (!repo) return
    await repo.putItem(toggleDone(item, key))
  }

  const removeBlock = async (id: string) => {
    if (!repo) return
    await repo.deleteBlock(id)
  }

  const heading = parseDayKey(date).toLocaleDateString([], { weekday: 'long' })
  const fullDate = parseDayKey(date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <section aria-labelledby="today-heading">
      <div className="date-heading">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            {fullDate}
          </p>
          <h1 id="today-heading">{isToday ? 'Today' : heading}</h1>
          {!isToday && <p className="muted" style={{ margin: 0 }}>{heading}</p>}
        </div>
      </div>

      <div className="today-grid">
        <div>
          <h2 className="section-title">Due</h2>
          {overdue.length > 0 && (
            <ul className="list" aria-label="Overdue items">
              {overdue.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  split={splitById.get(item.splitId)}
                  dateKey={date}
                  done={false}
                  overdue
                  onToggle={toggle}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
          {due.length > 0 ? (
            <ul className="list" aria-label="Due today">
              {due.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  split={splitById.get(item.splitId)}
                  dateKey={date}
                  done={item.completed}
                  onToggle={toggle}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          ) : (
            overdue.length === 0 && (
              <EmptyState title="Nothing due today.">
                Add a deadline with quick add, for example "lab report fri #homework", and it will land here.
              </EmptyState>
            )
          )}
        </div>

        <div>
          <h2 className="section-title">Timeline</h2>
          {!hasTimeline && rows.length <= 1 ? (
            <EmptyState title="Nothing on the calendar.">
              Tests and club meetings appear here at their time. Drag open work into the Week view to create
              work blocks for this day.
            </EmptyState>
          ) : (
            <ol className="timeline" aria-label="Timeline for the day">
              {rows.map((row) => {
                const key = `${row.kind}-${row.start}-${row.kind === 'block' ? row.block.id : row.kind === 'event' ? row.item.id : ''}`
                if (row.kind === 'gap') {
                  return (
                    <li key={key} className="gap">
                      <time dateTime={new Date(row.start).toISOString()}>{formatTime(row.start)}</time>
                      <span>
                        Free for {formatDuration(Math.round((row.end - row.start) / 60000))}, until{' '}
                        {formatTime(row.end)}
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={key}>
                    <time dateTime={new Date(row.start).toISOString()}>{formatTime(row.start)}</time>
                    <div className="event-body" style={{ ['--split' as string]: row.split?.color }}>
                      <button type="button" className="item-title" onClick={() => onOpen(row.item)}>
                        {row.item.title}
                      </button>
                      <div className="item-meta">
                        {row.split && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <SplitMarker color={row.split.color} />
                            {row.split.name}
                          </span>
                        )}
                        <span>
                          {row.kind === 'block' ? 'Work block' : 'Event'}
                          {row.end ? `, ${formatTime(row.start)} to ${formatTime(row.end)}` : ''}
                        </span>
                        {row.kind === 'block' && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ minHeight: 0, padding: '0 4px', fontSize: 13 }}
                            onClick={() => removeBlock(row.block.id)}
                            aria-label={`Remove work block for ${row.item.title}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
