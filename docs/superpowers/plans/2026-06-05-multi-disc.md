# 多飞盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把战术板从「每帧单盘」升级为「多盘」(可加/删,允许删到 0),每个盘独立拖放、按帧插值移动,旧单盘板自动迁移。

**Architecture:** 盘与球员同构——顶层 `board.data.discs`(权威盘列表，只存 id) + 每帧 `frame.discStates[id]`(各盘位置)。插值/快照/渲染复用球员的 per-id 写法。旧 `frame.discState` 由纯函数 `normalizeBoardData` 在 `setBoard` 时迁移。

**Tech Stack:** React 18, Zustand 4, react-konva, Vite 5, Vitest + @testing-library/react。

设计文档：`docs/superpowers/specs/2026-06-05-multi-disc-design.md`

---

## File Structure

- **Create** `client/src/utils/normalizeBoardData.js` + `.test.js` — 迁移纯函数。
- **Modify** `client/src/utils/defaultBoardData.js` — 新结构 discs+discStates。
- **Modify** `client/src/utils/interpolate.js` + `.test.js` — discStates per-id 插值/快照。
- **Modify** `client/src/store/boardStore.js` + `.test.js` — setBoard 接迁移、`updateFrameDiscState` per-id、`addDisc`、`removeDisc`；旧测试对齐 + 新测试。
- **Modify** `client/src/components/Disc.jsx` — `discId` + `onContextMenu` + `React.memo`。
- **Modify** `client/src/components/BoardCanvas.jsx` — 遍历渲染、稳定回调、加盘按钮(人工验证)。

> 无后端改动；无 DB 迁移。

---

## Task 1: `normalizeBoardData` 迁移 + 默认数据新结构

**Files:**
- Create: `client/src/utils/normalizeBoardData.js`
- Create: `client/src/utils/normalizeBoardData.test.js`
- Modify: `client/src/utils/defaultBoardData.js`

- [ ] **Step 1: 写失败测试** — 新建 `client/src/utils/normalizeBoardData.test.js`:

```js
import { normalizeBoardData } from './normalizeBoardData'

test('迁移旧单盘 discState → discStates[disc-1] 并补 discs', () => {
  const old = {
    players: [], globalAnnotations: [],
    frames: [
      { id: 'f0', playerStates: {}, discState: { x: 0.5, y: 0.5 } },
      { id: 'f1', playerStates: {}, discState: { x: 0.3, y: 0.7 } },
    ],
  }
  const n = normalizeBoardData(old)
  expect(n.discs).toEqual([{ id: 'disc-1' }])
  expect(n.frames[0].discStates).toEqual({ 'disc-1': { x: 0.5, y: 0.5 } })
  expect(n.frames[1].discStates).toEqual({ 'disc-1': { x: 0.3, y: 0.7 } })
  expect(n.frames[0].discState).toBeUndefined()
})

test('已是新结构则幂等', () => {
  const cur = {
    players: [], globalAnnotations: [],
    discs: [{ id: 'disc-1' }, { id: 'disc-2' }],
    frames: [{ id: 'f0', playerStates: {}, discStates: { 'disc-1': { x: 0.5, y: 0.5 }, 'disc-2': { x: 0.6, y: 0.6 } } }],
  }
  const n = normalizeBoardData(cur)
  expect(n.discs).toEqual([{ id: 'disc-1' }, { id: 'disc-2' }])
  expect(n.frames[0].discStates).toEqual({ 'disc-1': { x: 0.5, y: 0.5 }, 'disc-2': { x: 0.6, y: 0.6 } })
})

test('不可变：不改入参', () => {
  const old = { players: [], globalAnnotations: [], frames: [{ id: 'f0', playerStates: {}, discState: { x: 0.5, y: 0.5 } }] }
  normalizeBoardData(old)
  expect(old.frames[0].discState).toEqual({ x: 0.5, y: 0.5 })
  expect(old.discs).toBeUndefined()
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/utils/normalizeBoardData.test.js` → FAIL(模块不存在)。

- [ ] **Step 3: 实现** — 新建 `client/src/utils/normalizeBoardData.js`:

