'use client'

import { FirstRunSetup } from './FirstRunSetup'
import { LocalDataProvider, useLocalData } from './LocalDataProvider'
import Navbar from './Navbar'
import { CopyToastProvider } from './CopyToast'
import { RecordComposerProvider } from './RecordComposerProvider'

function LocalAppShell({ children }: { children: React.ReactNode }) {
  const { status, error, refresh } = useLocalData()

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50" aria-live="polite">
        <p className="text-sm text-slate-500">正在读取本地数据…</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
        <section className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">本地数据无法打开</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 font-medium text-white" type="button" onClick={() => void refresh()}>
            重试
          </button>
        </section>
      </main>
    )
  }

  if (status === 'needs-setup') return <FirstRunSetup />

  return (
    <CopyToastProvider>
      <RecordComposerProvider>
        <Navbar />
        <main className="min-h-screen bg-gray-50 pb-safe-tabbar md:pb-0">
          {children}
        </main>
      </RecordComposerProvider>
    </CopyToastProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocalDataProvider>
      <LocalAppShell>{children}</LocalAppShell>
    </LocalDataProvider>
  )
}
