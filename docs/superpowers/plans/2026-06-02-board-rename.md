# 战术板改名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让战术板能改名——战术板页双击标题内联编辑，列表页「重命名」按钮（prompt），都持久化。

**Architecture:** 后端零改动（PUT 已支持 name）。store 加 `renameBoard(name)`（设 board.name + isDirty，不进撤销栈）；`useAutoSave` 改发 `{ name, data }` 使改名走可靠保存；BoardCanvas 顶栏内联 `<input>`（复用既有 keydown 的 INPUT 放行实现焦点隔离）；BoardList 加 prompt 重命名（含无改动拦截）。

**Tech Stack:** React 18, Zustand 4, react-router-dom 6, Vite 5, Vitest + @testing-library/react（globals 已开，`vi` 全局可用）。

---

## File Structure

- **Modify** `client/src/store/boardStore.js` — 新增 `renameBoard`。
- **Modify** `client/src/store/boardStore.test.js` — `renameBoard` 测试。
- **Modify** `client/src/hooks/useAutoSave.js` — 保存载荷加 `name`。
- **Modify** `client/src/hooks/useAutoSave.test.js` — 断言更新为含 `name`。
- **Modify** `client/src/components/BoardList.jsx` — 「重命名」按钮 + handleRename（无改动拦截）。
- **Create** `client/src/components/BoardList.test.jsx` — 重命名交互测试。
- **Modify** `client/src/components/BoardCanvas.jsx` — 顶栏标题内联编辑（人工验证）。

> 无数据库迁移；无后端改动。

---

