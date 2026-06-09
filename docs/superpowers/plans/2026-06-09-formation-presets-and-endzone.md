# 阵型预设 + 得分区视觉 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给战术板加 5 个一键阵型预设（默认/竖排/横排/Zone/Junk，整场 14 人 + 飞盘到位），并把得分区从暗色块改成浅白线 + 竖排 END ZONE 文字。

**Architecture:** 阵型坐标为纯数据常量；一个纯函数 `buildFormationPatch` 把预设映射成「每个球员/飞盘的新 x,y」补丁（便于单测）；store 的 `applyFormation` 用现有 `withHistory` 把补丁合并进当前可编辑帧（保留 orientation、删 ctrl、只设第一个飞盘）；底栏一个 `FormationMenu` 向上弹出菜单调用它，播放/非关键帧时禁用。得分区改 `Field.jsx`（纯展示层）。

**Tech Stack:** React 18 + react-konva + Zustand + Vite + Vitest。

参考设计：`docs/superpowers/specs/2026-06-09-formation-presets-and-endzone-design.md`

---

## 背景：实现者必读

- 帧结构：`frame.playerStates[id] = { x, y, orientation, ctrl? }`，`frame.discStates[discId] = { x, y, ctrl? }`。坐标为 0..1 归一化。
- 球员 id：红队 `r1..r7`、蓝队 `b1..b7`，每个 player 对象有 `team`（'red'|'blue'）和 `number`（1..7）。预设坐标数组下标 i 对应 number i+1。
- `boardStore.js` 的 `withHistory(s, next)` 负责压栈历史；所有改 data 的 action 都用它。`snapshot` 存 `data` 引用 + `currentFrameIndex`，依赖 reducer 全程不可变更新。
- `BoardCanvas.jsx` 中 `editableIndex = getEditableFrameIndex(frames, playheadTime, isPlaying)`；`editable = editableIndex !== -1`（播放中或停在非关键帧时为 -1）。现有拖球员调用 `updateFramePlayerState(editableIndex, ...)`。
- 测试运行（PowerShell，用 `;` 不用 `&&`）：单文件 `cd client; npx vitest run src/utils/formations.test.js`；全量 `cd client; npx vitest run`。
- Konva 已在用：`Group/Rect/Line/Text` 从 `react-konva` 引入。

## 文件结构

- **新增** `client/src/utils/formations.js` — `FORMATIONS`、`FORMATION_ORDER`、纯函数 `buildFormationPatch`
- **新增** `client/src/utils/formations.test.js`
- **新增** `client/src/components/FormationMenu.jsx` — 底栏向上弹出菜单
- **新增** `client/src/components/FormationMenu.test.jsx`
- **修改** `client/src/store/boardStore.js` — 加 `applyFormation`
- **修改** `client/src/store/boardStore.test.js` — `applyFormation` 测试
- **修改** `client/src/components/BoardCanvas.jsx` — 底栏挂 `FormationMenu`
- **修改** `client/src/components/Field.jsx` — 得分区视觉

---

## Task 1: 阵型数据 + buildFormationPatch（TDD，纯函数）

**Files:**
- Create: `client/src/utils/formations.js`
- Test: `client/src/utils/formations.test.js`

- [ ] **Step 1: 写失败测试** — 新建 `client/src/utils/formations.test.js`：

