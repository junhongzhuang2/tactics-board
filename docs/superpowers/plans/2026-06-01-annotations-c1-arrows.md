# 标注工具 C1（基础设施 + 箭头）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用箭头走通整条标注管线——数据模型、store 增删（纳入撤销）、Konva 渲染、绘制工具栏、绘制流（含零长度拦截与事件冒泡守卫）、点选 + 删除。

**Architecture:** 几何与可见性抽成纯函数 `utils/annotations.js`；标注存 `frame.annotations[]`（本帧）/`board.data.globalAnnotations[]`（全局），store 用 `withHistory` 增删（自动进撤销）；`AnnotationLayer` 用 Konva `<Arrow>` 渲染「全局 + 活动帧」标注 + 绘制预览；BoardCanvas 加 tool/scope/draft/selection 状态与 Stage 绘制事件。

**Tech Stack:** React 18, react-konva 18（Arrow/Layer）, Zustand 4, Vite 5, Vitest + @testing-library/react（globals 已开，`vi` 全局可用）。

---

## File Structure

- **Create** `client/src/utils/annotations.js` — `createArrowAnnotation`、`visibleAnnotations`、`arrowPixelLength`、常量 `MIN_ARROW_PX`/`DEFAULT_ANNO_COLOR`。
- **Create** `client/src/utils/annotations.test.js`。
- **Modify** `client/src/store/boardStore.js` — `addAnnotation`、`removeAnnotation`。
- **Modify** `client/src/store/boardStore.test.js`。
- **Create** `client/src/components/AnnotationToolbar.jsx` + `AnnotationToolbar.test.jsx`。
- **Create** `client/src/components/ArrowAnnotation.jsx`、`client/src/components/AnnotationLayer.jsx`（Konva，无单测）。
- **Modify** `client/src/components/BoardCanvas.jsx` — 渲染工具栏+标注层、tool/scope/draft/selection 状态、Stage 绘制事件、绘制时禁球员拖动、Delete 键、点空取消选中。

> 无数据库迁移；占位 `annotations`/`globalAnnotations` 已存在。

---

## Task 1: 纯函数 `utils/annotations.js`

**Files:**
- Create: `client/src/utils/annotations.js`
- Test: `client/src/utils/annotations.test.js`

- [ ] **Step 1: Write the failing test**

写入 `client/src/utils/annotations.test.js`：
```js
import { createArrowAnnotation, visibleAnnotations, arrowPixelLength, MIN_ARROW_PX } from './annotations'

test('createArrowAnnotation builds an arrow with a unique id and fields', () => {
  const a = createArrowAnnotation('pass', 0.1, 0.2, 0.3, 0.4, '#ffeb3b')
  expect(a.type).toBe('arrow')
  expect(a.variant).toBe('pass')
  expect([a.x1, a.y1, a.x2, a.y2]).toEqual([0.1, 0.2, 0.3, 0.4])
  expect(a.color).toBe('#ffeb3b')
  expect(a.id).toMatch(/^anno-/)
})

test('visibleAnnotations returns globals always plus the active frame annotations, tagged', () => {
  const data = {
    globalAnnotations: [{ id: 'g1' }],
    frames: [{ annotations: [{ id: 'f0a' }] }, { annotations: [{ id: 'f1a' }] }],
  }
  expect(visibleAnnotations(data, 1)).toEqual([
    { annotation: { id: 'g1' }, scope: 'global', frameIndex: null },
    { annotation: { id: 'f1a' }, scope: 'frame', frameIndex: 1 },
  ])
})

test('visibleAnnotations with no frame annotations returns only globals', () => {
  const data = { globalAnnotations: [{ id: 'g1' }], frames: [{ annotations: [] }] }
  expect(visibleAnnotations(data, 0)).toEqual([
    { annotation: { id: 'g1' }, scope: 'global', frameIndex: null },
  ])
})

test('arrowPixelLength is euclidean; MIN_ARROW_PX is 5', () => {
  expect(arrowPixelLength(0, 0, 3, 4)).toBe(5)
  expect(MIN_ARROW_PX).toBe(5)
  expect(arrowPixelLength(0, 0, 3, 3.9)).toBeLessThan(5)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/utils/annotations.test.js`
