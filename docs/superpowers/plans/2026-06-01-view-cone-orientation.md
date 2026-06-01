# 视野锥 + 朝向编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给球员加可单独开关的半透明视野锥、可拖手柄编辑朝向、双击小面板（改名+开关锥），并把朝向插值改成最短路径。

**Architecture:** 几何与裁切逻辑抽成纯函数（`utils/cone.js`）便于单测；朝向最短路插值放 `interpolate.js`（`lerpAngle`）；锥用 Konva `<Wedge>`，旋转手柄用可拖 `<Circle>`——拖拽中只更新 Player 本地预览状态，松手才写一次 store（一条撤销历史）；`showCone` 是每球员持久化属性，新增 store 动作 `setPlayerShowCone`；双击打开 DOM 小面板，位置经 `clampPanel` 防出界。

**Tech Stack:** React 18, react-konva 18（Wedge/Circle）, Zustand 4, Vite 5, Vitest + @testing-library/react（globals 已开，`vi` 全局可用，setup 在 `client/src/test-setup.js`）。

---

## File Structure

- **Create** `client/src/utils/cone.js` — 纯函数 `orientationFromHandle`/`handleOffset`/`coneWedgeRotationDeg`/`clampPanel` + 常量。
- **Create** `client/src/utils/cone.test.js`。
- **Modify** `client/src/utils/interpolate.js` — 新增 `lerpAngle`，`lerpFrames` 的 orientation 改用它。
- **Modify** `client/src/utils/interpolate.test.js` — `lerpAngle` + 最短路 `interpolateAt` 测试。
- **Modify** `client/src/store/boardStore.js` — 新增 `setPlayerShowCone`。
- **Modify** `client/src/store/boardStore.test.js` — `setPlayerShowCone` 测试。
- **Modify** `client/src/utils/defaultBoardData.js` — 每球员加 `showCone: false`。
- **Create** `client/src/utils/defaultBoardData.test.js`。
- **Create** `client/src/components/ViewCone.jsx`、`client/src/components/RotateHandle.jsx`（Konva，无单测）。
- **Modify** `client/src/components/Player.jsx` — 渲染锥+手柄、`dragOrientation` 本地预览、`editable`/`onRotate` props。
- **Create** `client/src/components/PlayerEditPanel.jsx` + `client/src/components/PlayerEditPanel.test.jsx`。
- **Modify** `client/src/components/BoardCanvas.jsx` — `selectedPlayerId`、面板渲染+`clampPanel`、接 `onRotate`/`onToggleCone`/`onRename`、给 Player 传 `editable`/`onRotate`。

> 无数据库迁移：`showCone` 进 `board.data.players`，随既有 JSONB 持久化。

---

## Task 1: cone.js 几何/裁切纯函数