```js
import { describe, test, expect } from 'vitest'
import { FORMATIONS, FORMATION_ORDER, buildFormationPatch } from './formations'

const players = [
  { id: 'r1', team: 'red', number: 1 }, { id: 'r2', team: 'red', number: 2 },
  { id: 'r3', team: 'red', number: 3 }, { id: 'r4', team: 'red', number: 4 },
  { id: 'r5', team: 'red', number: 5 }, { id: 'r6', team: 'red', number: 6 },
  { id: 'r7', team: 'red', number: 7 },
  { id: 'b1', team: 'blue', number: 1 }, { id: 'b2', team: 'blue', number: 2 },
  { id: 'b3', team: 'blue', number: 3 }, { id: 'b4', team: 'blue', number: 4 },
  { id: 'b5', team: 'blue', number: 5 }, { id: 'b6', team: 'blue', number: 6 },
  { id: 'b7', team: 'blue', number: 7 },
]
const discs = [{ id: 'disc-1' }]

test('FORMATION_ORDER lists the five presets', () => {
  expect(FORMATION_ORDER).toEqual(['default', 'vstack', 'hstack', 'zone', 'junk'])
})

test('buildFormationPatch maps default formation to exact coords', () => {
  const { playerStates, discStates } = buildFormationPatch('default', players, discs)
  expect(playerStates.r1).toEqual({ x: 0.15, y: 0.12 })
  expect(playerStates.r4).toEqual({ x: 0.15, y: 0.50 })
  expect(playerStates.b1).toEqual({ x: 0.85, y: 0.12 })
  expect(discStates['disc-1']).toEqual({ x: 0.162, y: 0.534 })
})

test('buildFormationPatch only sets the first disc, ignores others', () => {
  const { discStates } = buildFormationPatch('vstack', players, [{ id: 'disc-1' }, { id: 'disc-2' }])
  expect(discStates['disc-1']).toEqual({ x: 0.189, y: 0.481 })
  expect(discStates['disc-2']).toBeUndefined()
})

test('buildFormationPatch skips players not present and needs no orientation/ctrl', () => {
  const { playerStates } = buildFormationPatch('default', [{ id: 'r1', team: 'red', number: 1 }], discs)
  expect(Object.keys(playerStates)).toEqual(['r1'])
  expect(playerStates.r1).toEqual({ x: 0.15, y: 0.12 }) // 仅 x,y，无 orientation/ctrl
})

test('buildFormationPatch with no discs returns empty discStates', () => {
  const { discStates } = buildFormationPatch('default', players, [])
  expect(discStates).toEqual({})
})

test('unknown formation key returns empty patch', () => {
  expect(buildFormationPatch('nope', players, discs)).toEqual({ playerStates: {}, discStates: {} })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client; npx vitest run src/utils/formations.test.js`
Expected: FAIL（`formations.js` 不存在 / 导出未定义）。

- [ ] **Step 3: 实现** — 新建 `client/src/utils/formations.js`：

