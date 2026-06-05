# 曲线轨迹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让球员/飞盘在两帧间走二次贝塞尔弧线——起点帧元素加可选 `ctrl`，单击元素显示中点手柄拖设曲率，无 ctrl 退回直线。

**Architecture:** `ctrl` 挂在起点帧元素状态上；`interpolate.js` 的 `lerpFrames` 在 x/y 处加「有 ctrl 走二次贝塞尔、否则直线」分支；单击选中元素时渲染 `TrajectoryHandle`（贝塞尔虚线预览 + 可拖中点手柄），松手经新 store action `setTrajectoryCtrl` 提交一步。朝向独立、初版不做匀速重参数化。

**Tech Stack:** React 18, Zustand 4, react-konva, Vite 5, Vitest。

设计文档：`docs/superpowers/specs/2026-06-05-curve-trajectory-design.md`

---

## File Structure

- **Modify** `client/src/utils/interpolate.js` + `.test.js` — `quadraticPoint` + lerpFrames 贝塞尔分支。
- **Modify** `client/src/store/boardStore.js` + `.test.js` — `setTrajectoryCtrl`。
- **Create** `client/src/components/TrajectoryHandle.jsx` — 贝塞尔虚线预览 + 可拖手柄。
- **Modify** `client/src/components/Player.jsx` / `Disc.jsx` — 加 `onSelect`（单击选中）。
- **Modify** `client/src/components/BoardCanvas.jsx` — `selectedElement` state、单击接线、`TrajectoryHandle` 渲染、`setTrajectoryCtrl` 接线、点空白清选中（人工验证）。

> 无后端改动；无 DB 迁移（`ctrl` 是 data JSON 的可选字段）。

---

## Task 1: 插值 `quadraticPoint` + lerpFrames 贝塞尔分支

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: 写失败测试** — 在 `interpolate.test.js` 顶部 import 里加入 `quadraticPoint`（合并进现有 `from './interpolate'`），并在文件末尾追加：

```js
test('quadraticPoint 端点、ctrl=中点退化直线、ctrl 偏离', () => {
  expect(quadraticPoint(0, 0.5, 1, 0)).toBeCloseTo(0)   // t=0 → p0
  expect(quadraticPoint(0, 0.5, 1, 1)).toBeCloseTo(1)   // t=1 → p1
  expect(quadraticPoint(0, 0.5, 1, 0.5)).toBeCloseTo(0.5) // ctrl=中点 → 直线
  expect(quadraticPoint(0, 1, 0, 0.5)).toBeCloseTo(0.5) // P0=0,C=1,P1=0 → 0.25*0+0.5*1+0.25*0
})

test('lerpFrames 有 ctrl 时球员走二次贝塞尔（中点偏离直线）', () => {
  const frames = [
    { id: 'f0', duration: 1000, playerStates: { r1: { x: 0, y: 0, orientation: 0, ctrl: { x: 0.5, y: 1 } } }, discStates: {} },
    { id: 'f1', duration: 0, playerStates: { r1: { x: 1, y: 0, orientation: 0 } }, discStates: {} },
  ]
  const v = interpolateAt(frames, 500) // 段中点 t=0.5
  expect(v.playerStates.r1.x).toBeCloseTo(0.5)
  expect(v.playerStates.r1.y).toBeCloseTo(0.5) // 直线应为 0，贝塞尔抬到 0.5
})

test('lerpFrames 无 ctrl 时仍走直线（回归）', () => {
  const frames = [
    { id: 'f0', duration: 1000, playerStates: { r1: { x: 0, y: 0, orientation: 0 } }, discStates: {} },
    { id: 'f1', duration: 0, playerStates: { r1: { x: 1, y: 1, orientation: 0 } }, discStates: {} },
  ]
  const v = interpolateAt(frames, 500)
  expect(v.playerStates.r1.x).toBeCloseTo(0.5)
  expect(v.playerStates.r1.y).toBeCloseTo(0.5)
})

test('lerpFrames 飞盘也支持 ctrl 曲线', () => {
  const frames = [
    { id: 'f0', duration: 1000, playerStates: {}, discStates: { 'disc-1': { x: 0, y: 0, ctrl: { x: 0.5, y: 1 } } } },
    { id: 'f1', duration: 0, playerStates: {}, discStates: { 'disc-1': { x: 1, y: 0 } } },
  ]
  const v = interpolateAt(frames, 500)
  expect(v.discStates['disc-1'].y).toBeCloseTo(0.5)
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/utils/interpolate.test.js` → FAIL（`quadraticPoint` 未导出 / 走的是直线，y=0 而非 0.5）。

