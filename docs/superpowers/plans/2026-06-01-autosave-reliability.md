# 自动保存可靠性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让自动保存在断网时不再静默丢失：失败有反馈、退避自动重试 + 手动重试、关页提醒，并用版本号守卫防止迟到的旧请求覆盖新状态。

**Architecture:** 把保存编排抽成 `useAutoSave({ board, isDirty, markClean })` hook（防抖 → try/catch 保存 → 失败退避重试 → beforeunload 守卫 → saveTokenRef 竞态守卫），对外暴露 `{ saveStatus, retryNow }`。退避延时与「未保存」判定抽成纯函数。BoardCanvas 删掉内联保存 effect，改用 hook 并据 saveStatus 渲染状态栏 + 重试按钮。store 不变。

**Tech Stack:** React 18 (hooks), Vite 5, Vitest + @testing-library/react（`renderHook`、`vi.useFakeTimers`、`vi.advanceTimersByTimeAsync`、`vi.mock`；globals 已开）。

---

## File Structure

- **Create** `client/src/utils/saveStatus.js` — 纯函数 `nextRetryDelay(failureCount)`、`hasUnsavedChanges(isDirty, saveStatus)`。
- **Create** `client/src/utils/saveStatus.test.js`。
- **Create** `client/src/hooks/useAutoSave.js` — 保存编排 hook。
- **Create** `client/src/hooks/useAutoSave.test.js` — 假定时器 + mock api 的 hook 测试（含竞态守卫）。
- **Modify** `client/src/components/BoardCanvas.jsx` — 删内联保存 effect，接 `useAutoSave`，渲染 saveStatus 指示 + 立即重试按钮。

> 无数据库迁移；无 store 改动。

---

## Task 1: 纯函数 `saveStatus.js`

**Files:**
- Create: `client/src/utils/saveStatus.js`
- Test: `client/src/utils/saveStatus.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/utils/saveStatus.test.js`：
```js
import { nextRetryDelay, hasUnsavedChanges } from './saveStatus'

test('nextRetryDelay backs off 5s, 10s, then caps at 30s', () => {
  expect(nextRetryDelay(1)).toBe(5000)
  expect(nextRetryDelay(2)).toBe(10000)
  expect(nextRetryDelay(3)).toBe(30000)
  expect(nextRetryDelay(5)).toBe(30000)
})

test('hasUnsavedChanges true while saving, error, or dirty; false when clean+saved', () => {
  expect(hasUnsavedChanges(false, 'saved')).toBe(false)
  expect(hasUnsavedChanges(false, 'saving')).toBe(true)
  expect(hasUnsavedChanges(false, 'error')).toBe(true)
  expect(hasUnsavedChanges(true, 'saved')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/utils/saveStatus.test.js`
Expected: FAIL（找不到 `./saveStatus`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/utils/saveStatus.js`：
```js
// 退避延时：5s → 10s → 之后恒 30s。只要页面开着就一直试到成功。
export function nextRetryDelay(failureCount) {
  const table = [5000, 10000, 30000]
  return table[Math.min(failureCount - 1, table.length - 1)]
}

// 是否有未保存改动（用于 beforeunload 与状态显示）
export function hasUnsavedChanges(isDirty, saveStatus) {
  return isDirty || saveStatus === 'saving' || saveStatus === 'error'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/utils/saveStatus.test.js`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/saveStatus.js client/src/utils/saveStatus.test.js
git commit -m "feat: saveStatus pure helpers (retry backoff, unsaved predicate)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: `useAutoSave` hook

**Files:**
- Create: `client/src/hooks/useAutoSave.js`
- Test: `client/src/hooks/useAutoSave.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/hooks/useAutoSave.test.js`：
```js
import { act, renderHook } from '@testing-library/react'
import { useAutoSave } from './useAutoSave'
import * as api from '../api/boards'

vi.mock('../api/boards', () => ({ saveBoard: vi.fn() }))

const board = { id: 'b1', data: { x: 1 } }

beforeEach(() => {
  vi.useFakeTimers()
  api.saveBoard.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

test('saves after the 1s debounce, marks clean, status saved', async () => {
  api.saveBoard.mockResolvedValue()
  const markClean = vi.fn()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(api.saveBoard).toHaveBeenCalledWith('b1', { data: { x: 1 } })
  expect(markClean).toHaveBeenCalledTimes(1)
  expect(result.current.saveStatus).toBe('saved')
})

test('on failure goes to error then auto-retries after backoff', async () => {
  api.saveBoard.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce()
  const markClean = vi.fn()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) }) // first attempt fails
  expect(api.saveBoard).toHaveBeenCalledTimes(1)
  expect(result.current.saveStatus).toBe('error')
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) // retry after 5s succeeds
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')
  expect(markClean).toHaveBeenCalledTimes(1)
})

test('retryNow triggers an immediate save', async () => {
  api.saveBoard.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean: vi.fn() }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.saveStatus).toBe('error')
  await act(async () => { result.current.retryNow(); await vi.advanceTimersByTimeAsync(0) })
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')
})

