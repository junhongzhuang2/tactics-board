# Phase 2 Sub-block A — 动画播放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把逐帧静态战术板升级为可播放的关键帧动画：比例时间轴 + 可拖动播放头，所有元素按各帧 duration 同步线性插值移动，仅在精确停于关键帧起点时可编辑。

**Architecture:** 渲染走「纯函数派生」路线——`interpolateAt(frames, playheadTime)` 计算当前时刻所有元素位置，画布只渲染其输出，不再直接读 `currentFrame`。播放由 requestAnimationFrame 驱动的 hook 累加 `playheadTime`，推进逻辑抽成纯函数 `advancePlayhead` 便于测试。Zustand store 新增 `isPlaying / playheadTime / loop` 及配套动作。`FrameBar` 被新的 `Timeline` 组件取代。

**Tech Stack:** React 18, react-konva 18, Zustand 4, Vite 5, Vitest + @testing-library/react（jsdom，globals 已开，setup 在 `client/src/test-setup.js`）。

---

## File Structure

- **Create** `client/src/utils/interpolate.js` — 纯函数：`frameStartTimes`, `totalDuration`, `interpolateAt`, `getEditableFrameIndex`, `advancePlayhead`。无 React 依赖，最易测。
- **Create** `client/src/utils/interpolate.test.js` — 上述纯函数的单测。
- **Modify** `client/src/store/boardStore.js` — 新增 `isPlaying/playheadTime/loop` 状态与 `play/pause/toggleLoop/setPlayhead/insertFrameAfter/setFrameDuration` 动作；修改 `setBoard`(初始化新字段)、`setCurrentFrame`(同步 playhead)、`removeFrame`(同步 playhead)；删除 `addFrame`。
- **Modify** `client/src/store/boardStore.test.js` — 新动作的测试，替换 `addFrame` 测试。
- **Create** `client/src/hooks/usePlaybackEngine.js` — rAF 循环，订阅 store 的 isPlaying 变化，用 `advancePlayhead` 推进。
- **Create** `client/src/components/Timeline.jsx` — 比例帧块 + 播放头 + 播放/暂停 + ⏮⏭ + 循环开关 + 时长输入框。
- **Create** `client/src/components/Timeline.test.jsx` — 组件交互测试。
- **Modify** `client/src/components/Player.jsx` — 新增 `draggable` prop（默认 true），只读时禁拖。
- **Modify** `client/src/components/Disc.jsx` — 同上。
- **Modify** `client/src/components/BoardCanvas.jsx` — 渲染数据源改为 `interpolateAt`；按 `getEditableFrameIndex` 决定可拖与写入帧；挂 `usePlaybackEngine`；用 `Timeline` 替换 `FrameBar`。
- **Delete** `client/src/components/FrameBar.jsx`。

> 注意：`isPlaying/playheadTime/loop` 是运行时 UI 状态，**不存进 DB**（DB 只存 `board.data`）。因此本 Sub-block 不需要数据库迁移。

---

## Task 1: 时间轴几何纯函数 `frameStartTimes` / `totalDuration`

**Files:**
- Create: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/utils/interpolate.test.js`：

```js
import { frameStartTimes, totalDuration } from './interpolate'

const frames = [
  { id: 'f0', duration: 1000 },
  { id: 'f1', duration: 500 },
  { id: 'f2', duration: 9999 }, // 最后一帧 duration 无效
]

test('frameStartTimes returns cumulative start time of each frame', () => {
  expect(frameStartTimes(frames)).toEqual([0, 1000, 1500])
})

test('totalDuration sums all but the last frame duration', () => {
  // 1000 + 500，最后一帧不计
  expect(totalDuration(frames)).toBe(1500)
})

