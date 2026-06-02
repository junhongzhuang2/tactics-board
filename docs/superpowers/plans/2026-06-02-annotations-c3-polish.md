# 标注 C3：编辑打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已画好的标注能被移动、改尺寸、切换作用域（本帧↔全局），并让标注工具栏可折叠。

**Architecture:** 移动用 Konva `draggable`（拖动即预览，松手 `updateAnnotation` 提交一步）；改尺寸用自绘 `Handle` 小方块句柄 + BoardCanvas 本地预览 state（拖拽中不入历史，松手提交）；作用域切换用新 store 动作 `moveAnnotation`，由 HTML 浮动工具条 `SelectionToolbar` 触发（`全局→本帧`在非关键帧禁用，防锁死）。

**Tech Stack:** React 18, Zustand 4, react-konva（Konva）, Vite 5, Vitest + @testing-library/react。

设计文档：`docs/superpowers/specs/2026-06-02-annotations-c3-polish-design.md`

---

## File Structure

- **Modify** `client/src/utils/annotations.js` — `translateAnnotation` + `annotationTopAnchor`。
- **Modify** `client/src/utils/annotations.test.js` — 两函数测试。
- **Modify** `client/src/store/boardStore.js` — `moveAnnotation`。
- **Modify** `client/src/store/boardStore.test.js` — `moveAnnotation` 测试。
- **Modify** `client/src/components/AnnotationToolbar.jsx` + `.test.jsx` — 折叠。
- **Create** `client/src/components/Handle.jsx` — 通用可拖句柄。
- **Modify** `client/src/components/{Arrow,Rect,Ellipse,Text}Annotation.jsx` — `draggable` 移动 + 句柄改尺寸。
- **Create** `client/src/components/SelectionToolbar.jsx` — HTML 浮动工具条。
- **Modify** `client/src/components/AnnotationLayer.jsx` — `draggable`/预览/移动/改尺寸透传。
- **Modify** `client/src/components/BoardCanvas.jsx` — 预览 state、移动/改尺寸/工具条接线、`moveAnnotation`、作用域 editable 校验（人工验证）。

> 无数据库迁移；无后端改动。

---

## Task 1: 纯函数 `translateAnnotation` + `annotationTopAnchor`

**Files:**
- Modify: `client/src/utils/annotations.js`
- Test: `client/src/utils/annotations.test.js`

- [ ] **Step 1: 写失败测试** — 在 `annotations.test.js` 顶部 import 加入 `translateAnnotation, annotationTopAnchor`（合并进现有 `from './annotations'`），并在文件末尾追加：

```js
test('translateAnnotation 平移矩形/椭圆/箭头的两角', () => {
  const r = translateAnnotation({ type: 'rect', x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 }, 0.05, -0.1)
  expect(r.x1).toBeCloseTo(0.15); expect(r.y1).toBeCloseTo(0.1)
  expect(r.x2).toBeCloseTo(0.35); expect(r.y2).toBeCloseTo(0.3)
})

test('translateAnnotation 平移文字锚点', () => {
  const t = translateAnnotation({ type: 'text', x: 0.5, y: 0.6 }, 0.1, 0.1)
  expect(t.x).toBeCloseTo(0.6); expect(t.y).toBeCloseTo(0.7)
})

test('annotationTopAnchor 矩形/椭圆/箭头取包围盒顶边中点', () => {
  const a = annotationTopAnchor({ type: 'rect', x1: 0.2, y1: 0.6, x2: 0.4, y2: 0.2 })
  expect(a.x).toBeCloseTo(0.3); expect(a.y).toBeCloseTo(0.2)
})

test('annotationTopAnchor 文字取其锚点', () => {
  const a = annotationTopAnchor({ type: 'text', x: 0.5, y: 0.3 })
  expect(a.x).toBeCloseTo(0.5); expect(a.y).toBeCloseTo(0.3)
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/utils/annotations.test.js` → FAIL（函数未定义）。

- [ ] **Step 3: 实现** — 在 `annotations.js` 末尾追加：

```js
// 平移：返回平移后的坐标 patch（dx,dy 归一化）
export function translateAnnotation(annotation, dx, dy) {
  if (annotation.type === 'text') {
    return { x: annotation.x + dx, y: annotation.y + dy }
  }
  const { x1, y1, x2, y2 } = annotation
  return { x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy }
}

// 包围盒顶边中点（浮动工具条定位用），归一化
export function annotationTopAnchor(annotation) {
  if (annotation.type === 'text') {
    return { x: annotation.x, y: annotation.y }
  }
  const { x1, y1, x2, y2 } = annotation
  return { x: (x1 + x2) / 2, y: Math.min(y1, y2) }
}
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/utils/annotations.test.js` → PASS。

