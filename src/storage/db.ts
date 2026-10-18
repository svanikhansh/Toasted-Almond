import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Item, Split, WorkBlock } from '../domain/types'

export const DB_NAME = 'toasted-almond'
export const DB_VERSION = 1

export type MetaValue = { key: string; value: unknown }

export interface AlmondDB extends DBSchema {
  splits: { key: string; value: Split }
  items: { key: string; value: Item; indexes: { bySplit: string } }
  blocks: { key: string; value: WorkBlock; indexes: { byStart: number } }
  meta: { key: string; value: MetaValue }
}

export type Db = IDBPDatabase<AlmondDB>

export function openDatabase(name = DB_NAME): Promise<Db> {
  return openDB<AlmondDB>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('splits', { keyPath: 'id' })
      const items = db.createObjectStore('items', { keyPath: 'id' })
      items.createIndex('bySplit', 'splitId')
      const blocks = db.createObjectStore('blocks', { keyPath: 'id' })
      blocks.createIndex('byStart', 'start')
      db.createObjectStore('meta', { keyPath: 'key' })
    },
  })
}