Expected: FAIL（找不到 `./annotations`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/utils/annotations.js`：
```js
export const MIN_ARROW_PX = 5
export const DEFAULT_ANNO_COLOR = '#ffeb3b'

// 新建箭头标注（带唯一 id）
export function createArrowAnnotation(variant, x1, y1, x2, y2, color) {
  return { id: `anno-${Date.now()}`, type: 'arrow', variant, x1, y1, x2, y2, color }
}

// 当前应显示的标注：全局（始终）+ 活动帧的本帧标注，带归属信息（供选中/删除定位）
export function visibleAnnotations(data, activeFrameIndex) {
  const globals = (data.globalAnnotations ?? []).map((a) => ({ annotation: a, scope: 'global', frameIndex: null }))
  const frame = data.frames?.[activeFrameIndex]
  const frameAnnos = (frame?.annotations ?? []).map((a) => ({ annotation: a, scope: 'frame', frameIndex: activeFrameIndex }))
  return [...globals, ...frameAnnos]
}

// 两端物理屏幕像素距离（零长度拦截用）
export function arrowPixelLength(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/utils/annotations.test.js`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/annotations.js client/src/utils/annotations.test.js
git commit -m "feat: annotation pure helpers (factory, visible selector, pixel length)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: store `addAnnotation` / `removeAnnotation`

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: Write the failing test**

在 `client/src/store/boardStore.test.js` 末尾追加（`makeBoard()` 的 frame0 已有 `annotations: []`、data 已有 `globalAnnotations: []`）：
```js
test('addAnnotation frame scope pushes to that frame and records history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'a1', type: 'arrow' }))
  expect(result.current.board.data.frames[0].annotations).toHaveLength(1)
  expect(result.current.board.data.frames[0].annotations[0].id).toBe('a1')
  expect(result.current.past.length).toBe(1)
})

test('addAnnotation global scope pushes to globalAnnotations', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('global', null, { id: 'g1', type: 'arrow' }))
  expect(result.current.board.data.globalAnnotations.map(a => a.id)).toContain('g1')
  expect(result.current.past.length).toBe(1)
})

test('removeAnnotation deletes by id and records history; undo restores', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'a1', type: 'arrow' }))
  act(() => result.current.removeAnnotation('frame', 0, 'a1'))
  expect(result.current.board.data.frames[0].annotations).toHaveLength(0)
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].annotations).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: FAIL（`addAnnotation` 不是函数）。

- [ ] **Step 3: Write the implementation**

在 `client/src/store/boardStore.js` 中，紧跟 `setPlayerShowCone` 动作之后新增：
```js
  addAnnotation: (scope, frameIndex, annotation) => set((s) => {
    const data = s.board.data
    if (scope === 'global') {
      const globalAnnotations = [...(data.globalAnnotations ?? []), annotation]
      return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations } }, isDirty: true })
    }
    const frames = data.frames.map((f, i) =>
      i === frameIndex ? { ...f, annotations: [...(f.annotations ?? []), annotation] } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),

  removeAnnotation: (scope, frameIndex, annotationId) => set((s) => {
    const data = s.board.data
    if (scope === 'global') {
      const globalAnnotations = (data.globalAnnotations ?? []).filter((a) => a.id !== annotationId)
      return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations } }, isDirty: true })
    }
    const frames = data.frames.map((f, i) =>
      i === frameIndex ? { ...f, annotations: (f.annotations ?? []).filter((a) => a.id !== annotationId) } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/store/boardStore.test.js`
Expected: PASS（含既有 store 测试）。

- [ ] **Step 5: Commit**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: addAnnotation/removeAnnotation store actions (history-recorded)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: `AnnotationToolbar` 组件

**Files:**
- Create: `client/src/components/AnnotationToolbar.jsx`
- Test: `client/src/components/AnnotationToolbar.test.jsx`

- [ ] **Step 1: Write the failing test**

