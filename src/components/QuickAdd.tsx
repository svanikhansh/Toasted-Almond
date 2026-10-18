import { forwardRef, useMemo, useState, type FormEvent } from 'react'
import { itemFromQuickAdd } from '../domain/items'
import { parseQuickAdd } from '../domain/quickAdd'
import type { Repo } from '../storage/repo'
import type { Split } from '../domain/types'

type Props = {
  repo: Repo | null
  splits: Split[]
}

export const QuickAdd = forwardRef<HTMLInputElement, Props>(function QuickAdd({ repo, splits }, ref) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => (text.trim() ? parseQuickAdd(text, splits) : null), [text, splits])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!repo) return
    const parsed = parseQuickAdd(text, splits)
    if (!parsed) {
      setError('Add a title, for example "chem test fri 3pm #tests".')
      return
    }
    await repo.putItem(itemFromQuickAdd(parsed, splits))
    setText('')
    setError(null)
  }

  const hint = error ?? (preview ? `Adds: ${preview.title}, ${preview.summary}` : 'Try "chem test fri 3pm #tests"')

  return (
    <form className="quick-add" onSubmit={submit} role="search" aria-label="Quick add">
      <label htmlFor="quick-add-input" className="sr-only">
        Quick add. Example: chem test fri 3pm #tests. Press Enter to add.
      </label>
      <input
        id="quick-add-input"
        ref={ref}
        type="text"
        value={text}
        placeholder="Quick add (n)"
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        aria-describedby="quick-add-hint"
        aria-invalid={error ? true : undefined}
      />
      <div id="quick-add-hint" className="hint" aria-live="polite">
        {hint}
      </div>
    </form>
  )
})
