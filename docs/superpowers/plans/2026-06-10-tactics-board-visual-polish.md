# 战术板高级视觉升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把战术板编辑界面升级为「深夜球场推演」视觉语言：外场暗流微光、球场柔影、全站毛玻璃控件、哑光球员色、飞盘悬浮投影、专业剪辑式关键帧时间轴。

**Architecture:** 纯前端样式/Konva 渲染改动。CSS 改动集中在 `client/src/index.css`（控制按钮的 `.ctrl-btn` 呼吸态系统）；各栏的毛玻璃底色就地内联改；球场/球员/飞盘的视觉用 Konva 属性改；唯一新逻辑是判定「帧是否被改过」的纯函数 `isFrameModified`，配合时间轴的飞盘黄小点与丝滑滑块。不引入新依赖、不改数据结构、不改交互逻辑。

**Tech Stack:** React 18 + react-konva（Stage/Layer/Rect/Circle/Text 的 shadow 属性）、内联 style + 少量 `index.css` 类、Vitest + @testing-library/react。

**测试运行约定（本机内存紧张）：** 跑测试用串行模式避免 OOM：
```
cd client; npx vitest run --no-file-parallelism
```
单文件：`cd client; npx vitest run --no-file-parallelism src/utils/frameStatus.test.js`

---

### Task 1: 外场暗流微光 + 球场柔影

纯视觉常量改，无可单测逻辑；验证 = 全量测试不回归 + 浏览器肉眼确认。

**Files:**
- Modify: `client/src/components/BoardCanvas.jsx:373`（画布容器背景）
- Modify: `client/src/components/Field.jsx:19`（球场底层 Rect 加阴影）

- [ ] **Step 1: 画布容器背景改径向微光**

`client/src/components/BoardCanvas.jsx` 第 373 行，把画布容器 div 的 `background: '#0d0d1a'` 改为墨绿径向微光。改后整行：

```jsx
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at center, #081e16 0%, #040b08 80%)' }}>
```

- [ ] **Step 2: 球场底层 Rect 加 Konva 柔影**

`client/src/components/Field.jsx`，给「背景」那块铺满球场的 Rect（第 19 行）加阴影属性。改后：

```jsx
      {/* 背景（整场同绿，不再有暗色端区块）+ 向下柔影，使球场浮在暗场之上 */}
      <Rect
        x={0} y={0} width={w} height={h} fill={FIELD_COLOR}
        shadowColor="#000000" shadowBlur={32}
        shadowOffset={{ x: 0, y: 12 }} shadowOpacity={0.5}
      />
```

注意：仅这一块外层背景 Rect 加阴影；外边框 / 端区线 / 中线 / END ZONE 文字都不动。

- [ ] **Step 3: 全量测试不回归**

Run: `cd client; npx vitest run --no-file-parallelism`
Expected: 全部通过（与改前数量一致，无新增失败）。

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BoardCanvas.jsx client/src/components/Field.jsx
git commit -m "style: outer pitch glow background + field drop shadow"
```

---

### Task 2: 哑光球员色 + 字体 + 飞盘悬浮投影

纯视觉常量改；验证 = 全量测试不回归 + 浏览器确认。

**Files:**
- Modify: `client/src/components/Player.jsx:7-9,48-58`
- Modify: `client/src/components/Disc.jsx:37`

- [ ] **Step 1: 球员哑光色 + 字号**

`client/src/components/Player.jsx` 第 7、9 行：

```jsx
const TEAM_COLORS = { red: '#ef4444', blue: '#3b82f6' }
const PLAYER_RADIUS = 18
const FONT_SIZE = 11
```

- [ ] **Step 2: 球员名字字重 bold → 500**

同文件，名字 `<Text>`（约 48-59 行）把 `fontStyle="bold"` 改为 `fontStyle="500"`。改后该 Text：

```jsx
      <Text
        text={label}
        fontSize={FONT_SIZE}
        fill="#fff"
        fontStyle="500"
        width={PLAYER_RADIUS * 2}
        height={PLAYER_RADIUS * 2}
        x={-PLAYER_RADIUS}
        y={-PLAYER_RADIUS}
        align="center"
        verticalAlign="middle"
      />
```

- [ ] **Step 3: 飞盘悬浮投影**

`client/src/components/Disc.jsx` 第 37 行，给黄色主圆 Circle 加阴影。改后（内圈装饰圆第 38 行不动）：

```jsx
      <Circle
        radius={DISC_RADIUS} fill="#f5c518" stroke="#c8a000" strokeWidth={2}
        shadowColor="black" shadowBlur={8}
        shadowOffset={{ x: 2, y: 5 }} shadowOpacity={0.4}
      />