**Files:**
- Create: `client/src/utils/cone.js`
- Test: `client/src/utils/cone.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/utils/cone.test.js`：
```js
import { orientationFromHandle, handleOffset, coneWedgeRotationDeg, clampPanel } from './cone'

test('orientationFromHandle maps cardinal directions', () => {
  expect(orientationFromHandle(10, 0)).toBeCloseTo(0)            // 右
  expect(orientationFromHandle(0, 10)).toBeCloseTo(Math.PI / 2)  // 下
  expect(Math.abs(orientationFromHandle(-10, 0))).toBeCloseTo(Math.PI) // 左 ±π
  expect(orientationFromHandle(0, -10)).toBeCloseTo(-Math.PI / 2) // 上
})

test('handleOffset places the handle on the radius circle', () => {
  const r = handleOffset(0, 64);          expect(r.x).toBeCloseTo(64);  expect(r.y).toBeCloseTo(0)
  const d = handleOffset(Math.PI / 2, 64); expect(d.x).toBeCloseTo(0);   expect(d.y).toBeCloseTo(64)
  const u = handleOffset(-Math.PI / 2, 64);expect(u.x).toBeCloseTo(0);   expect(u.y).toBeCloseTo(-64)
})

test('coneWedgeRotationDeg centers the wedge on the facing direction (boundaries)', () => {
  expect(coneWedgeRotationDeg(0, 90)).toBeCloseTo(-45)
  expect(coneWedgeRotationDeg(Math.PI, 90)).toBeCloseTo(135)      // 左
  expect(coneWedgeRotationDeg(-Math.PI, 90)).toBeCloseTo(-225)    // 左（另一符号）
  expect(coneWedgeRotationDeg(-Math.PI / 2, 90)).toBeCloseTo(-135) // 上
})

test('coneWedgeRotationDeg gives visually-equivalent rotation for +pi and -pi (no flip/flicker)', () => {
  const norm = (deg) => ((deg % 360) + 360) % 360
  expect(norm(coneWedgeRotationDeg(Math.PI, 90))).toBeCloseTo(norm(coneWedgeRotationDeg(-Math.PI, 90)))
})

test('clampPanel keeps the panel inside the viewport', () => {
  expect(clampPanel(100, 100, 200, 120, 1000, 800)).toEqual({ x: 100, y: 100 }) // 不越界
  expect(clampPanel(900, 100, 200, 120, 1000, 800)).toEqual({ x: 800, y: 100 }) // 右越界
  expect(clampPanel(100, 750, 200, 120, 1000, 800)).toEqual({ x: 100, y: 680 }) // 底越界
  expect(clampPanel(50, 50, 1200, 120, 1000, 800)).toEqual({ x: 0, y: 50 })     // 面板比视口还宽 → 夹到 0
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/utils/cone.test.js`
Expected: FAIL（找不到 `./cone`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/utils/cone.js`：
```js
export const CONE_ANGLE_DEG = 90
export const CONE_RADIUS = 64
export const CONE_OPACITY = 0.2
export const HANDLE_RADIUS = 7

// 手柄相对球员中心的 canvas 偏移 → 朝向弧度
export function orientationFromHandle(dx, dy) {
  return Math.atan2(dy, dx)
}

// 朝向 → 手柄应处的 canvas 偏移（固定半径上）
export function handleOffset(orientation, radius) {
  return { x: Math.cos(orientation) * radius, y: Math.sin(orientation) * radius }
}

// 朝向（弧度）→ Konva Wedge 的 rotation（度），使扇形以朝向为中心
export function coneWedgeRotationDeg(orientation, coneAngleDeg) {
  return (orientation * 180) / Math.PI - coneAngleDeg / 2
}