```js
// 归一化坐标（0..1）。数组下标 i 对应球衣号 i+1。红队左进攻、蓝队右防守、飞盘给红队。
// 坐标由用户在可视化拖拽编辑器中亲手摆定。
export const FORMATIONS = {
  default: {
    label: '默认阵型',
    red:  [[0.15,0.12],[0.15,0.25],[0.15,0.38],[0.15,0.50],[0.15,0.63],[0.15,0.76],[0.15,0.88]],
    blue: [[0.85,0.12],[0.85,0.25],[0.85,0.38],[0.85,0.50],[0.85,0.63],[0.85,0.76],[0.85,0.88]],
    disc: [0.162,0.534],
  },
  vstack: {
    label: '竖排',
    red:  [[0.182,0.441],[0.18,0.618],[0.42,0.50],[0.49,0.50],[0.56,0.50],[0.63,0.50],[0.70,0.50]],
    blue: [[0.20,0.401],[0.20,0.576],[0.411,0.556],[0.48,0.56],[0.548,0.562],[0.618,0.557],[0.688,0.562]],
    disc: [0.189,0.481],
  },
  hstack: {
    label: '横排',
    red:  [[0.221,0.494],[0.22,0.35],[0.22,0.65],[0.509,0.241],[0.509,0.447],[0.506,0.637],[0.506,0.836]],
    blue: [[0.244,0.463],[0.252,0.363],[0.245,0.617],[0.53,0.20],[0.53,0.40],[0.53,0.60],[0.53,0.80]],
    disc: [0.229,0.523],
  },
  zone: {
    label: 'Zone',
    red:  [[0.242,0.497],[0.24,0.299],[0.242,0.689],[0.513,0.205],[0.512,0.399],[0.511,0.604],[0.514,0.792]],
    blue: [[0.242,0.444],[0.288,0.375],[0.298,0.502],[0.485,0.317],[0.471,0.502],[0.491,0.698],[0.638,0.494]],
    disc: [0.252,0.531],
  },
  junk: {
    label: 'Junk',
    red:  [[0.241,0.498],[0.243,0.299],[0.242,0.71],[0.48,0.22],[0.48,0.398],[0.485,0.576],[0.487,0.781]],
    blue: [[0.287,0.495],[0.272,0.385],[0.27,0.613],[0.456,0.317],[0.443,0.488],[0.475,0.669],[0.619,0.463]],
    disc: [0.247,0.533],
  },
}

export const FORMATION_ORDER = ['default', 'vstack', 'hstack', 'zone', 'junk']

// 返回 { playerStates: {id:{x,y}}, discStates: {discId:{x,y}} } 补丁。
// 只含每个元素的新 x,y；不含 orientation/ctrl（合并交给 store）。
export function buildFormationPatch(formationKey, players, discs) {
  const f = FORMATIONS[formationKey]
  if (!f) return { playerStates: {}, discStates: {} }
  const playerStates = {}
  for (const p of players) {
    const arr = p.team === 'red' ? f.red : p.team === 'blue' ? f.blue : null
    const coord = arr && arr[p.number - 1]
    if (coord) playerStates[p.id] = { x: coord[0], y: coord[1] }
  }
  const discStates = {}
  if (discs.length > 0 && f.disc) {
    discStates[discs[0].id] = { x: f.disc[0], y: f.disc[1] }
  }
  return { playerStates, discStates }
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `cd client; npx vitest run src/utils/formations.test.js`
Expected: PASS（全部 6 个）。

- [ ] **Step 5: 提交**

```bash
git add client/src/utils/formations.js client/src/utils/formations.test.js
git commit -m "feat: formation preset data + buildFormationPatch pure fn"
```

---

## Task 2: store applyFormation（TDD）

**Files:**
- Modify: `client/src/store/boardStore.js`（在 `updateFrameDiscState` 之后加 `applyFormation`）
- Test: `client/src/store/boardStore.test.js`（追加测试）

- [ ] **Step 1: 写失败测试**

先在 `client/src/store/boardStore.test.js` **文件顶部 import 区**确保这一行存在（若已有则不重复）：

```js
import { createDefaultBoardData } from '../utils/defaultBoardData'
```

文件顶部应已有 `import { renderHook, act } from '@testing-library/react'` 与 `import { useBoardStore } from './boardStore'`（若导入名不同照搬其用法）。然后在文件**末尾追加**这三个测试（不要把 import 写进测试块）：

```js
test('applyFormation sets current frame positions, keeps orientation, drops ctrl', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  // 先给 r1 一个朝向和曲线 ctrl，验证后面 orientation 保留、ctrl 被清
  act(() => result.current.updateFramePlayerState(0, 'r1', { orientation: 1.2 }))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.4, y: 0.4 }))
  const pastBefore = result.current.past.length

  act(() => result.current.applyFormation(0, 'default'))

  const f = result.current.board.data.frames[0]
  expect(f.playerStates.r1.x).toBe(0.15)
  expect(f.playerStates.r1.y).toBe(0.12)
  expect(f.playerStates.r1.orientation).toBe(1.2) // 朝向保留
  expect(f.playerStates.r1.ctrl).toBeUndefined()  // 曲线被清
  // 飞盘设到第一个盘
  expect(f.discStates['disc-1']).toEqual({ x: 0.162, y: 0.534 })
  // 记一步历史
  expect(result.current.past.length).toBe(pastBefore + 1)
})

test('applyFormation is undoable in one step', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  const before = result.current.board.data.frames[0].playerStates.r1.x
  act(() => result.current.applyFormation(0, 'vstack'))
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.182)
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(before)
})

test('applyFormation only touches the target frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  act(() => result.current.insertFrameAfter(0)) // 现在有 2 帧，当前在帧 1
  const frame1R1Before = result.current.board.data.frames[1].playerStates.r1.x
  act(() => result.current.applyFormation(0, 'hstack')) // 只改帧 0
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.221)
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(frame1R1Before)
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: 新增 3 个 FAIL（`applyFormation is not a function`）；其余原有测试仍 PASS。

- [ ] **Step 3: 实现** — 在 `client/src/store/boardStore.js` 顶部 import 区加：

```js
import { buildFormationPatch } from '../utils/formations'
```

然后在 `updateFrameDiscState` action（约 53-58 行）之后插入：

```js
  applyFormation: (frameIndex, formationKey) => set((s) => {
    const data = s.board.data
    const { playerStates: pPatch, discStates: dPatch } = buildFormationPatch(formationKey, data.players, data.discs)
    const frames = data.frames.map((f, i) => {
      if (i !== frameIndex) return f
      const playerStates = { ...f.playerStates }
      for (const id in pPatch) {
        const el = { ...playerStates[id], ...pPatch[id] } // 保留 orientation
        delete el.ctrl                                    // 位置重置，旧曲线作废
        playerStates[id] = el
      }
      const discStates = { ...f.discStates }
      for (const id in dPatch) {
        const el = { ...discStates[id], ...dPatch[id] }
        delete el.ctrl
        discStates[id] = el
      }
      return { ...f, playerStates, discStates }
    })
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),
```

