# 标注 C2：形状 + 文字 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 C1 箭头标注的基础上，新增矩形、椭圆、文字三种标注类型，并加入一排颜色选择。

**Architecture:** 最大化复用 C1。形状沿用箭头的 `draft={x1,y1,x2,y2}` 拖拽流；`store` 的 `addAnnotation/removeAnnotation` 零改动；`AnnotationLayer` 改为按 `type` 分发到独立小组件；文字用 click 放置 + 画布内联 `<input>`；颜色由 `BoardCanvas` 持一个 state 并经工具栏色块切换。

**Tech Stack:** React 18, Zustand 4, react-konva（Konva）, Vite 5, Vitest + @testing-library/react（globals 开，`vi` 全局可用）。

设计文档：`docs/superpowers/specs/2026-06-02-annotations-c2-shapes-text-design.md`

---

## File Structure

- **Modify** `client/src/utils/annotations.js` — 三个 create 函数 + 常量（`MIN_SHAPE_PX`/`DEFAULT_FONT_PX`/`ANNO_COLORS`）。
- **Modify** `client/src/utils/annotations.test.js` — 新增纯函数测试。
- **Modify** `client/src/components/AnnotationToolbar.jsx` — 三个新工具按钮 + 一排色块。
- **Modify** `client/src/components/AnnotationToolbar.test.jsx` — 新增工具/色块测试。
- **Create** `client/src/components/RectAnnotation.jsx`
- **Create** `client/src/components/EllipseAnnotation.jsx`
- **Create** `client/src/components/TextAnnotation.jsx`
- **Modify** `client/src/components/AnnotationLayer.jsx` — 按 `type` 分发渲染。
- **Modify** `client/src/components/BoardCanvas.jsx` — 工具集、绘制流分发、文字内联 input、颜色 state、工具栏/图层接线（人工验证）。

> 无数据库迁移；无后端改动；`store` 零改动。

---

## Task 1: 纯函数 + 常量（`utils/annotations.js`）

**Files:**
- Modify: `client/src/utils/annotations.js`
- Test: `client/src/utils/annotations.test.js`

- [ ] **Step 1: 写失败测试**

在 `client/src/utils/annotations.test.js` 末尾追加（顶部 import 已有从 `./annotations` 引入的写法，按文件现状把新符号加进 import；若该文件用逐个 `import { ... } from './annotations'`，确保引入 `createRectAnnotation, createEllipseAnnotation, createTextAnnotation, MIN_SHAPE_PX, DEFAULT_FONT_PX, ANNO_COLORS, visibleAnnotations`）：

```js
import {
  createRectAnnotation, createEllipseAnnotation, createTextAnnotation,
  MIN_SHAPE_PX, DEFAULT_FONT_PX, ANNO_COLORS, visibleAnnotations,
} from './annotations'

test('createRectAnnotation 产出 rect 结构（归一化两角 + 色 + 唯一 id）', () => {
  const a = createRectAnnotation(0.1, 0.2, 0.3, 0.4, '#ff5252')
  expect(a.type).toBe('rect')
  expect(a).toMatchObject({ x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4, color: '#ff5252' })
  expect(a.id).toMatch(/^anno-/)
})

test('createEllipseAnnotation 产出 ellipse 结构', () => {
  const a = createEllipseAnnotation(0.1, 0.2, 0.3, 0.4, '#4a9eff')
  expect(a.type).toBe('ellipse')
  expect(a).toMatchObject({ x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4, color: '#4a9eff' })
  expect(a.id).toMatch(/^anno-/)
})

test('createTextAnnotation 产出 text 结构（单点 + 字符串）', () => {
  const a = createTextAnnotation(0.5, 0.6, '助攻跑位', '#ffffff')
  expect(a.type).toBe('text')
  expect(a).toMatchObject({ x: 0.5, y: 0.6, text: '助攻跑位', color: '#ffffff' })
  expect(a.id).toMatch(/^anno-/)
})

test('三个 create 函数 id 互不相同', () => {
  const ids = new Set([
    createRectAnnotation(0, 0, 1, 1, '#fff').id,
    createEllipseAnnotation(0, 0, 1, 1, '#fff').id,
    createTextAnnotation(0, 0, 'x', '#fff').id,
  ])
  expect(ids.size).toBe(3)
})

test('常量值符合设计', () => {
  expect(MIN_SHAPE_PX).toBe(5)
  expect(DEFAULT_FONT_PX).toBe(16)
  expect(ANNO_COLORS).toEqual(['#ffeb3b', '#ff5252', '#4a9eff', '#ffffff'])
})

test('visibleAnnotations 对混合 type（rect/text）仍正确归类', () => {
  const data = {
    globalAnnotations: [{ id: 'g1', type: 'rect' }],
    frames: [{ annotations: [{ id: 'f1', type: 'text' }] }],
  }
  const vis = visibleAnnotations(data, 0)
  expect(vis).toHaveLength(2)
  expect(vis.find((e) => e.annotation.id === 'g1').scope).toBe('global')
  expect(vis.find((e) => e.annotation.id === 'f1').scope).toBe('frame')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd client; npx vitest run src/utils/annotations.test.js`