// 面板出界裁切：右/底越界回退一个面板尺寸，再夹到 ≥0
export function clampPanel(x, y, panelW, panelH, viewW, viewH) {
  return {
    x: Math.max(0, x + panelW > viewW ? viewW - panelW : x),
    y: Math.max(0, y + panelH > viewH ? viewH - panelH : y),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/utils/cone.test.js`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/cone.js client/src/utils/cone.test.js
git commit -m "feat: cone geometry and panel-clamp pure functions"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: 朝向最短路插值 `lerpAngle`

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/utils/interpolate.test.js` 末尾追加：
```js
import { lerpAngle } from './interpolate'

test('lerpAngle handles the normal case', () => {
  expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4)
})

test('lerpAngle crosses straight-left via the short path, not the long way', () => {
  const a = (170 * Math.PI) / 180
  const b = (-170 * Math.PI) / 180
  expect(Math.abs(lerpAngle(a, b, 0.5))).toBeCloseTo(Math.PI) // 落在正左 ±π，而非接近 0
})

test('interpolateAt uses shortest-path orientation (no 340-degree spin)', () => {
  const frames = [
    { id: 'f0', duration: 1000, playerStates: { r1: { x: 0.5, y: 0.5, orientation: (170 * Math.PI) / 180 } }, discState: { x: 0, y: 0 } },
    { id: 'f1', duration: 500,  playerStates: { r1: { x: 0.5, y: 0.5, orientation: (-170 * Math.PI) / 180 } }, discState: { x: 0, y: 0 } },
  ]
  const v = interpolateAt(frames, 500) // 第0段中点
  expect(Math.abs(v.playerStates.r1.orientation)).toBeCloseTo(Math.PI) // 正左，不是 0
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/utils/interpolate.test.js`
Expected: FAIL（`lerpAngle` 未定义；最短路测试不通过）。

- [ ] **Step 3: Write the implementation**

在 `client/src/utils/interpolate.js` 中，紧跟现有 `function lerp(a, b, t) { ... }` 之后新增导出函数：
```js
// 就近角度插值：把 b−a 归一化到 (−π, π] 再按 t 推进
export function lerpAngle(a, b, t) {
  let d = (b - a) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}
```
然后把 `lerpFrames` 里这一行：
```js
      orientation: lerp(s0.orientation, s1.orientation, t),
```
改为：
```js
      orientation: lerpAngle(s0.orientation, s1.orientation, t),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/utils/interpolate.test.js`
Expected: PASS（含既有插值测试——orientation 0→2 中点仍为 1，因 |2−0|<π）。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: shortest-path orientation interpolation (lerpAngle)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: store `setPlayerShowCone`

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/store/boardStore.test.js` 末尾追加：
```js
test('setPlayerShowCone toggles showCone and records history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setPlayerShowCone('r1', true))
  expect(result.current.board.data.players.find(p => p.id === 'r1').showCone).toBe(true)
  expect(result.current.past.length).toBe(1)
  act(() => result.current.undo())
  expect(result.current.board.data.players.find(p => p.id === 'r1').showCone).toBeFalsy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: FAIL（`setPlayerShowCone` 不是函数）。

- [ ] **Step 3: Write the implementation**

在 `client/src/store/boardStore.js` 中，紧跟 `renamePlayer` 动作之后新增：
```js
  setPlayerShowCone: (playerId, show) => set((s) => {
    const players = s.board.data.players.map((p) =>
      p.id === playerId ? { ...p, showCone: show } : p
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true })
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: PASS（含既有 store 测试）。

- [ ] **Step 5: Commit**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: setPlayerShowCone store action (history-recorded)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: defaultBoardData 默认 `showCone: false`

**Files:**
- Modify: `client/src/utils/defaultBoardData.js`
- Test: `client/src/utils/defaultBoardData.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/utils/defaultBoardData.test.js`：
```js
import { createDefaultBoardData } from './defaultBoardData'

test('creates 14 players, each with showCone false', () => {
  const data = createDefaultBoardData()
  expect(data.players.length).toBe(14)
  for (const p of data.players) {
    expect(p.showCone).toBe(false)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/utils/defaultBoardData.test.js`
Expected: FAIL（`showCone` 为 undefined）。

- [ ] **Step 3: Write the implementation**

在 `client/src/utils/defaultBoardData.js` 的 `players` 数组里，给每个球员对象加 `showCone: false`。最终每行形如：
```js
      { id: 'r1', team: 'red',  number: 1, name: '1', showCone: false },
      { id: 'r2', team: 'red',  number: 2, name: '2', showCone: false },
      { id: 'r3', team: 'red',  number: 3, name: '3', showCone: false },
      { id: 'r4', team: 'red',  number: 4, name: '4', showCone: false },
      { id: 'r5', team: 'red',  number: 5, name: '5', showCone: false },
      { id: 'r6', team: 'red',  number: 6, name: '6', showCone: false },
      { id: 'r7', team: 'red',  number: 7, name: '7', showCone: false },
      { id: 'b1', team: 'blue', number: 1, name: '1', showCone: false },
      { id: 'b2', team: 'blue', number: 2, name: '2', showCone: false },
      { id: 'b3', team: 'blue', number: 3, name: '3', showCone: false },
      { id: 'b4', team: 'blue', number: 4, name: '4', showCone: false },
      { id: 'b5', team: 'blue', number: 5, name: '5', showCone: false },
      { id: 'b6', team: 'blue', number: 6, name: '6', showCone: false },
      { id: 'b7', team: 'blue', number: 7, name: '7', showCone: false },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/utils/defaultBoardData.test.js`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/defaultBoardData.js client/src/utils/defaultBoardData.test.js
git commit -m "feat: default players carry showCone false"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: ViewCone + RotateHandle（Konva 组件）

**Files:**
- Create: `client/src/components/ViewCone.jsx`
- Create: `client/src/components/RotateHandle.jsx`

> 这两个是 Konva 视觉/交互组件，几何已由 Task 1 的纯函数覆盖测试；jsdom 下不写脆弱的 Konva 渲染测试，交互在 Task 8 人工浏览器验证。

- [ ] **Step 1: Write ViewCone.jsx**

写入 `client/src/components/ViewCone.jsx`：
```js
import { Wedge } from 'react-konva'
import { coneWedgeRotationDeg, CONE_ANGLE_DEG, CONE_RADIUS, CONE_OPACITY } from '../utils/cone'

// 半透明扇形，以 orientation 为中心方向；不拦截事件
export default function ViewCone({ orientation, color }) {
  return (
    <Wedge
      radius={CONE_RADIUS}
      angle={CONE_ANGLE_DEG}
      rotation={coneWedgeRotationDeg(orientation, CONE_ANGLE_DEG)}
      fill={color}
      opacity={CONE_OPACITY}
      listening={false}
    />
  )
}
```

- [ ] **Step 2: Write RotateHandle.jsx**

写入 `client/src/components/RotateHandle.jsx`：
```js
import { Circle } from 'react-konva'
import { orientationFromHandle, handleOffset, HANDLE_RADIUS, CONE_RADIUS } from '../utils/cone'

// 可拖小圆点；拖拽中只 onPreview（不写 store），松手 onCommit。
// 每次都把节点约束回固定半径，朝向由相对球员中心的位置算出。
export default function RotateHandle({ orientation, onPreview, onCommit }) {
  const pos = handleOffset(orientation, CONE_RADIUS)

  function compute(e) {
    const node = e.target
    const o = orientationFromHandle(node.x(), node.y())
    const snapped = handleOffset(o, CONE_RADIUS)
    node.position(snapped) // 约束回半径圆
    return o
  }

  return (
    <Circle
      x={pos.x}
      y={pos.y}
      radius={HANDLE_RADIUS}
      fill="#fff"
      stroke="#333"
      strokeWidth={1}
      draggable
      onDragMove={(e) => onPreview(compute(e))}
      onDragEnd={(e) => onCommit(compute(e))}
    />
  )
}
```

- [ ] **Step 3: Verify imports/build**

Run: `cd client; npx vitest run`（确认无回归、模块解析正常）
Expected: PASS（现有全部测试通过）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ViewCone.jsx client/src/components/RotateHandle.jsx
git commit -m "feat: ViewCone wedge and RotateHandle Konva components"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Player.jsx 渲染锥+手柄、本地预览

**Files:**
- Modify: `client/src/components/Player.jsx`

> Player 含 Konva 节点，不写脆弱单测；逻辑由纯函数测试 + Task 8 人工验证覆盖。

- [ ] **Step 1: Rewrite Player.jsx**

把 `client/src/components/Player.jsx` 整体替换为：
```js
import { useState } from 'react'
import { Circle, Text, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'
import ViewCone from './ViewCone'
import RotateHandle from './RotateHandle'

const TEAM_COLORS = { red: '#e53935', blue: '#1e88e5' }
const PLAYER_RADIUS = 18
const FONT_SIZE = 13

export default function Player({
  player,           // { id, team, number, name, showCone }
  playerState,      // { x, y, orientation } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,        // (playerId, newNormState) => void
  onDoubleClick,    // (playerId) => void
  onRotate,         // (orientation) => void  — 仅松手时调用一次
  editable = false,
  draggable = true,
}) {
  const [dragOrientation, setDragOrientation] = useState(null)
  const { x: cx, y: cy } = toCanvas(playerState.x, playerState.y, fieldWidth, fieldHeight)
  const color = TEAM_COLORS[player.team] ?? '#999'
  const label = player.name.length <= 3 ? player.name : player.name.slice(0, 3)
  const coneOrientation = dragOrientation ?? playerState.orientation

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd(player.id, { ...playerState, x: clamped.x, y: clamped.y })
  }

  return (
    <Group
      x={cx} y={cy}
      draggable={draggable}
      onDragEnd={handleDragEnd}
      onDblClick={() => onDoubleClick?.(player.id)}
    >
      {player.showCone && <ViewCone orientation={coneOrientation} color={color} />}
      <Circle radius={PLAYER_RADIUS} fill={color} stroke="#fff" strokeWidth={2} />
      <Text
        text={label}
        fontSize={FONT_SIZE}
        fill="#fff"
        fontStyle="bold"
        width={PLAYER_RADIUS * 2}
        height={PLAYER_RADIUS * 2}
        x={-PLAYER_RADIUS}
        y={-PLAYER_RADIUS}
        align="center"
        verticalAlign="middle"
      />
      {player.showCone && editable && (
        <RotateHandle
          orientation={coneOrientation}
          onPreview={(o) => setDragOrientation(o)}
          onCommit={(o) => { setDragOrientation(null); onRotate?.(o) }}
        />
      )}
    </Group>
  )
}
```

- [ ] **Step 2: Verify no regression + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Player.jsx
git commit -m "feat: Player renders view cone and rotate handle with drag preview"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 7: PlayerEditPanel（DOM 小面板）

**Files:**
- Create: `client/src/components/PlayerEditPanel.jsx`
- Test: `client/src/components/PlayerEditPanel.test.jsx`

- [ ] **Step 1: Write the failing test**

写入 `client/src/components/PlayerEditPanel.test.jsx`：
```js
import { render, screen, fireEvent } from '@testing-library/react'
import PlayerEditPanel from './PlayerEditPanel'

const player = { id: 'r1', name: '7', showCone: false }

test('renders name input and cone checkbox reflecting the player', () => {
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByLabelText('球员名字')).toHaveValue('7')
  expect(screen.getByLabelText('显示视野锥')).not.toBeChecked()
})

test('changing the checkbox calls onToggleCone', () => {
  const onToggleCone = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={onToggleCone} onClose={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('显示视野锥'))
  expect(onToggleCone).toHaveBeenCalledWith(true)
})

test('Enter in the name input commits a trimmed name and closes', () => {
  const onRename = vi.fn()
  const onClose = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={onRename} onToggleCone={vi.fn()} onClose={onClose} />)
  const input = screen.getByLabelText('球员名字')
  fireEvent.change(input, { target: { value: '  小王  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onRename).toHaveBeenCalledWith('小王')
  expect(onClose).toHaveBeenCalled()
})

test('empty name is not committed', () => {
  const onRename = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={onRename} onToggleCone={vi.fn()} onClose={vi.fn()} />)
  const input = screen.getByLabelText('球员名字')
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.blur(input)
  expect(onRename).not.toHaveBeenCalled()
})

test('close button calls onClose', () => {
  const onClose = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={vi.fn()} onClose={onClose} />)
  fireEvent.click(screen.getByLabelText('关闭'))
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/components/PlayerEditPanel.test.jsx`
Expected: FAIL（找不到 `./PlayerEditPanel`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/components/PlayerEditPanel.jsx`：
```js
export const PANEL_W = 200
export const PANEL_H = 112

const styles = {
  panel: {
    position: 'absolute', width: PANEL_W, padding: 10, zIndex: 20,
    background: '#1a1a2e', border: '1px solid #555', borderRadius: 8,
    display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  input: {
    height: 30, borderRadius: 6, padding: '0 8px',
    background: '#0d0d1a', border: '1px solid #555', color: '#fff',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: 13 },
  close: {
    height: 28, borderRadius: 6, background: '#2a2a3e',
    border: '1px solid #555', color: '#ccc', cursor: 'pointer',
  },
}

export default function PlayerEditPanel({ player, x, y, onRename, onToggleCone, onClose }) {
  function commit(e) {
    const v = e.target.value.trim()
    if (v) onRename(v)
  }
  return (
    <div style={{ ...styles.panel, left: x, top: y }}>
      <input
        aria-label="球员名字"
        style={styles.input}
        defaultValue={player.name}
        key={player.id}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(e); onClose() } }}
        onBlur={commit}
      />
      <label style={styles.row}>
        <input
          type="checkbox"
          aria-label="显示视野锥"
          defaultChecked={!!player.showCone}
          onChange={(e) => onToggleCone(e.target.checked)}
        />
        显示视野锥
      </label>
      <button style={styles.close} aria-label="关闭" onClick={onClose}>关闭</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/components/PlayerEditPanel.test.jsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PlayerEditPanel.jsx client/src/components/PlayerEditPanel.test.jsx
git commit -m "feat: PlayerEditPanel for rename and cone toggle"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 8: 接入 BoardCanvas

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

- [ ] **Step 1: Add imports**

在 `client/src/components/BoardCanvas.jsx` 顶部 import 段加入：
```js
import PlayerEditPanel, { PANEL_W, PANEL_H } from './PlayerEditPanel'
import { clampPanel } from '../utils/cone'
```

- [ ] **Step 2: Destructure setPlayerShowCone and add selectedPlayerId state**

把 store 解构扩展，加入 `setPlayerShowCone`（与现有 `renamePlayer` 等并列）：
```js
    setPlayhead, play, pause, toggleLoop, markClean,
    renamePlayer, setPlayerShowCone,
  } = useBoardStore()
```
（注意：`renamePlayer` 之前是通过 `useBoardStore.getState().renamePlayer` 调用的；现在改为从解构里拿。）

在 `usePlaybackEngine()` 之后加入本地状态：
```js
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
```

- [ ] **Step 3: Open the panel on double-click and pass cone props to Player**

把 `<Player>` 的 `onDoubleClick` 改为打开面板，并新增 `editable`/`onRotate`：
```js
                  <Player
                    key={player.id}
                    player={player}
                    playerState={state}
                    fieldWidth={fieldW}
                    fieldHeight={fieldH}
                    draggable={editable}
                    editable={editable}
                    onRotate={(orientation) =>
                      updateFramePlayerState(editableIndex, player.id, { ...state, orientation })
                    }
                    onDragEnd={(id, newState) =>
                      updateFramePlayerState(editableIndex, id, newState)
                    }
                    onDoubleClick={(id) => setSelectedPlayerId(id)}
                  />
```
（删除原 `onDoubleClick` 里的 `prompt(...)` 改名逻辑——改名移到面板。）

- [ ] **Step 4: Render the panel**

在画布 `<div ref={containerRef} ...>` 内部、`<Stage>...</Stage>` 之后（仍在该 div 内，使绝对定位相对于画布容器），加入：
```js
            {selectedPlayerId && view && (() => {
              const sel = board.data.players.find(p => p.id === selectedPlayerId)
              const selState = view.playerStates[selectedPlayerId]
              if (!sel || !selState) return null
              const rawX = fieldX + selState.x * fieldW + 12
              const rawY = fieldY + selState.y * fieldH + 12
              const pos = clampPanel(rawX, rawY, PANEL_W, PANEL_H, stageW, stageH)
              return (
                <PlayerEditPanel
                  player={sel}
                  x={pos.x}
                  y={pos.y}
                  onRename={(name) => renamePlayer(selectedPlayerId, name)}
                  onToggleCone={(show) => setPlayerShowCone(selectedPlayerId, show)}
                  onClose={() => setSelectedPlayerId(null)}
                />
              )
            })()}
```
（面板相对画布容器绝对定位，故用 `stageW`/`stageH`（容器尺寸）作裁切边界，保证不超出画布区域。）

- [ ] **Step 5: Run full suite + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归）。
Run: `cd client; npx vite build`
Expected: 构建成功，无未用导入/语法错误（确认旧的 `prompt` 改名与 `useBoardStore.getState().renamePlayer` 已移除）。

- [ ] **Step 6: Manual smoke test (browser)**

启动前后端，打开一个战术板：
- 双击球员 → 弹出小面板（名字 + 「显示视野锥」勾选 + 关闭）。把球员摆在**右边缘/最底部**双击 → 面板不超出画布、关闭按钮可点。
- 勾选「显示视野锥」→ 该球员出现半透明扇形；停在关键帧时扇形尖端出现小手柄。
- 拖手柄绕球员转 → 扇形实时跟转；松手后定下来。转一大圈后按 `Ctrl+Z`：**只回退一步**（不是上百步），证明拖拽中没记历史。
- 改名后回车：名字更新、面板关闭。
- 在第1帧把某人朝向设为「略偏左上」，第2帧设为「略偏左下」（跨正左），播放：球员**就近小转**而非反向大风车。
- 预览/播放中：手柄不显示，扇形仍按插值朝向显示。

> 把结果反馈给我，尤其：拖手柄后撤销是否只占一步、跨正左播放是否就近转、边缘双击面板是否完整可见。

- [ ] **Step 7: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: wire view cone, rotate handle and edit panel into BoardCanvas"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §2 数据模型 `showCone` → Task 4（默认）+ Task 3（动作）✅
- §3 `setPlayerShowCone` 记历史 → Task 3 ✅
- §4 `cone.js` 四个纯函数（含 `clampPanel`）→ Task 1 ✅
- §5 ViewCone/RotateHandle/Player/PlayerEditPanel/BoardCanvas → Task 5/6/7/8 ✅
- §5 RotateHandle dragMove 仅预览、dragEnd 提交一步 → Task 5（onPreview/onCommit）+ Task 6（dragOrientation、onCommit 清空+调 onRotate）✅
- §5 面板出界裁切 → Task 1（clampPanel）+ Task 8（用 stageW/H 调用）✅
- §6 数据流（显示/改朝向/开关锥改名）→ Task 6/8 ✅
- §6.1 朝向最短路 `lerpAngle` + `interpolateAt` → Task 2 ✅
- §7 测试（cone 纯函数边界、lerpAngle、setPlayerShowCone、defaultBoardData、PlayerEditPanel）→ Task 1/2/3/4/7 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码。

**3. Type consistency：** `orientationFromHandle`/`handleOffset`/`coneWedgeRotationDeg`/`clampPanel`/常量在 Task 1 定义，Task 5/6/8 一致引用；`lerpAngle` Task 2 定义并在 `lerpFrames` 使用；`setPlayerShowCone(playerId, show)` Task 3 定义、Task 8 调用一致；Player 新 props `editable`/`onRotate` Task 6 定义、Task 8 传入一致；`PlayerEditPanel` props（player/x/y/onRename/onToggleCone/onClose）与导出 `PANEL_W`/`PANEL_H` 在 Task 7 定义、Task 8 消费一致。

**已知取舍：** ViewCone/RotateHandle/Player 的 Konva 渲染与拖拽不写自动化测试——几何由 cone.js 纯函数覆盖，交互由 Task 8 Step 6 人工浏览器验证（与既有 Konva 组件做法一致）。