```

- [ ] **Step 4: 全量测试不回归**

Run: `cd client; npx vitest run --no-file-parallelism`
Expected: 全部通过。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Player.jsx client/src/components/Disc.jsx
git commit -m "style: matte team colors + lighter player label + floating disc shadow"
```

---

### Task 3: 毛玻璃控制栏 + 呼吸态按钮系统

在 `index.css` 建一套控制按钮类（含 hover/激活外发光/禁用），并把 4 个栏的栏底改成统一毛玻璃。按钮的 hover 需要 CSS（内联做不了），所以走 class；栏底无 hover 需求，就地内联改。

**Files:**
- Modify: `client/src/index.css`（追加 `.ctrl-btn` 系列）
- Modify: `client/src/components/BoardCanvas.jsx`（顶栏 + 阵型栏栏底；← 返回、+ 盘 按钮上 class）
- Modify: `client/src/components/UndoRedoButtons.jsx`（↶↷ 上 class）
- Modify: `client/src/components/FormationMenu.jsx`（阵型 ▲ 触发按钮上 class）
- Modify: `client/src/components/AnnotationToolbar.jsx`（栏底毛玻璃 + 工具/范围/收展按钮上 class）
- Modify: `client/src/components/Timeline.jsx`（栏底毛玻璃 + 控制按钮上 class；循环激活态）

- [ ] **Step 1: index.css 追加控制按钮类**

在 `client/src/index.css` 末尾追加：

```css
/* ── 战术板控制按钮：毛玻璃栏内的「呼吸态」按钮 ── */
.ctrl-btn {
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: color .15s ease, background .15s ease, box-shadow .15s ease;
}
.ctrl-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
}
.ctrl-btn.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
}
.ctrl-btn:disabled,
.ctrl-btn[aria-disabled="true"] {
  opacity: .45;
  cursor: default;
  color: rgba(255, 255, 255, 0.35);
  background: transparent;
  box-shadow: none;
}
```

- [ ] **Step 2: BoardCanvas 顶栏 + 阵型栏栏底毛玻璃**

`client/src/components/BoardCanvas.jsx`。顶栏容器（约 277-281 行）的 style 改为毛玻璃：

```jsx
      <div style={{
        padding: '8px 16px',
        background: 'rgba(17,24,20,0.55)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
```

阵型栏容器（约 555-558 行）的 style 改为：

```jsx
        <div style={{
          padding: '6px 16px',
          background: 'rgba(17,24,20,0.55)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
```

- [ ] **Step 3: BoardCanvas 顶栏「← 返回」「+ 盘」用 ctrl-btn**

同文件。「← 返回」Link（约 282-292 行）：加 `className="ctrl-btn"`，并从内联 style 去掉 `background/border/color`（保留布局）。改后：

```jsx
        <Link
          to="/"
          title="返回战术板列表"
          className="ctrl-btn"
          style={{
            padding: '4px 10px', height: 28, borderRadius: 6, lineHeight: '20px',
            fontSize: 13, textDecoration: 'none',
          }}
        >
          ← 返回
        </Link>
```

「+ 盘」按钮（约 335-347 行）：加 `className="ctrl-btn"`，去掉内联的 `background/border/color/opacity`（`disabled` 由 `.ctrl-btn:disabled` 接管），保留布局与 `disabled`/`title`。改后：

```jsx
          <button
            onClick={addDisc}
            disabled={isPlaying}
            title="加一个飞盘"
            className="ctrl-btn"
            style={{
              padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13,
            }}
          >
            + 盘
          </button>
```

- [ ] **Step 4: UndoRedoButtons 用 ctrl-btn**

`client/src/components/UndoRedoButtons.jsx` 整文件替换为（布局留内联，外观交给 class，禁用交给 `:disabled`）：

```jsx
const btnStyle = { padding: '0 10px', height: 28, borderRadius: 6, fontSize: 14, lineHeight: 1 }

export default function UndoRedoButtons({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <>
      <button className="ctrl-btn" style={btnStyle} aria-label="撤销" disabled={!canUndo} onClick={onUndo}>↶</button>
      <button className="ctrl-btn" style={btnStyle} aria-label="重做" disabled={!canRedo} onClick={onRedo}>↷</button>
    </>
  )
}
```

