import { useCallback, useEffect, useState } from 'react'

export type View = 'today' | 'week' | 'month' | 'splits' | 'load'
export type Theme = 'light' | 'dark' | 'system'

export type Prefs = {
  view: View
  hiddenSplits: string[]
  theme: Theme
}

const KEY = 'toasted-almond:prefs'
const DEFAULTS: Prefs = { view: 'today', hiddenSplits: [], theme: 'system' }

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Storage may be full or disabled; preferences just won't persist.
    }
  }, [prefs])

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        prefs.theme === 'dark' ||
        (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [prefs.theme])

  const setView = useCallback((view: View) => setPrefs((p) => ({ ...p, view })), [])
  const setTheme = useCallback((theme: Theme) => setPrefs((p) => ({ ...p, theme })), [])
  const toggleSplit = useCallback(
    (id: string) =>
      setPrefs((p) => ({
        ...p,
        hiddenSplits: p.hiddenSplits.includes(id)
          ? p.hiddenSplits.filter((x) => x !== id)
          : [...p.hiddenSplits, id],
      })),
    [],
  )

  return { prefs, setView, setTheme, toggleSplit }
}
