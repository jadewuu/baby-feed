'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Baby, Check, Edit2, LayoutGrid, Plus, Trash2, X } from 'lucide-react'
import { useLocalData } from '@/components/LocalDataProvider'
import LocalDataSettings from '@/components/LocalDataSettings'
import { createBaby, deleteBaby, updateBaby } from '@/lib/local-store/babies'
import type { LocalBaby } from '@/lib/local-store/schema'

type BabyFormMode = 'add' | 'edit' | null

export default function Settings() {
  const { babies, activeBabyId, commit, selectBaby } = useLocalData()
  const [formMode, setFormMode] = useState<BabyFormMode>(null)
  const [editingBaby, setEditingBaby] = useState<LocalBaby | null>(null)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('FEMALE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const closeForm = () => {
    if (saving) return
    setFormMode(null)
    setEditingBaby(null)
    setName('')
    setBirthDate('')
    setGender('FEMALE')
    setError('')
  }

  const openAdd = () => {
    closeForm()
    setFormMode('add')
  }

  const openEdit = (baby: LocalBaby) => {
    setEditingBaby(baby)
    setName(baby.name)
    setBirthDate(baby.birthDate.slice(0, 10))
    setGender(baby.gender)
    setError('')
    setFormMode('edit')
  }

  const saveBaby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      if (formMode === 'edit' && editingBaby) {
        await commit(() => updateBaby(editingBaby.id, { name, birthDate, gender }))
        setFeedback('宝宝信息已更新')
      } else {
        await commit(() => createBaby({ name, birthDate, gender }))
        setFeedback('宝宝已添加')
      }
      setSaving(false)
      closeForm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
      setSaving(false)
    }
  }

  const removeBaby = async (baby: LocalBaby) => {
    if (!window.confirm(`确定删除“${baby.name}”吗？该宝宝的全部记录也会被永久删除。`)) return
    setFeedback('')
    try {
      await commit(() => deleteBaby(baby.id))
      setFeedback('宝宝及相关记录已删除')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '删除失败，请重试')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-4 md:pb-4">
      {feedback && <p className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white" role="status">{feedback}</p>}

      <section className="rounded-3xl border border-blue-50 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">宝宝管理</h1>
            <p className="mt-1 text-sm text-slate-500">当前宝宝会用于首页、时间轴和统计。</p>
          </div>
          <button type="button" onClick={openAdd} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
            <Plus size={18} />添加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {babies.map(baby => {
            const active = baby.id === activeBabyId
            return (
              <article key={baby.id} className={`rounded-2xl border p-4 ${active ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600"><Baby size={20} /></div>
                  <button type="button" onClick={() => void selectBaby(baby.id)} className="min-h-11 min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold text-slate-900">{baby.name}</span>
                    <span className="block text-xs text-slate-500">{baby.birthDate.slice(0, 10)} · {baby.gender === 'FEMALE' ? '女宝宝' : '男宝宝'}</span>
                  </button>
                  {active && <span className="flex items-center gap-1 text-xs font-semibold text-blue-700"><Check size={15} />当前</span>}
                  <button type="button" onClick={() => openEdit(baby)} aria-label={`编辑${baby.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-white"><Edit2 size={18} /></button>
                  <button type="button" onClick={() => void removeBaby(baby)} aria-label={`删除${baby.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <Link href="/settings/quick-records" className="flex min-h-16 items-center gap-3 rounded-3xl border border-blue-50 bg-white px-5 shadow-sm">
        <LayoutGrid className="text-blue-600" />
        <span className="flex-1"><span className="block font-semibold text-slate-900">快捷记录</span><span className="block text-sm text-slate-500">选择并调整首页快捷入口</span></span>
      </Link>

      <LocalDataSettings />

      {formMode && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) closeForm() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="baby-form-title" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 id="baby-form-title" className="text-lg font-bold text-slate-900">{formMode === 'edit' ? '编辑宝宝' : '添加宝宝'}</h2>
              <button type="button" onClick={closeForm} aria-label="关闭" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"><X /></button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={saveBaby}>
              <label className="block text-sm font-medium text-slate-700">姓名<input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base" value={name} onChange={event => setName(event.target.value)} required /></label>
              <label className="block text-sm font-medium text-slate-700">出生日期<input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base" type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} required /></label>
              <label className="block text-sm font-medium text-slate-700">性别<select className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base" value={gender} onChange={event => setGender(event.target.value as 'MALE' | 'FEMALE')}><option value="FEMALE">女宝宝</option><option value="MALE">男宝宝</option></select></label>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <button type="submit" disabled={saving} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-60">{saving ? '正在保存' : '保存'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