写入 `client/src/components/AnnotationToolbar.test.jsx`：
```js
import { render, screen, fireEvent } from '@testing-library/react'
import AnnotationToolbar from './AnnotationToolbar'

function setup(over = {}) {
  const h = { onToolChange: vi.fn(), onScopeChange: vi.fn() }
  render(<AnnotationToolbar tool="none" scope="frame" {...h} {...over} />)
  return h
}

test('renders the three tools and two scope buttons', () => {
  setup()
  expect(screen.getByLabelText('选择')).toBeInTheDocument()
  expect(screen.getByLabelText('传盘')).toBeInTheDocument()
  expect(screen.getByLabelText('跑位')).toBeInTheDocument()
  expect(screen.getByLabelText('本帧')).toBeInTheDocument()
  expect(screen.getByLabelText('全局')).toBeInTheDocument()
})

test('clicking a tool calls onToolChange with its key', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('传盘'))
  expect(h.onToolChange).toHaveBeenCalledWith('pass')
  fireEvent.click(screen.getByLabelText('跑位'))
  expect(h.onToolChange).toHaveBeenCalledWith('run')
})

test('clicking a scope button calls onScopeChange', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('全局'))
  expect(h.onScopeChange).toHaveBeenCalledWith('global')
})

test('the active tool and scope are marked aria-pressed', () => {
  setup({ tool: 'pass', scope: 'global' })
  expect(screen.getByLabelText('传盘')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('选择')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByLabelText('全局')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('本帧')).toHaveAttribute('aria-pressed', 'false')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx`
Expected: FAIL（找不到 `./AnnotationToolbar`）。

- [ ] **Step 3: Write the implementation**

写入 `client/src/components/AnnotationToolbar.jsx`：
```js
const TOOLS = [
  { key: 'none', label: '选择' },
  { key: 'pass', label: '传盘' },
  { key: 'run', label: '跑位' },
]

const styles = {
  bar: {
    position: 'absolute', top: 12, left: 12, zIndex: 15,
    display: 'flex', alignItems: 'center', gap: 6, padding: 6,
    background: '#111', border: '1px solid #333', borderRadius: 8,
  },
  btn: (active) => ({
    padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13, cursor: 'pointer',
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '1px solid #4a9eff' : '1px solid #555',
    color: '#fff',
  }),
  sep: { width: 1, height: 20, background: '#444', margin: '0 2px' },
}

export default function AnnotationToolbar({ tool, scope, onToolChange, onScopeChange }) {
  return (
    <div style={styles.bar}>
      {TOOLS.map((t) => (
        <button
          key={t.key}
          aria-label={t.label}
          aria-pressed={tool === t.key}
          style={styles.btn(tool === t.key)}
          onClick={() => onToolChange(t.key)}
        >
          {t.label}
        </button>
      ))}
      <span style={styles.sep} />
      <button aria-label="本帧" aria-pressed={scope === 'frame'} style={styles.btn(scope === 'frame')} onClick={() => onScopeChange('frame')}>本帧</button>
      <button aria-label="全局" aria-pressed={scope === 'global'} style={styles.btn(scope === 'global')} onClick={() => onScopeChange('global')}>全局</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AnnotationToolbar.jsx client/src/components/AnnotationToolbar.test.jsx
git commit -m "feat: AnnotationToolbar (tool + scope buttons)"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: `ArrowAnnotation` + `AnnotationLayer`（Konva 组件）

**Files:**
- Create: `client/src/components/ArrowAnnotation.jsx`
- Create: `client/src/components/AnnotationLayer.jsx`

> Konva 视觉/交互组件，几何由 `annotations.js` 纯函数覆盖；不写脆弱 Konva 渲染测试，交互在 Task 6 人工验证。

- [ ] **Step 1: Write ArrowAnnotation.jsx**

写入 `client/src/components/ArrowAnnotation.jsx`：
```js
import { Arrow } from 'react-konva'

