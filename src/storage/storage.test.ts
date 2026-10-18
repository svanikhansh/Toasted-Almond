import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRepo, type Repo } from './repo'
import { seedIfEmpty } from './seed'
import { exportData, importData, parseExport } from './transfer'
import { openDatabase } from './db'

let repo: Repo
let counter = 0

beforeEach(async () => {
  counter += 1
  repo = await createRepo(await openDatabase(`test-db-${counter}`))
})

describe('seeding', () => {
  it('seeds once and not again after data is cleared', async () => {
    expect(await seedIfEmpty(repo)).toBe(true)
    const snap = await repo.readAll()
    expect(snap.splits).toHaveLength(5)
    expect(snap.items.length).toBeGreaterThan(0)
    expect(snap.blocks.length).toBeGreaterThan(0)

    await repo.deleteItem(snap.items[0].id)
    expect(await seedIfEmpty(repo)).toBe(false)
    expect((await repo.readAll()).items.length).toBe(snap.items.length - 1)
  })
})

describe('repo', () => {
  it('deletes an item together with its work blocks', async () => {
    await seedIfEmpty(repo)
    const snap = await repo.readAll()
    const target = snap.blocks[0].itemId
    await repo.deleteItem(target)
    const after = await repo.readAll()
    expect(after.blocks.some((b) => b.itemId === target)).toBe(false)
    expect(after.items.some((i) => i.id === target)).toBe(false)
  })

  it('notifies subscribers on change', async () => {
    let calls = 0
    const unsub = repo.subscribe(() => calls++)
    await seedIfEmpty(repo)
    expect(calls).toBeGreaterThan(0)
    unsub()
  })
})

describe('export and import', () => {
  it('round-trips data through JSON', async () => {
    await seedIfEmpty(repo)
    const file = await exportData(repo)
    const text = JSON.stringify(file)

    const other = await createRepo(await openDatabase(`test-db-${counter}-b`))
    const result = await importData(other, text)
    expect(result.items).toBe(file.items.length)
    const restored = await other.readAll()
    expect(restored.items.map((i) => i.id).sort()).toEqual(file.items.map((i) => i.id).sort())
    expect(restored.blocks.length).toBe(file.blocks.length)
  })

  it('rejects files that are not Toasted Almond exports', () => {
    expect(() => parseExport('not json')).toThrow(/not valid JSON/)
    expect(() => parseExport(JSON.stringify({ format: 'other' }))).toThrow(/not a Toasted Almond/)
    expect(() =>
      parseExport(JSON.stringify({ format: 'toasted-almond', version: 1, splits: [] })),
    ).toThrow(/missing/)
    expect(() =>
      parseExport(
        JSON.stringify({ format: 'toasted-almond', version: 99, splits: [], items: [], blocks: [] }),
      ),
    ).toThrow(/newer version/)
  })
})
