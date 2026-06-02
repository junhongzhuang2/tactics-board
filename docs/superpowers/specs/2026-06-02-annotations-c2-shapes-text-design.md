# 标注 C2：形状 + 文字 设计文档

> 标注工具第二阶段。C1（箭头：传盘/跑位）已于 2026-06-02 完成并合并到 main。本阶段在 C1 已验证的结构上**向外扩展**：新增矩形、椭圆、文字三种标注类型，并加入一排颜色选择。编辑已有标注、作用域切换 UI、折叠工具栏归 C3。

## 1. 目标与范围

**做什么：**
- **矩形**（描边空心，拖拽包围盒）
- **椭圆/圆**（描边空心，包围盒内切，拖拽）
- **文字**（点击放置 + 画布内联 `<input>` 输入）
- **一排颜色选择**（黄/红/蓝/白），作用于所有新建标注（含箭头）

**不做（留待 C3）：** 编辑已有标注（移动/改尺寸/改文字）、作用域切换 UI、折叠工具栏、形状自由旋转、按住画正圆/正方形。

**核心哲学（与 C1 一致）：** 标注只支持「创建 + 删除」，不支持创建后编辑。文字内容在创建时定一次，要改就删了重写。

## 2. 方案选择

采用**「最大化复用 C1」**方案：形状沿用箭头的 `draft={x1,y1,x2,y2}` 拖拽绘制流；`store` 的 `addAnnotation/removeAnnotation`（已是通用 annotation 数组）零改动；`AnnotationLayer` 从写死渲染箭头改为按 `type` 分发到独立小组件。

已排除：(B) 把箭头重构进统一几何抽象——要动刚稳定的 C1，回归风险高，违反 YAGNI；(C) 形状/文字走独立数据路径——与 scope/删除/历史机制割裂、大量重复代码。

## 3. 数据模型

坐标全部归一化（0–1），与现有标注一致。**已有 `type:'arrow'` 完全不动，向后兼容。**

```
矩形    { id, type:'rect',    x1, y1, x2, y2, color }
椭圆    { id, type:'ellipse', x1, y1, x2, y2, color }
文字    { id, type:'text',    x,  y,  text, color }
```

- **矩形/椭圆**复用箭头的两角 `x1,y1,x2,y2`（拖拽起点/终点，可能反向）。渲染时归一化成包围盒：`left=min(x1,x2)`、`top=min(y1,y2)`、`w=|x2−x1|`、`h=|y2−y1|`。椭圆按包围盒内切（center = 两角中点，radiusX/Y = 半宽/半高）。这样形状**完全复用**箭头那条 `draft` 绘制流。
- **文字**是单点锚（左上）+ 字符串，字号用固定屏幕像素常量 `DEFAULT_FONT_PX=16`（不随画布缩放变大，避免小场地时文字爆掉）。

`store` 的 `addAnnotation(scope, frameIndex, annotation)` / `removeAnnotation(...)` 与 `visibleAnnotations(data, activeIdx)` **一行都不用改**。

## 4. 纯函数层（`utils/annotations.js`）

现有函数（`createArrowAnnotation` / `visibleAnnotations` / `arrowPixelLength`）都不动。新增：

```
createRectAnnotation(x1,y1,x2,y2,color)    → { id, type:'rect', ... }
createEllipseAnnotation(x1,y1,x2,y2,color) → { id, type:'ellipse', ... }
createTextAnnotation(x,y,text,color)       → { id, type:'text', ... }

export const MIN_SHAPE_PX = 5      // 形状对角线像素 < 5 拦截（复用 arrowPixelLength 算对角线）
export const DEFAULT_FONT_PX = 16
export const ANNO_COLORS = ['#ffeb3b', '#ff5252', '#4a9eff', '#ffffff']  // 黄/红/蓝/白
```

- id 生成沿用现有 `anno-${Date.now()}-${rand}` 写法。
- 最小尺寸拦截复用现有 `arrowPixelLength`（两点 hypot，语义通用），阈值用新增 `MIN_SHAPE_PX`（=5，与箭头 `MIN_ARROW_PX` 同值）。

## 5. 绘制流（`BoardCanvas`）

**工具集扩展：** `tool` 从 `'none'|'pass'|'run'` 扩成再加 `'rect'|'ellipse'|'text'`。两类交互：
- **拖拽型**（`pass/run/rect/ellipse`）：走现有 `draft={x1,y1,x2,y2}` 流程。
- **点击型**（`text`）：click 放点，不走 draft。

**改动点：**
- `handleStageMouseDown/Move`：拖拽型逻辑不变；现有 frame-scope 非关键帧门控（`if (scope==='frame' && !editable) return`）一并复用。
- `handleStageMouseUp`：把写死的 `createArrowAnnotation` 换成按 `tool` 分发——`pass/run→createArrow`、`rect→createRect`、`ellipse→createEllipse`；最小尺寸阈值用 `MIN_SHAPE_PX`。`addAnnotation` 调用不变，anno 带上当前 `color`。
- **文字**：`text` 工具下 mousedown → 记录归一化点 `textDraft={x,y}`（同样过 frame-scope 门控）→ 画布上叠一个 HTML `<input>`，绝对定位到该点屏幕坐标（`fieldX + x*fieldW`, `fieldY + y*fieldH`）。回车/失焦：`text.trim()` 非空 → `createTextAnnotation` + `addAnnotation`；Esc 或空 → 取消。清 `textDraft`。

**焦点隔离（已自动满足）：** keydown 守卫（`BoardCanvas.jsx:87`）已对 `INPUT/TEXTAREA` 放行，故文字内联 input 聚焦时 Delete/Ctrl+Z 只作用于输入框文本，不删标注、不触发画布撤销。无需新代码。

