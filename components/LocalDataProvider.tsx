'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { listBabies } from '@/lib/local-store/babies'
import { getSettings, setActiveBabyId } from '@/lib/local-store/settings'
import type { LocalBaby } from '@/lib/local-store/schema'

type LocalDataStatus = 'loading' | 'needs-setup' | 'ready' | 'error'

interface LocalDataContextValue {
  status: LocalDataStatus
  babies: LocalBaby[]
  activeBabyId: string | null
  revision: number
  error: string | null
  refresh(): Promise<void>
  commit<T>(write: () => Promise<T>): Promise<T>
  selectBaby(id: string): Promise<void>
}

const LocalDataContext = createContext<LocalDataContextValue | null>(null)

export function useLocalData() {
  const context = useContext(LocalDataContext)
  if (!context) throw new Error('useLocalData must be used within LocalDataProvider')
  return context
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocalDataStatus>('loading')
  const [babies, setBabies] = useState<LocalBaby[]>([])
  const [activeBabyId, setActiveBaby] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const [nextBabies, settings] = await Promise.all([listBabies(), getSettings()])
      const nextActiveBabyId = nextBabies.some(baby => baby.id === settings.activeBabyId)
        ? settings.activeBabyId
        : nextBabies[0]?.id ?? null

      if (nextActiveBabyId !== settings.activeBabyId) {
        await setActiveBabyId(nextActiveBabyId)
      }

      setBabies(nextBabies)
      setActiveBaby(nextActiveBabyId)
      setStatus(nextBabies.length === 0 ? 'needs-setup' : 'ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '本地数据加载失败')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const commit = useCallback(async <T,>(write: () => Promise<T>) => {
    const result = await write()
    setRevision(current => current + 1)
    await refresh()
    return result
  }, [refresh])

  const selectBaby = useCallback(async (id: string) => {
    await commit(() => setActiveBabyId(id))
  }, [commit])

  const value = useMemo<LocalDataContextValue>(() => ({
    status,
    babies,
    activeBabyId,
    revision,
    error,
    refresh,
    commit,
    selectBaby,
  }), [activeBabyId, babies, commit, error, refresh, revision, selectBaby, status])

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>
}
