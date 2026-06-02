# 标注 C3：编辑打磨 设计文档

> 标注工具第三阶段。C1（箭头）、C2（形状+文字，含文字编辑/多行/调宽）已完成并合并到 main。C3 围绕「选中一条已有标注后对它做操作」+ 工具栏体验：**移动、拖句柄改尺寸、作用域切换（本帧↔全局）、折叠工具栏**。

## 1. 目标与范围

**做什么：**
- **移动**：「选择」工具下拖动任意标注（箭头/矩形/椭圆/文字）整体挪位置。
- **改尺寸**：选中矩形/椭圆拖 4 角改大小；选中箭头拖 2 端点改方向长度。（文字"大小"由 C2 双击调框宽负责，不另加句柄。）
- **作用域切换**：选中标注后在浮动工具条上「本帧 ↔ 全局」切换。
- **折叠工具栏**：标注工具栏可收起/展开，不挡画布。

**不做（YAGNI）：** 旋转、文字加句柄、8 句柄（只做 4 角）、多选、对齐吸附。

**核心约束（防"锁死"）：** `全局→本帧`会把标注落到当前帧 `currentFrameIndex`；若此刻 playhead 不在关键帧（`!editable`），标注所属帧与活动帧分叉，将既不显示也选不中而"锁死"。故该切换在 `!editable` 时拦截（UI 层禁用 + 兜底 return）。`本帧→全局`不拦截（全局总可见）；移动/改尺寸不会锁死（改的是标注自身所属帧，可见性不变），不门控。

## 2. 方案

采用**「自绘句柄 + draggable + HTML 浮动工具条」**。移动用 Konva `draggable` 统一各类型；改尺寸用自绘小方块句柄，契合归一化两角模型；浮动工具条用 HTML 浮层（复用 C2 文字框「归一化坐标→屏幕坐标」定位）承载作用域切换 + 删除。

已排除：**Konva Transformer**——react-konva 里要管理节点 ref + attach，Transformer 用 scale 改大小需在 transformEnd 反算回归一化两角并重置 scale，较绕；箭头/文字又不适用，混合反更复杂。

## 3. 数据模型（不加新字段）

移动/改尺寸只改现有归一化坐标：箭头/矩形/椭圆改 `x1,y1,x2,y2`；文字移动改 `x,y`。作用域切换不改 annotation 内容，只把它从一个数组搬到另一个（`frame.annotations` ↔ `globalAnnotations`）。

## 4. 纯函数（`utils/annotations.js`，可 TDD）

```
translateAnnotation(annotation, dx, dy) → 平移后的 patch（归一化 dx,dy）
  arrow/rect/ellipse: { x1:x1+dx, y1:y1+dy, x2:x2+dx, y2:y2+dy }
  text:               { x:x+dx,   y:y+dy }

annotationTopAnchor(annotation) → 包围盒顶边中点的归一化 {x,y}（浮动工具条定位用）
  arrow/rect/ellipse: { x:(x1+x2)/2, y:Math.min(y1,y2) }
  text:               { x, y }
```

（改尺寸=拖某角/端点改对应 `x1/x2/y1/y2`，逻辑直白，放组件内算，不单独抽函数。）

## 5. store

- **复用 `updateAnnotation(scope, frameIndex, id, patch)`**（C2 已有，合并任意字段）：
  - 移动 = `updateAnnotation(sc, fi, id, translateAnnotation(anno, dx, dy))`
  - 改尺寸 = `updateAnnotation(sc, fi, id, { x2: …, y2: … })` 等
- **新增 `moveAnnotation(fromScope, fromFrameIndex, toScope, toFrameIndex, id)`**：从源数组取出该标注对象、删除，加入目标数组，`withHistory`（一步可撤销）。用于作用域切换。`全局→本帧`时落到 `toFrameIndex`（= 当前帧）。

撤销：移动/改尺寸/切换都进栈；拖拽中本地预览（不入 store/历史），松手提交一步。

## 6. 选中态 + 浮动工具条

- **选中**：复用现有 `selectedAnnoId` + `selectionRef`（已能拿 `{annotation, scope, frameIndex}`）。「选择」工具（none）下单击标注选中；点空白取消（均已有）。
- **浮动工具条（`SelectionToolbar.jsx`，HTML 浮层）**：仅当有选中标注时显示，定位在 `annotationTopAnchor` 上方（`z-index` 高于 Stage，`transform: translateX(-50%)` 居中悬于标注上方）。三个按钮：
  - **「本帧」/「全局」**：指示当前 scope（当前 `aria-pressed`），点另一个执行 `moveAnnotation` 切换。`全局→本帧`按钮在 `!editable` 时 `disabled` + tooltip「停在关键帧才能转为本帧」；切换 handler 内再 `if (toScope==='frame' && !editable) return` 兜底（defense-in-depth）。
  - **「删除」**：`removeAnnotation` + 清选中。
- **防闪退（defense-in-depth）：** 工具条最外层容器加 `onClick`/`onMouseDown` 的 `stopPropagation`。说明：当前 HTML-over-canvas 架构下，点击 HTML 按钮时 canvas 收不到该指针事件，Konva `Stage.onClick` 一般不会触发，故"经 Konva 取消选中而闪退"通常不发生；但 `stopPropagation` 切断冒泡到任何 DOM 祖先、明确闭环意图、对未来稳健，写入。

