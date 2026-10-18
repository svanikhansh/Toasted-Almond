import { useEffect, useRef, useState } from 'react'
import { dayKey, atMinute } from '../domain/dates'
import { toggleDone } from '../domain/items'
import type { Item, Split } from '../domain/types'
import type { Repo } from '../storage/repo'
import { KIND_LABEL } from './common'

type Props = {
  item: Item | null
  splits: Split[]
  repo: Repo | null
  onClose: () => void
}

export function ItemDialog({ item, splits, repo, onClose }: Props) {
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
        <ItemForm key={item.id} item={item} splits={splits} repo={repo} onClose={() => ref.current?.close()} />
      )}
    </dialog>
  )
}

function ItemForm({
  item,
  splits,
  repo,
  onClose,
}: {
  item: Item
  splits: Split[]
  repo: Repo | null
  onClose: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [splitId, setSplitId] = useState(item.splitId)
  const [due, setDue] = useState(item.dueAt != null ? dayKey(item.dueAt) : '')
  const [notes, setNotes] = useState(item.notes)
  const [priority, setPriority] = useState(item.priority)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repo || !title.trim()) return
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
      updatedAt: Date.now(),
    })
    onClose()
  }

  const complete = async () => {
    if (!repo) return
    await repo.putItem(toggleDone(item, dayKey()))
    onClose()
  }

  const remove = async () => {
    if (!repo) return
    if (!window.confirm(`Delete "${item.title}" and its scheduled blocks?`)) return
    await repo.deleteItem(item.id)
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

      <div className="field">
        <label htmlFor="item-title">Title</label>
        <input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
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
        <label htmlFor="item-notes">Notes</label>
        <textarea id="item-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn btn-danger btn-ghost" onClick={remove}>
          Delete
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={complete}>
            {item.completed ? 'Reopen' : 'Complete'}
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </div>
    </form>
  )
}
