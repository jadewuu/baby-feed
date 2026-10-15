'use client'

import { useState, type FormEvent } from 'react'
import { Baby, Loader2 } from 'lucide-react'
import { useLocalData } from '@/components/LocalDataProvider'
import { createBaby } from '@/lib/local-store/babies'

export function FirstRunSetup() {
  const { commit } = useLocalData()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('FEMALE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await commit(() => createBaby({ name, birthDate, gender }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-5 py-10">
      <section className="mx-auto max-w-md rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Baby aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">先添加宝宝</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          所有记录只保存在这台设备的浏览器中，不会上传到服务器。请定期在设置里导出备份。
        </p>

        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            宝宝姓名
            <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={name} onChange={event => setName(event.target.value)} autoComplete="off" required />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            出生日期
            <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} required />
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">性别</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([['FEMALE', '女宝宝'], ['MALE', '男宝宝']] as const).map(([value, label]) => (
                <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium ${gender === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}>
                  <input className="sr-only" type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" size={18} aria-hidden="true" />}
            {saving ? '正在保存' : '开始记录'}
          </button>
        </form>
      </section>
    </main>
  )
}