- [ ] **Step 4: 运行，确认通过**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: 全部 PASS（含新增 3 个）。

- [ ] **Step 5: 提交**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: applyFormation store action (merge into current frame, keep orientation, drop ctrl)"
```

---

## Task 3: FormationMenu 组件 + 接入 BoardCanvas

**Files:**
- Create: `client/src/components/FormationMenu.jsx`
- Test: `client/src/components/FormationMenu.test.jsx`
- Modify: `client/src/components/BoardCanvas.jsx`

- [ ] **Step 1: 写失败测试** — 新建 `client/src/components/FormationMenu.test.jsx`：

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import FormationMenu from './FormationMenu'

test('opens menu and lists all five presets', () => {
  render(<FormationMenu onApply={() => {}} disabled={false} />)
  fireEvent.click(screen.getByText(/阵型/))
  expect(screen.getByText('默认阵型')).toBeInTheDocument()
  expect(screen.getByText('竖排')).toBeInTheDocument()
  expect(screen.getByText('横排')).toBeInTheDocument()
  expect(screen.getByText('Zone')).toBeInTheDocument()
  expect(screen.getByText('Junk')).toBeInTheDocument()
})

test('clicking a preset calls onApply with its key and closes', () => {
  const onApply = vi.fn()
  render(<FormationMenu onApply={onApply} disabled={false} />)
  fireEvent.click(screen.getByText(/阵型/))
  fireEvent.click(screen.getByText('竖排'))
  expect(onApply).toHaveBeenCalledWith('vstack')
  expect(screen.queryByText('竖排')).not.toBeInTheDocument() // 选完关闭
})

test('disabled trigger does not open the menu', () => {
  render(<FormationMenu onApply={() => {}} disabled={true} />)
  fireEvent.click(screen.getByText(/阵型/))
  expect(screen.queryByText('默认阵型')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client; npx vitest run src/components/FormationMenu.test.jsx`
Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现** — 新建 `client/src/components/FormationMenu.jsx`：