// 一条箭头。pass=虚线，run=实线。hitStrokeWidth 加宽命中区，细线也好点选/右键。
export default function ArrowAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x1, y1, x2, y2, variant, color } = annotation
  return (
    <Arrow
      points={[x1 * fieldWidth, y1 * fieldHeight, x2 * fieldWidth, y2 * fieldHeight]}
      stroke={color}
      fill={color}
      strokeWidth={selected ? 5 : 3}
      dash={variant === 'pass' ? [10, 6] : undefined}
      pointerLength={12}
      pointerWidth={12}
      hitStrokeWidth={15}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
```

- [ ] **Step 2: Write AnnotationLayer.jsx**

写入 `client/src/components/AnnotationLayer.jsx`：
```js
import { Layer } from 'react-konva'
import ArrowAnnotation from './ArrowAnnotation'

// 渲染「全局 + 活动帧」标注（entries）+ 绘制预览（draft）。
export default function AnnotationLayer({
  x, y, entries, draft, draftVariant, draftColor,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete,
}) {
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) => (
        <ArrowAnnotation
          key={annotation.id}
          annotation={annotation}
          fieldWidth={fieldWidth}
          fieldHeight={fieldHeight}
          selected={annotation.id === selectedId}
          onSelect={onSelect}
          onDelete={() => onDelete(scope, frameIndex, annotation.id)}
        />
      ))}
      {draft && (
        <ArrowAnnotation
          annotation={{ id: '__draft__', variant: draftVariant, color: draftColor, ...draft }}
          fieldWidth={fieldWidth}
          fieldHeight={fieldHeight}
          selected={false}
        />
      )}
    </Layer>
  )
}
```

- [ ] **Step 3: Verify no regression + build**

Run: `cd client; npx vitest run`
Expected: PASS（现有全部测试通过，模块解析正常）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ArrowAnnotation.jsx client/src/components/AnnotationLayer.jsx
git commit -m "feat: ArrowAnnotation and AnnotationLayer Konva components"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: BoardCanvas — 工具栏 + 标注层渲染 + 状态 + 绘制时禁拖

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> Konva/DOM 集成，不写脆弱单测；逻辑由纯函数/store 测试 + Task 6 人工验证覆盖。

- [ ] **Step 1: Add imports**

在 `client/src/components/BoardCanvas.jsx` 顶部 import 段加入：
```js
import AnnotationToolbar from './AnnotationToolbar'
import AnnotationLayer from './AnnotationLayer'
import { interpolateAt, getEditableFrameIndex, activeFrameIndex } from '../utils/interpolate'
import { visibleAnnotations, createArrowAnnotation, arrowPixelLength, MIN_ARROW_PX, DEFAULT_ANNO_COLOR } from '../utils/annotations'
```
（把原来的 `import { interpolateAt, getEditableFrameIndex } from '../utils/interpolate'` 整行替换为上面含 `activeFrameIndex` 的版本，避免重复导入。`createArrowAnnotation`/`arrowPixelLength`/`MIN_ARROW_PX` 供 Task 6 使用，现在一并导入。）

- [ ] **Step 2: Destructure annotation actions + add state**

把 store 解构扩展，加入 `addAnnotation, removeAnnotation`：
```js
    renamePlayer, setPlayerShowCone, addAnnotation, removeAnnotation,
  } = useBoardStore()
```
在 `const [selectedPlayerId, setSelectedPlayerId] = useState(null)` 附近新增：
```js
  const [tool, setTool] = useState('none')       // 'none' | 'pass' | 'run'
  const [scope, setScope] = useState('frame')    // 'frame' | 'global'
  const [draft, setDraft] = useState(null)       // { x1, y1, x2, y2 } 归一化
  const [selectedAnnoId, setSelectedAnnoId] = useState(null)
```

- [ ] **Step 3: Derive annotation view data**

在 `const editable = editableIndex !== -1` 之后新增：
```js
  const drawing = tool !== 'none'
  const activeIdx = frames ? activeFrameIndex(frames, playheadTime) : 0
  const annoEntries = board ? visibleAnnotations(board.data, activeIdx) : []
```

- [ ] **Step 4: Disable player/disc drag while drawing**

把两处 `draggable={editable}`（Player 和 Disc）改为 `draggable={editable && !drawing}`。Player 的那处同时保留 `editable={editable}` 不变。

- [ ] **Step 5: Render the AnnotationLayer inside the Stage**

在 Stage 内、**Field 的 `<Layer>` 之后、球员 `<Layer>` 之前**插入标注层（使标注位于场地之上、球员之下）：
```js
            <AnnotationLayer
              x={fieldX}
              y={fieldY}
              entries={annoEntries}
              draft={draft}
              draftVariant={tool === 'none' ? 'run' : tool}
              draftColor={DEFAULT_ANNO_COLOR}
              fieldWidth={fieldW}
              fieldHeight={fieldH}
              selectedId={selectedAnnoId}
              onSelect={(id) => setSelectedAnnoId(id)}
              onDelete={(sc, fi, id) => { removeAnnotation(sc, fi, id); setSelectedAnnoId(null) }}
            />
