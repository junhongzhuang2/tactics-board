# 标注工具 C1：基础设施 + 箭头 设计文档

**日期：** 2026-06-01
**状态：** 已确认
**范围：** Phase 2 Sub-block C 的第一块（C1）——标注数据模型、store、画布渲染、绘制工具栏、箭头类型（传盘虚线 / 跑位实线）、点选 + 删除，全程纳入撤销。C2（形状+文字）、C3（编辑+作用域切换 UI+折叠工具栏）另开。

---

## 1. 目标

用箭头走通整条标注管线：**数据 → 工具栏 → 绘制 → 渲染 → 选中 → 删除 → 撤销**。
- 两种箭头：**传盘**（虚线）、**跑位**（实线），直线，自带箭头。
- 作用域由工具栏开关决定：**本帧**（存该关键帧，仅当它是「活动帧」时显示）或 **全局**（存 board 级，始终显示）。
- 增删标注纳入撤销/重做。

> 现有占位已就绪：`frames[].annotations: []`、`board.data.globalAnnotations: []`，且增删帧已带着 annotations 走。本块开始真正使用它们。

---

## 2. 数据模型

标注对象（坐标归一化 0–1，相对场地）：
```
{ id: 'anno-<timestamp>', type: 'arrow', variant: 'pass' | 'run', x1, y1, x2, y2, color }
```
- `variant: 'pass'` → 虚线；`'run'` → 实线。
- **本帧标注**存入 `frames[currentFrameIndex].annotations[]`；**全局标注**存入 `board.data.globalAnnotations[]`。
- `color`：固定默认黄色 `'#ffeb3b'`（绿茵上清晰）；调色后续再加。
- 向后兼容：旧数据这两个数组已存在为 `[]`。

---

## 3. 纯函数 `utils/annotations.js`（可单测）

```js
export const MIN_ARROW_PX = 5

// 新建箭头标注（带唯一 id）
export function createArrowAnnotation(variant, x1, y1, x2, y2, color) {
  return { id: `anno-${Date.now()}`, type: 'arrow', variant, x1, y1, x2, y2, color }
}

// 当前应显示的标注：全局（始终） + 活动帧的本帧标注。
// 返回带归属信息的条目，供选中/删除定位。
export function visibleAnnotations(data, activeFrameIndex) {
  const globals = (data.globalAnnotations ?? []).map(a => ({ annotation: a, scope: 'global', frameIndex: null }))
  const frameAnnos = (data.frames[activeFrameIndex]?.annotations ?? []).map(a => ({ annotation: a, scope: 'frame', frameIndex: activeFrameIndex }))
  return [...globals, ...frameAnnos]
}

// 两端物理屏幕像素距离（零长度拦截用）
export function arrowPixelLength(x1px, y1px, x2px, y2px) {
  return Math.hypot(x2px - x1px, y2px - y1px)
}
```

---

## 4. Store 动作（均走 `withHistory`，纳入撤销）

```js
addAnnotation(scope, frameIndex, annotation) // scope 'frame'|'global'
removeAnnotation(scope, frameIndex, annotationId)
```
- `addAnnotation`：`scope==='global'` → 把 annotation push 进 `globalAnnotations`；否则 push 进 `frames[frameIndex].annotations`。不可变更新 + `withHistory` + `isDirty:true`。
- `removeAnnotation`：从对应集合按 `id` 过滤删除。同样 `withHistory`。
- 因走 `withHistory`，增删标注天然进撤销/重做（与现有动作一致）。

---

## 5. 绘制流（核心）

BoardCanvas 本地状态：`tool`（`'none' | 'pass' | 'run'`）、`scope`（`'frame' | 'global'`）、`draft`（绘制中的箭头 `{x1,y1,x2,y2}` 归一化，或 null）、`selectedAnnoId`。

**工具模式**：
- `tool !== 'none'` 时：球员/飞盘 `draggable=false`；Stage 进入绘制模式。
- `tool === 'none'` 时：恢复正常编辑（拖球员、旋转、双击面板）；点标注=选中。

**绘制（仅在非播放态）**：
- `onMouseDown`：取 `stage.getPointerPosition()`，减去 `fieldX/fieldY` 得场地内 px，再 `/fieldW、/fieldH` 归一化并夹到 0–1；`draft.start = draft.end = 该点`。
- `onMouseMove`：有 draft 时更新 `draft.end`，实时预览箭头（用 `ArrowAnnotation` 画 draft）。
- `onMouseUp`：
  - 计算两端**物理像素距离** `len = arrowPixelLength(x1*fieldW, y1*fieldH, x2*fieldW, y2*fieldH)`。
  - **【零长度拦截】** 若 `len < MIN_ARROW_PX(5)` → 视为误触，**丢弃 draft，不调 addAnnotation、不进 store、不进撤销栈**。
  - 否则 `createArrowAnnotation(tool, ...draft, color)` → `addAnnotation(scope, currentFrameIndex, anno)`；清空 draft。