```jsx
import { useState, useRef, useEffect } from 'react'
import { FORMATIONS, FORMATION_ORDER } from '../utils/formations'

const TRIGGER = {
  padding: '4px 12px', height: 28, borderRadius: 6,
  background: '#2a2a3e', border: '1px solid #555', color: '#ccc',
  fontSize: 13, cursor: 'pointer',
}
const MENU = {
  position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
  background: '#1a1a2e', border: '1px solid #444', borderRadius: 8,
  padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
  minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 20,
}
const ITEM = {
  padding: '7px 12px', borderRadius: 5, background: 'transparent',
  border: 'none', color: '#eee', fontSize: 13, textAlign: 'left', cursor: 'pointer',
}

export default function FormationMenu({ onApply, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {open && (
        <div style={MENU}>
          {FORMATION_ORDER.map((key) => (
            <button
              key={key}
              style={ITEM}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onApply(key); setOpen(false) }}
            >
              {FORMATIONS[key].label}
            </button>
          ))}
        </div>
      )}
      <button
        style={{ ...TRIGGER, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        disabled={disabled}
        title={disabled ? '播放中或非关键帧不可用' : '选择阵型预设'}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
      >
        阵型 ▲
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `cd client; npx vitest run src/components/FormationMenu.test.jsx`
Expected: PASS（3 个）。

- [ ] **Step 5: 接入 BoardCanvas** — 改 `client/src/components/BoardCanvas.jsx`：

(a) 在文件顶部 import 区（其它组件 import 旁）加：
```jsx
import FormationMenu from './FormationMenu'
```

(b) 在 store 解构（约 67-75 行）的 action 列表里加入 `applyFormation`，例如把
```jsx
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration,
```
改为
```jsx
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration, applyFormation,
```

(c) 在 canvas 容器 div 结束（约 546 行 `</div>` 之后）与 `{/* 时间轴 */}`（约 548 行）之间，插入底栏阵型条：
```jsx
      {/* 底栏：阵型预设 */}
      {board && (
        <div style={{
          padding: '6px 16px', background: '#111', borderTop: '1px solid #333',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <FormationMenu onApply={(key) => applyFormation(editableIndex, key)} disabled={!editable} />
        </div>
      )}
```

- [ ] **Step 6: 运行全量测试，确认不回归**

Run: `cd client; npx vitest run`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add client/src/components/FormationMenu.jsx client/src/components/FormationMenu.test.jsx client/src/components/BoardCanvas.jsx
git commit -m "feat: FormationMenu in bottom bar, wired to applyFormation (disabled when not editable)"
```

---

## Task 4: 得分区视觉（Field.jsx）

**Files:**
- Modify: `client/src/components/Field.jsx`

纯视觉改动，靠浏览器人工验收；只需保证不破坏现有测试。

- [ ] **Step 1: 替换 Field.jsx** — 把 `client/src/components/Field.jsx` 整体替换为：

```jsx
import { Group, Rect, Line, Text } from 'react-konva'

const FIELD_COLOR = '#2d5a27'
const LINE_COLOR = 'rgba(255,255,255,0.45)'
const EZ_TEXT_COLOR = 'rgba(255,255,255,0.25)'
const LINE_WIDTH = 2

const END_ZONE_LEFT = 0.18
const END_ZONE_RIGHT = 0.82
const EZ_FONT = 16

export default function Field({ fieldWidth, fieldHeight }) {
  const w = fieldWidth
  const h = fieldHeight

  return (
    <Group listening={false}>
      {/* 背景（整场同绿，不再有暗色端区块） */}
      <Rect x={0} y={0} width={w} height={h} fill={FIELD_COLOR} />

      {/* 外边框（浅白） */}
      <Rect
        x={0} y={0} width={w} height={h}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} fill="transparent"
      />

      {/* 左端区线 */}
      <Line
        points={[END_ZONE_LEFT * w, 0, END_ZONE_LEFT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 右端区线 */}
      <Line
        points={[END_ZONE_RIGHT * w, 0, END_ZONE_RIGHT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 中线（虚线） */}
      <Line
        points={[0.5 * w, 0, 0.5 * w, h]}
        stroke={LINE_COLOR} strokeWidth={1}
        dash={[8, 8]} opacity={0.4}
      />

      {/* 左端区竖排 END ZONE 文字（绕中心旋转 -90，居中于左端区） */}
      <Text
        text="END ZONE"
        fontSize={EZ_FONT} fontStyle="bold" fill={EZ_TEXT_COLOR}
        width={h} height={EZ_FONT} align="center"
        offsetX={h / 2} offsetY={EZ_FONT / 2}
        rotation={-90}
        x={(END_ZONE_LEFT / 2) * w} y={h / 2}
      />

      {/* 右端区竖排 END ZONE 文字 */}
      <Text
        text="END ZONE"
        fontSize={EZ_FONT} fontStyle="bold" fill={EZ_TEXT_COLOR}
        width={h} height={EZ_FONT} align="center"
        offsetX={h / 2} offsetY={EZ_FONT / 2}
        rotation={-90}
        x={((END_ZONE_RIGHT + 1) / 2) * w} y={h / 2}
      />
    </Group>
  )
}
```

说明：`width={h}` 让文字在「旋转前」横排撑满 h 长度并 `align="center"` 居中；`offsetX=h/2, offsetY=EZ_FONT/2` 把旋转中心设到文字中心；`rotation={-90}` 转成竖排；`x` 为端区水平中心（左 0.09w、右 0.91w），`y=h/2` 垂直居中。

- [ ] **Step 2: 运行全量测试，确认不回归**

Run: `cd client; npx vitest run`
Expected: 全部 PASS（Field 无专门测试；逻辑层不受影响）。

- [ ] **Step 3: 浏览器人工验收** — `cd client; npm run dev`，打开任意战术板：
  - [ ] 得分区不再是暗色块，整场同绿；外框/端区线是淡白色
  - [ ] 左右端区中央各有竖排浅白 "END ZONE" 文字，清晰但不抢眼
  - [ ] 中线虚线仍在
  - [ ] 底栏「阵型 ▲」按钮，点开向上弹出 5 个预设
  - [ ] 选「默认阵型」：两队贴各自端区线、飞盘给红队；选「竖排/横排/Zone/Junk」站位与设计一致
  - [ ] 选预设后可 Ctrl+Z 一步撤销
  - [ ] 播放中 / 停在非关键帧时「阵型」按钮置灰不可用

- [ ] **Step 4: 提交**

```bash
git add client/src/components/Field.jsx
git commit -m "style: end zone visual — soft white lines + vertical END ZONE text, drop dark blocks"
```

---

## 完成后

- 全部任务完成后做整体审查（spec 合规 + 代码质量），再让用户在浏览器最终验收（重点：5 个阵型站位、得分区文字、播放/非关键帧禁用），然后合并到 main、用户手动 push。
