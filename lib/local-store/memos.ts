import { openBabyFeedDb } from './db.ts'
import { LocalStoreError, toLocalStoreError } from './errors.ts'
import { STORE_NAMES, type LocalMemo, type MemoInput, type MemoPatch } from './schema.ts'

function assertMemoFields(title: string, scheduledAt: string) {
  if (!title.trim()) throw new LocalStoreError('validation', '请输入备忘标题')
  if (Number.isNaN(Date.parse(scheduledAt))) throw new LocalStoreError('validation', '备忘时间格式不正确')
}

export async function listMemos(
  babyId: string,
  status?: 'pending' | 'completed',
): Promise<LocalMemo[]> {
  const db = await openBabyFeedDb()
  if (status) {
    const range = IDBKeyRange.bound([babyId, status, ''], [babyId, status, '\uffff'])
    return db.getAllFromIndex(STORE_NAMES.memos, 'by-baby-status-time', range)
  }
  const range = IDBKeyRange.bound([babyId, ''], [babyId, '\uffff'])
  return db.getAllFromIndex(STORE_NAMES.memos, 'by-baby-time', range)
}

export async function createMemo(input: MemoInput): Promise<LocalMemo> {
  assertMemoFields(input.title, input.scheduledAt)
  const now = new Date().toISOString()
  const memo: LocalMemo = {
    ...input,
    title: input.title.trim(),
    content: input.content?.trim() || null,
    id: crypto.randomUUID(),
    completed: false,
    status: 'pending',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  try {
    const db = await openBabyFeedDb()
    const transaction = db.transaction([STORE_NAMES.babies, STORE_NAMES.memos], 'readwrite')
    if (!(await transaction.objectStore(STORE_NAMES.babies).get(input.babyId))) {
      transaction.abort()
      throw new LocalStoreError('validation', '宝宝不存在')
    }
    await transaction.objectStore(STORE_NAMES.memos).add(memo)
    await transaction.done
    return memo
  } catch (error) {
    throw toLocalStoreError(error, '备忘保存失败，请重试')
  }
}

export async function updateMemo(id: string, babyId: string, patch: MemoPatch): Promise<LocalMemo> {
  try {
    const db = await openBabyFeedDb()
    const existing = await db.get(STORE_NAMES.memos, id)
    if (!existing || existing.babyId !== babyId) throw new LocalStoreError('validation', '备忘不存在')
    const title = patch.title === undefined ? existing.title : patch.title.trim()
    const scheduledAt = patch.scheduledAt ?? existing.scheduledAt
    assertMemoFields(title, scheduledAt)
    const completed = patch.completed ?? existing.completed
    const now = new Date().toISOString()
    const updated: LocalMemo = {
      ...existing,
      ...patch,
      title,
      content: patch.content === undefined ? existing.content : patch.content?.trim() || null,
      scheduledAt,
      completed,
      status: completed ? 'completed' : 'pending',
      completedAt: completed ? (existing.completedAt ?? now) : null,
      updatedAt: now,
    }
    await db.put(STORE_NAMES.memos, updated)
    return updated
  } catch (error) {
    throw toLocalStoreError(error, '备忘更新失败，请重试')
  }
}

export async function deleteMemo(id: string, babyId: string): Promise<void> {
  try {
    const db = await openBabyFeedDb()
    const existing = await db.get(STORE_NAMES.memos, id)
    if (!existing || existing.babyId !== babyId) throw new LocalStoreError('validation', '备忘不存在')
    await db.delete(STORE_NAMES.memos, id)
  } catch (error) {
    throw toLocalStoreError(error, '备忘删除失败，请重试')
  }
}
