'use client'

import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import Stats with SSR disabled to avoid hydration mismatch
// caused by recharts' internal @loadable/component Suspense boundary
const Stats = dynamic(() => import('@/components/Stats'), {
  ssr: false,
  loading: () => (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </div>
  ),
})

export default function StatsPageClient() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const defaultTab = (tabParam === 'memos' || tabParam === 'insights') ? tabParam : 'dashboard'

  return <Stats defaultTab={defaultTab} />
}
