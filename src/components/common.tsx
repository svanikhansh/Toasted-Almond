import type { CSSProperties, ReactNode } from 'react'
import { dayKey, formatTime, formatDayLabel } from '../domain/dates'
import type { Item, ItemKind, Split } from '../domain/types'

export const KIND_LABEL: Record<ItemKind, string> = {
  homework: 'Homework',
  test: 'Test',
  project: 'Project',
  tournament: 'Tournament',
  club: 'Club',
}

const PRIORITY_LABEL = ['', 'Low', 'Medium', 'High'] as const

export function SplitMarker({ color }: { color: string }) {
  return <span className="marker" style={{ background: color }} aria-hidden="true" />
}

export function splitStyle(split: Split | undefined): CSSProperties {
  return { ['--split' as string]: split?.color ?? 'var(--ink-muted)' }
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <h3>{title}</h3>
      {children && <p style={{ margin: 0, maxWidth: '52ch' }}>{children}</p>}
    </div>
  )
}

/** Human due label: time for today, weekday and date otherwise. */
export function dueLabel(item: Item): string | null {
  if (item.dueAt == null) return null
  const key = dayKey(item.dueAt)
  const today = dayKey()
  const hasTime = new Date(item.dueAt).getHours() * 60 + new Date(item.dueAt).getMinutes() !== 23 * 60 + 59
  const when = key === today ? 'Today' : formatDayLabel(key)
  return hasTime ? `${when}, ${formatTime(item.dueAt)}` : `${when}`
}

export function subtaskProgress(item: Item): string | null {
  const subs =
    item.kind === 'project'
      ? item.milestones.flatMap((m) => m.subtasks)
      : item.subtasks
  if (!subs.length) return null
  const done = subs.filter((s) => s.done).length
  return `${done}/${subs.length} done`
}

type ItemRowProps = {
  item: Item
  split: Split | undefined
  /** Day key used for recurring completion. */
  dateKey: string
  done: boolean
  overdue?: boolean
  extraMeta?: string
  onToggle: (item: Item, dateKey: string) => void
  onOpen: (item: Item) => void
}

export function ItemRow({ item, split, dateKey, done, overdue, extraMeta, onToggle, onOpen }: ItemRowProps) {
  const meta = [
    KIND_LABEL[item.kind],
    item.kind === 'homework' && item.className ? item.className : null,
    item.kind === 'homework' && item.estimateMin > 0 ? `${item.estimateMin} min` : null,
    item.priority >= 1 ? PRIORITY_LABEL[item.priority] : null,
    subtaskProgress(item),
    extraMeta ?? null,
  ].filter(Boolean)
  const due = dueLabel(item)

  return (
    <li className={`item-row${overdue ? ' overdue' : ''}`} style={splitStyle(split)}>
      <input
        type="checkbox"
        className="check"
        checked={done}
        onChange={() => onToggle(item, dateKey)}
        aria-label={`Mark "${item.title}" ${done ? 'not done' : 'done'}`}
      />
      <div style={{ minWidth: 0 }}>
        <button type="button" className={`item-title${done ? ' done' : ''}`} onClick={() => onOpen(item)}>
          {item.title}
        </button>
        <div className="item-meta">
          {split && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SplitMarker color={split.color} />
              {split.name}
            </span>
          )}
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
          {due && <span className={overdue ? 'overdue-label' : undefined}>{overdue ? `Overdue, ${due}` : `Due ${due}`}</span>}
        </div>
      </div>
    </li>
  )
}