```

- [ ] **Step 6: Render the toolbar**

在画布 `<div ref={containerRef} ...>` 内部、`<Stage>` 之前（或之后均可，浮动定位）插入：
```js
        {board && (
          <AnnotationToolbar
            tool={tool}
            scope={scope}
            onToolChange={(t) => { setTool(t); setSelectedAnnoId(null) }}
            onScopeChange={setScope}
          />
        )}
```

- [ ] **Step 7: Run full suite + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归）。
Run: `cd client; npx vite build`
Expected: 构建成功，无未用导入错误（注意：`createArrowAnnotation`/`arrowPixelLength`/`MIN_ARROW_PX` 在本任务暂未使用——若构建对未用导入报错则先注释掉这三个导入、Task 6 再恢复；Vite 默认不因未用 import 失败，通常无需处理）。

- [ ] **Step 8: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: render annotation toolbar and layer; disable player drag in draw mode"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: BoardCanvas — 绘制流 + 选中/删除

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> 绘制/选中是 Konva 指针交互，不写脆弱单测；零长度拦截的数学（`arrowPixelLength`）已单测，交互由 Step 6 人工浏览器验证。

- [ ] **Step 1: Add a justDrew ref and a selection ref**

在组件内（hooks 区域）新增：
```js
  const justDrewRef = useRef(false)
  const selectionRef = useRef(null)
  selectionRef.current = annoEntries.find((e) => e.annotation.id === selectedAnnoId) ?? null
```
（`useRef` 已从 'react' 导入。）

- [ ] **Step 2: Add pointer→norm helper and Stage draw handlers**

在 `handleStep` 函数附近新增：
```js
  function pointerToNorm(e) {
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return null
    return {
      x: Math.min(1, Math.max(0, (pos.x - fieldX) / fieldW)),
      y: Math.min(1, Math.max(0, (pos.y - fieldY) / fieldH)),
    }
  }

  function handleStageMouseDown(e) {
    if (!drawing || isPlaying) return
    const p = pointerToNorm(e)
    if (!p) return
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }

  function handleStageMouseMove(e) {
    if (!draft) return
    const p = pointerToNorm(e)
    if (!p) return
    setDraft((d) => ({ ...d, x2: p.x, y2: p.y }))
  }

  function handleStageMouseUp(e) {
    if (!draft) return
    const len = arrowPixelLength(draft.x1 * fieldW, draft.y1 * fieldH, draft.x2 * fieldW, draft.y2 * fieldH)
    if (len >= MIN_ARROW_PX) {
      const anno = createArrowAnnotation(tool, draft.x1, draft.y1, draft.x2, draft.y2, DEFAULT_ANNO_COLOR)
      addAnnotation(scope, currentFrameIndex, anno)
      justDrewRef.current = true   // 防绘制结束的残留 click 取消选中
      e.cancelBubble = true
    }
    setDraft(null)
  }

  function handleStageClick(e) {
    if (justDrewRef.current) { justDrewRef.current = false; return }
    if (tool === 'none' && e.target === e.target.getStage()) {
      setSelectedAnnoId(null) // 点空白取消选中
    }
  }
```

- [ ] **Step 3: Wire the handlers onto the Stage**

把 `<Stage width={stageW} height={stageH}>` 改为：
```js
          <Stage
            width={stageW}
            height={stageH}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onClick={handleStageClick}
          >
```

- [ ] **Step 4: Add Delete/Backspace handling for the selected annotation**

在现有「撤销/重做快捷键」的 `useEffect` 里的 `onKeyDown` 函数中，`if (tag === 'INPUT' || tag === 'TEXTAREA') return` 之后、`isUndoShortcut` 判断之前，插入：
```js
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        e.preventDefault()
        const { scope: sc, frameIndex: fi, annotation } = selectionRef.current
        removeAnnotation(sc, fi, annotation.id)
        setSelectedAnnoId(null)
        return
      }
