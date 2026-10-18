export type ItemKind = 'homework' | 'test' | 'project' | 'tournament' | 'club'

/** A prep task counted back from a test or tournament date. */
export type PrepTemplate = { id: string; title: string; daysBefore: number }

export type Split = {
  id: string
  name: string
  color: string
  order: number
  archived: boolean
  /** Any day in an A week. Weeks alternate A and B from this week. */
  rotationAnchor?: string
  /** Per-kind prep templates. Unset kinds use the built-in defaults. */
  prepTemplates?: { test?: PrepTemplate[]; tournament?: PrepTemplate[] }
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
  /** Total scheduled occurrences, counting skipped ones. */
  count?: number
  /** Only occur in A or B weeks of the split's rotation. Unset means every week. */
  rotation?: 'A' | 'B'
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
  /** Day keys of recurring occurrences removed from the series. */
  skippedOccurrences?: string[]
  /** Title overrides for single occurrences, keyed by day key. */
  occurrenceTitles?: Record<string, string>
  recurrence?: Recurrence
  /** Id of the test or tournament this prep task was generated for. */
  prepFor?: string
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
