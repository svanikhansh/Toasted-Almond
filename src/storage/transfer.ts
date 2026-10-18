import type { Item, Split, WorkBlock } from '../domain/types'
import type { Repo, Snapshot } from './repo'

export const EXPORT_FORMAT = 'toasted-almond'
export const EXPORT_VERSION = 1

export type ExportFile = {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  splits: Split[]
  items: Item[]
  blocks: WorkBlock[]
}

export async function exportData(repo: Repo, now = new Date()): Promise<ExportFile> {
  const snap = await repo.readAll()
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    ...snap,
  }
}

/** Parse and validate an export file. Throws with a readable message on bad input. */
export function parseExport(text: string): Snapshot {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!data || typeof data !== 'object') throw new Error('This file has no data.')
  const f = data as Partial<ExportFile>
  if (f.format !== EXPORT_FORMAT) throw new Error('This file is not a Toasted Almond export.')
  if (typeof f.version !== 'number' || f.version > EXPORT_VERSION) {
    throw new Error('This export was made by a newer version of the app.')
  }
  if (!Array.isArray(f.splits) || !Array.isArray(f.items) || !Array.isArray(f.blocks)) {
    throw new Error('The export is missing splits, items, or blocks.')
  }
  return { splits: f.splits, items: f.items, blocks: f.blocks }
}

/** Import merges by id: existing records with the same id are overwritten. */
export async function importData(repo: Repo, text: string): Promise<{ items: number }> {
  const snap = parseExport(text)
  await repo.importSnapshot(snap)
  return { items: snap.items.length }
}