- [ ] **Step 5: FormationMenu 触发按钮用 ctrl-btn**

`client/src/components/FormationMenu.jsx`。`TRIGGER` 常量（第 4-8 行）删掉 `background/border/color`，只留布局：

```jsx
const TRIGGER = {
  padding: '4px 12px', height: 28, borderRadius: 6, fontSize: 13,
}
```

触发按钮（约 50-57 行）加 `className="ctrl-btn"`，并去掉内联里的 `cursor/opacity`（禁用态交给 `.ctrl-btn:disabled`）：

```jsx
      <button
        className="ctrl-btn"
        style={TRIGGER}
        disabled={disabled}
        title={disabled ? '播放中或非关键帧不可用' : '选择阵型预设'}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
      >
        阵型 ▲
      </button>
```

（弹出菜单 `MENU`/`ITEM` 与 hover 行内逻辑不动。）

- [ ] **Step 6: AnnotationToolbar 栏底毛玻璃 + 按钮 ctrl-btn**

`client/src/components/AnnotationToolbar.jsx`。`styles.bar`（约 14-18 行）改为毛玻璃（保留绝对定位与圆角）：

```jsx
  bar: {
    position: 'absolute', top: 12, left: 12, zIndex: 15,
    display: 'flex', alignItems: 'center', gap: 6, padding: 6,
    background: 'rgba(17,24,20,0.55)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
```

`styles.btn` 改为只返回布局（外观交给 class）：

```jsx
  btn: { padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13 },
```

所有用到 `styles.btn(active)` 的按钮改为 `style={styles.btn}` + `className`：
- 折叠态的「✎ 标注」按钮（约 38 行）：`<button aria-label="展开工具栏" className="ctrl-btn" style={styles.btn} onClick={() => setCollapsed(false)}>✎ 标注</button>`
- 工具按钮 map（约 45-55 行）：`className={`ctrl-btn ${tool === t.key ? 'active' : ''}`} style={styles.btn}`
- 「本帧」（约 57 行）：`className={`ctrl-btn ${scope === 'frame' ? 'active' : ''}`} style={styles.btn}`
- 「全局」（约 58 行）：`className={`ctrl-btn ${scope === 'global' ? 'active' : ''}`} style={styles.btn}`
- 收起按钮「«」（约 70 行）：`className="ctrl-btn" style={styles.btn}`

改后这几处：

```jsx
  if (collapsed) {
    return (
      <div style={styles.bar}>
        <button aria-label="展开工具栏" className="ctrl-btn" style={styles.btn} onClick={() => setCollapsed(false)}>✎ 标注</button>
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
          className={`ctrl-btn ${tool === t.key ? 'active' : ''}`}
          style={styles.btn}
          onClick={() => onToolChange(t.key)}
        >
          {t.label}
        </button>
      ))}
      <span style={styles.sep} />
      <button aria-label="本帧" aria-pressed={scope === 'frame'} className={`ctrl-btn ${scope === 'frame' ? 'active' : ''}`} style={styles.btn} onClick={() => onScopeChange('frame')}>本帧</button>
      <button aria-label="全局" aria-pressed={scope === 'global'} className={`ctrl-btn ${scope === 'global' ? 'active' : ''}`} style={styles.btn} onClick={() => onScopeChange('global')}>全局</button>
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
      <button aria-label="收起工具栏" className="ctrl-btn" style={styles.btn} onClick={() => setCollapsed(true)}>«</button>
    </div>
  )
```

（颜色 swatch 保持原样——它的选中态靠白描边，不走 ctrl-btn。）

- [ ] **Step 7: Timeline 栏底毛玻璃 + 控制按钮 ctrl-btn**

`client/src/components/Timeline.jsx`。`STYLES.bar`（约 8-11 行）改毛玻璃：

```jsx
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px',
    background: 'rgba(17,24,20,0.55)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
```

`STYLES.btn`（约 12-16 行）改为只布局，并删掉 `STYLES.toggleOn`（约 17 行，循环激活态改用 class）：

```jsx
  btn: {
    padding: '0 12px', height: 36, borderRadius: 6,
    fontSize: 16, lineHeight: 1,
  },
```

控制按钮（约 104-115 行）加 `className`：

