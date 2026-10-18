# Toasted Almond: data model and component structure

## Stack

- Vite + React + TypeScript (PWA via manifest + service worker)
- IndexedDB via `idb` (all data local; no network dependency)
- Fonts self-hosted via `@fontsource-variable/newsreader` and `@fontsource-variable/public-sans` so they work offline
- Vitest + fake-indexeddb for tests

## Data model

Time is stored as epoch milliseconds (local-time semantics). Day keys are `YYYY-MM-DD` in local time.

```ts
type Split = {
  id: string
  name: string
  color: string          // hex from the palette or a derived tint
  order: number
  archived: boolean
}

type ItemKind = 'homework' | 'test' | 'project' | 'tournament' | 'club'

type Subtask = { id: string; title: string; done: boolean }

type Recurrence = {
  freq: 'daily' | 'weekly' | 'monthly'
  interval: number
  byWeekday?: number[]   // 0 = Sunday, used for weekly
  until?: string         // YYYY-MM-DD
}

type ItemBase = {
  id: string
  splitId: string
  title: string
  notes: string
  priority: 0 | 1 | 2 | 3
  subtasks: Subtask[]
  dueAt?: number         // deadline
  startsAt?: number      // fixed-time event (tests, club meetings, classes)
  endsAt?: number
  completed: boolean
  completedAt?: number
  completedOccurrences: string[] // day keys for completed recurring occurrences
  recurrence?: Recurrence
  createdAt: number
  updatedAt: number
}

type Item = ItemBase & (
  | { kind: 'homework'; className: string; estimateMin: number }
  | { kind: 'test'; topics: string[] }
  | { kind: 'project'; milestones: Milestone[] }
  | { kind: 'tournament'; startDate: string; endDate: string; location: string;
      packing: Subtask[]; rounds: { id: string; label: string; notes: string }[] }
  | { kind: 'club'; meetingTodos: Record<string, Subtask[]> } // keyed by day key
)

type Milestone = { id: string; title: string; dueAt?: number; done: boolean; subtasks: Subtask[] }

// Scheduled work block: a time range on the calendar linked to an item.
type WorkBlock = {
  id: string
  itemId: string
  subtaskId?: string
  start: number
  end: number
}
```

Stores (IndexedDB v1): `splits` (keyPath id), `items` (keyPath id, index `splitId`), `blocks` (keyPath id, index `start`), `meta` (keyPath key; holds `seeded`, UI prefs go to localStorage).

Recurring items are expanded at read time (`occurrencesInRange`). Completion of a recurring occurrence is recorded per day key, so completing one class meeting doesn't close the series.

## Domain rules

- Due section (Today): items with `dueAt` on the day or overdue and open. Items with `startsAt` are timeline events, not due entries, so tests do not appear twice.
- Busy time: fixed events plus work blocks. Free gaps are the complement inside the day window (08:00 to 22:00), keeping gaps of at least 15 minutes.
- Overload (Load view, next): planned hours per split per week = sum of block durations; flag days above a threshold.
- Quick add: `chem test fri 3pm #tests` parses into a split, kind, date, and time. Tests become fixed events (`startsAt`); other kinds get `dueAt`.

## Component structure

```
src/
  domain/        pure logic, no React or IndexedDB
    types.ts       model above
    palette.ts     palette tokens, default splits, derived tints
    color.ts       contrast helpers (used by tests)
    dates.ts       day keys, week ranges, occurrence expansion, gap computation
    quickAdd.ts    natural-language shorthand parser
  storage/       IndexedDB access
    db.ts          idb schema and open
    repo.ts        CRUD for splits, items, blocks; change notifications
    seed.ts        first-open seed data (relative to today)
    transfer.ts    JSON export / import (merge by id)
  state/
    useData.ts     hook loading splits/items/blocks and re-rendering on change
    useShortcuts.ts keyboard shortcuts
    prefs.ts       view, hidden splits, theme (localStorage)
  components/
    AppShell.tsx   top bar, view nav, quick add trigger
    NavTabs.tsx    Today / Week / Month / Splits / Load
    SplitFilter.tsx one-tap split chips (show/hide)
    QuickAdd.tsx   input for shorthand, shows parse preview
    ItemRow.tsx    checkbox, title, split marker, due label
    SplitMarker.tsx colored dot with ring (non-text contrast)
    EmptyState.tsx
    Dialog.tsx     accessible modal
  views/
    TodayView.tsx  due list, timeline (events, blocks, gaps)
    WeekView.tsx   due strip, time grid, unscheduled tray
    MonthView.tsx  (next)
    SplitsView.tsx (next: per-split pages, split management)
    LoadView.tsx   (next)
```

## Build order

1. Domain, storage, seed, shell, filters, quick add, shortcuts (this step).
2. Today and Week views (this step).
3. Month view, Splits pages and split management, Load view.
4. Backward planning templates for tests and tournaments, project milestones UI, tournament packing and rounds, club meeting to-dos.
5. ICS and Google Calendar import, rotating A/B schedule, recurring classes UI.
6. PWA polish: install prompt, update prompt, offline verification.