- [ ] **Step 5: 提交**
```bash
git add client/src/utils/annotations.js client/src/utils/annotations.test.js
git commit -m "feat: translateAnnotation + annotationTopAnchor pure helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: store `moveAnnotation`（作用域搬移）

**Files:**
- Modify: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: 写失败测试** — 在 `boardStore.test.js` 的 `updateAnnotation` 测试之后追加：

```js
test('moveAnnotation 本帧→全局：从帧移除、加入 global，记历史，undo 恢复', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'm1', type: 'rect', x1: 0, y1: 0, x2: 0.2, y2: 0.2 }))
  act(() => result.current.moveAnnotation('frame', 0, 'global', null, 'm1'))
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'm1')).toBeUndefined()
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'm1')).toBeTruthy()
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'm1')).toBeTruthy()
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'm1')).toBeUndefined()
})

test('moveAnnotation 全局→本帧：从 global 移除、加入目标帧', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('global', null, { id: 'g9', type: 'text', x: 0.1, y: 0.1, text: 'x' }))
  act(() => result.current.moveAnnotation('global', null, 'frame', 0, 'g9'))
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'g9')).toBeUndefined()
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'g9')).toBeTruthy()
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → FAIL（`moveAnnotation` 不是函数）。

- [ ] **Step 3: 实现** — 在 `boardStore.js` 的 `updateAnnotation` 动作之后新增：

```js
  moveAnnotation: (fromScope, fromFrameIndex, toScope, toFrameIndex, annotationId) => set((s) => {
    const data = s.board.data
    let moved
    const pluck = (arr) => (arr ?? []).filter((a) => {
      if (a.id === annotationId) { moved = a; return false }
      return true
    })
    let globalAnnotations = data.globalAnnotations ?? []
    let frames = data.frames
    if (fromScope === 'global') globalAnnotations = pluck(globalAnnotations)
    else frames = frames.map((f, i) => (i === fromFrameIndex ? { ...f, annotations: pluck(f.annotations) } : f))
    if (!moved) return s
    if (toScope === 'global') globalAnnotations = [...globalAnnotations, moved]
    else frames = frames.map((f, i) => (i === toFrameIndex ? { ...f, annotations: [...(f.annotations ?? []), moved] } : f))
    return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations, frames } }, isDirty: true })
  }),
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/store/boardStore.test.js` → PASS。

- [ ] **Step 5: 提交**
```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: moveAnnotation store action (switch annotation scope)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 工具栏折叠

**Files:**
- Modify: `client/src/components/AnnotationToolbar.jsx`
- Test: `client/src/components/AnnotationToolbar.test.jsx`

- [ ] **Step 1: 写失败测试** — 在 `AnnotationToolbar.test.jsx` 末尾追加：

```js
test('工具栏可收起与展开', () => {
  setup()
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('收起工具栏'))
  expect(screen.queryByLabelText('矩形')).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('展开工具栏'))
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx` → FAIL（没有「收起工具栏」按钮）。

- [ ] **Step 3: 实现** — 整体替换 `AnnotationToolbar.jsx` 为：

```jsx
import { useState } from 'react'
import { ANNO_COLORS } from '../utils/annotations'

const TOOLS = [
  { key: 'none', label: '选择' },
  { key: 'pass', label: '传盘' },
  { key: 'run', label: '跑位' },
  { key: 'rect', label: '矩形' },
  { key: 'ellipse', label: '椭圆' },
  { key: 'text', label: '文字' },
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
  swatch: (c, active) => ({
    width: 20, height: 20, padding: 0, borderRadius: 4, cursor: 'pointer', background: c,
    border: active ? '2px solid #fff' : '1px solid #555',
  }),
}