```jsx
      <button className="ctrl-btn" style={STYLES.btn} aria-label="上一帧" onClick={() => onStep(-1)}>⏮</button>
      {isPlaying ? (
        <button className="ctrl-btn" style={STYLES.btn} aria-label="暂停" onClick={onPause}>⏸</button>
      ) : (
        <button className="ctrl-btn" style={STYLES.btn} aria-label="播放" onClick={onPlay}>▶</button>
      )}
      <button className="ctrl-btn" style={STYLES.btn} aria-label="下一帧" onClick={() => onStep(1)}>⏭</button>
      <button
        className={`ctrl-btn ${loop ? 'active' : ''}`}
        style={STYLES.btn}
        aria-label="循环"
        onClick={onToggleLoop}
      >🔁</button>
```

插入帧按钮（约 157 行）：`<button className="ctrl-btn" style={STYLES.btn} aria-label="插入帧" onClick={() => onInsertAfter(currentFrameIndex)}>＋</button>`

（帧块 `STYLES.frame`、`STYLES.playhead`、`STYLES.durInput`、`STYLES.handle` 本任务不动，留给 Task 5。）

- [ ] **Step 8: 全量测试不回归**

Run: `cd client; npx vitest run --no-file-parallelism`
Expected: 全部通过。`Timeline.test.jsx` 和 `AnnotationToolbar.test.jsx` 用 `getByText`/`getByLabelText` 取按钮，不依赖 class/inline 外观，应不受影响。

- [ ] **Step 9: Commit**

```bash
git add client/src/index.css client/src/components/BoardCanvas.jsx client/src/components/UndoRedoButtons.jsx client/src/components/FormationMenu.jsx client/src/components/AnnotationToolbar.jsx client/src/components/Timeline.jsx
git commit -m "style: frosted-glass control bars + breathing .ctrl-btn states"
```

---

### Task 4: `isFrameModified` 纯函数

判定一帧是否被教练手动改过（有标注，或任一 player/disc 带贝塞尔曲率 ctrl）。供 Task 5 的时间轴小点用。完整 TDD。

**Files:**
- Create: `client/src/utils/frameStatus.js`
- Create: `client/src/utils/frameStatus.test.js`

- [ ] **Step 1: 写失败测试**

`client/src/utils/frameStatus.test.js`：

```js
import { isFrameModified } from './frameStatus'

test('空帧（无标注、无 ctrl）→ false', () => {
  expect(isFrameModified({ playerStates: { p1: { x: 0.1, y: 0.2 } }, discStates: {}, annotations: [] })).toBe(false)
})

test('缺省 playerStates/discStates/annotations 也不报错 → false', () => {
  expect(isFrameModified({})).toBe(false)
})

test('有本帧标注 → true', () => {
  expect(isFrameModified({ playerStates: {}, discStates: {}, annotations: [{ id: 'a' }] })).toBe(true)
})

test('某 player 带贝塞尔 ctrl → true', () => {
  expect(isFrameModified({
    playerStates: { p1: { x: 0.1, y: 0.2, ctrl: { x: 0.3, y: 0.4 } } },
    discStates: {}, annotations: [],
  })).toBe(true)
})

test('某 disc 带 ctrl → true', () => {
  expect(isFrameModified({
    playerStates: {}, discStates: { d1: { x: 0.5, y: 0.5, ctrl: { x: 0.6, y: 0.6 } } }, annotations: [],
  })).toBe(true)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd client; npx vitest run --no-file-parallelism src/utils/frameStatus.test.js`
Expected: FAIL —— 报找不到 `./frameStatus` 模块 / `isFrameModified is not a function`。

- [ ] **Step 3: 实现**

`client/src/utils/frameStatus.js`：

```js
// 一帧是否被教练手动改过：有标注，或任一 player/disc 带贝塞尔曲率 ctrl。
// 用于时间轴把「有战术发生」的帧标成飞盘黄小点。
export function isFrameModified(frame) {
  if (frame.annotations && frame.annotations.length > 0) return true
  for (const id in frame.playerStates) {
    if (frame.playerStates[id]?.ctrl) return true
  }
  for (const id in frame.discStates) {
    if (frame.discStates[id]?.ctrl) return true
  }
  return false
}
```

（`for...in` 对 `undefined`/`null` 安全：不迭代、不报错，故缺省字段返回 false。）

- [ ] **Step 4: 运行确认通过**