```js
// 把旧的单盘结构（frame.discState）迁移成多盘（board.data.discs + frame.discStates）。幂等、不可变。
export function normalizeBoardData(data) {
  const discs = data.discs ?? [{ id: 'disc-1' }]
  const frames = data.frames.map((f) => {
    if (f.discStates) return f // 已是新结构
    const { discState, ...rest } = f
    return { ...rest, discStates: discState ? { 'disc-1': discState } : {} }
  })
  return { ...data, discs, frames }
}
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/utils/normalizeBoardData.test.js` → PASS。

- [ ] **Step 5: 默认数据改新结构** — 在 `client/src/utils/defaultBoardData.js` 的 `createDefaultBoardData` 返回对象里：
  (a) 在 `players: [...]` 之后新增一行 `discs: [{ id: 'disc-1' }],`
  (b) 把帧里的 `discState: { x: 0.50, y: 0.50 },` 改为 `discStates: { 'disc-1': { x: 0.50, y: 0.50 } },`

- [ ] **Step 6: 全套测试** — Run: `cd client; npx vitest run` → 现有测试应仍全绿(此时还没动 interpolate/store，`createDefaultBoardData` 只在新建板用，旧测试不依赖它的 disc 字段)。若有失败，记录但不要在本任务修(后续任务处理 interpolate/store)。预期：全绿。

- [ ] **Step 7: 提交**
```bash
git add client/src/utils/normalizeBoardData.js client/src/utils/normalizeBoardData.test.js client/src/utils/defaultBoardData.js
git commit -m "feat: normalizeBoardData migration + multi-disc default data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `interpolate` 改 per-id discStates

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: 更新测试(red)** — 在 `client/src/utils/interpolate.test.js` 做以下精确修改(只动 `animFrames` 这组 + 其断言；`efFrames`/`afFrames`/orientation frames 不动——它们要么不调 interpolateAt，要么靠实现的 `?? {}` 兜底)：

  (a) `animFrames` 第 0 帧的 `discState: { x: 0, y: 0 },` 改为 `discStates: { 'disc-1': { x: 0, y: 0 } },`
  (b) `animFrames` 第 1 帧的 `discState: { x: 1, y: 1 },` 改为 `discStates: { 'disc-1': { x: 1, y: 1 } },`
  (c) `expect(v.discState).toEqual({ x: 0, y: 0 })` 改为 `expect(v.discStates['disc-1']).toEqual({ x: 0, y: 0 })`
  (d) `expect(v.discState.x).toBeCloseTo(0.5)` 改为 `expect(v.discStates['disc-1'].x).toBeCloseTo(0.5)`

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/utils/interpolate.test.js` → FAIL(实现仍返回 `discState`，`v.discStates` 为 undefined)。

- [ ] **Step 3: 实现** — 在 `client/src/utils/interpolate.js`：

  把 `snapshot` 整体替换为：
