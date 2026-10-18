import { useMemo, useState, type DragEvent } from 'react'
import {
  addDays,
  atMinute,
  dayKey,
  formatTime,
  occurrenceOn,
  parseDayKey,
  weekDays,
} from '../domain/dates'
import {
  defaultBlockMinutes,
  dueOn,
  makeBlock,
  overdueBefore,
  snapMinutes,
  unscheduledTasks,
} from '../domain/items'
import type { Item, Split, WorkBlock } from '../domain/types'
import { EmptyState, KIND_LABEL, RepeatMark, SplitMarker, dueLabel, splitStyle } from '../components/common'
import type { Repo } from '../storage/repo'

const START_HOUR = 7
const END_HOUR = 22
const HOUR_PX = 48
const GRID_PX = (END_HOUR - START_HOUR) * HOUR_PX
const MIME_ITEM = 'application/x-almond-item'
const MIME_BLOCK = 'application/x-almond-block'

type Props = {
  date: string
  onDateChange: (key: string) => void
  items: Item[]
  blocks: WorkBlock[]
  splits: Split[]
  repo: Repo | null
  onOpen: (item: Item, occurrenceKey?: string) => void
}

export function WeekView({ date, onDateChange, items, blocks, splits, repo, onOpen }: Props) {
  const days = useMemo(() => weekDays(date), [date])
  const today = dayKey()
  const splitById = useMemo(() => new Map(splits.map((s) => [s.id, s])), [splits])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [schedDay, setSchedDay] = useState('')
  const [schedMinutes, setSchedMinutes] = useState(9 * 60)

  const weekLabel = `${parseDayKey(days[0]).toLocaleDateString([], { month: 'short', day: 'numeric' })} to ${parseDayKey(days[6]).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`

  const columns = useMemo(
    () =>
      days.map((key) => {
        const events = items.flatMap((i) => {
          const o = occurrenceOn(i, key, splitById.get(i.splitId)?.rotationAnchor)
          return o && o.startsAt != null ? [o] : []
        })
        const dayBlocks = blocks.filter((b) => dayKey(b.start) === key && itemById.has(b.itemId))
        const due = dueOn(items, key, (i) => splitById.get(i.splitId)?.rotationAnchor)
        const overdue = key === today ? overdueBefore(items, key) : []
        return { key, events, dayBlocks, due, overdue }
      }),
    [days, items, blocks, itemById, splitById, today],
  )

  const weekEmpty = columns.every(
    (c) => c.events.length === 0 && c.dayBlocks.length === 0 && c.due.length === 0 && c.overdue.length === 0,
  )

  const tray = useMemo(() => unscheduledTasks(items), [items])

  const topFor = (ms: number) => {
    const start = parseDayKey(dayKey(ms))
    start.setHours(START_HOUR, 0, 0, 0)
    return ((ms - start.getTime()) / 60_000 / 60) * HOUR_PX
  }
  const heightFor = (start: number, end: number) => Math.max(22, ((end - start) / 60_000 / 60) * HOUR_PX)

  const dragOverColumn = (e: DragEvent<HTMLDivElement>, key: string) => {
    const types = Array.from(e.dataTransfer.types)
    if (!types.includes(MIME_ITEM) && !types.includes(MIME_BLOCK)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropKey !== key) setDropKey(key)
  }

  const dropOnColumn = async (e: DragEvent<HTMLDivElement>, key: string) => {
    e.preventDefault()
    setDropKey(null)
    if (!repo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = START_HOUR * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60
    const start = atMinute(key, Math.min(snapMinutes(minutes), END_HOUR * 60 - 30))

    const itemId = e.dataTransfer.getData(MIME_ITEM)
    if (itemId) {
      const item = itemById.get(itemId)
      if (item) await repo.putBlock(makeBlock(item.id, start, defaultBlockMinutes(item)))
      return
    }
    const blockId = e.dataTransfer.getData(MIME_BLOCK)
    const block = blocks.find((b) => b.id === blockId)
    if (block) {
      const duration = block.end - block.start
      await repo.putBlock({ ...block, start, end: start + duration })
    }
  }

  const startDrag = (e: DragEvent<HTMLElement>, mime: string, id: string) => {
    e.dataTransfer.setData(mime, id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const openSchedule = (item: Item) => {
    setScheduling(item.id)
    setSchedDay(days.includes(today) ? today : days[0])
    setSchedMinutes(9 * 60)
  }

  const confirmSchedule = async (item: Item) => {
    if (!repo || !schedDay) return
    await repo.putBlock(makeBlock(item.id, atMinute(schedDay, schedMinutes), defaultBlockMinutes(item)))
    setScheduling(null)
  }

  const slots = Array.from({ length: ((END_HOUR - START_HOUR) * 60) / 30 }, (_, i) => START_HOUR * 60 + i * 30)

  return (
    <section aria-labelledby="week-heading">
      <div className="week-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>{weekLabel}</p>
          <h1 id="week-heading" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>Week</h1>
        </div>
        <div className="nav-buttons" role="group" aria-label="Change week">
          <button type="button" className="btn" onClick={() => onDateChange(addDays(date, -7))}>
            Previous week
          </button>
          <button type="button" className="btn" onClick={() => onDateChange(dayKey())}>
            This week
          </button>
          <button type="button" className="btn" onClick={() => onDateChange(addDays(date, 7))}>
            Next week
          </button>
        </div>
      </div>

      {weekEmpty && (
        <div style={{ marginTop: 16 }}>
          <EmptyState title="This week is clear.">
            Drag an open task from the tray onto a time slot to make a work block, or use Schedule on a task to
            place it without dragging.
          </EmptyState>
        </div>
      )}

      <div className="week-layout">
        <aside className="tray" aria-label="Unscheduled work">
          <h2 className="section-title">Open work</h2>
          {tray.length === 0 ? (
            <EmptyState title="No open work.">Everything is complete or on the calendar.</EmptyState>
          ) : (
            <ul className="list tray-list">
              {tray.map((item) => {
                const split = splitById.get(item.splitId)
                const due = dueLabel(item)
                return (
                  <li
                    key={item.id}
                    className="tray-item"
                    style={splitStyle(split)}
                    draggable
                    onDragStart={(e) => startDrag(e, MIME_ITEM, item.id)}
                  >
                    <button type="button" className="item-title" onClick={() => onOpen(item)}>
                      {item.title}
                    </button>
                    <div className="item-meta">
                      {split && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <SplitMarker color={split.color} />
                          {split.name}
                        </span>
                      )}
                      <span>{KIND_LABEL[item.kind]}</span>
                      {due && <span>Due {due}</span>}
                    </div>
                    {scheduling === item.id ? (
                      <div className="schedule-form">
                        <label className="sr-only" htmlFor={`sched-day-${item.id}`}>Day</label>
                        <select id={`sched-day-${item.id}`} value={schedDay} onChange={(e) => setSchedDay(e.target.value)}>
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {parseDayKey(d).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                            </option>
                          ))}
                        </select>
                        <label className="sr-only" htmlFor={`sched-time-${item.id}`}>Start time</label>
                        <select
                          id={`sched-time-${item.id}`}
                          value={schedMinutes}
                          onChange={(e) => setSchedMinutes(Number(e.target.value))}
                        >
                          {slots.map((m) => (
                            <option key={m} value={m}>
                              {formatTime(atMinute(today, m))}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-primary" onClick={() => confirmSchedule(item)}>
                          Add block
                        </button>
                        <button type="button" className="btn" onClick={() => setScheduling(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => openSchedule(item)}>
                        Schedule
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <div className="cal-scroll">
          <div className="cal" role="table" aria-label="Week calendar">
            <div className="cal-row cal-head" role="row">
              <div role="columnheader" aria-label="Time" />
              {columns.map((c) => (
                <div
                  key={c.key}
                  role="columnheader"
                  className={`cal-head-cell${c.key === today ? ' today' : ''}`}
                  aria-label={parseDayKey(c.key).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                >
                  <div>{parseDayKey(c.key).toLocaleDateString([], { weekday: 'short' })}</div>
                  <span className="day-num" aria-hidden="true">{parseDayKey(c.key).getDate()}</span>
                </div>
              ))}
            </div>

            <div className="cal-row due-strip" role="row" aria-label="Due dates">
              <div className="gutter-label" role="rowheader">Due</div>
              {columns.map((c) => (
                <div className="cell" key={c.key} role="cell">
                  {c.overdue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="due-chip overdue"
                      style={splitStyle(splitById.get(item.splitId))}
                      onClick={() => onOpen(item, c.key)}
                      aria-label={`Overdue: ${item.title}`}
                    >
                      {item.title}
                    </button>
                  ))}
                  {c.due.map((o) => (
                    <button
                      key={`${o.item.id}-${o.key}`}
                      type="button"
                      className="due-chip"
                      style={splitStyle(splitById.get(o.item.splitId))}
                      onClick={() => onOpen(o.item, c.key)}
                    >
                      {o.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="cal-row grid-body" role="row">
              <div style={{ position: 'relative', height: GRID_PX }} aria-hidden="true">
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="hour-label" style={{ position: 'absolute', top: i * HOUR_PX, right: 0, left: 0 }}>
                    {formatTime(atMinute(today, (START_HOUR + i) * 60))}
                  </div>
                ))}
              </div>
              {columns.map((c) => (
                <div
                  key={c.key}
                  role="cell"
                  aria-label={parseDayKey(c.key).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  className={`grid-col${c.key === today ? ' today' : ''}${dropKey === c.key ? ' drop-target' : ''}`}
                  style={{ height: GRID_PX }}
                  onDragOver={(e) => dragOverColumn(e, c.key)}
                  onDragLeave={() => setDropKey((k) => (k === c.key ? null : k))}
                  onDrop={(e) => dropOnColumn(e, c.key)}
                >
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div key={i} className="hour-line" style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0 }} />
                  ))}

                  {c.events.map((o) => {
                    const start = o.startsAt!
                    const end = o.endsAt ?? start + 3_600_000
                    const split = splitById.get(o.item.splitId)
                    return (
                      <button
                        key={`ev-${o.item.id}`}
                        type="button"
                        className="event fixed"
                        style={{ top: topFor(start), height: heightFor(start, end), ...splitStyle(split) }}
                        onClick={() => onOpen(o.item, o.key)}
                        aria-label={`${o.item.title}, ${formatTime(start)} to ${formatTime(end)}`}
                      >
                        <span className="event-title">
                          {o.item.title}
                          {o.item.recurrence && <RepeatMark />}
                        </span>
                        <span className="event-time">{formatTime(start)}</span>
                      </button>
                    )
                  })}

                  {c.dayBlocks.map((b) => {
                    const item = itemById.get(b.itemId)!
                    const split = splitById.get(item.splitId)
                    return (
                      <div
                        key={`bl-${b.id}`}
                        className="event block"
                        draggable
                        onDragStart={(e) => startDrag(e, MIME_BLOCK, b.id)}
                        style={{ top: topFor(b.start), height: heightFor(b.start, b.end), ...splitStyle(split), cursor: 'grab' }}
                      >
                        <button type="button" className="item-title event-title" style={{ textAlign: 'left' }} onClick={() => onOpen(item, c.key)}>
                          {item.title}
                        </button>
                        <span className="event-time">
                          {formatTime(b.start)} to {formatTime(b.end)}
                        </span>
                        <button
                          type="button"
                          className="remove"
                          onClick={() => repo?.deleteBlock(b.id)}
                          aria-label={`Remove work block for ${item.title}`}
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {columns.length > 0 && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Work blocks: drag to move, drop from the tray to create. Use Schedule for a keyboard or touch path.
        </p>
      )}
    </section>
  )
}
