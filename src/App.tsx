import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { DataProvider, useData } from './state/DataContext'
import { usePrefs, type View } from './state/prefs'
import { dayKey, addDays } from './domain/dates'
import type { Item } from './domain/types'
import { IcsImport } from './components/IcsImport'
import { QuickAdd } from './components/QuickAdd'
import { ItemDialog } from './components/ItemDialog'
import { EmptyState, splitStyle } from './components/common'
import { TodayView } from './views/TodayView'
import { WeekView } from './views/WeekView'
import { MonthView } from './views/MonthView'
import { SplitsView } from './views/SplitsView'
import { LoadView } from './views/LoadView'
import { exportData, importData } from './storage/transfer'

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: 'today', label: 'Today', key: 't' },
  { id: 'week', label: 'Week', key: 'w' },
  { id: 'month', label: 'Month', key: 'm' },
  { id: 'splits', label: 'Splits', key: 'p' },
  { id: 'load', label: 'Load', key: 'l' },
]

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}

function Shell() {
  const { ready, error, repo, snapshot } = useData()
  const { prefs, setView, setTheme, toggleSplit } = usePrefs()
  const [date, setDate] = useState(() => dayKey())
  const [editing, setEditing] = useState<Item | null>(null)
  const [editingKey, setEditingKey] = useState<string | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const quickAddRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const activeSplits = useMemo(() => snapshot.splits.filter((s) => !s.archived), [snapshot.splits])
  const hidden = useMemo(() => new Set(prefs.hiddenSplits), [prefs.hiddenSplits])

  const visibleItems = useMemo(
    () => snapshot.items.filter((i) => activeSplits.some((s) => s.id === i.splitId) && !hidden.has(i.splitId)),
    [snapshot.items, activeSplits, hidden],
  )
  const visibleIds = useMemo(() => new Set(visibleItems.map((i) => i.id)), [visibleItems])
  const visibleBlocks = useMemo(
    () => snapshot.blocks.filter((b) => visibleIds.has(b.itemId)),
    [snapshot.blocks, visibleIds],
  )

  const openItem = useCallback((item: Item, occurrenceKey?: string) => {
    setEditing(item)
    setEditingKey(occurrenceKey)
    setDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setEditing(null)
    setEditingKey(undefined)
  }, [])

  // Keyboard shortcuts: n = quick add, t/w/m/p/l = views, [ and ] = previous/next period.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target) || dialogOpen) return
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        quickAddRef.current?.focus()
        return
      }
      if (key === 'x') {
        const row = document.activeElement?.closest('.item-row')
        const check = row?.querySelector<HTMLInputElement>('input.check')
        if (check) {
          e.preventDefault()
          check.click()
        }
        return
      }
      const view = VIEWS.find((v) => v.key === key)
      if (view) {
        setView(view.id)
        return
      }
      if (e.key === '[' || e.key === ']') {
        const step = prefs.view === 'week' ? 7 : 1
        setDate((d) => addDays(d, e.key === '[' ? -step : step))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogOpen, prefs.view, setView])

  const exportAll = async () => {
    if (!repo) return
    const data = await exportData(repo)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `toasted-almond-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice('Exported your data.')
  }

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !repo) return
    try {
      const result = await importData(repo, await file.text())
      setNotice(`Imported ${result.items} items.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'That file could not be imported.')
    }
  }

  if (!ready) {
    return (
      <div className="app-loading" role="status">
        Opening your almond…
      </div>
    )
  }

  if (error || !repo) {
    return (
      <div className="page">
        <EmptyState title="Storage is unavailable.">
          {error ?? 'This browser blocked local storage. Try a regular window instead of a private one.'}
        </EmptyState>
      </div>
    )
  }

  const hiddenCount = prefs.hiddenSplits.length

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="topbar">
        <div className="brand">Toasted Almond</div>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {VIEWS.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="nav-btn"
                  aria-current={prefs.view === v.id ? 'page' : undefined}
                  onClick={() => setView(v.id)}
                  title={`${v.label} (${v.key.toUpperCase()})`}
                >
                  {v.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="toolbar">
        <QuickAdd ref={quickAddRef} repo={repo} splits={activeSplits} />
        <IcsImport repo={repo} splits={activeSplits} />
      </div>

      <div className="filters" role="group" aria-label="Show splits">
        <span className="filters-label">Splits</span>
        {activeSplits.map((s) => {
          const on = !hidden.has(s.id)
          return (
            <button
              key={s.id}
              type="button"
              className="filter-chip"
              aria-pressed={on}
              style={splitStyle(s)}
              onClick={() => toggleSplit(s.id)}
            >
              <span className="filter-dot" aria-hidden="true" />
              {s.name}
              <span className="sr-only">{on ? ', shown' : ', hidden'}</span>
            </button>
          )
        })}
        {hiddenCount > 0 && (
          <button type="button" className="link-btn" onClick={() => activeSplits.forEach((s) => hidden.has(s.id) && toggleSplit(s.id))}>
            Show all
          </button>
        )}
      </div>

      <main id="main" className="page">
        {prefs.view === 'today' && (
          <TodayView date={date} items={visibleItems} blocks={visibleBlocks} splits={activeSplits} repo={repo} onOpen={openItem} />
        )}
        {prefs.view === 'week' && (
          <WeekView
            date={date}
            onDateChange={setDate}
            items={visibleItems}
            blocks={visibleBlocks}
            splits={activeSplits}
            repo={repo}
            onOpen={openItem}
          />
        )}
        {prefs.view === 'month' && (
          <MonthView date={date} onDateChange={setDate} items={visibleItems} splits={activeSplits} onOpen={openItem} />
        )}
        {prefs.view === 'splits' && (
          <SplitsView splits={snapshot.splits} items={snapshot.items} repo={repo} onOpen={openItem} />
        )}
        {prefs.view === 'load' && (
          <LoadView date={date} onDateChange={setDate} items={visibleItems} blocks={visibleBlocks} splits={activeSplits} />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-group">
          <label htmlFor="theme-select">Theme</label>
          <select id="theme-select" value={prefs.theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="footer-group">
          <button type="button" className="btn" onClick={exportAll}>
            Export data
          </button>
          <button type="button" className="btn" onClick={() => importRef.current?.click()}>
            Import data
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import a Toasted Almond export file"
            onChange={importFile}
          />
        </div>
        <p className="shortcuts muted" aria-label="Keyboard shortcuts">
          N quick add, T W M P L switch views, [ ] previous or next, X completes the focused task
        </p>
        <p role="status" aria-live="polite" className="muted">
          {notice}
        </p>
      </footer>

      {dialogOpen && (
        <ItemDialog
          item={editing}
          occurrenceKey={editingKey}
          splits={activeSplits}
          repo={repo}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}
