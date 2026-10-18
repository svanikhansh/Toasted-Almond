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

/** Completed and total sub-tasks. Projects count sub-tasks across all milestones. */
export function subtaskCounts(item: Item): { done: number; total: number } | null {
  const subs = item.kind === 'project' ? item.milestones.flatMap((m) => m.subtasks) : item.subtasks
  if (!subs.length) return null
  return { done: subs.filter((s) => s.done).length, total: subs.length }
}

export function subtaskProgress(item: Item): string | null {
  const counts = subtaskCounts(item)
  return counts ? `${counts.done}/${counts.total} done` : null
}

type ItemRowProps = {
  item: Item
  /** Title shown for this occurrence, when it differs from the item's title. */
  title?: string
  split: Split | undefined
  /** Day key used for recurring completion. */
  dateKey: string
  done: boolean
  overdue?: boolean
  extraMeta?: string
  onToggle: (item: Item, dateKey: string) => void
  onOpen: (item: Item, occurrenceKey?: string) => void
}

/** Small marker for recurring items. Drawn in the current text color. */
export function RepeatMark() {
  return (
    <svg className="repeat-mark" width="12" height="12" viewBox="0 0 16 16" role="img" aria-label="Repeats">
      <path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2v3h-3M4 14v-3h3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function ItemRow({ item, title, split, dateKey, done, overdue, extraMeta, onToggle, onOpen }: ItemRowProps) {
  const shownTitle = title ?? item.title
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
        aria-label={`Mark "${shownTitle}" ${done ? 'not done' : 'done'}`}
      />
      <div style={{ minWidth: 0 }}>
        <button type="button" className={`item-title${done ? ' done' : ''}`} onClick={() => onOpen(item, dateKey)}>
          {shownTitle}
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
          {item.recurrence && <RepeatMark />}
        </div>
        {item.kind === 'project' && subtaskCounts(item) && (
          <progress
            className="subtask-progress"
            max={subtaskCounts(item)!.total}
            value={subtaskCounts(item)!.done}
            aria-label={`${item.title} progress`}
            style={{ accentColor: split?.color ?? 'var(--ink-muted)' }}
          />
        )}
      </div>
    </li>
  )
}