Run: `cd client; npx vitest run --no-file-parallelism src/utils/frameStatus.test.js`
Expected: PASS（5 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/frameStatus.js client/src/utils/frameStatus.test.js
git commit -m "feat: isFrameModified — detect frames with annotations or bezier ctrl"
```

---

### Task 5: 时间轴帧块重做 —— 改过小点 + 丝滑滑块

帧块从实心彩块改为低调毛玻璃块；每块底部一颗小点（改过=飞盘黄，普通=浅灰）；当前活动帧用一个绝对定位的荧光蓝高亮层表示，切帧时 `transition` 丝滑滑过去；红色精确播放头竖线保留。滑块位置靠帧块 ref 实测像素算，适配按时长变宽的不等宽帧块。

测试环境无 `ResizeObserver`，先给 test-setup 加最小 mock。

**Files:**
- Modify: `client/src/test-setup.js`（加 ResizeObserver mock）
- Modify: `client/src/components/Timeline.jsx`
- Modify: `client/src/components/Timeline.test.jsx`（追加小点 + 滑块断言）

- [ ] **Step 1: test-setup 加 ResizeObserver mock**

`client/src/test-setup.js` 末尾追加：

```js
// jsdom 没有 ResizeObserver；Timeline 滑块测量用到，mock 成空实现
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
```

- [ ] **Step 2: 写失败测试（小点 + 滑块）**

`client/src/components/Timeline.test.jsx` 末尾追加（沿用文件里的 `setup`，但小点用例需要自带 playerStates/annotations 的 frames，故单独 render）：

```js
import { render as rtlRender } from '@testing-library/react'

test('改过的帧渲染飞盘黄小点，普通帧渲染浅灰小点', () => {
  const framesWithStatus = [
    { id: 'm0', duration: 1000, annotations: [{ id: 'a' }], playerStates: {}, discStates: {} },
    { id: 'm1', duration: 1000, annotations: [], playerStates: {}, discStates: {} },
  ]
  const handlers = {
    onJumpToFrame: vi.fn(), onPlay: vi.fn(), onPause: vi.fn(), onToggleLoop: vi.fn(),
    onInsertAfter: vi.fn(), onRemoveFrame: vi.fn(), onSetDuration: vi.fn(), onStep: vi.fn(), onSetPlayhead: vi.fn(),
  }
  rtlRender(
    <Timeline frames={framesWithStatus} currentFrameIndex={0} playheadTime={0}
      isPlaying={false} loop={false} {...handlers} />
  )
  expect(screen.getByTestId('frame-dot-0').dataset.modified).toBe('true')
  expect(screen.getByTestId('frame-dot-1').dataset.modified).toBe('false')
})

test('渲染当前帧滑块高亮层', () => {
  setup()
  expect(screen.getByTestId('frame-slider')).toBeInTheDocument()
})
```

- [ ] **Step 3: 运行确认失败**

Run: `cd client; npx vitest run --no-file-parallelism src/components/Timeline.test.jsx`
Expected: FAIL —— 找不到 `frame-dot-0` / `frame-slider` testid。

- [ ] **Step 4: 实现 —— Timeline 帧块重做 + 滑块**

`client/src/components/Timeline.jsx`：

(a) 顶部 import 加 `useLayoutEffect` 与 `isFrameModified`：

```jsx
import { useRef, useState, useLayoutEffect } from 'react'
import { totalDuration, durationFromDrag, activeFrameIndex } from '../utils/interpolate'
import { isFrameModified } from '../utils/frameStatus'
```

(b) `STYLES.frame` 改为低调毛玻璃块（不再用 active 实心高亮，去掉入参），并新增 `STYLES.dot` 与 `STYLES.slider`。把原 `STYLES.frame: (active) => ({...})` 替换为：

```jsx
  frame: {
    position: 'relative', height: 36, borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', flexShrink: 0, boxSizing: 'border-box',
  },
  dot: (modified) => ({
    position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
    width: 5, height: 5, borderRadius: '50%',
    background: modified ? '#ffd23f' : 'rgba(255,255,255,0.25)',
    pointerEvents: 'none',
  }),
  slider: (left, width) => ({
    position: 'absolute', top: 0, height: 36, left, width,
    borderRadius: 6, boxSizing: 'border-box',
    background: 'rgba(56,189,248,0.15)', border: '2px solid #38bdf8',
    boxShadow: '0 0 12px rgba(56,189,248,0.3)', pointerEvents: 'none',
    transition: 'left .25s cubic-bezier(.16,1,.3,1), width .25s cubic-bezier(.16,1,.3,1)',
  }),
