import { useMemo, useState, type FormEvent } from 'react'
import { atMinute, dayKey, formatDayLabel } from '../domain/dates'
import { itemFromQuickAdd, toggleDone } from '../domain/items'
import { SPLIT_SWATCHES } from '../domain/palette'
import { TEST_PREP, TOURNAMENT_PREP, backwardPlan, type PrepTemplate } from '../domain/planning'
import type { Item, ItemKind, Split } from '../domain/types'
import type { Repo } from '../storage/repo'
import { EmptyState, ItemRow, KIND_LABEL, SplitMarker, splitStyle } from '../components/common'

const KINDS: ItemKind[] = ['homework', 'test', 'project', 'tournament', 'club']
const DEFAULT_START_MIN = 9 * 60
const TEST_MINUTES = 90 * 60_000

type DraftPrep = PrepTemplate & { checked: boolean }

function templatesFor(kind: ItemKind): PrepTemplate[] {
  if (kind === 'test') return TEST_PREP
  if (kind === 'tournament') return TOURNAMENT_PREP
  return []
}

function kindMeta(item: Item): string {
  switch (item.kind) {
    case 'homework':
      return ''
    case 'test':
      return item.topics.length ? `${item.topics.length} topics` : 'No topics yet'
    case 'project':
      return item.milestones.length ? `${item.milestones.length} milestones` : 'No milestones yet'
    case 'tournament':
      return [item.startDate === item.endDate ? item.startDate : `${item.startDate} to ${item.endDate}`, item.location || null]
        .filter(Boolean)
        .join(' · ')
    case 'club':
      return `${Object.keys(item.meetingTodos).length} meetings with to-dos`
  }
}

type Props = {
  splits: Split[]
  items: Item[]
  repo: Repo | null
  onOpen: (item: Item) => void
}

