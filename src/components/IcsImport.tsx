import { useState, type ChangeEvent } from 'react'
import { parseIcs } from '../domain/ics'
import { itemFromQuickAdd } from '../domain/items'
import type { Split } from '../domain/types'
import type { Repo } from '../storage/repo'

type Props = {
  repo: Repo | null
  splits: Split[]
}

export function IcsImport({ repo, splits }: Props) {
  const [status, setStatus] = useState<string | null>(null)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !repo) return
    const { events, skipped } = parseIcs(await file.text())
    for (const ev of events) {
      await repo.putItem(
        itemFromQuickAdd(
          { title: ev.title, kind: 'homework', startsAt: ev.startsAt, endsAt: ev.endsAt, summary: '' },
          splits,
        ),
      )
    }
    const skippedNote = skipped > 0 ? `, skipped ${skipped} without a start time` : ''
    setStatus(`Imported ${events.length} ${events.length === 1 ? 'event' : 'events'}${skippedNote}.`)
  }

  return (
    <div className="ics-import">
      <label className="link-btn">
        Import .ics
        <input type="file" accept=".ics,text/calendar" onChange={onFile} className="sr-only" />
      </label>
      <span className="hint" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