```

(c) 组件体内，`activeIndex` 那行（约 65 行）之后加帧块 ref 数组、滑块 state 与测量副作用：

```jsx
  const blockRefs = useRef([])
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  function measureSlider() {
    const track = trackRef.current
    const el = blockRefs.current[activeIndex]
    if (!track || !el) return
    const t = track.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setSlider({ left: b.left - t.left, width: b.width })
  }

  // 切帧 / 帧增删 / 时长变化后重测；首帧用 layout effect 避免闪烁
  useLayoutEffect(() => {
    measureSlider()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureSlider())
    if (trackRef.current) ro.observe(trackRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, frames, total])
```

(d) 轨道内的帧块 map（约 117-142 行的 `<div ref={trackRef} ...>` 块）替换为：每块挂 ref、去掉 active 入参、加小点与 testid，并在帧块后、红线前插入滑块：

```jsx
      <div ref={trackRef} style={STYLES.track} onClick={handleTrackClick}>
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            ref={(el) => { blockRefs.current[i] = el }}
            style={{ ...STYLES.frame, flex: blockFlex(i) }}
            onClick={(e) => { e.stopPropagation(); onJumpToFrame(i) }}
            onContextMenu={(e) => {
              e.preventDefault()
              if (frames.length > 1) onRemoveFrame(i)
            }}
            title={frames.length > 1 ? '右键删除此帧' : ''}
          >
            {i + 1}
            <span
              data-testid={`frame-dot-${i}`}
              data-modified={isFrameModified(frame) ? 'true' : 'false'}
              style={STYLES.dot(isFrameModified(frame))}
            />
            {/* Resize handle — not on last frame */}
            {i < frames.length - 1 && (
              <div
                style={STYLES.handle}
                onMouseDown={(e) => handleResizeStart(e, i)}
                onClick={(e) => e.stopPropagation()}
                title="拖动改变本帧时长"
              />
            )}
          </div>
        ))}
        <div data-testid="frame-slider" style={STYLES.slider(slider.left, slider.width)} />
        <div style={STYLES.playhead(playheadPct)} />
      </div>
```

注意：滑块 `pointerEvents:'none'`，点击穿透到下面的帧块，跳帧不受影响。

- [ ] **Step 5: 运行确认通过**

Run: `cd client; npx vitest run --no-file-parallelism src/components/Timeline.test.jsx`
Expected: PASS（新增 2 个用例 + 原有用例全过；原「renders one block per frame」等用 `getByText` 仍命中数字）。

- [ ] **Step 6: 全量测试不回归**

Run: `cd client; npx vitest run --no-file-parallelism`
Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add client/src/test-setup.js client/src/components/Timeline.jsx client/src/components/Timeline.test.jsx
git commit -m "feat: timeline keyframe dots + smooth sliding playhead highlight"
```

---

## 最终验收（浏览器）

实现全部完成后，由用户在浏览器逐项肉眼确认（这些是视觉细节，自动化测不了）：

1. 编辑界面背景是中心墨绿微光、四周近黑；球场矩形有向下柔影、像浮起。
2. 顶栏 / 画笔栏 / 阵型栏 / 时间轴都是半透明毛玻璃；按钮无硬边框、hover 提亮；循环开 / 画笔「本帧」「选择」等激活态是荧光蓝 + 外发光。
3. 时间轴帧块是低调毛玻璃块；改过的帧底部有飞盘黄小点、普通帧浅灰小点；切帧时蓝色高亮块在轨道上丝滑滑过去；红色播放头竖线还在。
4. 球员是哑光红 `#ef4444` / 哑光蓝 `#3b82f6`、名字更轻更透气；飞盘有右下投影、像悬浮在球员头顶上空。

---

## Self-Review（写完即查）

- **Spec 覆盖：** ① 微光+柔影→Task 1；② 毛玻璃+呼吸态按钮→Task 3；③ 改过小点→Task 4+5、丝滑滑块→Task 5；④ 哑光色+字体→Task 2、飞盘投影→Task 2。无遗漏。FAB 明确非目标，未排任务。
- **占位符：** 无 TBD/“类似上文”，每步给了完整代码与命令。
- **类型/命名一致：** `isFrameModified` 在 Task 4 定义、Task 5 import 使用，签名一致（接收 frame 对象，返回 boolean）；`.ctrl-btn` / `.ctrl-btn.active` / `:disabled` 在 Task 3 Step 1 定义，后续各按钮用同名 class；testid `frame-dot-${i}` / `frame-slider` 在 Task 5 实现与测试一致。