Expected: FAIL（`createRectAnnotation` 等不是函数 / 常量未定义）。

- [ ] **Step 3: 写实现**

在 `client/src/utils/annotations.js` 现有内容**之后**追加（现有 `MIN_ARROW_PX`/`DEFAULT_ANNO_COLOR`/`createArrowAnnotation`/`visibleAnnotations`/`arrowPixelLength` 全部保留不动）：

```js
export const MIN_SHAPE_PX = 5
export const DEFAULT_FONT_PX = 16
export const ANNO_COLORS = ['#ffeb3b', '#ff5252', '#4a9eff', '#ffffff'] // 黄/红/蓝/白

// 唯一 id（随机后缀避免同毫秒撞 id）
function annoId() {
  return `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// 矩形/椭圆：归一化两角（拖拽起点/终点，可能反向），渲染时算包围盒
export function createRectAnnotation(x1, y1, x2, y2, color) {
  return { id: annoId(), type: 'rect', x1, y1, x2, y2, color }
}

export function createEllipseAnnotation(x1, y1, x2, y2, color) {
  return { id: annoId(), type: 'ellipse', x1, y1, x2, y2, color }
}

// 文字：单点锚（左上）+ 字符串
export function createTextAnnotation(x, y, text, color) {
  return { id: annoId(), type: 'text', x, y, text, color }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd client; npx vitest run src/utils/annotations.test.js`
Expected: PASS（含既有测试）。

- [ ] **Step 5: 提交**

```bash
git add client/src/utils/annotations.js client/src/utils/annotations.test.js
git commit -m "feat: rect/ellipse/text annotation factories + C2 constants"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: 工具栏新工具 + 色块（`AnnotationToolbar`）

**Files:**
- Modify: `client/src/components/AnnotationToolbar.jsx`
- Test: `client/src/components/AnnotationToolbar.test.jsx`

- [ ] **Step 1: 更新测试（red）**

在 `client/src/components/AnnotationToolbar.test.jsx` 做以下精确修改：

(a) 把 `setup` 的 handler 与默认 props 补上颜色相关（第 4–8 行整体替换）：
```js
function setup(over = {}) {
  const h = { onToolChange: vi.fn(), onScopeChange: vi.fn(), onColorChange: vi.fn() }
  render(<AnnotationToolbar tool="none" scope="frame" color="#ffeb3b" {...h} {...over} />)
  return h
}
```

(b) 末尾追加新测试：
```js
test('renders the rect / ellipse / text tools', () => {
  setup()
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
  expect(screen.getByLabelText('椭圆')).toBeInTheDocument()
  expect(screen.getByLabelText('文字')).toBeInTheDocument()
})

test('clicking a new tool calls onToolChange with its key', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('矩形'))
  expect(h.onToolChange).toHaveBeenCalledWith('rect')
  fireEvent.click(screen.getByLabelText('椭圆'))
  expect(h.onToolChange).toHaveBeenCalledWith('ellipse')
  fireEvent.click(screen.getByLabelText('文字'))
  expect(h.onToolChange).toHaveBeenCalledWith('text')
})

test('renders a color swatch per ANNO_COLORS and calls onColorChange', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('颜色 #ff5252'))
  expect(h.onColorChange).toHaveBeenCalledWith('#ff5252')
})

test('the active color swatch is marked aria-pressed', () => {
  setup({ color: '#4a9eff' })
  expect(screen.getByLabelText('颜色 #4a9eff')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('颜色 #ffeb3b')).toHaveAttribute('aria-pressed', 'false')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx`
Expected: FAIL（没有「矩形/椭圆/文字」按钮、没有色块）。

- [ ] **Step 3: 写实现**

整体替换 `client/src/components/AnnotationToolbar.jsx` 为：

```jsx
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
    </div>
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd client; npx vitest run src/components/AnnotationToolbar.test.jsx`
Expected: PASS（含既有 4 个测试 + 新增 4 个）。

- [ ] **Step 5: 提交**

```bash
git add client/src/components/AnnotationToolbar.jsx client/src/components/AnnotationToolbar.test.jsx
git commit -m "feat: shape/text tools and color swatches in the annotation toolbar"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: 渲染组件 + 分发（Rect/Ellipse/Text + `AnnotationLayer`）

**Files:**
- Create: `client/src/components/RectAnnotation.jsx`
- Create: `client/src/components/EllipseAnnotation.jsx`
- Create: `client/src/components/TextAnnotation.jsx`
- Modify: `client/src/components/AnnotationLayer.jsx`

> 这些是挂 Konva/canvas 的渲染组件，与 C1 的 `ArrowAnnotation` 一样**不写自动化测试**（脆弱），靠 Task 4 的人工冒烟 + 构建验证。本任务无 red/green 步骤。

- [ ] **Step 1: 创建 `RectAnnotation.jsx`**

```jsx
import { Rect } from 'react-konva'

// 矩形标注（描边空心）。两角归一化 → 包围盒。透明填充使内部整体可点选，视觉仍空心。
// 选中用 shadowBlur 高亮，必须配 shadowForStrokeEnabled 否则空心边框无阴影。
export default function RectAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x1, y1, x2, y2, color } = annotation
  const left = Math.min(x1, x2) * fieldWidth
  const top = Math.min(y1, y2) * fieldHeight
  const w = Math.abs(x2 - x1) * fieldWidth
  const h = Math.abs(y2 - y1) * fieldHeight
  return (
    <Rect
      x={left}
      y={top}
      width={w}
      height={h}
      stroke={color}
      strokeWidth={selected ? 5 : 3}
      fill="rgba(0,0,0,0.001)"
      hitStrokeWidth={15}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      shadowForStrokeEnabled={true}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
```

- [ ] **Step 2: 创建 `EllipseAnnotation.jsx`**

```jsx
import { Ellipse } from 'react-konva'

// 椭圆标注（描边空心）。两角包围盒内切：center=中点，radiusX/Y=半宽/半高。
export default function EllipseAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x1, y1, x2, y2, color } = annotation
  const cx = ((x1 + x2) / 2) * fieldWidth
  const cy = ((y1 + y2) / 2) * fieldHeight
  const rx = (Math.abs(x2 - x1) / 2) * fieldWidth
  const ry = (Math.abs(y2 - y1) / 2) * fieldHeight
  return (
    <Ellipse
      x={cx}
      y={cy}
      radiusX={rx}
      radiusY={ry}
      stroke={color}
      strokeWidth={selected ? 5 : 3}
      fill="rgba(0,0,0,0.001)"
      hitStrokeWidth={15}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      shadowForStrokeEnabled={true}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
```

- [ ] **Step 3: 创建 `TextAnnotation.jsx`**

```jsx
import { Text } from 'react-konva'
import { DEFAULT_FONT_PX } from '../utils/annotations'

// 文字标注。单点锚（左上）+ 固定屏幕字号（不随画布缩放）。文字本身即命中区。
export default function TextAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x, y, text, color } = annotation
  return (
    <Text
      x={x * fieldWidth}
      y={y * fieldHeight}
      text={text}
      fontSize={DEFAULT_FONT_PX}
      fontStyle="bold"
      fill={color}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
```

- [ ] **Step 4: 改 `AnnotationLayer.jsx` 为按 type 分发**

整体替换 `client/src/components/AnnotationLayer.jsx` 为：

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
  x, y, entries, draft, draftType, draftVariant, draftColor,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete,
}) {
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) =>
        renderAnnotation(annotation, {
          fieldWidth,
          fieldHeight,
          selected: annotation.id === selectedId,
          onSelect,
          onDelete: () => onDelete(scope, frameIndex, annotation.id),
        })
      )}
      {draft && draftType !== 'text' &&
        renderAnnotation(
          { id: '__draft__', type: draftType, variant: draftVariant, color: draftColor, ...draft },
          { fieldWidth, fieldHeight, selected: false }
        )}
    </Layer>
  )
}
```

- [ ] **Step 5: 构建确认无语法/导入错误**

Run: `cd client; npx vite build`
Expected: 构建成功（注意：此时 `BoardCanvas` 还没传 `draftType`，draft 预览 type 会是 `undefined` → 走 default 渲染箭头，不影响构建；Task 4 会补全）。

- [ ] **Step 6: 提交**

```bash
git add client/src/components/RectAnnotation.jsx client/src/components/EllipseAnnotation.jsx client/src/components/TextAnnotation.jsx client/src/components/AnnotationLayer.jsx
git commit -m "feat: rect/ellipse/text Konva components + type-dispatched AnnotationLayer"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: BoardCanvas 接线（绘制流 + 文字内联 input + 颜色）

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx`

> BoardCanvas 挂 Konva，绘制流/内联 input 不写脆弱组件测——纯函数与工具栏已单测，焦点隔离由既有 INPUT 守卫保证。Step 7 人工冒烟。

- [ ] **Step 1: 更新 import（加入新 create 函数与常量）**

把 `client/src/components/BoardCanvas.jsx` 顶部这行：
```js
import { visibleAnnotations, createArrowAnnotation, arrowPixelLength, MIN_ARROW_PX, DEFAULT_ANNO_COLOR } from '../utils/annotations'
```
替换为：
```js
import {
  visibleAnnotations, createArrowAnnotation, createRectAnnotation, createEllipseAnnotation, createTextAnnotation,
  arrowPixelLength, MIN_SHAPE_PX, DEFAULT_ANNO_COLOR, DEFAULT_FONT_PX,
} from '../utils/annotations'
```
（移除了不再使用的 `MIN_ARROW_PX`；Task 4 全程改用 `MIN_SHAPE_PX`，二者同值 5。）

- [ ] **Step 2: 新增 state（颜色 + 文字草稿）**

在 `const [selectedAnnoId, setSelectedAnnoId] = useState(null)` 之后新增两行：
```js
  const [color, setColor] = useState(DEFAULT_ANNO_COLOR)
  const [textDraft, setTextDraft] = useState(null) // { x, y } 归一化；非 null 时显示内联输入框
```

- [ ] **Step 3: 文字工具改 mousedown 分支**

把 `handleStageMouseDown` 整体替换为：
```js
  function handleStageMouseDown(e) {
    justDrewRef.current = false // 每次新交互开头清残留标志（防拖到画布外无 click 时卡住）
    if (!drawing || isPlaying) return
    // 本帧标注只能停在关键帧时画：否则 currentFrameIndex 与活动帧分叉，画完即不可见
    if (scope === 'frame' && !editable) return
    const p = pointerToNorm(e)
    if (!p) return
    if (tool === 'text') {
      setTextDraft({ x: p.x, y: p.y }) // 文字：放点 → 内联输入，不走 draft 拖拽
      return
    }
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }
```

- [ ] **Step 4: mouseup 按工具分发 create**

把 `handleStageMouseUp` 整体替换为：
```js
  function handleStageMouseUp(e) {
    if (!draft) return
    const len = arrowPixelLength(draft.x1 * fieldW, draft.y1 * fieldH, draft.x2 * fieldW, draft.y2 * fieldH)
    if (len >= MIN_SHAPE_PX) {
      const { x1, y1, x2, y2 } = draft
      let anno
      if (tool === 'rect') anno = createRectAnnotation(x1, y1, x2, y2, color)
      else if (tool === 'ellipse') anno = createEllipseAnnotation(x1, y1, x2, y2, color)
      else anno = createArrowAnnotation(tool, x1, y1, x2, y2, color) // pass / run
      addAnnotation(scope, currentFrameIndex, anno)
      justDrewRef.current = true   // 防绘制结束的残留 click 取消选中
      e.cancelBubble = true
    }
    setDraft(null)
  }
```

- [ ] **Step 5: 新增 `toolToType` + `commitText` 辅助函数**

在 `handleStageClick` 函数之后新增：
```js
  function toolToType(t) {
    if (t === 'rect' || t === 'ellipse') return t
    return 'arrow' // pass / run / none 的 draft 预览都按箭头渲染
  }

  function commitText(value) {
    const t = value.trim()
    // mousedown 已做 frame-scope 门控，这里只需判空
    if (t && textDraft) {
      addAnnotation(scope, currentFrameIndex, createTextAnnotation(textDraft.x, textDraft.y, t, color))
    }
    setTextDraft(null)
  }
```

- [ ] **Step 6: 接线 JSX —— 工具栏 props、内联 input、AnnotationLayer props**

(a) 把 `AnnotationToolbar` 调用（约 `BoardCanvas.jsx:248-253`）替换为：
```jsx
          <AnnotationToolbar
            tool={tool}
            scope={scope}
            color={color}
            onToolChange={(t) => { setTool(t); setSelectedAnnoId(null) }}
            onScopeChange={setScope}
            onColorChange={setColor}
          />
```

(b) 在该 `AnnotationToolbar` 之后、`{!board || !view ? (...) : (...)}` 之前，新增文字内联输入框（只在 `textDraft` 存在时挂载，提交/失焦后 `setTextDraft(null)` 彻底卸载——绝不用 display:none 隐藏，否则残留透明 DOM 永久遮挡画布点击）：
```jsx
        {textDraft && (
          <input
            aria-label="文字标注内容"
            autoFocus
            defaultValue=""
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText(e.target.value)
              else if (e.key === 'Escape') setTextDraft(null)
            }}
            onBlur={(e) => commitText(e.target.value)}
            style={{
              position: 'absolute',
              left: fieldX + textDraft.x * fieldW,
              top: fieldY + textDraft.y * fieldH,
              zIndex: 30, // 高于 Konva Stage 容器
              fontSize: DEFAULT_FONT_PX, fontWeight: 'bold',
              padding: '2px 6px', borderRadius: 4,
              background: '#0d0d1a', border: '1px solid #555', color: '#fff',
            }}
          />
        )}
```

(c) 把 `AnnotationLayer` 调用里的这两行：
```jsx
              draftVariant={tool === 'none' ? 'run' : tool}
              draftColor={DEFAULT_ANNO_COLOR}
```
替换为：
```jsx
              draftType={toolToType(tool)}
              draftVariant={tool === 'pass' ? 'pass' : 'run'}
              draftColor={color}
```

- [ ] **Step 7: 全套测试 + 构建**

Run: `cd client; npx vitest run`
Expected: PASS（无回归；新增的纯函数/工具栏测试也在内）。
Run: `cd client; npx vite build`
Expected: 构建成功。

- [ ] **Step 8: 人工冒烟（浏览器）**

启动前后端，打开一个战术板，停在关键帧：
1. 选「矩形」「椭圆」拖拽画出，松手生成；拖得极小（<5px）不生成。
2. 选「文字」点画布 → 出现输入框 → 输字回车生成；Esc / 空白不生成；**在输入框内按 Ctrl+Z / Delete 只动框内文本，不删标注、不触发画布撤销**；提交后点击画布空白能正常取消选中（验证 input 已卸载、无透明 DOM 残留遮挡）。
3. 点某个色块后，新建的矩形/椭圆/文字/箭头都用该色。
4. 「本帧」作用域在非关键帧（预览中）不能画；「全局」始终可画。
5. 右键标注 / 选中后按 Delete 删除形状与文字；撤销-重做能恢复其增删。
6. 选中矩形/椭圆时边框有白色阴影高亮（验证 `shadowForStrokeEnabled`）。
7. 画完约 1 秒顶栏显示「已保存」；刷新页面标注仍在。

> 把结果反馈给我，尤其第 2 项（文字框焦点隔离 + 提交后无残留遮挡）与第 6 项（空心形状选中阴影）。

- [ ] **Step 9: 提交**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: wire shape/text drawing, inline text input, and color into BoardCanvas"
```
追加空行 + trailer：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3 数据模型 rect/ellipse/text → Task 1 create 函数 ✅
- §4 纯函数 + 常量（`MIN_SHAPE_PX`/`DEFAULT_FONT_PX`/`ANNO_COLORS`）→ Task 1 ✅
- §5 绘制流（拖拽型分发 + 文字 click + 内联 input + frame-scope 门控复用）→ Task 4 Step 3/4/6 ✅
- §5 焦点隔离（既有 INPUT 守卫）→ 无需改码，Task 4 Step 8.2 人工验证 ✅
- §6 渲染分发（单一 `renderAnnotation` + draft 共用 + `toolToType`/`variant`）→ Task 3 Step 4 + Task 4 Step 5/6c ✅
- §7 三个 Konva 组件 → Task 3 Step 1/2/3 ✅
- §8 颜色 state + 工具栏色块 → Task 2 + Task 4 Step 2/6a ✅
- §9.1 空心形状选中阴影 `shadowForStrokeEnabled` → Task 3 Rect/Ellipse ✅
- §9.2 内联 input z-index 高于 Stage + 提交后 unmount（条件渲染，不用 display:none）→ Task 4 Step 6b ✅
- §10 测试（create 结构/混合 type 归类、工具栏新工具/色块；Konva 组件不测）→ Task 1 + Task 2 ✅

**2. Placeholder scan：** 无 TODO/TBD；每个代码步骤含完整代码或精确的逐处替换。

**3. Type consistency：** `createRectAnnotation(x1,y1,x2,y2,color)` / `createEllipseAnnotation(...)` / `createTextAnnotation(x,y,text,color)` 三处定义（Task 1）与调用（Task 4 Step 4/5）签名一致；`AnnotationLayer` 新增 props `draftType`（Task 3）与传入（Task 4 Step 6c）一致；工具栏新增 props `color`/`onColorChange`（Task 2）与传入（Task 4 Step 6a）一致；`MIN_SHAPE_PX` 统一替换 `MIN_ARROW_PX` 的用法（Task 4 Step 1/4）。

**已知取舍：** Konva 渲染组件（Rect/Ellipse/Text）与 BoardCanvas 绘制流不写自动化测试（挂 canvas、脆弱）——纯函数与工具栏由单测覆盖，其余靠人工冒烟，与 C1 一致。透明填充用 `rgba(0,0,0,0.001)` 实现空心形状整体可点选；若实测内部点选不灵，再在 Task 4 Step 8 反馈后调整命中策略（如改 `hitFunc`）。