- [ ] **Step 3: 实现** — 在 `client/src/utils/interpolate.js`：

  (a) 在 `lerp` 函数附近新增并导出：
```js
export function quadraticPoint(p0, c, p1, t) {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * c + t * t * p1
}
```

  (b) 在 `lerpFrames` 里，把球员的 x/y 行改为（保留 orientation 不变）：
```js
    const pc = s0.ctrl
    playerStates[id] = {
      x: pc ? quadraticPoint(s0.x, pc.x, s1.x, t) : lerp(s0.x, s1.x, t),
      y: pc ? quadraticPoint(s0.y, pc.y, s1.y, t) : lerp(s0.y, s1.y, t),
      orientation: lerpAngle(s0.orientation, s1.orientation, t),
    }
```

  (c) 把飞盘的 discStates 行改为：
```js
    const dc = d0.ctrl
    discStates[id] = {
      x: dc ? quadraticPoint(d0.x, dc.x, d1.x, t) : lerp(d0.x, d1.x, t),
      y: dc ? quadraticPoint(d0.y, dc.y, d1.y, t) : lerp(d0.y, d1.y, t),
    }
```
  （`snapshot` 不变——单帧静态不含 ctrl 影响。）

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/utils/interpolate.test.js` → PASS。然后全套 `cd client; npx vitest run` → 全绿。

- [ ] **Step 5: 提交**
```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: quadratic bezier trajectory interpolation (opt-in via ctrl)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: store `setTrajectoryCtrl`

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: 写失败测试** — 在 `boardStore.test.js` 末尾追加（`makeBoard()` 帧含 `playerStates.r1` 与迁移后的 `discStates['disc-1']`）：

```js
test('setTrajectoryCtrl 给球员设控制点并记历史；传 null 删除回直线', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.5, y: 0.9 }))
  expect(result.current.board.data.frames[0].playerStates.r1.ctrl).toEqual({ x: 0.5, y: 0.9 })
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(1)
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', null))
  expect(result.current.board.data.frames[0].playerStates.r1.ctrl).toBeUndefined()
})

test('setTrajectoryCtrl 给飞盘设控制点；undo 恢复', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'disc', 'disc-1', { x: 0.3, y: 0.7 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].ctrl).toEqual({ x: 0.3, y: 0.7 })
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].discStates['disc-1'].ctrl).toBeUndefined()
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → FAIL（`setTrajectoryCtrl` 未定义）。

- [ ] **Step 3: 实现** — 在 `boardStore.js` 的 `updateFrameDiscState` 动作之后新增：

```js
  setTrajectoryCtrl: (frameIndex, kind, id, ctrl) => set((s) => {
    const key = kind === 'player' ? 'playerStates' : 'discStates'
    const frames = s.board.data.frames.map((f, i) => {
      if (i !== frameIndex) return f
      const states = { ...f[key] }
      const el = { ...states[id] }
      if (ctrl) el.ctrl = ctrl
      else delete el.ctrl
      states[id] = el
      return { ...f, [key]: states }
    })
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true })
  }),
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → PASS。然后全套 `cd client; npx vitest run` → 全绿。

- [ ] **Step 5: 提交**
```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: setTrajectoryCtrl store action (set/clear per-element curve control point)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `TrajectoryHandle` 组件 + Player/Disc 单击选中

**Files:**
- Create: `client/src/components/TrajectoryHandle.jsx`
- Modify: `client/src/components/Player.jsx`
- Modify: `client/src/components/Disc.jsx`

> Konva 组件，无自动化测试；构建验证。`onSelect`/TrajectoryHandle 由 Task 4 接线。

- [ ] **Step 1: 创建 `client/src/components/TrajectoryHandle.jsx`**

```jsx
import { useState } from 'react'
import { Circle, Shape } from 'react-konva'

const HANDLE_R = 7
const clamp = (v) => Math.min(1, Math.max(0, v))

