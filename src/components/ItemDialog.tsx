import { useEffect, useRef, useState, type FormEvent } from 'react'
import { anchorKey, atMinute, dayKey, formatDayLabel, parseDayKey } from '../domain/dates'
import { toggleDone } from '../domain/items'
import { buildRecurrence, repeatOf, usesWeekdays, type EndMode, type Repeat } from '../domain/series'
import type { Item, Split } from '../domain/types'
import type { Repo } from '../storage/repo'
import { KIND_LABEL } from './common'

type Props = {
  item: Item | null
  /** Day key of the occurrence that was opened, if any. */
  occurrenceKey?: string
  splits: Split[]
  repo: Repo | null
  onClose: () => void
}

const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweeklyA', label: 'Every other week, A weeks' },
  { value: 'biweeklyB', label: 'Every other week, B weeks' },
  { value: 'monthly', label: 'Monthly, same date' },
]

/** Monday first. Values match Date.getDay(), where 0 is Sunday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function ItemDialog({ item, occurrenceKey, splits, repo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (item && !el.open) el.showModal()
    if (!item && el.open) el.close()
  }, [item])

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="item-dialog-title">
      {item && (
        <ItemForm
          key={`${item.id}-${occurrenceKey ?? ''}`}
          item={item}
          occurrenceKey={occurrenceKey}
          splits={splits}
          repo={repo}
          onClose={() => ref.current?.close()}
        />
      )}
    </dialog>
  )
}

function ItemForm({
  item,
  occurrenceKey,
  splits,
  repo,
  onClose,
}: {
  item: Item
  occurrenceKey?: string
  splits: Split[]
  repo: Repo | null
  onClose: () => void
}) {
  const rec = item.recurrence
  const seriesDay = anchorKey(item)
  const isSeries = rec != null
  const [scope, setScope] = useState<'occurrence' | 'all'>(isSeries && occurrenceKey ? 'occurrence' : 'all')
  const occ = isSeries && occurrenceKey != null && scope === 'occurrence'
  const dayForTitle = occ ? occurrenceKey : undefined

  const [title, setTitle] = useState(
    dayForTitle ? (item.occurrenceTitles?.[dayForTitle] ?? item.title) : item.title,
  )
  const [splitId, setSplitId] = useState(item.splitId)
  const [due, setDue] = useState(item.dueAt != null ? dayKey(item.dueAt) : '')
  const [notes, setNotes] = useState(item.notes)
  const [priority, setPriority] = useState(item.priority)
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(rec))
  const [weekdays, setWeekdays] = useState<number[]>(
    rec?.byWeekday?.length ? rec.byWeekday : [parseDayKey(seriesDay).getDay()],
  )
  const [ends, setEnds] = useState<EndMode>(rec?.count ? 'count' : rec?.until ? 'until' : 'never')
  const [until, setUntil] = useState(rec?.until ?? '')
  const [count, setCount] = useState(rec?.count ?? 10)
  const [error, setError] = useState<string | null>(null)

  const splitAnchor = splits.find((s) => s.id === splitId)?.rotationAnchor
  const needsAnchor = repeat === 'biweeklyA' || repeat === 'biweeklyB'
  const doneNow = isSeries ? item.completedOccurrences.includes(occurrenceKey ?? dayKey()) : item.completed

  const toggleWeekday = (day: number) => {
    setWeekdays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!repo || !title.trim()) return

    if (occ && dayForTitle) {
      // A single occurrence can only change its title.
      const occurrenceTitles = { ...(item.occurrenceTitles ?? {}) }
      const next = title.trim()
      if (next === item.title) delete occurrenceTitles[dayForTitle]
      else occurrenceTitles[dayForTitle] = next
      await repo.putItem({ ...item, occurrenceTitles, updatedAt: Date.now() })
      onClose()
      return
    }

    if (usesWeekdays(repeat) && weekdays.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    if (ends === 'count' && count < 1) {
      setError('Enter how many occurrences the series has.')
      return
    }
    if (ends === 'until' && until && until < seriesDay) {
      setError('The end date is before the first occurrence.')
      return
    }

    const previousDay = item.dueAt != null ? dayKey(item.dueAt) : ''
    const dueAt = due
      ? due === previousDay && item.dueAt != null
        ? item.dueAt
        : atMinute(due, 23 * 60 + 59)
      : undefined
    await repo.putItem({
      ...item,
      title: title.trim(),
      splitId,
      notes,
      priority,
      dueAt,
      recurrence: buildRecurrence(repeat, weekdays, ends, until, count),
      updatedAt: Date.now(),
    })
    onClose()
  }

  const complete = async () => {
    if (!repo) return
    await repo.putItem(toggleDone(item, occurrenceKey ?? dayKey()))
    onClose()
  }

  const remove = async () => {
    if (!repo) return
    if (occ && occurrenceKey) {
      if (!window.confirm(`Remove ${formatDayLabel(occurrenceKey)} from "${item.title}"? Other occurrences stay.`)) return
      await repo.putItem({
        ...item,
        skippedOccurrences: [...(item.skippedOccurrences ?? []), occurrenceKey],
        updatedAt: Date.now(),
      })
    } else {
      const message = isSeries
        ? `Delete all occurrences of "${item.title}" and its scheduled blocks?`
        : `Delete "${item.title}" and its scheduled blocks?`
      if (!window.confirm(message)) return
      await repo.deleteItem(item.id)
    }
    onClose()
  }

  return (
    <form onSubmit={save}>
      <h2 id="item-dialog-title" style={{ fontSize: 24, marginBottom: 2 }}>
        Edit {KIND_LABEL[item.kind].toLowerCase()}
      </h2>
      <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
        Kind-specific fields are added in the Splits pages.
      </p>

      {isSeries && occurrenceKey && (
        <fieldset className="scope-row" style={{ border: 0, padding: 0, margin: '0 0 12px', minWidth: 0 }}>
          <legend className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Apply changes to
          </legend>
          <label>
            <input type="radio" name="scope" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />
            This occurrence, {formatDayLabel(occurrenceKey)}
          </label>
          <label>
            <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
            All occurrences
          </label>
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="item-title">Title</label>
        <input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <fieldset className="plain-fieldset" disabled={occ}>
        <div className="field">
          <label htmlFor="item-split">Split</label>
          <select id="item-split" value={splitId} onChange={(e) => setSplitId(e.target.value)}>
            {splits
              .filter((s) => !s.archived || s.id === item.splitId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="item-due">Due date</label>
          <input id="item-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="item-priority">Priority</label>
          <select
            id="item-priority"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as Item['priority'])}
          >
            <option value={0}>None</option>
            <option value={1}>Low</option>
            <option value={2}>Medium</option>
            <option value={3}>High</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="item-repeat">Repeat</label>
          <select id="item-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {usesWeekdays(repeat) && (
          <div className="weekday-row" role="group" aria-label="Weekdays">
            {WEEKDAY_ORDER.map((day) => (
              <label key={day}>
                <input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                {WEEKDAY_LABEL[day]}
              </label>
            ))}
          </div>
        )}

        {repeat !== 'none' && (
          <>
            <div className="field">
              <label htmlFor="item-ends">Ends</label>
              <select id="item-ends" value={ends} onChange={(e) => setEnds(e.target.value as EndMode)}>
                <option value="never">Never</option>
                <option value="until">On a date</option>
                <option value="count">After a number of occurrences</option>
              </select>
            </div>
            {ends === 'until' && (
              <div className="field">
                <label htmlFor="item-until">End date</label>
                <input id="item-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            )}
            {ends === 'count' && (
              <div className="field">
                <label htmlFor="item-count">Occurrences</label>
                <input
                  id="item-count"
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
                />
              </div>
            )}
            {needsAnchor && (
              <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                {splitAnchor
                  ? 'A and B weeks follow this split\u2019s A-week date.'
                  : 'This split has no A-week date yet. Set one in Splits so A and B weeks line up.'}
              </p>
            )}
          </>
        )}

        <div className="field">
          <label htmlFor="item-notes">Notes</label>
          <textarea id="item-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </fieldset>

      {error && (
        <p role="alert" style={{ fontSize: 13, margin: '0 0 8px' }}>
          {error}
        </p>
      )}

      <div className="dialog-actions">
        <button type="button" className="btn btn-danger btn-ghost" onClick={remove}>
          {occ ? 'Remove occurrence' : 'Delete'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={complete}>
            {doneNow ? 'Reopen' : 'Complete'}
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </div>
    </form>
  )
}