```js
function snapshot(frame) {
  const playerStates = {}
  for (const id in frame.playerStates) {
    playerStates[id] = { ...frame.playerStates[id] }
  }
  const discStates = {}
  for (const id in (frame.discStates ?? {})) {
    discStates[id] = { ...frame.discStates[id] }
  }
  return { playerStates, discStates }
}
```

  把 `lerpFrames` 的 `return { ... }` 块(原 playerStates + discState）整体替换为：
```js
  const discStates = {}
  for (const id in (f0.discStates ?? {})) {
    const d0 = f0.discStates[id]
    const d1 = f1.discStates?.[id] ?? d0
    discStates[id] = { x: lerp(d0.x, d1.x, t), y: lerp(d0.y, d1.y, t) }
  }
  return { playerStates, discStates }
```
  (即：保留原 `playerStates` 循环不变，把结尾的 `discState` lerp 换成上面的 `discStates` per-id 循环 + 新 return。)

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/utils/interpolate.test.js` → PASS。

- [ ] **Step 5: 提交**
```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: interpolate per-disc discStates (multi-disc)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: store — 迁移接入 + per-id 更新 + 加/删盘

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: 更新现有测试 + 加新测试(red)** — 在 `client/src/store/boardStore.test.js`：

  (a) **破坏性变更对齐(全局替换)** — 把所有 `result.current.updateFrameDiscState(0, {` 替换为 `result.current.updateFrameDiscState(0, 'disc-1', {`(10 处，均为 frameIndex 0)。把所有断言 `result.current.board.data.frames[0].discState.x` 替换为 `result.current.board.data.frames[0].discStates['disc-1'].x`(6 处)。
  > makeBoard 与 push 进去的 fixture 帧仍可保留旧 `discState` 字段——`setBoard` 会经 `normalizeBoardData` 把它们迁移成 `discStates['disc-1']`，所以上面断言成立。

  (b) 把现有这条测试(原断言 disc position)确认成如下形态(应与 (a) 替换后一致)：
```js
test('updateFrameDiscState updates disc position', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.7)
  expect(result.current.isDirty).toBe(true)
})
```

  (c) 在文件末尾追加新测试：
```js
test('addDisc 给所有帧加一个盘并记历史', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  const before = result.current.board.data.discs.length
  act(() => result.current.addDisc())
  expect(result.current.board.data.discs.length).toBe(before + 1)
  const newId = result.current.board.data.discs[result.current.board.data.discs.length - 1].id
  // 每帧都加上了该盘
  for (const f of result.current.board.data.frames) {
    expect(f.discStates[newId]).toBeDefined()
  }
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(1)
})

test('removeDisc 从所有帧删一个盘', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.removeDisc('disc-1'))
  expect(result.current.board.data.discs.find(d => d.id === 'disc-1')).toBeUndefined()
  for (const f of result.current.board.data.frames) {
    expect(f.discStates['disc-1']).toBeUndefined()
  }
})

test('连续 removeDisc 删到空：discs 为空数组、每帧 discStates 为空，且不崩', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addDisc()) // 现在 2 个盘
  const ids = result.current.board.data.discs.map(d => d.id)
  act(() => result.current.removeDisc(ids[0]))
  act(() => result.current.removeDisc(ids[1]))
  expect(result.current.board.data.discs).toEqual([])
  for (const f of result.current.board.data.frames) {
    expect(f.discStates).toEqual({})
  }
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → FAIL(`updateFrameDiscState` 旧签名忽略 discId / `addDisc`/`removeDisc` 未定义 / 断言读 discStates 失败)。

- [ ] **Step 3: 实现** — 在 `client/src/store/boardStore.js`：

  (a) 顶部 import 加入：
```js
import { normalizeBoardData } from '../utils/normalizeBoardData'
```

  (b) 把 `setBoard` 改为存入迁移后的 data：
```js
  setBoard: (board) => set({
    board: { ...board, data: normalizeBoardData(board.data) },
    currentFrameIndex: 0, isDirty: false,
    isPlaying: false, playheadTime: 0, loop: false,
    past: [], future: [],
  }),
```

  (c) 把 `updateFrameDiscState` 整体替换为 per-id 版本：
```js
  updateFrameDiscState: (frameIndex, discId, state) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex ? { ...f, discStates: { ...f.discStates, [discId]: state } } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true })
  }),