export default function AnnotationToolbar({ tool, scope, color, onToolChange, onScopeChange, onColorChange }) {
  const [collapsed, setCollapsed] = useState(false)
  if (collapsed) {
    return (
      <div style={styles.bar}>
        <button aria-label="展开工具栏" style={styles.btn(false)} onClick={() => setCollapsed(false)}>✎ 标注</button>
      </div>
    )
  }
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
      <span style={styles.sep} />
      {ANNO_COLORS.map((c) => (
        <button
          key={c}
          aria-label={`颜色 ${c}`}
          aria-pressed={color === c}
          style={styles.swatch(c, color === c)}
          onClick={() => onColorChange(c)}
        />
      ))}
      <span style={styles.sep} />
      <button aria-label="收起工具栏" style={styles.btn(false)} onClick={() => setCollapsed(true)}>«</button>
    </div>
  )
}
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx` → PASS（含既有测试）。

- [ ] **Step 5: 提交**
```bash
git add client/src/components/AnnotationToolbar.jsx client/src/components/AnnotationToolbar.test.jsx
git commit -m "feat: collapsible annotation toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `Handle` 句柄组件 + 四个标注组件（移动 + 改尺寸）

**Files:**
- Create: `client/src/components/Handle.jsx`
- Modify: `client/src/components/{Arrow,Rect,Ellipse,Text}Annotation.jsx`

> 这些是挂 Konva 的渲染组件，不写自动化测试（脆弱），靠构建 + 后续任务的人工冒烟验证。组件新增的 `draggable`/`onMoveCommit`/`onResizePreview`/`onResizeCommit` props 在 Task 5 接线前为 undefined，组件不会报错（句柄 `selected && onResizeCommit` 为假不渲染、`draggable` 为假）。

- [ ] **Step 1: 创建 `Handle.jsx`**

```jsx
import { Rect } from 'react-konva'

const SIZE = 10

// 通用可拖句柄（小方块）。x,y 为中心（相对图层的像素）。回调给出新的中心像素。
export default function Handle({ x, y, onDragMove, onDragEnd }) {
  return (
    <Rect
      x={x - SIZE / 2}
      y={y - SIZE / 2}
      width={SIZE}
      height={SIZE}
      fill="#ffffff"
      stroke="#4a9eff"
      strokeWidth={1}
      draggable
      onMouseDown={(e) => { e.cancelBubble = true }}
      onDragStart={(e) => { e.cancelBubble = true }}
      onDragMove={(e) => { e.cancelBubble = true; onDragMove?.(e.target.x() + SIZE / 2, e.target.y() + SIZE / 2) }}
      onDragEnd={(e) => { e.cancelBubble = true; onDragEnd?.(e.target.x() + SIZE / 2, e.target.y() + SIZE / 2) }}
    />
  )
}
```

- [ ] **Step 2: 整体替换 `RectAnnotation.jsx`**

```jsx
import { Fragment } from 'react'
import { Rect } from 'react-konva'
import Handle from './Handle'
import { translateAnnotation } from '../utils/annotations'

export default function RectAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening, draggable, onMoveCommit, onResizePreview, onResizeCommit }) {
  const { x1, y1, x2, y2, color } = annotation
  const left = Math.min(x1, x2) * fieldWidth
  const top = Math.min(y1, y2) * fieldHeight
  const w = Math.abs(x2 - x1) * fieldWidth
  const h = Math.abs(y2 - y1) * fieldHeight
  return (
    <Fragment>
      <Rect
        x={left} y={top} width={w} height={h}
        stroke={color} strokeWidth={selected ? 5 : 3}
        fill="rgba(0,0,0,0.001)" hitStrokeWidth={15}
        listening={listening}
        draggable={draggable}
        shadowColor={selected ? '#ffffff' : undefined}
        shadowBlur={selected ? 8 : 0}
        shadowForStrokeEnabled={true}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
        onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onDragEnd={(e) => {
          const dx = e.target.x() / fieldWidth - Math.min(x1, x2)
          const dy = e.target.y() / fieldHeight - Math.min(y1, y2)
          onMoveCommit?.(translateAnnotation(annotation, dx, dy))
        }}
      />
      {selected && onResizeCommit && (
        <Fragment>
          <Handle key="tl" x={x1 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="tr" x={x2 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="bl" x={x1 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y2: py / fieldHeight })} />
          <Handle key="br" x={x2 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y2: py / fieldHeight })} />
        </Fragment>
      )}
    </Fragment>
  )
}
```

- [ ] **Step 3: 整体替换 `EllipseAnnotation.jsx`**