## 6. 渲染分发（`AnnotationLayer`）

- 现在写死 `ArrowAnnotation`，改为抽一个 `renderAnnotation(anno, props)` 内部 `switch(anno.type)` → `Arrow/Rect/Ellipse/Text` 四个组件。**entries 和 draft 预览共用这一个分发函数**（单一来源）。
- draft 预览把 `{ id:'__draft__', type: toolToType(tool), color, ...draft }` 丢给同一分发渲染（文字无拖拽预览，不参与）。其中 `toolToType`：`pass/run→'arrow'`、`rect→'rect'`、`ellipse→'ellipse'`；箭头预览额外带 `variant=tool`（区分虚线传盘/实线跑位）。

## 7. 新增组件（与 `ArrowAnnotation` 并列，各自一种 type）

- **`RectAnnotation`** — Konva `Rect`，描边、透明填充（使内部整体可点选，视觉仍空心）+ `hitStrokeWidth` 加宽边框命中；选中加粗 + 阴影；`onClick/onTap/onContextMenu` 同箭头（`cancelBubble` + select/delete）。
- **`EllipseAnnotation`** — Konva `Ellipse`（中心 + 半径由两角算），其余同 Rect。
- **`TextAnnotation`** — Konva `Text`（`fontSize=DEFAULT_FONT_PX`，`fill=color`），选中高亮，点选/删除同上。

## 8. 颜色

- `BoardCanvas` 加 `const [color, setColor] = useState(DEFAULT_ANNO_COLOR)`（默认黄 = `ANNO_COLORS[0]`）。新建标注（箭头/形状/文字）统一带入当前 `color`，替换写死的 `DEFAULT_ANNO_COLOR`——**色块对箭头也生效**。
- `AnnotationToolbar` 加一排色块：遍历 `ANNO_COLORS` 渲染小方块按钮，当前色高亮（`aria-pressed`）。新增 props `color` / `onColorChange`。

## 9. 实现注意 / 坑

> 这两点必须在实现时落实，否则会有隐蔽缺陷。

1. **空心形状选中阴影：** Rect/Ellipse 内部透明，Konva 的 `shadowBlur` 默认只给**填充区**上阴影。选中高亮若用阴影，**必须配 `shadowForStrokeEnabled={true}`**，否则空心形状的边框没有阴影、看不出选中态。

2. **文字内联 input 生命周期：** 在 BoardCanvas 之上动态挂载的 HTML `<input>`，其 `z-index` 必须**高于 Konva Stage 的容器**；提交或 `onBlur` 后**必须从 DOM 树彻底卸载（unmount，即条件渲染 `textDraft && <input>`）**，**绝不能用 `display:none` 隐藏**——残留的透明 DOM 会永久拦截画布的点击事件，导致之后无法选中/绘制。

## 10. 测试策略

沿用 C1 取舍——纯函数 / store / toolbar 可测；Konva 渲染组件 + 绘制流挂 canvas、脆弱，不写自动化测试，走人工冒烟。

**自动化（Vitest + @testing-library）：**
- `utils/annotations.test.js` 增：三个 create 函数产出正确结构（type/字段/color/唯一 id）；`visibleAnnotations` 对混合 type（含 rect/text）仍正确归类。
- `AnnotationToolbar.test.jsx` 增：渲染出矩形/椭圆/文字三个新工具 + 色块；点新工具 → `onToolChange` 带正确 key；点色块 → `onColorChange` 带正确色、当前色 `aria-pressed`。
- `store` 的 `addAnnotation/removeAnnotation` 不改、已被现有箭头测试覆盖（形状/文字走同一路径），不新增。

**人工冒烟清单：**
1. 拖拽画矩形/椭圆，松手生成；太小（<5px）不生成。
2. 文字：点画布出输入框，回车生成；Esc/空不生成；**输入框内 Ctrl+Z/Delete 只动文本、不动标注历史**；提交后画布可正常点选（验证 input 已 unmount，无透明 DOM 残留）。
3. 选色块后新建标注（含箭头）用该色。
4. frame scope 非关键帧不能画（门控）、global 始终可画。
5. 右键 / 选中后 Delete 删形状/文字；撤销-重做覆盖其增删。
6. 选中矩形/椭圆时边框有阴影高亮（验证 `shadowForStrokeEnabled`）。
7. 自动保存：画完约 1 秒「已保存」，刷新仍在。

## 11. 文件清单

- **Modify** `client/src/utils/annotations.js` — 三个 create 函数 + 常量。
- **Modify** `client/src/utils/annotations.test.js` — 新增测试。
- **Modify** `client/src/components/AnnotationToolbar.jsx` — 新工具按钮 + 色块。
- **Modify** `client/src/components/AnnotationToolbar.test.jsx` — 新增测试。
- **Modify** `client/src/components/AnnotationLayer.jsx` — 按 type 分发。
- **Create** `client/src/components/RectAnnotation.jsx`
- **Create** `client/src/components/EllipseAnnotation.jsx`
- **Create** `client/src/components/TextAnnotation.jsx`
- **Modify** `client/src/components/BoardCanvas.jsx` — 工具集、绘制流分发、文字内联 input、颜色 state（人工验证）。

> 无数据库迁移；无后端改动；`store` 零改动。

## 12. 单元边界回顾

纯函数层（无副作用、易测）→ store（零改动）→ `AnnotationLayer` 分发（单一 `renderAnnotation` 来源）→ 4 个独立小组件（各一种 type）→ `BoardCanvas` 绘制流（拖拽/点击两类）→ `Toolbar`（工具 + 色块）。每个单元职责单一、边界清晰，可独立理解与测试。