test('a late stale response does not overwrite newer state (race guard)', async () => {
  let resolveFirst
  api.saveBoard
    .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res })) // first hangs
    .mockResolvedValueOnce() // second resolves
  const markClean = vi.fn()
  const { result, rerender } = renderHook(
    ({ b }) => useAutoSave({ board: b, isDirty: true, markClean }),
    { initialProps: { b: board } }
  )
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) }) // first attempt starts, hangs
  expect(result.current.saveStatus).toBe('saving')

  const board2 = { id: 'b1', data: { x: 2 } } // new edit → new board ref
  rerender({ b: board2 })
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) }) // second attempt starts + resolves
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')

  markClean.mockClear()
  await act(async () => { resolveFirst(); await Promise.resolve() }) // first (stale) finally resolves
  expect(markClean).not.toHaveBeenCalled()   // stale callback ignored
  expect(result.current.saveStatus).toBe('saved')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/hooks/useAutoSave.test.js`
Expected: FAIL（找不到 `./useAutoSave`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/hooks/useAutoSave.js`：
```js
import { useEffect, useRef, useState } from 'react'
import { saveBoard } from '../api/boards'
import { nextRetryDelay, hasUnsavedChanges } from '../utils/saveStatus'

const DEBOUNCE_MS = 1000

// 封装自动保存编排：防抖 → 保存 → 失败退避重试 → beforeunload 守卫 → 竞态守卫
export function useAutoSave({ board, isDirty, markClean }) {
  const [saveStatus, setSaveStatus] = useState('saved')
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
    failureRef.current = 0
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/hooks/useAutoSave.test.js`
Expected: PASS（4 个测试，含竞态守卫）。然后全套 `cd client; npx vitest run`。

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useAutoSave.js client/src/hooks/useAutoSave.test.js
git commit -m "feat: useAutoSave hook with backoff retry and race guard"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: 接入 BoardCanvas

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

- [ ] **Step 1: Swap imports**

在 `client/src/components/BoardCanvas.jsx` 顶部：删除 `import { saveBoard } from '../api/boards'`（不再直接用），新增：
```js
import { useAutoSave } from '../hooks/useAutoSave'
```

- [ ] **Step 2: Replace the inline auto-save effect with the hook**

把这段内联自动保存 effect 整段删除：
```js
  // Auto-save 1 second after any dirty change
  useEffect(() => {
    if (!isDirty || !board) return
    const timer = setTimeout(async () => {
      await saveBoard(board.id, { data: board.data })
      markClean()
    }, 1000)
    return () => clearTimeout(timer)
  }, [isDirty, board, markClean])
```
替换为（放在 `usePlaybackEngine()` 之后、`selectedPlayerId` 状态附近即可）：
```js
  const { saveStatus, retryNow } = useAutoSave({ board, isDirty, markClean })
```
（`markClean` 仍从 store 解构，现在传给 hook；`isDirty`/`board` 同。）

- [ ] **Step 3: Replace the top-bar save indicator**

把顶栏里这一行：
```js
        {isDirty && <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>}
```
替换为按 `saveStatus` 显示的三态指示 + 失败时的「立即重试」按钮：
```js
        {board && saveStatus === 'saving' && (
          <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>
        )}
        {board && saveStatus === 'saved' && (
          <span style={{ fontSize: 12, color: '#888' }}>已保存</span>
        )}
        {board && saveStatus === 'error' && (
          <span style={{ fontSize: 12, color: '#f5c518', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚠ 保存失败，重试中
            <button
              onClick={retryNow}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#2a2a3e', border: '1px solid #555', color: '#ccc', cursor: 'pointer' }}
            >
              立即重试
            </button>
          </span>
        )}
```

- [ ] **Step 4: Run full suite + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归）。
Run: `cd client; npx vite build`
Expected: 构建成功，无未用导入（确认 `saveBoard` 不再被 BoardCanvas 引用，内联 effect 已删）。

- [ ] **Step 5: Manual smoke test (browser)**

启动前后端，打开一个战术板：
- 拖球员 → 顶栏短暂「保存中…」→「已保存」。
- 打开浏览器 DevTools → Network → 勾 **Offline**，再拖球员：约 1 秒后顶栏显示「⚠ 保存失败，重试中」+「立即重试」。等约 5 秒它自动再试（仍失败保持 error）。
- 取消 Offline（恢复网络），点「立即重试」（或等下一次自动重试）→ 变「已保存」。
- 离线状态下尝试关闭/刷新标签页 → 浏览器弹原生「改动可能未保存」确认框；数据已保存时关闭则无提醒。

> 把结果反馈给我，尤其：离线时是否出现 error + 重试按钮、恢复后是否变「已保存」、未保存时关页是否提醒。

- [ ] **Step 6: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: wire useAutoSave into BoardCanvas with save status + retry button"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3 状态机三态与转移 → Task 2（attemptSave/scheduleRetry/retryNow/debounce）✅
- §4 `nextRetryDelay`/`hasUnsavedChanges` → Task 1 ✅
- §5 hook 行为：防抖、attemptSave、竞态守卫 saveTokenRef、单飞、beforeunload、卸载清理、新编辑清重试+归零 → Task 2 ✅
- §5 竞态守卫核心 → Task 2 实现 + 专门的 race-guard 测试 ✅
- §6 UI 三态 + 立即重试 + 删内联 effect → Task 3 ✅
- §7 测试：纯函数、hook（含竞态）、beforeunload 由 hasUnsavedChanges 覆盖 → Task 1/2 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码。

**3. Type consistency：** `nextRetryDelay`/`hasUnsavedChanges` 在 Task 1 定义、Task 2 hook 引用一致；`useAutoSave({ board, isDirty, markClean })` 返回 `{ saveStatus, retryNow }`，Task 2 定义、Task 3 消费一致；saveStatus 取值 `'saved'|'saving'|'error'` 三处一致。

**已知取舍：** beforeunload 的 window 接线与 BoardCanvas 的 Konva 渲染不写自动化测试——`hasUnsavedChanges` 纯函数覆盖判定，UI 与离线行为由 Task 3 Step 5 人工浏览器验证（DevTools Offline）。
