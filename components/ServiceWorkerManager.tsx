'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/base-path'

export default function ServiceWorkerManager() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    const handleControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    void navigator.serviceWorker.register(withBasePath('/sw.js')).then(registration => {
      if (registration.waiting) setWaitingWorker(registration.waiting)

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') setWaitingWorker(installing)
        })
      })
    }).catch(error => {
      console.error('Service worker registration failed:', error)
    })

    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }, [])

  if (!waitingWorker) return null

  return (
    <aside className="fixed inset-x-3 top-4 z-[100] mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-slate-950 px-4 py-3 text-white shadow-2xl" role="status" aria-live="polite">
      <div>
        <p className="text-sm font-semibold">Baby Feed 已准备好更新</p>
        <p className="mt-0.5 text-xs text-slate-300">刷新后即可使用最新的离线版本。</p>
      </div>
      <button
        className="min-h-11 shrink-0 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900"
        type="button"
        onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
      >
        立即更新
      </button>
    </aside>
  )
}