test('totalDuration of single frame is 0', () => {
  expect(totalDuration([{ id: 'f0', duration: 1000 }])).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: FAIL，`frameStartTimes is not a function` / 模块不存在。

- [ ] **Step 3: Write minimal implementation**

写入 `client/src/utils/interpolate.js`：

```js
// 每帧在整条时间轴上的起始毫秒位置
export function frameStartTimes(frames) {
  const starts = []
  let acc = 0
  for (let i = 0; i < frames.length; i++) {
    starts.push(acc)
    acc += frames[i].duration
  }
  return starts
}

// 时间轴总长度 = 除最后一帧外所有帧 duration 之和（最后一帧无下一帧可过渡）
export function totalDuration(frames) {
  let acc = 0
  for (let i = 0; i < frames.length - 1; i++) {
    acc += frames[i].duration
  }
  return acc
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: PASS（3 个测试通过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: frameStartTimes and totalDuration timeline geometry helpers"
```

---

## Task 2: 插值纯函数 `interpolateAt`

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/utils/interpolate.test.js` 末尾追加：

```js
import { interpolateAt } from './interpolate'

const animFrames = [
  {
    id: 'f0', duration: 1000,
    playerStates: { r1: { x: 0, y: 0, orientation: 0 } },
    discState: { x: 0, y: 0 },
  },
  {
    id: 'f1', duration: 500,
    playerStates: { r1: { x: 1, y: 0.5, orientation: 2 } },
    discState: { x: 1, y: 1 },
  },
]

test('interpolateAt at frame start returns that frame exactly', () => {
  const v = interpolateAt(animFrames, 0)
  expect(v.playerStates.r1).toEqual({ x: 0, y: 0, orientation: 0 })
  expect(v.discState).toEqual({ x: 0, y: 0 })
})

test('interpolateAt at segment midpoint returns midpoint values', () => {
  const v = interpolateAt(animFrames, 500) // 第0段中点 (0..1000)
  expect(v.playerStates.r1.x).toBeCloseTo(0.5)
  expect(v.playerStates.r1.y).toBeCloseTo(0.25)
  expect(v.playerStates.r1.orientation).toBeCloseTo(1)
  expect(v.discState.x).toBeCloseTo(0.5)
})

test('interpolateAt at/after total duration returns last frame static state', () => {
  const v = interpolateAt(animFrames, 1000) // == totalDuration，落在最后一帧
  expect(v.playerStates.r1).toEqual({ x: 1, y: 0.5, orientation: 2 })
  const v2 = interpolateAt(animFrames, 99999)
  expect(v2.playerStates.r1).toEqual({ x: 1, y: 0.5, orientation: 2 })
})

test('interpolateAt with single frame returns that frame', () => {
  const single = [animFrames[0]]
  const v = interpolateAt(single, 0)
  expect(v.playerStates.r1).toEqual({ x: 0, y: 0, orientation: 0 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: FAIL，`interpolateAt is not a function`。

- [ ] **Step 3: Write minimal implementation**

在 `client/src/utils/interpolate.js` 追加：

```js
function lerp(a, b, t) {
  return a + (b - a) * t
}

function snapshot(frame) {
  const playerStates = {}
  for (const id in frame.playerStates) {
    playerStates[id] = { ...frame.playerStates[id] }
  }
  return { playerStates, discState: { ...frame.discState } }
}

function lerpFrames(f0, f1, t) {
  const playerStates = {}
  for (const id in f0.playerStates) {
    const s0 = f0.playerStates[id]
    const s1 = f1.playerStates[id] ?? s0
    playerStates[id] = {
      x: lerp(s0.x, s1.x, t),
      y: lerp(s0.y, s1.y, t),
      orientation: lerp(s0.orientation, s1.orientation, t),
    }
  }
  return {
    playerStates,
    discState: {
      x: lerp(f0.discState.x, f1.discState.x, t),
      y: lerp(f0.discState.y, f1.discState.y, t),
    },
  }
}

// 给定整条时间轴上的毫秒位置，返回所有元素插值后的位置
export function interpolateAt(frames, playheadTime) {
  if (frames.length === 1) return snapshot(frames[0])
  const total = totalDuration(frames)
  if (playheadTime >= total) return snapshot(frames[frames.length - 1])
  if (playheadTime <= 0) return snapshot(frames[0])

  const starts = frameStartTimes(frames)
  let i = 0
  for (let k = 0; k < frames.length - 1; k++) {
    if (playheadTime >= starts[k] && playheadTime < starts[k + 1]) {
      i = k
      break
    }
  }
  const dur = frames[i].duration
  const t = dur > 0 ? (playheadTime - starts[i]) / dur : 0
  return lerpFrames(frames[i], frames[i + 1], t)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: PASS（全部通过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: interpolateAt derived-render pure function"
```

---

## Task 3: 可编辑判定 `getEditableFrameIndex`

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/utils/interpolate.test.js` 末尾追加：

```js
import { getEditableFrameIndex } from './interpolate'

const efFrames = [
  { id: 'f0', duration: 1000, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f1', duration: 500, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f2', duration: 0, playerStates: {}, discState: { x: 0, y: 0 } },
]
// frameStartTimes = [0, 1000, 1500]

test('getEditableFrameIndex returns index when parked exactly on a keyframe start', () => {
  expect(getEditableFrameIndex(efFrames, 0, false)).toBe(0)
  expect(getEditableFrameIndex(efFrames, 1000, false)).toBe(1)
  expect(getEditableFrameIndex(efFrames, 1500, false)).toBe(2) // 最后一帧也可编辑
})

test('getEditableFrameIndex returns -1 between keyframes', () => {
  expect(getEditableFrameIndex(efFrames, 500, false)).toBe(-1)
})

test('getEditableFrameIndex returns -1 while playing', () => {
  expect(getEditableFrameIndex(efFrames, 0, true)).toBe(-1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: FAIL，`getEditableFrameIndex is not a function`。

- [ ] **Step 3: Write minimal implementation**

在 `client/src/utils/interpolate.js` 追加：

```js
// 播放头精确停在某关键帧起点且未播放时返回该帧索引，否则 -1
export function getEditableFrameIndex(frames, playheadTime, isPlaying) {
  if (isPlaying) return -1
  const starts = frameStartTimes(frames)
  return starts.findIndex((s) => s === playheadTime)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: getEditableFrameIndex edit-gate helper"
```

---

## Task 4: 播放头推进纯函数 `advancePlayhead`

**Files:**
- Modify: `client/src/utils/interpolate.js`
- Test: `client/src/utils/interpolate.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/utils/interpolate.test.js` 末尾追加：

```js
import { advancePlayhead } from './interpolate'

test('advancePlayhead advances within range', () => {
  expect(advancePlayhead(100, 50, 1000, false)).toEqual({ next: 150, stop: false })
})

test('advancePlayhead stops at total when not looping and reaching end', () => {
  expect(advancePlayhead(980, 50, 1000, false)).toEqual({ next: 1000, stop: true })
})

test('advancePlayhead wraps around when looping', () => {
  const r = advancePlayhead(980, 70, 1000, true) // 1050 % 1000 = 50
  expect(r.stop).toBe(false)
  expect(r.next).toBeCloseTo(50)
})

test('advancePlayhead with zero total stays at 0', () => {
  expect(advancePlayhead(0, 50, 0, true)).toEqual({ next: 0, stop: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: FAIL，`advancePlayhead is not a function`。

- [ ] **Step 3: Write minimal implementation**

在 `client/src/utils/interpolate.js` 追加：

```js
// 推进播放头：返回新位置与是否应停止（rAF 循环用）
export function advancePlayhead(playheadTime, dt, total, loop) {
  if (total <= 0) return { next: 0, stop: false }
  const next = playheadTime + dt
  if (next >= total) {
    if (loop) return { next: next % total, stop: false }
    return { next: total, stop: true }
  }
  return { next, stop: false }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: PASS（interpolate.test.js 全部通过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/interpolate.js client/src/utils/interpolate.test.js
git commit -m "feat: advancePlayhead playback-advance pure function"
```

---

## Task 5: Store 播放状态与动作

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: Write the failing test**

替换 `client/src/store/boardStore.test.js` 中 `beforeEach` 的 setState 为包含新字段，并替换 `addFrame` 测试、追加新动作测试。

将文件顶部 `beforeEach` 改为：

```js
beforeEach(() => {
  useBoardStore.setState({
    board: null,
    currentFrameIndex: 0,
    isDirty: false,
    isPlaying: false,
    playheadTime: 0,
    loop: false,
  })
})
```

删除原 `addFrame appends copy of current frame` 测试（第 60-66 行那段），并在文件末尾追加：

```js
test('insertFrameAfter inserts a copy after the given index', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({
    id: 'frame-1', duration: 1000,
    playerStates: { r1: { x: 0.9, y: 0.9, orientation: 0 }, b1: { x: 0.1, y: 0.1, orientation: 0 } },
    discState: { x: 0.2, y: 0.2 }, annotations: [],
  })
  act(() => result.current.setBoard(board))
  act(() => result.current.insertFrameAfter(0))
  expect(result.current.board.data.frames.length).toBe(3)
  // 新帧复制 index 0 的状态，插在 index 1
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(0.1)
  expect(result.current.currentFrameIndex).toBe(1)
  expect(result.current.isDirty).toBe(true)
})

test('insertFrameAfter on last frame appends', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.insertFrameAfter(0))
  expect(result.current.board.data.frames.length).toBe(2)
  expect(result.current.currentFrameIndex).toBe(1)
})

test('setFrameDuration updates a frame duration with floor', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setFrameDuration(0, 2500))
  expect(result.current.board.data.frames[0].duration).toBe(2500)
  act(() => result.current.setFrameDuration(0, 10)) // 低于下限
  expect(result.current.board.data.frames[0].duration).toBe(100)
  expect(result.current.isDirty).toBe(true)
})

test('play / pause toggle isPlaying', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.play())
  expect(result.current.isPlaying).toBe(true)
  act(() => result.current.pause())
  expect(result.current.isPlaying).toBe(false)
})

test('toggleLoop flips loop', () => {
  const { result } = renderHook(() => useBoardStore())
  expect(result.current.loop).toBe(false)
  act(() => result.current.toggleLoop())
  expect(result.current.loop).toBe(true)
})

test('setPlayhead sets playheadTime', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setPlayhead(640))
  expect(result.current.playheadTime).toBe(640)
})

test('setCurrentFrame syncs playhead to that frame start and pauses', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 500, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.play())
  act(() => result.current.setCurrentFrame(1))
  expect(result.current.currentFrameIndex).toBe(1)
  expect(result.current.playheadTime).toBe(1000) // frame 1 起点 = frame 0 duration
  expect(result.current.isPlaying).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/store/boardStore.test.js`
Expected: FAIL，`insertFrameAfter is not a function` 等。

- [ ] **Step 3: Write minimal implementation**

修改 `client/src/store/boardStore.js`。引入时间轴几何：在顶部 import 之后加：

```js
import { frameStartTimes } from '../utils/interpolate'

const MIN_DURATION = 100
```

把初始 state 与 `setBoard` 改为含新字段：

```js
  board: null,
  currentFrameIndex: 0,
  isDirty: false,
  isPlaying: false,
  playheadTime: 0,
  loop: false,

  setBoard: (board) => set({
    board, currentFrameIndex: 0, isDirty: false,
    isPlaying: false, playheadTime: 0, loop: false,
  }),
```

删除整个 `addFrame: () => set(...)` 块（原 26-39 行），替换为 `insertFrameAfter` 与 `setFrameDuration`：

```js
  insertFrameAfter: (index) => set((s) => {
    const frames = s.board.data.frames
    const src = frames[index]
    const newFrame = {
      ...JSON.parse(JSON.stringify(src)),
      id: `frame-${Date.now()}`,
      annotations: [],
    }
    const next = [...frames.slice(0, index + 1), newFrame, ...frames.slice(index + 1)]
    const newIndex = index + 1
    return {
      board: { ...s.board, data: { ...s.board.data, frames: next } },
      currentFrameIndex: newIndex,
      playheadTime: frameStartTimes(next)[newIndex],
      isPlaying: false,
      isDirty: true,
    }
  }),

  setFrameDuration: (index, ms) => set((s) => {
    const duration = Math.max(MIN_DURATION, Math.round(ms))
    const frames = s.board.data.frames.map((f, i) =>
      i === index ? { ...f, duration } : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
  }),
```

把 `setCurrentFrame` 改为同步 playhead 并暂停：

```js
  setCurrentFrame: (frameIndex) => set((s) => ({
    currentFrameIndex: frameIndex,
    playheadTime: frameStartTimes(s.board.data.frames)[frameIndex],
    isPlaying: false,
  })),
```

把 `removeFrame` 的 return 补上 playhead 同步（在已有 `currentFrameIndex` 计算后）：

```js
  removeFrame: (frameIndex) => set((s) => {
    if (s.board.data.frames.length <= 1) return s
    const frames = s.board.data.frames.filter((_, i) => i !== frameIndex)
    const currentFrameIndex = Math.min(s.currentFrameIndex, frames.length - 1)
    return {
      board: { ...s.board, data: { ...s.board.data, frames } },
      currentFrameIndex,
      playheadTime: frameStartTimes(frames)[currentFrameIndex],
      isPlaying: false,
      isDirty: true,
    }
  }),
```

在 `markClean` 之前追加播放动作：

```js
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  setPlayhead: (ms) => set({ playheadTime: ms }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/store/boardStore.test.js`
Expected: PASS（全部通过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: store playback state, insertFrameAfter, setFrameDuration"
```

---

## Task 6: 播放引擎 hook `usePlaybackEngine`

**Files:**
- Create: `client/src/hooks/usePlaybackEngine.js`

> 说明：此 hook 是 rAF + store 订阅的薄胶水层，推进逻辑已由 Task 4 的 `advancePlayhead` 纯函数覆盖测试。此处不再写单测（jsdom 下 rAF 计时难以确定性断言），仅实现。

- [ ] **Step 1: Create the hook**

写入 `client/src/hooks/usePlaybackEngine.js`：

```js
import { useEffect, useRef } from 'react'
import { useBoardStore } from '../store/boardStore'
import { totalDuration, advancePlayhead } from '../utils/interpolate'

// 监听 store 的 isPlaying，用 requestAnimationFrame 累加 playheadTime
export function usePlaybackEngine() {
  const rafRef = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    function tick(now) {
      const { isPlaying, playheadTime, loop, board, setPlayhead, pause } =
        useBoardStore.getState()
      if (!isPlaying || !board) {
        rafRef.current = null
        return
      }
      if (lastRef.current == null) lastRef.current = now
      const dt = now - lastRef.current
      lastRef.current = now

      const total = totalDuration(board.data.frames)
      const { next, stop } = advancePlayhead(playheadTime, dt, total, loop)
      setPlayhead(next)
      if (stop) {
        pause()
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.isPlaying && !prev.isPlaying) {
        lastRef.current = null
        rafRef.current = requestAnimationFrame(tick)
      } else if (!state.isPlaying && prev.isPlaying && rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    })

    return () => {
      unsub()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `cd client && npx vitest run src/utils/interpolate.test.js`
Expected: PASS（确认 interpolate 仍导出 hook 依赖的 `totalDuration` / `advancePlayhead`，无回归）。

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/usePlaybackEngine.js
git commit -m "feat: usePlaybackEngine rAF playback loop"
```

---

## Task 7: Timeline 组件

**Files:**
- Create: `client/src/components/Timeline.jsx`
- Test: `client/src/components/Timeline.test.jsx`

- [ ] **Step 1: Write the failing test**

写入 `client/src/components/Timeline.test.jsx`：

```js
import { render, screen, fireEvent } from '@testing-library/react'
import Timeline from './Timeline'

const frames = [
  { id: 'f0', duration: 1000 },
  { id: 'f1', duration: 3000 },
  { id: 'f2', duration: 500 },
]

function setup(overrides = {}) {
  const handlers = {
    onJumpToFrame: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onToggleLoop: vi.fn(),
    onInsertAfter: vi.fn(),
    onRemoveFrame: vi.fn(),
    onSetDuration: vi.fn(),
    onStep: vi.fn(),
    onSetPlayhead: vi.fn(),
  }
  render(
    <Timeline
      frames={frames}
      currentFrameIndex={0}
      playheadTime={0}
      isPlaying={false}
      loop={false}
      {...handlers}
      {...overrides}
    />
  )
  return handlers
}

test('renders one block per frame, numbered', () => {
  setup()
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('clicking a frame block jumps to it', () => {
  const h = setup()
  fireEvent.click(screen.getByText('2'))
  expect(h.onJumpToFrame).toHaveBeenCalledWith(1)
})

test('play button calls onPlay; shows pause while playing', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('播放'))
  expect(h.onPlay).toHaveBeenCalled()
})

test('pause button calls onPause when playing', () => {
  const h = setup({ isPlaying: true })
  fireEvent.click(screen.getByLabelText('暂停'))
  expect(h.onPause).toHaveBeenCalled()
})

test('step buttons call onStep with direction', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('上一帧'))
  expect(h.onStep).toHaveBeenCalledWith(-1)
  fireEvent.click(screen.getByLabelText('下一帧'))
  expect(h.onStep).toHaveBeenCalledWith(1)
})

test('loop toggle calls onToggleLoop', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('循环'))
  expect(h.onToggleLoop).toHaveBeenCalled()
})

test('insert button inserts after current frame', () => {
  const h = setup({ currentFrameIndex: 1 })
  fireEvent.click(screen.getByLabelText('插入帧'))
  expect(h.onInsertAfter).toHaveBeenCalledWith(1)
})

test('right-click a frame block removes it', () => {
  const h = setup()
  fireEvent.contextMenu(screen.getByText('2'))
  expect(h.onRemoveFrame).toHaveBeenCalledWith(1)
})

test('duration input commits on change (seconds -> ms)', () => {
  const h = setup({ currentFrameIndex: 0 })
  const input = screen.getByLabelText('当前帧时长(秒)')
  fireEvent.change(input, { target: { value: '2' } })
  fireEvent.blur(input)
  expect(h.onSetDuration).toHaveBeenCalledWith(0, 2000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/Timeline.test.jsx`
Expected: FAIL，找不到 `./Timeline` 模块。

- [ ] **Step 3: Write minimal implementation**

写入 `client/src/components/Timeline.jsx`：

```js
import { useRef } from 'react'
import { frameStartTimes, totalDuration } from '../utils/interpolate'

const MIN_BLOCK_PX = 44

const STYLES = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', background: '#111', borderTop: '1px solid #333',
  },
  btn: {
    padding: '0 12px', height: 36, borderRadius: 6,
    background: '#2a2a3e', border: '1px solid #555',
    color: '#ccc', cursor: 'pointer', fontSize: 16, lineHeight: 1,
  },
  toggleOn: { background: '#4a9eff', borderColor: '#4a9eff', color: '#fff' },
  track: {
    position: 'relative', flex: 1, height: 36,
    display: 'flex', gap: 2, overflow: 'hidden',
  },
  frame: (active) => ({
    height: 36, borderRadius: 6,
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '2px solid #4a9eff' : '2px solid #444',
    color: '#fff', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', flexShrink: 0,
  }),
  playhead: (leftPct) => ({
    position: 'absolute', top: 0, bottom: 0, left: `${leftPct}%`,
    width: 2, background: '#ff5252', pointerEvents: 'none',
  }),
  durInput: {
    width: 56, height: 30, borderRadius: 6, textAlign: 'center',
    background: '#1a1a2e', border: '1px solid #555', color: '#fff',
  },
}

export default function Timeline({
  frames,
  currentFrameIndex,
  playheadTime,
  isPlaying,
  loop,
  onJumpToFrame,
  onSetPlayhead,
  onPlay,
  onPause,
  onToggleLoop,
  onInsertAfter,
  onRemoveFrame,
  onSetDuration,
  onStep,
}) {
  const trackRef = useRef(null)
  const total = totalDuration(frames)
  const starts = frameStartTimes(frames)
  const playheadPct = total > 0 ? Math.min(100, (playheadTime / total) * 100) : 0

  // 帧块宽度 ∝ duration（最后一帧用最小宽度）
  function blockFlex(i) {
    if (i === frames.length - 1) return `0 0 ${MIN_BLOCK_PX}px`
    const dur = frames[i].duration || 1
    return `${dur} 1 ${MIN_BLOCK_PX}px`
  }

  function handleTrackClick(e) {
    if (!trackRef.current || total <= 0) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onSetPlayhead(Math.max(0, Math.min(total, pct * total)))
  }

  const curDurSec = (frames[currentFrameIndex]?.duration ?? 0) / 1000

  return (
    <div style={STYLES.bar}>
      <button style={STYLES.btn} aria-label="上一帧" onClick={() => onStep(-1)}>⏮</button>
      {isPlaying ? (
        <button style={STYLES.btn} aria-label="暂停" onClick={onPause}>⏸</button>
      ) : (
        <button style={STYLES.btn} aria-label="播放" onClick={onPlay}>▶</button>
      )}
      <button style={STYLES.btn} aria-label="下一帧" onClick={() => onStep(1)}>⏭</button>
      <button
        style={{ ...STYLES.btn, ...(loop ? STYLES.toggleOn : {}) }}
        aria-label="循环"
        onClick={onToggleLoop}
      >🔁</button>

      <div ref={trackRef} style={STYLES.track} onClick={handleTrackClick}>
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            style={{ ...STYLES.frame(i === currentFrameIndex), flex: blockFlex(i) }}
            onClick={(e) => { e.stopPropagation(); onJumpToFrame(i) }}
            onContextMenu={(e) => {
              e.preventDefault()
              if (frames.length > 1) onRemoveFrame(i)
            }}
            title={frames.length > 1 ? '右键删除此帧' : ''}
          >
            {i + 1}
          </div>
        ))}
        <div style={STYLES.playhead(playheadPct)} />
      </div>

      <label style={{ color: '#888', fontSize: 12 }}>时长</label>
      <input
        type="number"
        step="0.1"
        min="0.1"
        aria-label="当前帧时长(秒)"
        style={STYLES.durInput}
        defaultValue={curDurSec}
        key={`${currentFrameIndex}-${curDurSec}`}
        onBlur={(e) => onSetDuration(currentFrameIndex, Math.round(parseFloat(e.target.value || '0') * 1000))}
      />
      <button style={STYLES.btn} aria-label="插入帧" onClick={() => onInsertAfter(currentFrameIndex)}>＋</button>
    </div>
  )
}
```

> 注：测试用 `fireEvent.change` 后 `blur`；`onBlur` 读取最新值并换算成毫秒提交。`key` 含 duration 保证父层更新时输入框重置为新值。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/Timeline.test.jsx`
Expected: PASS（全部通过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Timeline.jsx client/src/components/Timeline.test.jsx
git commit -m "feat: Timeline component with proportional blocks and playhead"
```

---

## Task 8: Player / Disc 支持只读（draggable prop）

**Files:**
- Modify: `client/src/components/Player.jsx`
- Modify: `client/src/components/Disc.jsx`

- [ ] **Step 1: Add draggable prop to Player**

修改 `client/src/components/Player.jsx`：在 props 解构中加入 `draggable = true`：

```js
export default function Player({
  player,
  playerState,
  fieldWidth,
  fieldHeight,
  onDragEnd,
  onDoubleClick,
  draggable = true,
}) {
```

把 `<Group>` 的 `draggable` 改为受控：

```js
    <Group
      x={cx} y={cy}
      draggable={draggable}
      onDragEnd={handleDragEnd}
      onDblClick={() => onDoubleClick?.(player.id)}
    >
```

- [ ] **Step 2: Add draggable prop to Disc**

修改 `client/src/components/Disc.jsx`：

```js
export default function Disc({
  discState,
  fieldWidth,
  fieldHeight,
  onDragEnd,
  draggable = true,
}) {
```

```js
    <Group x={cx} y={cy} draggable={draggable} onDragEnd={handleDragEnd}>
```

- [ ] **Step 3: Verify no regression**

Run: `cd client && npx vitest run`
Expected: PASS（现有 coords / store / interpolate / Timeline 测试不受影响）。

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Player.jsx client/src/components/Disc.jsx
git commit -m "feat: Player and Disc accept draggable prop for read-only mode"
```

---

## Task 9: 接入 BoardCanvas（派生渲染 + 可编辑判定 + 删除 FrameBar）

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`
- Delete: `client/src/components/FrameBar.jsx`

- [ ] **Step 1: Rewrite BoardCanvas to use interpolated view**

把 `client/src/components/BoardCanvas.jsx` 的 import 段、store 解构、渲染段替换为下面内容（`useFieldSize` hook 与 `PADDING/FIELD_ASPECT` 常量保持不变，不要改）。

顶部 import 改为：

```js
import { useEffect, useRef, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import Field from './Field'
import Player from './Player'
import Disc from './Disc'
import Timeline from './Timeline'
import { useBoardStore } from '../store/boardStore'
import { usePlaybackEngine } from '../hooks/usePlaybackEngine'
import { interpolateAt, getEditableFrameIndex, frameStartTimes } from '../utils/interpolate'
import { saveBoard } from '../api/boards'
```

组件体内 store 解构 + 派生计算改为：

```js
export default function BoardCanvas() {
  const containerRef = useRef(null)
  const { stageW, stageH, fieldW, fieldH, fieldX, fieldY } = useFieldSize(containerRef)
  const {
    board, currentFrameIndex, isDirty, playheadTime, isPlaying, loop,
    updateFramePlayerState, updateFrameDiscState,
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration,
    setPlayhead, play, pause, toggleLoop, markClean,
  } = useBoardStore()

  usePlaybackEngine()

  // Auto-save 1 second after any dirty change
  useEffect(() => {
    if (!isDirty || !board) return
    const timer = setTimeout(async () => {
      await saveBoard(board.id, { data: board.data })
      markClean()
    }, 1000)
    return () => clearTimeout(timer)
  }, [isDirty, board])

  const frames = board?.data.frames
  const view = frames ? interpolateAt(frames, playheadTime) : null
  const editableIndex = frames ? getEditableFrameIndex(frames, playheadTime, isPlaying) : -1
  const editable = editableIndex !== -1

  function handleStep(dir) {
    if (!frames) return
    const next = Math.max(0, Math.min(frames.length - 1, currentFrameIndex + dir))
    setCurrentFrame(next)
  }
```

渲染段（`return (...)`）替换为：

```js
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <div style={{
        padding: '8px 16px', background: '#111',
        borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{board?.name ?? '加载中…'}</span>
        {isDirty && <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>}
        {!editable && board && <span style={{ fontSize: 12, color: '#f5c518' }}>预览中（停在关键帧才能编辑）</span>}
      </div>

      {/* 画布 — containerRef 始终挂载 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0d1a' }}>
        {!board || !view ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            加载中…
          </div>
        ) : (
          <Stage width={stageW} height={stageH}>
            <Layer x={fieldX} y={fieldY}>
              <Field fieldWidth={fieldW} fieldHeight={fieldH} />
            </Layer>
            <Layer x={fieldX} y={fieldY}>
              {board.data.players.map(player => {
                const state = view.playerStates[player.id]
                if (!state) return null
                return (
                  <Player
                    key={player.id}
                    player={player}
                    playerState={state}
                    fieldWidth={fieldW}
                    fieldHeight={fieldH}
                    draggable={editable}
                    onDragEnd={(id, newState) =>
                      updateFramePlayerState(editableIndex, id, newState)
                    }
                    onDoubleClick={(id) => {
                      const p = board.data.players.find(pl => pl.id === id)
                      const newName = prompt(
                        `重命名球员 ${p.number}（当前: ${p.name}）`,
                        p.name
                      )
                      if (newName !== null && newName.trim()) {
                        useBoardStore.getState().renamePlayer(id, newName.trim())
                      }
                    }}
                  />
                )
              })}
              <Disc
                discState={view.discState}
                fieldWidth={fieldW}
                fieldHeight={fieldH}
                draggable={editable}
                onDragEnd={(newState) =>
                  updateFrameDiscState(editableIndex, newState)
                }
              />
            </Layer>
          </Stage>
        )}
      </div>

      {/* 时间轴 */}
      {board && (
        <Timeline
          frames={board.data.frames}
          currentFrameIndex={currentFrameIndex}
          playheadTime={playheadTime}
          isPlaying={isPlaying}
          loop={loop}
          onJumpToFrame={setCurrentFrame}
          onSetPlayhead={setPlayhead}
          onPlay={play}
          onPause={pause}
          onToggleLoop={toggleLoop}
          onInsertAfter={insertFrameAfter}
          onRemoveFrame={removeFrame}
          onSetDuration={setFrameDuration}
          onStep={handleStep}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete FrameBar**

```bash
git rm client/src/components/FrameBar.jsx
```

- [ ] **Step 3: Run full test suite**

Run: `cd client && npx vitest run`
Expected: PASS（所有 client 测试通过，无对已删除 FrameBar 的引用）。

- [ ] **Step 4: Manual smoke test**

Run: 启动 `cd client && npm run dev`，另开终端启动后端，浏览器打开一个战术板：
- 拖一个球员 → 新增一帧（＋）→ 把球员拖到别处 → 点播放：球员应从起点平滑移动到终点
- 拖动播放头到中间：球员停在中途，顶栏显示"预览中"，此时拖不动球员
- 点第一个帧块：跳回起点，可再次编辑
- 打开🔁后播放：到末尾回绕循环；关闭后播完停在最后一帧
- 拖一个帧块越宽（duration 越大）播放越慢；改时长输入框数值生效
- 右键中间帧块：删除该帧

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: wire animation playback into BoardCanvas, replace FrameBar with Timeline"
```

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档逐节）：**
- 2.1 比例时间轴替换 FrameBar → Task 7（blockFlex ∝ duration）+ Task 9（删除 FrameBar）✅
- 2.2 点击帧块跳转 / 拖播放头 scrub → Task 7（onJumpToFrame / handleTrackClick→onSetPlayhead）✅
- 2.3 ⏮⏭ 步进 → Task 7 + Task 9（handleStep）✅
- 2.4 可编辑判定 → Task 3（getEditableFrameIndex）+ Task 9（editable 控制 draggable 与写入 editableIndex）✅
- 2.5 时长编辑（数字输入框）→ Task 7（durInput → onSetDuration）✅；拖帧块右边缘 → 见下方「已知简化」
- 2.6 循环开关默认关 → Task 5（loop:false 初始 + toggleLoop）+ Task 7（🔁 按钮）+ Task 6（advancePlayhead loop 分支）✅
- 2.7 ＋ 在选中帧后插入 / 右键删帧 → Task 5（insertFrameAfter）+ Task 7（onInsertAfter / onRemoveFrame）✅
- 3.1 interpolateAt 派生渲染 → Task 2 + Task 9 ✅
- 3.2 store 状态与动作 → Task 5 ✅
- 3.3 rAF 播放引擎 + loop 回绕 → Task 4 + Task 6 ✅
- 4 测试思路四类 → Task 1-5、7 覆盖；播放引擎以纯函数 advancePlayhead 覆盖 ✅

**2. Placeholder scan：** 无 TODO/TBD/"类似上文"；每个代码步骤均给出完整代码。

**3. Type consistency：** `interpolateAt`/`getEditableFrameIndex`/`advancePlayhead`/`frameStartTimes`/`totalDuration` 命名在 Task 1-4 定义、Task 5/6/9 调用一致；store 动作名 `insertFrameAfter/setFrameDuration/play/pause/toggleLoop/setPlayhead` 在 Task 5 定义、Task 9 调用一致；Timeline props 名在 Task 7 定义、Task 9 传入一致。

**已知简化（不阻塞本 Sub-block，记入待办）：**
- **拖帧块右边缘改时长**未实现，仅保留数字输入框。设计 2.5 要求两者并存——拖边缘涉及 pointer 拖拽几何，jsdom 难以可靠测试，且数字输入已覆盖核心需求。**建议**：作为本 Sub-block 收尾后的小增强单独加，或在用户实际使用后按需补。执行到 Task 7 时若需要，可追加一个 onMouseDown 边缘把手 + clientX→duration 映射。
- **播放头拖动（drag scrub）** 当前以「点击 track 定位」(handleTrackClick) 实现连续定位；逐像素拖动可后续增强为 mousedown/move/up。点击定位已能 scrub 到任意位置。