## Task 1: store `renameBoard`

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/store/boardStore.test.js` 末尾追加（`makeBoard()` 的 name 是 `'Test Board'`）：
```js
test('renameBoard sets the board name and marks dirty without touching history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, { x: 0.7, y: 0.2 })) // 制造一条历史
  const pastLenBefore = result.current.past.length
  act(() => result.current.renameBoard('新名字'))
  expect(result.current.board.name).toBe('新名字')
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(pastLenBefore) // 历史不变（board.name 不入撤销栈）
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: FAIL（`renameBoard` 不是函数）。

- [ ] **Step 3: Write the implementation**

在 `client/src/store/boardStore.js` 中，紧跟 `setBoard` 动作之后新增：
```js
  renameBoard: (name) => set((s) => {
    if (!s.board) return s
    return { board: { ...s.board, name }, isDirty: true }
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: PASS（含既有 store 测试）。

- [ ] **Step 5: Commit**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: renameBoard store action (board-level, not in undo history)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: `useAutoSave` 保存载荷含 `name`

**Files:**
- Modify: `client/src/hooks/useAutoSave.js`
- Test: `client/src/hooks/useAutoSave.test.js`

- [ ] **Step 1: Update the tests (red)**

在 `client/src/hooks/useAutoSave.test.js` 做以下精确修改：

(a) 第 7 行 `const board = { id: 'b1', data: { x: 1 } }` 改为：
```js
const board = { id: 'b1', name: 'N', data: { x: 1 } }
```
(b) 「saves after the 1s debounce」测试里的断言（原 `expect(api.saveBoard).toHaveBeenCalledWith('b1', { data: { x: 1 } })`）改为：
```js
  expect(api.saveBoard).toHaveBeenCalledWith('b1', { name: 'N', data: { x: 1 } })
```
(c) race-guard 测试里 `const board2 = { id: 'b1', data: { x: 2 } }` 改为：
```js
  const board2 = { id: 'b1', name: 'N', data: { x: 2 } }
```
(d) 「rapid edits coalesce」测试里：`initialProps: { b: { id: 'b1', data: { x: 1 } } }` 改为 `initialProps: { b: { id: 'b1', name: 'N', data: { x: 1 } } }`；`rerender({ b: { id: 'b1', data: { x: 2 } } })` 改为 `rerender({ b: { id: 'b1', name: 'N', data: { x: 2 } } })`；末尾断言 `expect(api.saveBoard).toHaveBeenCalledWith('b1', { data: { x: 2 } })` 改为：
```js
  expect(api.saveBoard).toHaveBeenCalledWith('b1', { name: 'N', data: { x: 2 } })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/hooks/useAutoSave.test.js`
Expected: FAIL（断言期望含 name，但实现仍只发 data）。

- [ ] **Step 3: Write the implementation**

在 `client/src/hooks/useAutoSave.js` 的 `attemptSave` 中，把
```js
      await saveBoard(b.id, { data: b.data })
```
改为：
```js
      await saveBoard(b.id, { name: b.name, data: b.data })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/hooks/useAutoSave.test.js`
Expected: PASS（全部）。然后全套 `cd client; npx vitest run`。

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useAutoSave.js client/src/hooks/useAutoSave.test.js
git commit -m "feat: autosave persists board name alongside data"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: 列表页「重命名」按钮（含无改动拦截）

**Files:**
- Modify: `client/src/components/BoardList.jsx`
- Test: `client/src/components/BoardList.test.jsx`

- [ ] **Step 1: Write the failing test**

写入 `client/src/components/BoardList.test.jsx`：
```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BoardList from './BoardList'
import * as api from '../api/boards'

vi.mock('../api/boards')

beforeEach(() => {
  vi.mocked(api.listBoards).mockResolvedValue([
    { id: 'b1', name: 'Old', updated_at: '2026-06-02T00:00:00Z' },
  ])
  vi.mocked(api.saveBoard).mockResolvedValue()
})

function renderList() {
  return render(<MemoryRouter><BoardList /></MemoryRouter>)
}

test('rename calls saveBoard and updates the card name', async () => {
  renderList()
  await screen.findByText('Old')
  vi.spyOn(window, 'prompt').mockReturnValue('New')
  fireEvent.click(screen.getByText('重命名'))
  await waitFor(() => expect(api.saveBoard).toHaveBeenCalledWith('b1', { name: 'New' }))
  expect(await screen.findByText('New')).toBeInTheDocument()
})

test('rename does nothing on cancel, empty, or unchanged name', async () => {
  renderList()
  await screen.findByText('Old')
  const promptSpy = vi.spyOn(window, 'prompt')
  promptSpy.mockReturnValueOnce(null)   // 取消
  fireEvent.click(screen.getByText('重命名'))
  promptSpy.mockReturnValueOnce('   ')  // 空白
  fireEvent.click(screen.getByText('重命名'))
  promptSpy.mockReturnValueOnce('Old')  // 未改动
  fireEvent.click(screen.getByText('重命名'))
  expect(api.saveBoard).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/components/BoardList.test.jsx`
Expected: FAIL（没有「重命名」按钮）。

- [ ] **Step 3: Write the implementation**

修改 `client/src/components/BoardList.jsx`：

(a) 顶部 import 加入 `saveBoard`：
```js
import { listBoards, createBoard, deleteBoard, saveBoard } from '../api/boards'
```
(b) 在 `STYLES` 对象里加一个 `renameBtn` 样式（放在 `deleteBtn` 之后）：
```js
  renameBtn: {
    padding: '6px 14px', background: 'transparent', color: '#ccc',
    border: '1px solid #555', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
```
(c) 在 `handleDelete` 之后新增 `handleRename`：
```js
  async function handleRename(e, board) {
    e.stopPropagation()
    const v = prompt('新名称', board.name)
    const trimmed = v?.trim()
    if (!trimmed || trimmed === board.name) return // 取消/空/未改动 → 不发请求
    await saveBoard(board.id, { name: trimmed })
    setBoards(bs => bs.map(b => (b.id === board.id ? { ...b, name: trimmed } : b)))
  }
```
(d) 把卡片里那个单独的「删除」按钮替换为「重命名 + 删除」两个按钮的容器：
```jsx
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={STYLES.renameBtn}
              onClick={(e) => handleRename(e, board)}
            >
              重命名
            </button>
            <button
              style={STYLES.deleteBtn}
              onClick={(e) => handleDelete(e, board.id)}
            >
              删除
            </button>
          </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/components/BoardList.test.jsx`
Expected: PASS（2 个测试）。然后全套 `cd client; npx vitest run`。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BoardList.jsx client/src/components/BoardList.test.jsx
git commit -m "feat: rename board from the list page (prompt, skip no-op saves)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: 战术板页顶栏标题内联改名

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> BoardCanvas 含 Konva，内联编辑不写脆弱组件测；store `renameBoard` 已单测，焦点隔离由既有 keydown 的 INPUT 守卫保证。Step 5 人工验证。

- [ ] **Step 1: Destructure renameBoard + add editing state**

在 `client/src/components/BoardCanvas.jsx` 的 `useBoardStore()` 解构里加入 `renameBoard`（与 `markClean` 等并列）。在 `const [selectedPlayerId, setSelectedPlayerId] = useState(null)` 附近新增：
```js
  const [editingName, setEditingName] = useState(false)
```

- [ ] **Step 2: Replace the title span with an inline editor**

把顶栏里这行：
```js
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{board?.name ?? '加载中…'}</span>
```
替换为：
```js
        {editingName ? (
          <input
            aria-label="战术板名称"
            autoFocus
            defaultValue={board?.name ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.target.value.trim()
                if (v) renameBoard(v)
                setEditingName(false)
              } else if (e.key === 'Escape') {
                setEditingName(false)
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) renameBoard(v)
              setEditingName(false)
            }}
            style={{
              fontSize: 16, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4,
              background: '#0d0d1a', border: '1px solid #555', color: '#fff',
            }}
          />
        ) : (
          <span
            style={{ fontWeight: 'bold', fontSize: 16, cursor: board ? 'text' : 'default' }}
            title={board ? '双击改名' : undefined}
            onDoubleClick={() => { if (board) setEditingName(true) }}
          >
            {board?.name ?? '加载中…'}
          </span>
        )}
```

- [ ] **Step 3: Run full suite + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 4: (no automated test)** 内联编辑是 DOM 交互，无自动化测试。

- [ ] **Step 5: Manual smoke test (browser)**

启动前后端，打开一个战术板：
- 双击顶栏标题 → 变输入框；改名后回车 → 标题更新，约 1 秒后「已保存」；返回列表页该板名也已更新。
- 双击标题改名后**按 Esc** → 不改、恢复原名。
- 输入框里清空后失焦 → 不提交（空名守卫）。
- **焦点隔离验证**：双击进入改名输入框，输入一些字后按 `Ctrl+Z`（或 Cmd+Z）→ 撤销的是**输入框内的文本**，战术板的球员/标注**不受影响**（撤销/重做历史不被污染）；按 `Delete` 也只删输入框文本、不删选中的标注。
- 列表页点某板「重命名」→ prompt 改名 → 卡片名更新;输入与原名相同直接确定 → 无网络请求(可在 Network 面板确认无 PUT)。

> 把结果反馈给我，尤其焦点隔离（改名框内 Ctrl+Z 不动战术板历史）与列表页无改动不发请求两项。

- [ ] **Step 6: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: inline rename of the board title in the top bar"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §2/§3 store `renameBoard`（不进历史）→ Task 1 ✅
- §2 autosave 发 `{ name, data }` → Task 2 ✅
- §3 战术板页内联编辑（双击、回车/失焦/Esc、空守卫）→ Task 4 ✅
- §3 焦点隔离守卫（INPUT 放行 Ctrl+Z）→ 复用既有 keydown 守卫，Task 4 Step 5 人工验证 ✅
- §4 列表页「重命名」+ 无改动拦截（`trimmed !== board.name`）→ Task 3 ✅
- §5 测试：renameBoard 不动 past/future、autosave 含 name、BoardList 新名/空/未改动 → Task 1/2/3 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码或精确的逐处修改。

**3. Type consistency：** `renameBoard(name)` Task 1 定义、Task 4 调用一致；autosave 载荷 `{ name, data }` Task 2 实现与测试断言一致；`saveBoard(id, { name })` Task 3 用法与既有 api 一致；BoardList `handleRename(e, board)` 与按钮 onClick 一致。

**已知取舍：** BoardCanvas 顶栏内联编辑不写自动化测试（组件挂 Konva）——`renameBoard` 由 store 测试覆盖，焦点隔离由既有 INPUT 守卫保证并人工验证。
