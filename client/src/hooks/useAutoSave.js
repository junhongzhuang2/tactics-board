import { useEffect, useRef, useState } from 'react'
import { saveBoard } from '../api/boards'
import { nextRetryDelay, hasUnsavedChanges } from '../utils/saveStatus'

const DEBOUNCE_MS = 1000

// 封装自动保存编排：防抖 → 保存 → 失败退避重试 → beforeunload 守卫 → 竞态守卫
export function useAutoSave({ board, isDirty, markClean }) {
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTokenRef = useRef(0)   // 版本号：每次保存认领一个，旧的迟到回调作废
  const failureRef = useRef(0)     // 连续失败计数（退避用）
  const debounceRef = useRef(null)
  const retryRef = useRef(null)
  const boardRef = useRef(board)
  const markCleanRef = useRef(markClean)
  boardRef.current = board
  markCleanRef.current = markClean

  async function attemptSave() {
    const b = boardRef.current
    if (!b) return
    const token = ++saveTokenRef.current
    setSaveStatus('saving')
    try {
      await saveBoard(b.id, { data: b.data })
      if (token !== saveTokenRef.current) return // 竞态守卫：已有更新保存发出
      failureRef.current = 0
      markCleanRef.current()
      setSaveStatus('saved')
    } catch {
      if (token !== saveTokenRef.current) return // 竞态守卫：旧回调静默退出
      setSaveStatus('error')
      retryRef.current = setTimeout(attemptSave, nextRetryDelay(++failureRef.current))
    }
  }

  function retryNow() {
    if (retryRef.current) clearTimeout(retryRef.current)
    failureRef.current = 0 // 用户手动重试：有意重置退避升级（从 5s 重新开始）
    attemptSave()
  }

  // 脏 → 防抖 1s 后保存；新编辑重置防抖、清挂起重试、失败计数归零
  useEffect(() => {
    if (!isDirty || !board) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
    failureRef.current = 0
    debounceRef.current = setTimeout(attemptSave, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [board, isDirty])

  // 关页守卫：有未保存改动时弹原生提醒
  useEffect(() => {
    function onBeforeUnload(e) {
      if (hasUnsavedChanges(isDirty, saveStatus)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, saveStatus])

  // 卸载清理所有定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [])

  return { saveStatus, retryNow }
}
