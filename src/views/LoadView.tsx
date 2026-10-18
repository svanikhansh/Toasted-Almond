import { useMemo } from 'react'
import { addDays, dayKey, formatDayLabel, formatDuration, weekDays } from '../domain/dates'
import { HEAVY_DAY_MINUTES, dailyLoad, weekTotalsBySplit } from '../domain/planning'
import type { Item, Split, WorkBlock } from '../domain/types'
import { EmptyState, SplitMarker, splitStyle } from '../components/common'

type Props = {
  date: string
  onDateChange: (key: string) => void
  items: Item[]
  blocks: WorkBlock[]
  splits: Split[]
}

export function LoadView({ date, onDateChange, items, blocks, splits }: Props) {
  const days = useMemo(() => weekDays(date), [date])
  const load = useMemo(() => dailyLoad(blocks, items, days), [blocks, items, days])
  const totals = useMemo(() => weekTotalsBySplit(load), [load])
  const weekTotal = Object.values(totals).reduce((sum, m) => sum + m, 0)
  const scale = Math.max(HEAVY_DAY_MINUTES, ...load.map((d) => d.totalMinutes))
  const splitById = useMemo(() => new Map(splits.map((s) => [s.id, s])), [splits])
  const today = dayKey()
  const heavyDays = load.filter((d) => d.heavy)

  return (
    <section aria-labelledby="load-heading">
      <div className="week-header">
        <div>
          <h1 id="load-heading" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>
            Load
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Planned work this week, from scheduled work blocks.
          </p>
        </div>
        <div className="nav-buttons" role="group" aria-label="Change week">
          <button type="button" className="btn" onClick={() => onDateChange(addDays(date, -7))}>
            Previous week
          </button>
          <button type="button" className="btn" onClick={() => onDateChange(today)}>
            This week
          </button>
          <button type="button" className="btn" onClick={() => onDateChange(addDays(date, 7))}>
            Next week
          </button>
        </div>
      </div>

      {weekTotal === 0 ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState title="No planned work this week.">
            Schedule a task as a work block in the Week view and its hours will show here.
          </EmptyState>
        </div>
      ) : (
        <>
          <h2 className="section-title" style={{ marginTop: 24 }}>
            By split
          </h2>
          <ul className="list" aria-label="Hours per split this week">
            {splits
              .filter((s) => (totals[s.id] ?? 0) > 0)
              .map((s) => (
                <li key={s.id} className="load-row">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <SplitMarker color={s.color} />
                    {s.name}
                  </span>
                  <span className="numeral">{formatDuration(totals[s.id])}</span>
                </li>
              ))}
            <li className="load-row load-total">
              <span>Total</span>
              <span className="numeral">{formatDuration(weekTotal)}</span>
            </li>
          </ul>

          <h2 className="section-title" style={{ marginTop: 24 }}>
            By day
          </h2>
          <ol className="load-days" aria-label="Planned minutes per day">
            {load.map((d) => (
              <li key={d.key} className="load-day">
                <div className="load-day-head">
                  <span className={d.key === today ? 'today-label' : undefined}>{formatDayLabel(d.key)}</span>
                  <span className="muted">{d.totalMinutes > 0 ? formatDuration(d.totalMinutes) : 'Nothing planned'}</span>
                </div>
                <div className="load-bar" role="img" aria-label={`${formatDayLabel(d.key)}: ${formatDuration(d.totalMinutes)} planned`}>
                  {Object.entries(d.bySplit).map(([splitId, minutes]) => (
                    <span
                      key={splitId}
                      className="load-seg"
                      style={{ width: `${(minutes / scale) * 100}%`, ...splitStyle(splitById.get(splitId)) }}
                      title={`${splitById.get(splitId)?.name ?? 'Split'}: ${formatDuration(minutes)}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {heavyDays.length > 0 && (
            <p className="heavy-note" role="note">
              {heavyDays.length === 1 ? 'One day looks heavy' : `${heavyDays.length} days look heavy`}:{' '}
              {heavyDays.map((d) => formatDayLabel(d.key)).join(', ')}. Over six hours planned. Moving one block to a
              lighter day may help.
            </p>
          )}
        </>
      )}
    </section>
  )
}