```

  (d) 在 `updateFrameDiscState` 之后新增两个动作：
```js
  addDisc: () => set((s) => {
    const data = s.board.data
    const id = `disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const n = data.discs.length
    const clamp = (v) => Math.min(1, Math.max(0, v))
    const pos = { x: clamp(0.5 + n * 0.04), y: clamp(0.5 + n * 0.04) }
    const discs = [...data.discs, { id }]
    const frames = data.frames.map((f) => ({ ...f, discStates: { ...f.discStates, [id]: pos } }))
    return withHistory(s, { board: { ...s.board, data: { ...data, discs, frames } }, isDirty: true })
  }),

  removeDisc: (discId) => set((s) => {
    const data = s.board.data
    const discs = data.discs.filter((d) => d.id !== discId)
    const frames = data.frames.map((f) => {
      const { [discId]: _removed, ...rest } = f.discStates
      return { ...f, discStates: rest }
    })
    return withHistory(s, { board: { ...s.board, data: { ...data, discs, frames } }, isDirty: true })
  }),
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → PASS。然后全套 `cd client; npx vitest run` → 全绿。

- [ ] **Step 5: 提交**
```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: multi-disc store (setBoard migration, per-id update, addDisc, removeDisc)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `Disc` 组件 — discId + 右键删 + React.memo

**Files:**
- Modify: `client/src/components/Disc.jsx`

> Konva 组件，不写自动化测试；构建验证。新 `discId`/`onContextMenu` 在 Task 5 接线前不被使用，组件仍可独立构建。

- [ ] **Step 1: 整体替换 `client/src/components/Disc.jsx`**

```jsx
import { memo } from 'react'
import { Circle, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'

const DISC_RADIUS = 14

function Disc({
  discId,
  discState,      // { x, y } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,      // (discId, newNormState) => void
  onContextMenu,  // (discId) => void
  draggable = true,
}) {
  const { x: cx, y: cy } = toCanvas(discState.x, discState.y, fieldWidth, fieldHeight)

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd(discId, { x: clamped.x, y: clamped.y })
  }

  return (
    <Group
      x={cx}
      y={cy}
      draggable={draggable}
      onDragEnd={handleDragEnd}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onContextMenu?.(discId) }}
    >
      <Circle radius={DISC_RADIUS} fill="#f5c518" stroke="#c8a000" strokeWidth={2} />
      <Circle radius={DISC_RADIUS * 0.55} fill="transparent" stroke="#c8a000" strokeWidth={1.5} />
    </Group>
  )
}

export default memo(Disc)
```

- [ ] **Step 2: 构建** — Run: `cd client; npx vite build` → 成功(注意：此时 BoardCanvas 仍按旧 `view.discState`/旧 onDragEnd 签名调用 Disc，构建不报错；运行时单盘渲染会暂时不对——下一个任务修。可接受，因为我们紧接着做 Task 5)。Run: `cd client; npx vitest run` → 全绿(无组件测试受影响)。

- [ ] **Step 3: 提交**
```bash
git add client/src/components/Disc.jsx
git commit -m "feat: Disc takes discId, right-click delete, wrapped in React.memo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `BoardCanvas` — 遍历渲染 + 稳定回调 + 加盘按钮

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> 无自动化测试；构建 + 人工冒烟。

- [ ] **Step 1: import useCallback** — 把顶部 `import { useEffect, useRef, useState } from 'react'` 改为：
```js
import { useEffect, useRef, useState, useCallback } from 'react'
```

- [ ] **Step 2: 从 store 解构 addDisc / removeDisc** — 找到解构 store 的那块(含 `updateFramePlayerState, updateFrameDiscState,`),在 `updateFrameDiscState,` 同行或紧邻加上 `addDisc, removeDisc,`。例如把
```js
    updateFramePlayerState, updateFrameDiscState,
```
改为
```js
    updateFramePlayerState, updateFrameDiscState, addDisc, removeDisc,
```

- [ ] **Step 3: 加稳定回调** — 在组件内已有函数(如 `handleStep`)附近新增：
```js
  const handleDiscDragEnd = useCallback(
    (discId, state) => updateFrameDiscState(editableIndex, discId, state),
    [updateFrameDiscState, editableIndex]
  )
  const handleDiscRemove = useCallback((discId) => removeDisc(discId), [removeDisc])
```

- [ ] **Step 4: 遍历渲染多盘** — 把现有单个 `<Disc>` 块：
```jsx
              <Disc
                discState={view.discState}
                fieldWidth={fieldW}
                fieldHeight={fieldH}
                draggable={editable && !drawing}
                onDragEnd={(newState) =>
                  updateFrameDiscState(editableIndex, newState)
                }
              />
```
替换为：
```jsx
              {board.data.discs.map((d) => {
                const ds = view.discStates[d.id]
                if (!ds) return null
                return (
                  <Disc
                    key={d.id}
                    discId={d.id}
                    discState={ds}
                    fieldWidth={fieldW}
                    fieldHeight={fieldH}
                    draggable={editable && !drawing}
                    onDragEnd={handleDiscDragEnd}
                    onContextMenu={handleDiscRemove}
                  />
                )
              })}
```

- [ ] **Step 5: 顶栏「+ 盘」按钮** — 在顶栏 `UndoRedoButtons` 之后(`{board && ( <UndoRedoButtons ... /> )}` 块紧跟其后)新增：
```jsx
        {board && (
          <button
            onClick={addDisc}
            disabled={isPlaying}
            title="加一个飞盘"
            style={{
              padding: '4px 10px', height: 28, borderRadius: 6,
              background: '#2a2a3e', border: '1px solid #555', color: '#ccc',
              fontSize: 13, cursor: isPlaying ? 'default' : 'pointer',
              opacity: isPlaying ? 0.5 : 1,
            }}
          >
            + 盘
          </button>
        )}
```

- [ ] **Step 6: 构建 + 全套测试** — Run: `cd client; npx vite build` → 成功。Run: `cd client; npx vitest run` → 全绿。

- [ ] **Step 7: 人工冒烟(浏览器)** — 启动前后端，打开战术板，停在关键帧：
  1. 点顶栏「+ 盘」→ 新盘出现(中心、多个时错开);拖多个盘各自移动。
  2. 在某盘上**右键** → 删除该盘;**一直删到 0 个**也正常(画布无盘、不报错、可继续操作)。
  3. 播放 → 多盘各自按帧插值移动;**播放中「+ 盘」按钮置灰禁用**。
  4. 撤销/重做覆盖加盘/删盘/移动;操作后约 1 秒「已保存」;刷新后多盘位置保留。
  5. **打开一个旧的单盘战术板**(C3 之前建的) → 正常显示那一个盘、可拖动/加盘/保存(迁移生效)。
  > 把结果反馈给我，尤其第 2 项(删到 0 不崩)与第 5 项(旧板迁移)。

- [ ] **Step 8: 提交**
```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: render multiple discs, add-disc button, stable callbacks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3 数据模型 discs+discStates → Task 1(默认数据) + 贯穿全任务 ✅
- §4 迁移 normalizeBoardData + setBoard 接入 → Task 1 + Task 3 Step 3b ✅
- §5 store：updateFrameDiscState per-id + addDisc + removeDisc + 门控(加盘按钮 disabled isPlaying；拖动 editable && !drawing) → Task 3 + Task 5 Step 4/5 ✅
- §5 破坏性变更先对齐旧测试 → Task 3 Step 1a ✅
- §6 interpolate per-id + 空盘安全(`?? {}`) + 遍历渲染 + Disc onContextMenu/memo + useCallback → Task 2 + Task 4 + Task 5 ✅
- §7 加盘按钮 → Task 5 Step 5 ✅
- §8 测试：normalizeBoardData / store(含删到空) / interpolate / 旧测试对齐 → Task 1/2/3 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码或精确替换。

**3. Type consistency：**
- `normalizeBoardData(data)`(Task 1)与 setBoard 调用(Task 3)一致。
- `updateFrameDiscState(frameIndex, discId, state)`(Task 3)与 Disc `onDragEnd(discId, state)`→`handleDiscDragEnd`(Task 4/5)一致。
- `addDisc()` / `removeDisc(discId)`(Task 3)与 Task 5 按钮/右键接线一致。
- `discs: [{ id }]` 与 `discStates: { [id]: {x,y} }` 结构在默认数据/迁移/store/插值/渲染各处一致。

**已知取舍：** Disc/BoardCanvas 挂 Konva，不写自动化测试(人工冒烟)。`React.memo` + 稳定回调在播放场景不跳过(props 每帧变，预期)，收益主要在非播放拖动、小规模下有限但无害。Task 4 完成到 Task 5 之间有一个短暂的「Disc 签名已变、BoardCanvas 未接线」窗口(构建仍过，运行时单盘暂不对)——两任务连续执行即可，不单独发布中间态。
