export type LocalStoreErrorCode = 'validation' | 'constraint' | 'quota' | 'transaction'

export class LocalStoreError extends Error {
  readonly code: LocalStoreErrorCode

  constructor(
    code: LocalStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'LocalStoreError'
    this.code = code
  }
}

export function toLocalStoreError(error: unknown, fallback: string): LocalStoreError {
  if (error instanceof LocalStoreError) return error
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new LocalStoreError('quota', '设备存储空间不足，请先导出备份并释放空间', { cause: error })
  }
  if (error instanceof DOMException && error.name === 'ConstraintError') {
    return new LocalStoreError('constraint', '记录与现有数据冲突', { cause: error })
  }
  return new LocalStoreError('transaction', fallback, { cause: error })
}