```jsx
import { Fragment } from 'react'
import { Ellipse } from 'react-konva'
import Handle from './Handle'
import { translateAnnotation } from '../utils/annotations'

export default function EllipseAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening, draggable, onMoveCommit, onResizePreview, onResizeCommit }) {
  const { x1, y1, x2, y2, color } = annotation
  const cx = ((x1 + x2) / 2) * fieldWidth
  const cy = ((y1 + y2) / 2) * fieldHeight
  const rx = (Math.abs(x2 - x1) / 2) * fieldWidth
  const ry = (Math.abs(y2 - y1) / 2) * fieldHeight
  return (
    <Fragment>
      <Ellipse
        x={cx} y={cy} radiusX={rx} radiusY={ry}
        stroke={color} strokeWidth={selected ? 5 : 3}
        fill="rgba(0,0,0,0.001)" hitStrokeWidth={15}
        listening={listening}
        draggable={draggable}
        shadowColor={selected ? '#ffffff' : undefined}
        shadowBlur={selected ? 8 : 0}
        shadowForStrokeEnabled={true}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
        onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onDragEnd={(e) => {
          const dx = e.target.x() / fieldWidth - (x1 + x2) / 2
          const dy = e.target.y() / fieldHeight - (y1 + y2) / 2
          onMoveCommit?.(translateAnnotation(annotation, dx, dy))
        }}
      />
      {selected && onResizeCommit && (
        <Fragment>
          <Handle key="tl" x={x1 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="tr" x={x2 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="bl" x={x1 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y2: py / fieldHeight })} />
          <Handle key="br" x={x2 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y2: py / fieldHeight })} />
        </Fragment>
      )}
    </Fragment>
  )
}
```

- [ ] **Step 4: 整体替换 `ArrowAnnotation.jsx`**

```jsx
import { Fragment } from 'react'
import { Arrow } from 'react-konva'
import Handle from './Handle'
import { translateAnnotation } from '../utils/annotations'

export default function ArrowAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening, draggable, onMoveCommit, onResizePreview, onResizeCommit }) {
  const { x1, y1, x2, y2, variant, color } = annotation
  return (
    <Fragment>
      <Arrow
        points={[x1 * fieldWidth, y1 * fieldHeight, x2 * fieldWidth, y2 * fieldHeight]}
        stroke={color} fill={color}
        strokeWidth={selected ? 5 : 3}
        dash={variant === 'pass' ? [10, 6] : undefined}
        pointerLength={12} pointerWidth={12} hitStrokeWidth={15}
        listening={listening}
        draggable={draggable}
        shadowColor={selected ? '#ffffff' : undefined}
        shadowBlur={selected ? 8 : 0}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
        onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onDragEnd={(e) => {
          const dx = e.target.x() / fieldWidth
          const dy = e.target.y() / fieldHeight
          e.target.position({ x: 0, y: 0 }) // points 是绝对坐标，offset 已并入 patch，必须复位
          onMoveCommit?.(translateAnnotation(annotation, dx, dy))
        }}
      />
      {selected && onResizeCommit && (
        <Fragment>
          <Handle key="p1" x={x1 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="p2" x={x2 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y2: py / fieldHeight })} />
        </Fragment>
      )}
    </Fragment>
  )
}
```

- [ ] **Step 5: 整体替换 `TextAnnotation.jsx`**（移动；文字不加句柄）

```jsx
import { Text } from 'react-konva'
import { DEFAULT_FONT_PX, translateAnnotation } from '../utils/annotations'

export default function TextAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, onEdit, listening, draggable, onMoveCommit }) {
  const { x, y, text, color, width } = annotation
  return (
    <Text
      x={x * fieldWidth}
      y={y * fieldHeight}
      text={text}
      fontSize={DEFAULT_FONT_PX}
      fontStyle="bold"
      fill={color}
      width={width != null ? width * fieldWidth : undefined}
      wrap="word"
      listening={listening}
      draggable={draggable}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onDblClick={(e) => { e.cancelBubble = true; onEdit?.() }}
      onDblTap={(e) => { e.cancelBubble = true; onEdit?.() }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
      onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onDragEnd={(e) => {
        const dx = e.target.x() / fieldWidth - x
        const dy = e.target.y() / fieldHeight - y
        onMoveCommit?.(translateAnnotation(annotation, dx, dy))
      }}
    />
  )
}
```

- [ ] **Step 6: 构建确认无错** — Run: `cd client; npx vite build` → 成功（组件新 props 暂未接线，不影响构建）。然后 `cd client; npx vitest run` → 全绿（无回归）。

