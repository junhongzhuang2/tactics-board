// 退避延时：5s → 10s → 之后恒 30s。只要页面开着就一直试到成功。
export function nextRetryDelay(failureCount) {
  const table = [5000, 10000, 30000]
  return table[Math.min(failureCount - 1, table.length - 1)]
}

// 是否有未保存改动（用于 beforeunload 与状态显示）
export function hasUnsavedChanges(isDirty, saveStatus) {
  return isDirty || saveStatus === 'saving' || saveStatus === 'error'
}
