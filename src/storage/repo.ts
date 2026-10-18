import type { Item, Split, WorkBlock } from '../domain/types'
import { openDatabase, type Db } from './db'

export type Snapshot = { splits: Split[]; items: Item[]; blocks: WorkBlock[] }

export type Repo = {
  db: Db
  readAll(): Promise<Snapshot>
  putSplit(split: Split): Promise<void>
  putItem(item: Item): Promise<void>
  deleteItem(id: string): Promise<void>
  putBlock(block: WorkBlock): Promise<void>
  deleteBlock(id: string): Promise<void>
  getMeta(key: string): Promise<unknown>
  setMeta(key: string, value: unknown): Promise<void>
  /** Replace or merge records by id in one transaction. */
  importSnapshot(snapshot: Snapshot): Promise<void>
  subscribe(listener: () => void): () => void
}

export async function createRepo(db?: Db): Promise<Repo> {
  const database = db ?? (await openDatabase())
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  const write = async (fn: () => Promise<void>) => {
    await fn()
    notify()
  }

  return {
    db: database,

    async readAll() {
      const [splits, items, blocks] = await Promise.all([
        database.getAll('splits'),
        database.getAll('items'),
        database.getAll('blocks'),
      ])
      return {
        splits: splits.sort((a, b) => a.order - b.order),
        items,
        blocks: blocks.sort((a, b) => a.start - b.start),
      }
    },

    putSplit: (split) => write(async () => { await database.put('splits', split) }),
    putItem: (item) => write(async () => { await database.put('items', item) }),
    deleteItem: (id) =>
      write(async () => {
        const tx = database.transaction(['items', 'blocks'], 'readwrite')
        await tx.objectStore('items').delete(id)
        const blockStore = tx.objectStore('blocks')
        for (const block of await blockStore.getAll()) {
          if (block.itemId === id) await blockStore.delete(block.id)
        }
        await tx.done
      }),
    putBlock: (block) => write(async () => { await database.put('blocks', block) }),
    deleteBlock: (id) => write(async () => { await database.delete('blocks', id) }),

    async getMeta(key) {
      return (await database.get('meta', key))?.value
    },
    setMeta: (key, value) => write(async () => { await database.put('meta', { key, value }) }),

    importSnapshot: (snapshot) =>
      write(async () => {
        const tx = database.transaction(['splits', 'items', 'blocks'], 'readwrite')
        for (const s of snapshot.splits) await tx.objectStore('splits').put(s)
        for (const i of snapshot.items) await tx.objectStore('items').put(i)
        for (const b of snapshot.blocks) await tx.objectStore('blocks').put(b)
        await tx.done
      }),

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
