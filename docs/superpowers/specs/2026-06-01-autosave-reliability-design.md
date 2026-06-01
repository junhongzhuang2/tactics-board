# 自动保存可靠性 设计文档

**日期：** 2026-06-01
**状态：** 已确认
**范围：** 修复自动保存断网静默丢失：失败反馈 + 退避重试 + 关页提醒 + 竞态守卫

---

## 1. 目标 / 问题

现状：`BoardCanvas` 的自动保存 effect 在 `setTimeout` 内 `await saveBoard(...)` 后 `markClean()`，无 `try/catch`。`saveBoard` 在网络失败或非 2xx 时抛错（fetch 网络错误会 reject）：
1. 异常被静默吞掉，`markClean` 不执行 → 顶栏一直显示「保存中…」（其实失败），无反馈。
2. effect 依赖 `[isDirty, board]`，失败后这两个不变 → **不自动重试**，要等下次编辑。
3. 关页即丢在途改动。

目标：失败有反馈、自动退避重试到成功、关页前提醒、并防异步竞态覆盖。

---

## 2. 方案

把整套保存编排抽成自定义 hook **`useAutoSave({ board, isDirty, markClean })`**（零依赖、可测）。退避延时与「未保存」判定抽成纯函数。store 保持纯净，BoardCanvas 只调用 hook 并渲染状态。

> 不采用「逻辑内联 BoardCanvas」（effect 变复杂、BoardCanvas 挂 Konva 难测）；不采用「搬进 store」（把网络/定时器塞进纯状态 store，概念变脏）。

---

## 3. 状态机 `saveStatus`

三态：
- `'saved'`：已持久化（含初始/无改动）。
- `'saving'`：一个保存请求在途。
- `'error'`：上次保存失败，重试已排队。

转移：
- 脏数据变化 →（防抖 1s）→ `saving`
- 保存成功 → `saved` + `markClean()` + failureCount 归零
- 保存失败 → `error` + 按 `nextRetryDelay(++failureCount)` 排重试
- 重试定时器触发 → `saving`（再试）
- 「立即重试」→ 取消重试定时器、failureCount 归零 → 立刻 `saving`
- 失败期间发生新编辑 → 走防抖路径、failureCount 归零（新数据视作新一轮）

---

## 4. 纯函数

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
放在新文件 `client/src/utils/saveStatus.js`，单测覆盖。

---

## 5. `useAutoSave` hook 行为

输入：`{ board, isDirty, markClean }`（board/isDirty 来自 store，markClean 是 store 动作）。
内部 ref/state：`saveStatus`（state）、`saveTokenRef`（版本号）、`failureRef`（连续失败计数）、`debounceRef`/`retryRef`（定时器句柄）。

核心 `attemptSave`：
```js
async function attemptSave() {
  if (!board) return
  const token = ++saveTokenRef.current   // 认领一个新版本
  setSaveStatus('saving')
  try {
    await saveBoard(board.id, { data: board.data })
    if (token !== saveTokenRef.current) return // 竞态守卫：已有更新保存发出，旧回调静默退出
    failureRef.current = 0
    markClean()
    setSaveStatus('saved')
  } catch {
    if (token !== saveTokenRef.current) return // 同上，静默退出（不设 error、不排重试）
    setSaveStatus('error')
    scheduleRetry()
  }
}
```

**竞态守卫（核心）**：每次 `attemptSave` 开头 `++saveTokenRef.current`。`await` 返回后比对 `token !== saveTokenRef.current`，若期间防抖触发 / `retryNow` / 重试定时器又发起了新的 `attemptSave`（都会 bump token），则旧的慢请求回调直接 `return`，**绝不**覆盖最新 status、绝不误 `markClean`、绝不重复排重试。

**触发与防抖**：一个 effect 监听 `[board, isDirty]`；当 `isDirty && board` 时，清掉旧防抖**和挂起的重试定时器**（`retryRef`）、`failureRef` 归零、`setTimeout(attemptSave, 1000)`。（board 每次编辑是新引用，故新编辑会重置防抖与失败计数，并取代任何已排队的旧重试。）

**重试** `scheduleRetry()`：`setTimeout(attemptSave, nextRetryDelay(++failureRef.current))`，存句柄到 `retryRef`。

**手动重试** `retryNow()`：清 `retryRef`、`failureRef.current = 0`、`attemptSave()`。

**单飞**：同一时刻只一个在途保存——新的触发都经 `attemptSave` bump token，旧 await 完成即被守卫作废；定时器在每次新触发/卸载时清理，避免叠加。

**beforeunload 守卫**：一个 effect 注册 `window` 的 `beforeunload`：当 `hasUnsavedChanges(isDirty, saveStatus)` 为真时 `e.preventDefault(); e.returnValue = ''`（弹原生确认）。卸载时移除监听。

**清理**：hook 卸载时 `clearTimeout(debounceRef)`、`clearTimeout(retryRef)`、移除 beforeunload 监听。

对外暴露：`{ saveStatus, retryNow }`。

---

## 6. UI（BoardCanvas 顶栏）

用 `useAutoSave` 取代现有 `isDirty && "保存中…"`：
```
const { saveStatus, retryNow } = useAutoSave({ board, isDirty, markClean })
```
顶栏据 `saveStatus` 显示：
- `saving` → 「保存中…」（灰）
- `saved` → 「已保存」（暗灰，低调）
- `error` → 「⚠ 保存失败，重试中」（黄）+ 「立即重试」按钮（onClick → `retryNow`）

移除 BoardCanvas 里原有的自动保存 `useEffect` 和 `markClean` 直接调用（逻辑搬进 hook；BoardCanvas 仍从 store 解构 `markClean` 传给 hook）。

---

## 7. 测试思路（TDD）

**纯函数 `saveStatus.js`：**
- `nextRetryDelay`：1→5000、2→10000、3→30000、5→30000。
- `hasUnsavedChanges`：`(false,'saved')`→false；`(false,'saving')`→true；`(false,'error')`→true；`(true,'saved')`→true。

**`useAutoSave` hook（`renderHook` + `vi.useFakeTimers` + `vi.mock('../api/boards')`）：**
- 脏 → 推进 1s → `saveBoard` 被调用、`saveStatus` saving→saved、`markClean` 被调用。
- `saveBoard` reject → `saveStatus` 变 `error`；推进 `nextRetryDelay` 后 `saveBoard` 再次被调用（自动重试）。
- 重试成功 → `saved` + `markClean`。
- `retryNow()` → 立即再调一次 `saveBoard`。
- **竞态守卫**：让第一次 `saveBoard` 返回一个可控的延迟 promise；在它 resolve 之前触发第二次保存（新编辑/`retryNow`）；让第一次「迟到」resolve → 断言迟到回调**未**改变最终 status、`markClean` 只按最新那次生效（旧回调静默）。

**beforeunload**：window 接线不写脆弱测试；判定由 `hasUnsavedChanges` 覆盖，人工验证。

---

## 8. 不在本次范围

- 本地草稿持久化（localStorage/IndexedDB）+ 重开对账 —— 远期硬核，与 E 实时协作的同步模型重叠，并入 E 一起设计（见 [[backlog-future-features]]）。
- 保存冲突/多端并发写 —— 同属 E。