- [ ] **Step 7: 提交**
```bash
git add client/src/components/Handle.jsx client/src/components/ArrowAnnotation.jsx client/src/components/RectAnnotation.jsx client/src/components/EllipseAnnotation.jsx client/src/components/TextAnnotation.jsx
git commit -m "feat: draggable move + resize handles on annotation components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 接线移动 + 改尺寸（`AnnotationLayer` + `BoardCanvas`）

**Files:**
- Modify: `client/src/components/AnnotationLayer.jsx`
- Modify: `client/src/components/BoardCanvas.jsx`

> 无自动化测试，构建 + 人工冒烟。

- [ ] **Step 1: 整体替换 `AnnotationLayer.jsx`**

```jsx
import { Layer } from 'react-konva'
import ArrowAnnotation from './ArrowAnnotation'
import RectAnnotation from './RectAnnotation'
import EllipseAnnotation from './EllipseAnnotation'
import TextAnnotation from './TextAnnotation'

// 单一分发来源：entries 与 draft 预览共用。key 取自 annotation.id（draft 用 '__draft__'）。
function renderAnnotation(annotation, props) {
  switch (annotation.type) {
    case 'rect':
      return <RectAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'ellipse':
      return <EllipseAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'text':
      return <TextAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'arrow':
    default:
      return <ArrowAnnotation key={annotation.id} annotation={annotation} {...props} />
  }
}

// 渲染「全局 + 活动帧」标注（entries）+ 绘制预览（draft）。
export default function AnnotationLayer({
  x, y, entries, draft, draftType, draftVariant, draftColor, tool, dragPreview,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete, onEdit, onMove, onResizePreview, onResizeCommit,
}) {
  const textTool = tool === 'text'
  const moveMode = tool === 'none'
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) => {
        // 拖句柄改尺寸时按预览坐标渲染（不入 store/历史）
        const anno = dragPreview?.id === annotation.id ? { ...annotation, ...dragPreview.patch } : annotation
        return renderAnnotation(anno, {
          fieldWidth,
          fieldHeight,
          selected: annotation.id === selectedId,
          // 文字工具下，形状/箭头不监听点击 → 让点击穿透到 Stage 放文字；文字标注始终监听（双击编辑）。
          listening: annotation.type === 'text' ? true : !textTool,
          // 选择工具下才可拖动移动
          draggable: moveMode,
          onSelect,
          onDelete: () => onDelete(scope, frameIndex, annotation.id),
          onEdit: () => onEdit?.(scope, frameIndex, annotation),
          onMoveCommit: (patch) => onMove?.(scope, frameIndex, annotation.id, patch),
          onResizePreview: (patch) => onResizePreview?.(annotation.id, patch),
          onResizeCommit: (patch) => onResizeCommit?.(scope, frameIndex, annotation.id, patch),
        })
      })}
      {draft && draftType !== 'text' &&
        renderAnnotation(
          { id: '__draft__', type: draftType, variant: draftVariant, color: draftColor, ...draft },
          { fieldWidth, fieldHeight, selected: false }
        )}
    </Layer>
  )
}
```

- [ ] **Step 2: BoardCanvas — 加预览 state 与三个 handler**

在 `const [textDraft, setTextDraft] = useState(null)` 之后新增：
```js
  const [dragPreview, setDragPreview] = useState(null) // { id, patch }：拖句柄改尺寸的本地预览，不入历史
```

在 `commitText` 函数之后新增：
```js
  // 移动：松手一次性提交一步（拖动中由 Konva 原生预览本体）
  function handleMove(sc, fi, id, patch) {
    updateAnnotation(sc, fi, id, patch)
  }
  // 改尺寸：拖句柄时本地预览，松手提交一步
  function handleResizePreview(id, patch) {
    setDragPreview({ id, patch })
  }
  function handleResizeCommit(sc, fi, id, patch) {
    updateAnnotation(sc, fi, id, patch)
    setDragPreview(null)
  }
```

- [ ] **Step 3: BoardCanvas — 给 `AnnotationLayer` 接线**

把 `AnnotationLayer` 调用里的 `tool={tool}` 那行之后补充传入（与现有 props 并列）：
```jsx
              tool={tool}
              dragPreview={dragPreview}
              onMove={handleMove}
              onResizePreview={handleResizePreview}
              onResizeCommit={handleResizeCommit}
