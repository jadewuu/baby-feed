'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { AlertTriangle, Database, Download, Trash2, Upload } from 'lucide-react'
import { useLocalData } from '@/components/LocalDataProvider'
import {
  clearAllData,
  exportBackup,
  parseBackupText,
  restoreBackup,
  type ValidatedBackup,
} from '@/lib/local-store/backup'
import { getBeijingToday } from '@/lib/time'

function backupCounts(backup: ValidatedBackup) {
  return {
    babies: backup.data.babies.length,
    feedingRecords: backup.data.feedingRecords.length,
    healthRecords: backup.data.healthRecords.length,
    toothEruptions: backup.data.toothEruptions.length,
    memos: backup.data.memos.length,
  }
}

export default function LocalDataSettings() {
  const { commit } = useLocalData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<ValidatedBackup | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const downloadBackup = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `baby-feed-backup-${getBeijingToday()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setFeedback({ tone: 'success', text: '备份文件已导出' })
    } catch (cause) {
      setFeedback({ tone: 'error', text: cause instanceof Error ? cause.message : '导出失败，请重试' })
    } finally {
      setBusy(false)
    }
  }

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingBackup(null)
    setFeedback(null)
    try {
      const backup = parseBackupText(await file.text())
      setPendingBackup(backup)
    } catch (cause) {
      setFeedback({ tone: 'error', text: cause instanceof Error ? cause.message : '备份文件无效' })
    }
  }

  const confirmRestore = async () => {
    if (!pendingBackup || busy) return
    const counts = backupCounts(pendingBackup)
    if (!window.confirm(`恢复会覆盖当前设备上的全部数据。确认恢复 ${counts.babies} 个宝宝、${counts.feedingRecords + counts.healthRecords} 条记录和 ${counts.memos} 条备忘吗？`)) return
    setBusy(true)
    setFeedback(null)
    try {
      await commit(() => restoreBackup(pendingBackup))
      setPendingBackup(null)
      setFeedback({ tone: 'success', text: '备份已恢复' })
    } catch (cause) {
      setFeedback({ tone: 'error', text: cause instanceof Error ? cause.message : '恢复失败，请重试' })
    } finally {
      setBusy(false)
    }
  }

  const confirmClear = async () => {
    if (busy) return
    if (!window.confirm('确定清空这台设备上的全部 Baby Feed 数据吗？此操作无法撤销，请先导出备份。')) return
    setBusy(true)
    setFeedback(null)
    try {
      await commit(() => clearAllData())
    } catch (cause) {
      setFeedback({ tone: 'error', text: cause instanceof Error ? cause.message : '清空失败，请重试' })
      setBusy(false)
    }
  }

  const counts = pendingBackup ? backupCounts(pendingBackup) : null

  return (
    <section className="rounded-3xl border border-blue-50 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div>
          <h2 className="font-semibold">本机数据包含敏感数据</h2>
          <p className="mt-1 text-sm leading-6">数据只保存在当前浏览器。更换手机、清除网站数据或删除浏览器可能导致记录丢失，建议定期备份并妥善保管文件。</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2"><Database className="text-blue-600" /><h2 className="text-lg font-bold text-slate-900">数据管理</h2></div>

      {feedback && <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${feedback.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void downloadBackup()} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-60"><Download size={18} />导出备份</button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 font-semibold text-blue-700 disabled:opacity-60"><Upload size={18} />选择备份文件</button>
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={event => void chooseBackup(event)} />
      </div>

      {pendingBackup && counts && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-semibold text-slate-900">备份内容已验证</p>
          <p className="mt-1 text-sm text-slate-600">{counts.babies} 个宝宝 · {counts.feedingRecords} 条喂养 · {counts.healthRecords} 条健康 · {counts.toothEruptions} 颗牙位 · {counts.memos} 条备忘</p>
          <button type="button" onClick={() => void confirmRestore()} disabled={busy} className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">确认覆盖并恢复</button>
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="font-semibold text-red-700">清空全部本地数据</h3>
        <p className="mt-1 text-sm text-slate-500">清空完成后会返回首次设置页。</p>
        <button type="button" onClick={() => void confirmClear()} disabled={busy} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-60"><Trash2 size={18} />清空全部数据</button>
      </div>
    </section>
  )
}