// 一段轨迹的曲率手柄：贝塞尔虚线预览 + 中点可拖小圆。坐标用归一化，内部转 canvas。
// 拖动中本地预览（不写 store），松手 onCommit；双击 onClear 回直线。事件 cancelBubble 防闪退。
export default function TrajectoryHandle({ p0, p1, ctrl, fieldWidth, fieldHeight, onCommit, onClear }) {
  const initial = ctrl ?? { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const [preview, setPreview] = useState(null) // 拖动预览（归一化）；null 用 initial
  const cur = preview ?? initial
  const cx = (nx) => nx * fieldWidth
  const cy = (ny) => ny * fieldHeight

  return (
    <>
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.moveTo(cx(p0.x), cy(p0.y))
          ctx.quadraticCurveTo(cx(cur.x), cy(cur.y), cx(p1.x), cy(p1.y))
          ctx.strokeShape(shape)
        }}
        stroke="#4a9eff"
        strokeWidth={2}
        dash={[8, 6]}
        listening={false}
      />
      <Circle
        x={cx(cur.x)}
        y={cy(cur.y)}
        radius={HANDLE_R}
        fill="#ffffff"
        stroke="#4a9eff"
        strokeWidth={2}
        draggable
        onDragStart={(e) => { e.cancelBubble = true }}
        onDragMove={(e) => {
          e.cancelBubble = true
          setPreview({ x: e.target.x() / fieldWidth, y: e.target.y() / fieldHeight })
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true
          const c = { x: clamp(e.target.x() / fieldWidth), y: clamp(e.target.y() / fieldHeight) }
          setPreview(null)
          onCommit(c)
        }}
        onClick={(e) => { e.cancelBubble = true }}
        onTap={(e) => { e.cancelBubble = true }}
        onDblClick={(e) => { e.cancelBubble = true; setPreview(null); onClear() }}
        onDblTap={(e) => { e.cancelBubble = true; setPreview(null); onClear() }}
      />
    </>
  )
}
```

- [ ] **Step 2: `Player.jsx` 加 onSelect（单击选中）**
  (a) 在解构 props 里加入 `onSelect`（与 `onDoubleClick` 并列）。
  (b) 在最外层 `<Group>` 上，`onDblClick` 那行之后新增：
```jsx
      onClick={(e) => { e.cancelBubble = true; onSelect?.(player.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(player.id) }}
```

- [ ] **Step 3: `Disc.jsx` 加 onSelect（单击选中）**
  (a) 在解构 props 里加入 `onSelect`。
  (b) 在最外层 `<Group>` 上，`onDragEnd` / `onContextMenu` 旁新增：
```jsx
      onClick={(e) => { e.cancelBubble = true; onSelect?.(discId) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(discId) }}
```
  （`Disc` 已 `export default memo(Disc)`，新增 `onSelect` prop 会参与 memo 比较；Task 4 用稳定回调传入。）

- [ ] **Step 4: 构建 + 全套** — Run: `cd client; npx vite build` → 成功（onSelect/TrajectoryHandle 暂未接线，不影响构建）。Run: `cd client; npx vitest run` → 全绿。

- [ ] **Step 5: 提交**
```bash
git add client/src/components/TrajectoryHandle.jsx client/src/components/Player.jsx client/src/components/Disc.jsx
git commit -m "feat: TrajectoryHandle (bezier preview + draggable handle) + click-to-select on Player/Disc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: BoardCanvas 接线（选中 + 手柄渲染 + 提交）

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> 无自动化测试；构建 + 人工冒烟。

- [ ] **Step 1: import TrajectoryHandle**
在组件 import 区加入：
```js
import TrajectoryHandle from './TrajectoryHandle'
```

- [ ] **Step 2: 从 store 解构 `setTrajectoryCtrl`**
找到解构 store 的块，在 `updateFramePlayerState, updateFrameDiscState, addDisc, removeDisc,` 这行末尾追加 `setTrajectoryCtrl,`。

- [ ] **Step 3: 新增 selectedElement state + 稳定回调**
在 `const [selectedAnnoId, setSelectedAnnoId] = useState(null)` 附近新增：
```js
  const [selectedElement, setSelectedElement] = useState(null) // { kind:'player'|'disc', id } | null
```
在其它 handler 附近新增稳定回调：
```js
  const handleSelectPlayer = useCallback((id) => setSelectedElement({ kind: 'player', id }), [])
  const handleSelectDisc = useCallback((id) => setSelectedElement({ kind: 'disc', id }), [])
```

- [ ] **Step 4: 点空白清选中**
在 `handleStageClick` 的 `if (tool === 'none' && e.target === e.target.getStage()) {` 块里，`setSelectedAnnoId(null)` 之后加一行：
```js
      setSelectedElement(null)
```

- [ ] **Step 5: 给 Player / Disc 传 onSelect**
在 `<Player ... />` 的 props 里加 `onSelect={handleSelectPlayer}`。在 `<Disc ... />` 的 props 里加 `onSelect={handleSelectDisc}`。

- [ ] **Step 6: 渲染 TrajectoryHandle**
在球员/飞盘所在的 `<Layer x={fieldX} y={fieldY}>`（`board.data.discs.map` 之后、该 `</Layer>` 之前）插入：
```jsx
              {selectedElement && !isPlaying && tool === 'none' && editable && selectedPlayerId === null &&
                editableIndex < board.data.frames.length - 1 && (() => {
                  const { kind, id } = selectedElement
                  const key = kind === 'player' ? 'playerStates' : 'discStates'
                  const cur = board.data.frames[editableIndex][key][id]
                  const next = board.data.frames[editableIndex + 1][key][id]
                  if (!cur || !next) return null
                  return (
                    <TrajectoryHandle
                      p0={{ x: cur.x, y: cur.y }}
                      p1={{ x: next.x, y: next.y }}
                      ctrl={cur.ctrl ?? null}
                      fieldWidth={fieldW}
                      fieldHeight={fieldH}
                      onCommit={(c) => setTrajectoryCtrl(editableIndex, kind, id, c)}
                      onClear={() => setTrajectoryCtrl(editableIndex, kind, id, null)}
                    />
                  )
                })()}
```

- [ ] **Step 7: 构建 + 全套** — Run: `cd client; npx vite build` → 成功。Run: `cd client; npx vitest run` → 全绿。

- [ ] **Step 8: 人工冒烟（浏览器）** — 启动前后端，打开战术板（多帧），停在关键帧：
  1. **单击**一个球员 → 出现「本帧→下一帧」蓝色虚线 + 中点白圆手柄;拖手柄 → 曲线弯曲;松手保存;播放时该球员走弧线。
  2. **双击手柄** → 回直线（且手柄不闪退）。**单击飞盘**同样可调曲线。
  3. 撤销/重做覆盖设/清 ctrl;点画布空白 → 取消选中、手柄消失。
  4. 非关键帧 / 播放中 / 最后一帧 / **双击球员开着改名面板时** → 不显示手柄。
  5. 走弧线时朝向仍按手设值插值（不沿切线）。
  6. 打开旧战术板（无 ctrl）→ 仍直线、正常;约 1 秒「已保存」;刷新后 ctrl 保留。
  > 重点反馈第 2 项（双击清除不闪退）与第 4 项（面板打开时手柄隐藏）。

- [ ] **Step 9: 提交**
```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: wire curve trajectory editing (select element, handle render, commit ctrl)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3 数据模型 ctrl（球员/盘）→ Task 1（消费）+ Task 2（写入）✅
- §4 插值 quadraticPoint + lerpFrames 分支（朝向不变）→ Task 1 ✅
- §5 选中机制（selectedElement、单击、点空白清）→ Task 3（onClick）+ Task 4 Step 3/4/5 ✅
- §6 手柄/预览/清除 + 门控（含 selectedPlayerId===null、cancelBubble）→ Task 3（TrajectoryHandle）+ Task 4 Step 6 ✅
- §7 store setTrajectoryCtrl（set/clear，withHistory）→ Task 2 ✅
- §8 测试：quadraticPoint / lerpFrames 有无 ctrl / setTrajectoryCtrl → Task 1/2 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码或精确替换。

**3. Type consistency：**
- `quadraticPoint(p0,c,p1,t)`（Task 1）导出并被 lerpFrames + 测试使用一致。
- `setTrajectoryCtrl(frameIndex, kind, id, ctrl)`（Task 2）与 Task 4 `onCommit`/`onClear` 调用一致（kind 同为 'player'|'disc'）。
- `TrajectoryHandle` props `p0/p1/ctrl/fieldWidth/fieldHeight/onCommit/onClear`（Task 3）与 Task 4 传入一致。
- `selectedElement = {kind,id}`、`onSelect(id)`（Player/Disc，Task 3）与 `handleSelectPlayer/Disc`（Task 4）一致。

**已知取舍：** TrajectoryHandle/Player/Disc/BoardCanvas 挂 Konva，不写自动化测试（人工冒烟）。控制点 clamp 在 dragEnd（拖动中自由预览、松手夹回 [0,1]）。手柄拖动预览用组件内部 state（不进 store/历史），松手一步——与 RotateHandle/视野锥一致。
