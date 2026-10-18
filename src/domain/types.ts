export type ItemKind = 'homework' | 'test' | 'project' | 'tournament' | 'club'

export type Split = {
  id: string
  name: string
  color: string
  order: number
  archived: boolean
}

export type Subtask = { id: string; title: string; done: boolean }

export type Milestone = {
  id: string
  title: string
  dueAt?: number
  done: boolean
  subtasks: Subtask[]
}

export type Recurrence = {
  freq: 'daily' | 'weekly' | 'monthly'
  interval: number
  /** 0 = Sunday. Used for weekly recurrences. */
  byWeekday?: number[]
  /** Last day key (YYYY-MM-DD) that can occur. */
  until?: string
}

export type ItemBase = {
  id: string
  splitId: string
  title: string
  notes: string
  priority: 0 | 1 | 2 | 3
  subtasks: Subtask[]
  /** Deadline. */
  dueAt?: number
  /** Fixed-time event start (tests, club meetings, classes). */
  startsAt?: number
  endsAt?: number
  completed: boolean
  completedAt?: number
  /** Day keys of completed recurring occurrences. */
  completedOccurrences: string[]
  recurrence?: Recurrence
  createdAt: number
  updatedAt: number
}

export type KindData =
  | { kind: 'homework'; className: string; estimateMin: number }
  | { kind: 'test'; topics: string[] }
  | { kind: 'project'; milestones: Milestone[] }
  | {
      kind: 'tournament'
      startDate: string
      endDate: string
      location: string
      packing: Subtask[]
      rounds: { id: string; label: string; notes: string }[]
    }
  | { kind: 'club'; meetingTodos: Record<string, Subtask[]> }

export type Item = ItemBase & KindData

/** A scheduled work block: a time range on the calendar linked to an item. */
export type WorkBlock = {
  id: string
  itemId: string
  subtaskId?: string
  start: number
  end: number
}

export type Priority = Item['priority']