```
（`removeAnnotation` 是稳定的 store 动作；该 effect 依赖数组保持 `[undo, redo]` 不变即可——`selectionRef`/`removeAnnotation`/`setSelectedAnnoId` 都稳定或为 ref。）

- [ ] **Step 5: Run full suite + build**

Run: `cd client; npx vitest run`
Expected: PASS（无回归；新增交互无自动化测试，纯函数/ store 测试已覆盖逻辑）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 6: Manual smoke test (browser)**

启动前后端，打开一个战术板：
- 点工具栏「传盘」→ 在场地拖一条线，松手 → 出现**虚线**箭头;「跑位」→ **实线**箭头。
- **零长度拦截**：选画笔后在场地上只**单击一下（几乎不拖）**→ 不产生箭头（< 5px 被丢弃）。
- 切「全局」再画 → 切换不同帧该箭头**仍显示**；切「本帧」画的箭头**只在该帧显示**，换帧消失，播放到该帧区间时出现。
- 工具切回「选择」→ 点箭头**选中**（高亮）→ 按 `Delete` 或右键箭头 → 删除。
- 选中箭头后点空白 → 取消选中。**画完箭头后不应误取消已选中项**（残留 click 守卫）。
- 画箭头/删除后按 `Ctrl+Z` → 撤销;`Ctrl+Shift+Z` → 重做。
- 绘制模式下球员**拖不动**；切回「选择」后球员恢复可拖。

> 把结果反馈给我，尤其：零长度是否被拦、本帧/全局显示是否正确、画完是否误取消选中、删除与撤销是否正常。

- [ ] **Step 7: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: arrow drawing flow with zero-length guard, selection and delete"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §2 数据模型 + §3 纯函数（createArrowAnnotation/visibleAnnotations/arrowPixelLength/常量）→ Task 1 ✅
- §4 store addAnnotation/removeAnnotation 走 withHistory → Task 2 ✅
- §5 绘制流：工具模式、draft 预览、**零长度拦截 <5px**、**cancelBubble + justDrewRef 守卫** → Task 6 ✅
- §5 选中/删除（点选、Delete/Backspace、右键）→ Task 4（ArrowAnnotation 事件）+ Task 6（Delete 键、点空取消、justDrewRef）✅
- §6 组件 AnnotationToolbar/ArrowAnnotation(hitStrokeWidth=15)/AnnotationLayer/BoardCanvas → Task 3/4/5/6 ✅
- §6 渲染顺序（场地→标注→球员）→ Task 5 Step 5 ✅
- §7 数据流（活动帧可见性、绘制/删除走 withHistory+自动保存）→ Task 5/6 ✅
- §8 测试：annotations 纯函数、store 增删、AnnotationToolbar → Task 1/2/3 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码。

**3. Type consistency：** `createArrowAnnotation(variant,x1,y1,x2,y2,color)`、`visibleAnnotations(data,activeFrameIndex)` 返回 `{annotation,scope,frameIndex}[]`、`arrowPixelLength(x1,y1,x2,y2)`、`MIN_ARROW_PX`/`DEFAULT_ANNO_COLOR` 在 Task 1 定义，Task 5/6 一致引用；`addAnnotation(scope,frameIndex,annotation)`/`removeAnnotation(scope,frameIndex,id)` Task 2 定义、Task 5/6 调用一致；`AnnotationToolbar`(tool/scope/onToolChange/onScopeChange)、`AnnotationLayer`(x/y/entries/draft/draftVariant/draftColor/fieldWidth/fieldHeight/selectedId/onSelect/onDelete)、`ArrowAnnotation`(annotation/fieldWidth/fieldHeight/selected/onSelect/onDelete) props 在定义与消费处一致。

**已知取舍：** ArrowAnnotation/AnnotationLayer 的 Konva 渲染与 Stage 指针绘制不写自动化测试——几何/可见性/零长度由纯函数覆盖，store 增删有测试，交互由 Task 6 Step 6 人工浏览器验证（与既有 Konva 组件一致）。