## 7. 移动 + 改尺寸句柄

**移动（`draggable`）：**
- 「选择」工具下标注节点 `draggable`；`onDragStart` 选中它，`onDragEnd` 读节点新位置 → 算归一化位移 `dx,dy` → `updateAnnotation(sc, fi, id, translateAnnotation(anno, dx, dy))`。
- **坑（已知）：** react-konva 拖动改节点内部 x/y，而节点位置受控于坐标 props。`dragEnd` 提交后靠重渲染按新 props 定位；为防抖动需在 `dragEnd` 把节点 position 复位（箭头用 `points`、无单一 x/y，要读 `node.x()/y()` 当偏移再复位到 0）。计划阶段给每类型精确代码。

**改尺寸（自绘句柄）：**
- 选中 rect/ellipse/arrow 时额外渲染句柄。抽通用 `<Handle x y onDragMove onDragEnd>` 小方块子组件（可拖、`cancelBubble` 防触发本体移动）。
  - rect / ellipse：**4 角**句柄 → 拖动改对应的 `x1/x2` 与 `y1/y2`。
  - arrow：**2 端点**句柄 → 拖动改 `(x1,y1)` 或 `(x2,y2)`。
  - 文字不加句柄。

**拖拽预览机制（移动 & 改尺寸共用）：**
- 拖拽过程中用 BoardCanvas 本地预览 state（临时坐标 patch，**不进 store、不进历史**），选中标注按预览坐标实时渲染；松手 `dragEnd` 时一次性 `updateAnnotation` 提交一步、清预览。与视野锥朝向「拖拽中预览、松手记一步」一致，避免拖拽塞满撤销栈。

## 8. 折叠工具栏

`AnnotationToolbar` 加内部折叠状态（默认展开）。展开 = 现在的整排（工具 + 本帧/全局 + 色块）；收起 = 只剩一个小图标按钮，点击展开，展开态含一个收起按钮。纯 UI，独立于前三项，实现时放最后。

## 9. 测试策略

延续 C1/C2：纯函数 / store / 可测 UI 走单测，Konva 交互人工。

**单测（TDD）：**
- `translateAnnotation`、`annotationTopAnchor`（`utils/annotations.js`）。
- store `moveAnnotation`（本帧→全局、全局→本帧、`withHistory`、undo）。
- `AnnotationToolbar` 折叠（点收起 → 工具隐藏；点展开 → 恢复）。
- `updateAnnotation` 已测，复用。

**不写自动化测试（挂 canvas/DOM，脆弱）：** 移动/句柄拖拽/浮动工具条定位/预览——人工冒烟。

**人工冒烟清单：**
1. 选择工具下拖动箭头/矩形/椭圆/文字 → 移动；松手位置保存、撤销可回。
2. 选中矩形/椭圆 → 4 角句柄拖动改大小；选中箭头 → 拖端点改方向；松手记一步、撤销可回。
3. 拖拽过程流畅预览，不每步进历史（撤销一次回到拖前）。
4. 选中标注 → 浮动工具条出现其上方；切「全局/本帧」生效；`全局→本帧`在非关键帧时按钮禁用 + tooltip。
5. 点工具条按钮（删除/切换）不会误取消选中而闪退；删除后工具条消失。
6. 工具栏收起/展开。
7. 自动保存：操作后约 1 秒「已保存」，刷新后保留。

## 10. 文件清单

- **Modify** `client/src/utils/annotations.js` — `translateAnnotation` + `annotationTopAnchor`。
- **Modify** `client/src/utils/annotations.test.js` — 两函数测试。
- **Modify** `client/src/store/boardStore.js` — `moveAnnotation`。
- **Modify** `client/src/store/boardStore.test.js` — `moveAnnotation` 测试。
- **Create** `client/src/components/Handle.jsx` — 通用可拖句柄。
- **Create** `client/src/components/SelectionToolbar.jsx` — HTML 浮动工具条。
- **Modify** `client/src/components/AnnotationLayer.jsx` — 选中时渲染句柄、`draggable` 透传、按预览坐标渲染。
- **Modify** `client/src/components/ArrowAnnotation.jsx` / `RectAnnotation.jsx` / `EllipseAnnotation.jsx` / `TextAnnotation.jsx` — `draggable` + `onDragEnd` 平移；rect/ellipse/arrow 渲染句柄。
- **Modify** `client/src/components/AnnotationToolbar.jsx` — 折叠 + 测试。
- **Modify** `client/src/components/BoardCanvas.jsx` — 拖拽预览 state、句柄/移动/工具条接线、`moveAnnotation`、作用域切换 editable 校验（人工验证）。

> 无数据库迁移；无后端改动。

## 11. 单元边界回顾

纯函数（平移/锚点，易测）→ store（`updateAnnotation` 复用 + `moveAnnotation` 新增，易测）→ `Handle`（单一职责：一个可拖小方块）→ `SelectionToolbar`（HTML 浮层，承载 scope/删除）→ 各标注组件（自身坐标映射 + 句柄）→ `AnnotationLayer`（分发 + 预览）→ `BoardCanvas`（编排：选中、预览 state、接线）。每个单元职责单一、边界清晰。