export function SplitsView({ splits, items, repo, onOpen }: Props) {
  const today = dayKey()
  const sorted = useMemo(() => [...splits].sort((a, b) => a.order - b.order), [splits])
  const active = sorted.filter((s) => !s.archived)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const selected = active.find((s) => s.id === pickedId) ?? active[0] ?? null

  const [newSplitName, setNewSplitName] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ItemKind>('homework')
  const [date, setDate] = useState(today)
  const [prep, setPrep] = useState<DraftPrep[]>([])
  const [message, setMessage] = useState('')

  const splitItems = useMemo(() => (selected ? items.filter((i) => i.splitId === selected.id) : []), [items, selected])
  const open = splitItems
    .filter((i) => !i.completed)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  const done = splitItems.filter((i) => i.completed)
  const now = Date.now()

  const chooseKind = (k: ItemKind) => {
    setKind(k)
    setPrep(templatesFor(k).map((t) => ({ ...t, checked: true })))
  }

  const addSplit = async (e: FormEvent) => {
    e.preventDefault()
    const name = newSplitName.trim()
    if (!name || !repo) return
    const order = sorted.length ? Math.max(...sorted.map((s) => s.order)) + 1 : 0
    await repo.putSplit({
      id: crypto.randomUUID(),
      name,
      color: SPLIT_SWATCHES[sorted.length % SPLIT_SWATCHES.length],
      order,
      archived: false,
    })
    setNewSplitName('')
    setMessage(`Added split "${name}".`)
  }

  const move = async (split: Split, dir: -1 | 1) => {
    const index = sorted.indexOf(split)
    const other = sorted[index + dir]
    if (!other || !repo) return
    await repo.putSplit({ ...split, order: other.order })
    await repo.putSplit({ ...other, order: split.order })
  }

  const createItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!repo || !selected || !title.trim()) return
    const created = Date.now()
    const isTest = kind === 'test'
    const startsAt = isTest ? atMinute(date, DEFAULT_START_MIN) : undefined
    const dueAt = isTest ? undefined : atMinute(date, 23 * 60 + 59)
    const item = itemFromQuickAdd(
      {
        title: title.trim(),
        kind,
        splitId: selected.id,
        dueAt,
        startsAt,
        endsAt: startsAt != null ? startsAt + TEST_MINUTES : undefined,
        summary: '',
      },
      splits,
      created,
    )
    await repo.putItem(item)

    const steps = backwardPlan(date, prep.filter((p) => p.checked && p.title.trim()))
    for (const step of steps) {
      await repo.putItem(
        itemFromQuickAdd(
          { title: step.title, kind: 'homework', splitId: selected.id, dueAt: step.dueAt, summary: '' },
          splits,
          created,
        ),
      )
    }
    setMessage(
      `Added "${item.title}"${steps.length ? ` with ${steps.length} prep ${steps.length === 1 ? 'task' : 'tasks'}` : ''}.`,
    )
    setTitle('')
    setPrep(templatesFor(kind).map((t) => ({ ...t, checked: true })))
  }

  return (
    <section aria-labelledby="splits-heading">
      <h1 id="splits-heading" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>
        Splits
      </h1>

      {active.length === 0 ? (
        <EmptyState title="No active splits.">Add a split below to start filing work.</EmptyState>
      ) : (
        <>
          <div className="filters" role="group" aria-label="Choose a split" style={{ padding: 0, marginTop: 12 }}>
            {active.map((s) => (
              <button
                key={s.id}
                type="button"
                className="filter-chip"
                aria-pressed={s.id === selected?.id}
                style={splitStyle(s)}
                onClick={() => setPickedId(s.id)}
              >
                <span className="filter-dot" aria-hidden="true" />
                {s.name}
              </button>
            ))}
          </div>

          {selected && (
            <div style={{ marginTop: 24 }}>
              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SplitMarker color={selected.color} />
                {selected.name}
                <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>
                  {open.length} open · {done.length} done
                </span>
              </h2>

              <form className="split-form" onSubmit={createItem} aria-label={`Add to ${selected.name}`}>
                <div className="field">
                  <label htmlFor="new-title">Title</label>
                  <input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chem test, lab report" />
                </div>
                <div className="field">
                  <label htmlFor="new-kind">Type</label>
                  <select id="new-kind" value={kind} onChange={(e) => chooseKind(e.target.value as ItemKind)}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-date">{kind === 'test' ? 'Test date' : 'Due date'}</label>
                  <input id="new-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                {prep.length > 0 && (
                  <fieldset className="prep">
                    <legend>Prep plan, spaced backward from the date</legend>
                    {prep.map((p, index) => {
                      const due = dayKey(backwardPlan(date, [p])[0].dueAt)
                      return (
                        <div key={p.id} className="prep-row">
                          <input
                            id={`prep-${p.id}`}
                            type="checkbox"
                            checked={p.checked}
                            onChange={(e) =>
                              setPrep((list) => list.map((x, i) => (i === index ? { ...x, checked: e.target.checked } : x)))
                            }
                          />
                          <label htmlFor={`prep-${p.id}`} className="sr-only">
                            Include prep task
                          </label>
                          <input
                            aria-label={`Prep task ${index + 1} title`}
                            value={p.title}
                            onChange={(e) =>
                              setPrep((list) => list.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
                            }
                          />
                          <span className="muted prep-due">{formatDayLabel(due)}</span>
                        </div>
                      )
                    })}
                  </fieldset>
                )}

                <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                  Add {KIND_LABEL[kind].toLowerCase()}
                </button>
              </form>

              {open.length === 0 ? (
                <div style={{ marginTop: 16 }}>
                  <EmptyState title={`Nothing open in ${selected.name}.`}>
                    Add an item above, or use quick add with #{selected.name.toLowerCase()}.
                  </EmptyState>
                </div>
              ) : (
                <ul className="list" style={{ marginTop: 16 }}>
                  {open.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      split={selected}
                      dateKey={today}
                      done={item.completed}
                      overdue={item.dueAt != null && item.dueAt < now}
                      extraMeta={kindMeta(item)}
                      onToggle={(it) => repo?.putItem(toggleDone(it, today))}
                      onOpen={onOpen}
                    />
                  ))}
                </ul>
              )}

              {done.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary>Completed ({done.length})</summary>
                  <ul className="list">
                    {done.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        split={selected}
                        dateKey={today}
                        done
                        overdue={false}
                        extraMeta={kindMeta(item)}
                        onToggle={(it) => repo?.putItem(toggleDone(it, today))}
                        onOpen={onOpen}
                      />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}

      <h2 className="section-title" style={{ marginTop: 40 }}>
        Manage splits
      </h2>
      <ul className="list split-manage">
        {sorted.map((s, index) => (
          <li key={s.id} className="split-manage-row" style={splitStyle(s)}>
            <SplitMarker color={s.color} />
            <label className="sr-only" htmlFor={`name-${s.id}`}>
              Name
            </label>
            <input
              id={`name-${s.id}`}
              defaultValue={s.name}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== s.name) void repo?.putSplit({ ...s, name })
                else e.target.value = s.name
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            <div className="swatches" role="group" aria-label={`Color for ${s.name}`}>
              {SPLIT_SWATCHES.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  aria-label={`Color ${i + 1}`}
                  aria-pressed={c.toLowerCase() === s.color.toLowerCase()}
                  style={{ background: c }}
                  onClick={() => repo?.putSplit({ ...s, color: c })}
                />
              ))}
            </div>
            <div className="split-actions">
              <button type="button" className="btn" onClick={() => move(s, -1)} disabled={index === 0} aria-label={`Move ${s.name} up`}>
                Up
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => move(s, 1)}
                disabled={index === sorted.length - 1}
                aria-label={`Move ${s.name} down`}
              >
                Down
              </button>
              <button type="button" className="btn" onClick={() => repo?.putSplit({ ...s, archived: !s.archived })}>
                {s.archived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="split-form" onSubmit={addSplit} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="new-split">New split</label>
          <input id="new-split" value={newSplitName} onChange={(e) => setNewSplitName(e.target.value)} placeholder="Lab" />
        </div>
        <button type="submit" className="btn" disabled={!newSplitName.trim()}>
          Add split
        </button>
      </form>

      <p role="status" aria-live="polite" className="muted" style={{ marginTop: 12 }}>
        {message}
      </p>
    </section>
  )
}
