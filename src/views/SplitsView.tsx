import { useMemo, useState, type FormEvent } from 'react'
import { atMinute, dayKey, formatDayLabel } from '../domain/dates'
import { itemFromQuickAdd, toggleDone } from '../domain/items'
import { SPLIT_SWATCHES } from '../domain/palette'
import { backwardPlan, defaultPrepTemplates, prepTemplatesFor, studyPlan, type PrepTemplate } from '../domain/planning'
import type { Item, ItemKind, Split } from '../domain/types'
import type { Repo } from '../storage/repo'
import { EmptyState, ItemRow, KIND_LABEL, SplitMarker, splitStyle } from '../components/common'

const KINDS: ItemKind[] = ['homework', 'test', 'project', 'tournament', 'club']
const DEFAULT_START_MIN = 9 * 60
const TEST_MINUTES = 90 * 60_000

type DraftPrep = PrepTemplate & { checked: boolean }

/** Day-by-day topic plan for an upcoming test with topics. */
function StudyPlanCard({ item, todayKey }: { item: Item; todayKey: string }) {
  if (item.kind !== 'test' || item.startsAt == null || item.topics.length === 0) return null
  const steps = studyPlan(item.startsAt, item.topics, todayKey)
  if (steps.length === 0) return null
  return (
    <section style={{ marginTop: 16 }} aria-label={`Study plan for ${item.title}`}>
      <h3>Study plan: {item.title}</h3>
      <ul className="list">
        {steps.map((s, i) => (
          <li key={`${s.topic}-${i}`} className="item-meta">
            {formatDayLabel(s.dayKey)}: {s.topic}
          </li>
        ))}
      </ul>
    </section>
  )
}

type PrepDraft = { test: PrepTemplate[]; tournament: PrepTemplate[] }

/** Editable prep templates for one split. Saved on demand, and used by new items in that split. */
function PrepTemplateEditor({ split, repo }: { split: Split; repo: Repo | null }) {
  const [draft, setDraft] = useState<PrepDraft>(() => ({
    test: prepTemplatesFor(split, 'test'),
    tournament: prepTemplatesFor(split, 'tournament'),
  }))
  const [status, setStatus] = useState('')

  const update = (kind: keyof PrepDraft, list: PrepTemplate[]) => {
    setDraft((d) => ({ ...d, [kind]: list }))
    setStatus('')
  }

  const save = async () => {
    if (!repo) return
    const clean = (list: PrepTemplate[]) =>
      list.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim() }))
    await repo.putSplit({
      ...split,
      prepTemplates: { test: clean(draft.test), tournament: clean(draft.tournament) },
    })
    setStatus(`Saved prep templates for ${split.name}.`)
  }

  const sections: { kind: keyof PrepDraft; label: string }[] = [
    { kind: 'test', label: 'Test' },
    { kind: 'tournament', label: 'Tournament' },
  ]

  return (
    <details style={{ marginTop: 32 }}>
      <summary>Prep templates for {split.name}</summary>
      <p className="muted" style={{ marginTop: 8 }}>
        Counted back from the test or tournament date. New items in this split start with these tasks.
      </p>
      {sections.map(({ kind, label }) => (
        <fieldset key={kind} className="prep" style={{ marginTop: 12 }}>
          <legend>{label}</legend>
          {draft[kind].map((t, index) => (
            <div key={t.id} className="prep-row">
              <input
                aria-label={`${label} prep task ${index + 1} title`}
                value={t.title}
                onChange={(e) =>
                  update(kind, draft[kind].map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
                }
              />
              <input
                aria-label={`${label} prep task ${index + 1} days before`}
                type="number"
                min={0}
                step={1}
                value={t.daysBefore}
                onChange={(e) =>
                  update(
                    kind,
                    draft[kind].map((x, i) =>
                      i === index ? { ...x, daysBefore: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="btn"
                aria-label={`Remove ${label} prep task ${index + 1}`}
                onClick={() => update(kind, draft[kind].filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => update(kind, [...draft[kind], { id: crypto.randomUUID(), title: '', daysBefore: 1 }])}
          >
            Add task
          </button>
        </fieldset>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!repo}>
          Save templates
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDraft({ test: defaultPrepTemplates('test'), tournament: defaultPrepTemplates('tournament') })
            setStatus('')
          }}
        >
          Reset to defaults
        </button>
      </div>
      <p role="status" aria-live="polite" className="muted">
        {status}
      </p>
    </details>
  )
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
  onOpen: (item: Item, occurrenceKey?: string) => void
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

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const rowMeta = (item: Item) => {
    const parent = item.prepFor ? itemById.get(item.prepFor) : undefined
    return [kindMeta(item), parent ? `Prep for ${parent.title}` : ''].filter(Boolean).join(' · ')
  }

  const splitItems = useMemo(() => (selected ? items.filter((i) => i.splitId === selected.id) : []), [items, selected])
  const open = splitItems
    .filter((i) => !i.completed)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  const done = splitItems.filter((i) => i.completed)
  const now = Date.now()

  const chooseKind = (k: ItemKind) => {
    setKind(k)
    setPrep(prepTemplatesFor(selected, k).map((t) => ({ ...t, checked: true })))
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
      await repo.putItem({
        ...itemFromQuickAdd(
          { title: step.title, kind: 'homework', splitId: selected.id, dueAt: step.dueAt, summary: '' },
          splits,
          created,
        ),
        prepFor: item.id,
      })
    }
    setMessage(
      `Added "${item.title}"${steps.length ? ` with ${steps.length} prep ${steps.length === 1 ? 'task' : 'tasks'}` : ''}.`,
    )
    setTitle('')
    setPrep(prepTemplatesFor(selected, kind).map((t) => ({ ...t, checked: true })))
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

                {(kind === 'test' || kind === 'tournament') && (
                  <fieldset className="prep">
                    <legend>Prep plan, counted back from the date</legend>
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
                          <input
                            aria-label={`Prep task ${index + 1} days before`}
                            type="number"
                            min={0}
                            step={1}
                            value={p.daysBefore}
                            onChange={(e) =>
                              setPrep((list) =>
                                list.map((x, i) =>
                                  i === index ? { ...x, daysBefore: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x,
                                ),
                              )
                            }
                          />
                          <span className="muted prep-due">{formatDayLabel(due)}</span>
                          <button
                            type="button"
                            className="btn"
                            aria-label={`Remove prep task ${index + 1}`}
                            onClick={() => setPrep((list) => list.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setPrep((list) => [...list, { id: crypto.randomUUID(), title: '', daysBefore: 1, checked: true }])}
                    >
                      Add prep task
                    </button>
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
                      extraMeta={rowMeta(item)}
                      onToggle={(it) => repo?.putItem(toggleDone(it, today))}
                      onOpen={(item) => onOpen(item)}
                    />
                  ))}
                </ul>
              )}

              {open.map((item) => (
                <StudyPlanCard key={`plan-${item.id}`} item={item} todayKey={today} />
              ))}

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
                        extraMeta={rowMeta(item)}
                        onToggle={(it) => repo?.putItem(toggleDone(it, today))}
                        onOpen={(item) => onOpen(item)}
                      />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {selected && <PrepTemplateEditor key={selected.id} split={selected} repo={repo} />}

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
            <div className="field">
              <label htmlFor={`rotation-${s.id}`}>A-week date</label>
              <input
                id={`rotation-${s.id}`}
                type="date"
                value={s.rotationAnchor ?? ''}
                onChange={(e) => repo?.putSplit({ ...s, rotationAnchor: e.target.value || undefined })}
              />
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