- 颜色用默认 `'#ffeb3b'`。

**选中 / 删除（tool === 'none'）**：
- 点击某标注 → `selectedAnnoId = 它的 id`（高亮）。点空白 → 取消选中。
- 选中后按 `Delete`/`Backspace` 或右键该标注 → `removeAnnotation(scope, frameIndex, id)`（scope/frameIndex 来自 visibleAnnotations 的归属信息）。
- 移动/拖端点编辑 = **C3**，本块不做。

---

## 6. 组件

- **`AnnotationToolbar.jsx`**：画布左上角浮动小工具条。按钮：选择(`none`)、传盘(`pass`,虚线图标)、跑位(`run`,实线图标)，当前工具高亮；作用域开关「本帧/全局」。Props：`tool`、`scope`、`onToolChange`、`onScopeChange`。（折叠面板留 C3。）
- **`ArrowAnnotation.jsx`**：渲染一条箭头。用 react-konva `<Arrow>`：`points={[x1*fieldW, y1*fieldH, x2*fieldW, y2*fieldH]}`、`stroke/fill=color`、`dash={variant==='pass' ? [10,6] : undefined}`、`strokeWidth=3`、`pointerLength/pointerWidth` 设箭头大小。选中时加高亮（更粗/外发光）。`onClick`/`onTap` → `onSelect(id)`；`onContextMenu` → `onDelete`。
- **`AnnotationLayer.jsx`**：一个 Konva `<Layer x={fieldX} y={fieldY}>`，渲染 `visibleAnnotations(...)` 的每条 `ArrowAnnotation` + 绘制中的 `draft` 预览。接 `selectedAnnoId`、`onSelect`、`onDelete`。
- **`BoardCanvas.jsx`**：加 tool/scope/draft/selectedAnnoId 状态；Stage 绘制事件；渲染 `AnnotationToolbar` + `AnnotationLayer`；绘制模式下关闭球员拖动；键盘 Delete/Backspace 删除选中标注（焦点在 input 时放行）。

**渲染顺序**：场地 → 标注层 → 球员/飞盘层（标注在球员下方，避免盖住球员；如需在上层后续可调）。`activeFrameIndex` 复用 `interpolate.js` 已有函数。

---

## 7. 数据流

- **显示**：`AnnotationLayer` 用 `visibleAnnotations(board.data, activeFrameIndex(frames, playheadTime))` → 全局始终显示、活动帧的本帧标注随播放出现/消失。
- **绘制**：Stage mouseup（通过零长度拦截后）→ `addAnnotation(scope, currentFrameIndex, anno)` → withHistory + 自动保存。
- **删除**：选中 + Delete/右键 → `removeAnnotation(...)` → withHistory + 自动保存。

---

## 8. 测试思路（TDD）

**`utils/annotations.js`：**
- `createArrowAnnotation`：含唯一 id、type 'arrow'、variant、四坐标、color。
- `visibleAnnotations`：全局始终在；活动帧的本帧标注带 `scope:'frame'`+`frameIndex`；活动帧无标注/越界 → 只剩全局；条目带正确归属。
- `arrowPixelLength`：`(0,0,3,4)`→5；据此 `< 5` / `>= 5` 的拦截边界（如 4.9 丢弃、5 保留）。

**store：**
- `addAnnotation('frame', 0, a)` → 进 `frames[0].annotations`、记历史；`addAnnotation('global', null, a)` → 进 `globalAnnotations`、记历史。
- `removeAnnotation` 从对应集合按 id 删除、记历史；`undo()` 还原。

**`AnnotationToolbar` 组件：** 渲染三个工具按钮 + 作用域开关；点击调 `onToolChange`/`onScopeChange`；当前工具/作用域高亮。

**Konva 渲染与绘制拖拽**（ArrowAnnotation/AnnotationLayer、Stage mousedown/move/up）：不写脆弱自动化测试；几何与拦截由 `annotations.js` 纯函数覆盖，交互人工浏览器验证。

---

## 9. 不在 C1 范围

- 形状（矩形/圆 区域）、文字标注 → C2。
- 移动/拖端点编辑已有标注、每条标注的作用域切换 UI、工具栏折叠面板 → C3。
- 曲线箭头 → 并入 [[backlog-future-features]] 的曲线轨迹。
- 标注调色 / 线宽自定义 → 后续。