```

- [ ] **Step 4: 构建 + 全套测试** — Run: `cd client; npx vite build` → 成功。Run: `cd client; npx vitest run` → 全绿。

- [ ] **Step 5: 人工冒烟（移动 + 改尺寸）** — 启动前后端，打开战术板，停在关键帧：
  1. 「选择」工具下拖动箭头/矩形/椭圆/文字 → 整体移动；松手后位置保存、撤销一次回到原位。
  2. 选中矩形/椭圆 → 4 角出现白色小方块，拖角改大小；选中箭头 → 拖两端改方向；松手记一步、撤销可回。
  3. 拖句柄过程中形状实时跟随预览；撤销一次回到拖前（中间不产生多步历史）。
  4. 画完约 1 秒「已保存」；刷新后移动/尺寸保留。
  > 已知小瑕疵：移动一个**选中**的形状时，其改尺寸句柄在拖动过程中可能短暂不跟随、松手归位。若影响使用请反馈。

- [ ] **Step 6: 提交**
```bash
git add client/src/components/AnnotationLayer.jsx client/src/components/BoardCanvas.jsx
git commit -m "feat: wire annotation move (draggable) and resize (handles + preview)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 浮动工具条（作用域切换 + 删除）

**Files:**
- Create: `client/src/components/SelectionToolbar.jsx`
- Modify: `client/src/components/BoardCanvas.jsx`

> 无自动化测试（HTML 浮层 + 依赖选中态），构建 + 人工冒烟。

- [ ] **Step 1: 创建 `SelectionToolbar.jsx`**

```jsx
const styles = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: 4,
    background: '#111', border: '1px solid #333', borderRadius: 8,
  },
  btn: (active) => ({
    padding: '3px 8px', height: 24, borderRadius: 5, fontSize: 12, cursor: 'pointer',
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '1px solid #4a9eff' : '1px solid #555',
    color: '#fff',
  }),
  del: {
    padding: '3px 8px', height: 24, borderRadius: 5, fontSize: 12, cursor: 'pointer',
    background: 'transparent', color: '#e57373', border: '1px solid #e57373',
  },
}

// 选中标注后的浮动小工具条（HTML）。stopPropagation 切断冒泡到任何 DOM 祖先，保证点击闭环。
export default function SelectionToolbar({ scope, canMoveToFrame, onSetScope, onDelete, style }) {
  const stop = (e) => e.stopPropagation()
  return (
    <div style={{ ...styles.bar, ...style }} onClick={stop} onMouseDown={stop}>
      <button
        aria-label="本帧"
        aria-pressed={scope === 'frame'}
        disabled={scope === 'global' && !canMoveToFrame}
        title={scope === 'global' && !canMoveToFrame ? '停在关键帧才能转为本帧' : undefined}
        style={styles.btn(scope === 'frame')}
        onClick={() => onSetScope('frame')}
      >
        本帧
      </button>
      <button
        aria-label="全局"
        aria-pressed={scope === 'global'}
        style={styles.btn(scope === 'global')}
        onClick={() => onSetScope('global')}
      >
        全局
      </button>
      <button aria-label="删除标注" style={styles.del} onClick={onDelete}>删除</button>
    </div>
  )
}
```

- [ ] **Step 2: BoardCanvas — import**

把现有从 `'../utils/annotations'` 的 import 中加入 `annotationTopAnchor`（合并进已有那条多行 import）。并在组件 import 区加入：
```js
import SelectionToolbar from './SelectionToolbar'
```

- [ ] **Step 3: BoardCanvas — 作用域切换 handler**

在 `handleResizeCommit` 之后新增：
```js
  // 浮动工具条「本帧/全局」切换
  function handleSetScope(toScope) {
    const sel = selectionRef.current
    if (!sel || toScope === sel.scope) return
    if (toScope === 'frame' && !editable) return // 兜底：非关键帧不能转本帧，防标注锁死
    if (toScope === 'frame') moveAnnotation('global', null, 'frame', currentFrameIndex, sel.annotation.id)
    else moveAnnotation(sel.scope, sel.frameIndex, 'global', null, sel.annotation.id)
  }
```

- [ ] **Step 4: BoardCanvas — 解构 `moveAnnotation`**

把 store 解构里的 `addAnnotation, removeAnnotation, updateAnnotation,` 改为：
```js
    addAnnotation, removeAnnotation, updateAnnotation, moveAnnotation,
```

- [ ] **Step 5: BoardCanvas — 渲染浮动工具条**

