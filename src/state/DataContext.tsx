import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createRepo, type Repo, type Snapshot } from '../storage/repo'
import { seedIfEmpty } from '../storage/seed'

type DataState = {
  ready: boolean
  error: string | null
  repo: Repo | null
  snapshot: Snapshot
}

const EMPTY: Snapshot = { splits: [], items: [], blocks: [] }

const DataContext = createContext<DataState>({ ready: false, error: null, repo: null, snapshot: EMPTY })

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    ready: false,
    error: null,
    repo: null,
    snapshot: EMPTY,
  })

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    ;(async () => {
      try {
        const repo = await createRepo()
        await seedIfEmpty(repo)
        const load = async () => {
          const snapshot = await repo.readAll()
          if (!cancelled) setState({ ready: true, error: null, repo, snapshot })
        }
        unsubscribe = repo.subscribe(() => void load())
        await load()
      } catch (err) {
        if (!cancelled) {
          setState({
            ready: true,
            error: err instanceof Error ? err.message : 'Storage is unavailable.',
            repo: null,
            snapshot: EMPTY,
          })
        }
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return <DataContext.Provider value={state}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  return useContext(DataContext)
}