在 `textDraft && (...)` 的 `<textarea>` 块**之后**（仍在 `containerRef` 这个 `position:relative` 容器内）新增：
```jsx
        {selectedAnnoId && selectionRef.current && (() => {
          const sel = selectionRef.current
          const anchor = annotationTopAnchor(sel.annotation)
          return (
            <SelectionToolbar
              scope={sel.scope}
              canMoveToFrame={editable}
              onSetScope={handleSetScope}
              onDelete={() => { removeAnnotation(sel.scope, sel.frameIndex, sel.annotation.id); setSelectedAnnoId(null) }}
              style={{
                position: 'absolute',
                left: fieldX + anchor.x * fieldW,
                top: fieldY + anchor.y * fieldH - 40,
                transform: 'translateX(-50%)',
                zIndex: 25,
              }}
            />
          )
        })()}
```

- [ ] **Step 6: 构建 + 全套测试** — Run: `cd client; npx vite build` → 成功。Run: `cd client; npx vitest run` → 全绿。

- [ ] **Step 7: 人工冒烟（浮动工具条）**
  1. 「选择」工具下单击一条标注 → 其上方出现浮动工具条；点空白取消选中、工具条消失。
  2. 选中一条**全局**标注 → 点「本帧」转为本帧（落到当前帧）；**停在非关键帧（预览中）时「本帧」按钮禁用 + 悬停提示**。
  3. 选中一条**本帧**标注 → 点「全局」转为全局（所有帧可见）。
  4. 点工具条「删除」→ 标注删除、工具条消失；点工具条按钮不会误取消选中而闪退。
  5. 切换/删除后约 1 秒「已保存」；撤销可回；刷新保留。

- [ ] **Step 8: 提交**
```bash
git add client/src/components/SelectionToolbar.jsx client/src/components/BoardCanvas.jsx
git commit -m "feat: floating selection toolbar (scope switch + delete) with editable guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3/§4 数据模型 + 纯函数 `translateAnnotation`/`annotationTopAnchor` → Task 1 ✅
- §5 store：`updateAnnotation` 复用（移动/改尺寸）+ 新 `moveAnnotation`（作用域）→ Task 2 + Task 5/6 调用 ✅
- §6 选中态 + 浮动工具条 + `!editable` 校验 + `stopPropagation` 防闪退 → Task 6 ✅
- §7 移动（draggable，箭头复位坑）+ 改尺寸句柄（Handle，rect/ellipse 4 角、arrow 2 端点）+ 拖拽预览（dragPreview，不入历史）→ Task 4 + Task 5 ✅
- §8 折叠工具栏 → Task 3 ✅
- §9 测试：纯函数/moveAnnotation/折叠单测，其余人工 → Task 1/2/3 + Task 5/6 人工冒烟 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码或精确替换。

**3. Type consistency：**
- `translateAnnotation(annotation, dx, dy)`（Task 1）与各组件 `onDragEnd` 调用一致（Task 4）。
- `annotationTopAnchor(annotation)`（Task 1）与 BoardCanvas 工具条定位一致（Task 6）。
- `moveAnnotation(fromScope, fromFrameIndex, toScope, toFrameIndex, id)`（Task 2）与 `handleSetScope` 调用一致（Task 6）。
- 组件 props `draggable`/`onMoveCommit`/`onResizePreview`/`onResizeCommit`（Task 4）与 `AnnotationLayer` 传入（Task 5）一致；`onMove`/`onResizePreview`/`onResizeCommit`/`dragPreview`（AnnotationLayer，Task 5）与 BoardCanvas handler（Task 5）一致。
- `SelectionToolbar` props `scope`/`canMoveToFrame`/`onSetScope`/`onDelete`/`style`（Task 6）与 BoardCanvas 传入一致。

**已知取舍 / 瑕疵：**
- 移动/句柄拖拽/浮动工具条挂 Konva/HTML，不写自动化测试（人工冒烟），与 C1/C2 一致。
- 移动一个**选中**形状时句柄拖动过程中可能短暂错位、松手归位（Task 5 Step 5 注明，待人工反馈）。
- react-konva 受控节点 + draggable：移动提交后靠新 props 接管定位；箭头已显式 `position({x:0,y:0})` 复位，矩形/椭圆/文字用 x/y 定位由 props 接管，若实测抖动再在 dragEnd 复位（Task 5 可迭代）。
