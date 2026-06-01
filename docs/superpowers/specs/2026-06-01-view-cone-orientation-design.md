# 视野锥 + 朝向编辑 设计文档

**日期：** 2026-06-01
**状态：** 已确认（细节按效果后续可调）
**范围：** Phase 2 Sub-block B —— 球员朝向的可视化（半透明视野锥）与编辑（旋转手柄），按球员开关

---

## 1. 目标

让球员的朝向可见、可编辑：
- 每名球员可单独开启一个半透明扇形「视野锥」，表示其面朝方向。
- 朝向纳入关键帧动画：播放时锥随插值后的 orientation 实时旋转（已有插值，无需改动）。
- 通过拖动旋转手柄设置朝向；通过双击小面板开关某球员的锥并改名。

> `orientation` 字段早已存在于 `playerStates` 且已纳入 `interpolateAt` 线性插值。本功能补上「画出来」和「编辑入口」。

---

## 2. 数据模型

- `board.data.players[]` 每项新增 `showCone: boolean`（默认 `false`），随 `board.data` 持久化。
- `orientation`（弧度）仍按帧存于 `playerStates[playerId]`，本功能不改其存储位置。
- 锥的几何（角度、半径、透明度）是**代码常量**，不进数据。
- **向后兼容**：旧战术板的 player 没有 `showCone` → 取值为 `undefined`（假）→ 不画锥。渲染处用 `player.showCone` 真值判断即可。
- `createDefaultBoardData()`：14 名球员各补 `showCone: false`。

**朝向约定**：`orientation` 为弧度，`0` 指向右（+x）。画布 y 向下，故角度顺屏幕顺时针增大。手柄拖到 `(dx, dy)`（相对球员中心的 canvas 偏移）时 `orientation = atan2(dy, dx)`。

---

## 3. Store

新增动作：
```
setPlayerShowCone(playerId, show) → set((s) => withHistory(s, {
  board: { ...s.board, data: { ...s.board.data,
    players: s.board.data.players.map(p => p.id === playerId ? { ...p, showCone: show } : p) } },
  isDirty: true,
}))
```
- 与 `renamePlayer` 同款：改 `players[]`、`withHistory` 记历史、置 `isDirty`。
- 改朝向不需要新动作：复用既有 `updateFramePlayerState(frameIndex, playerId, { ...state, orientation })`（已记历史）。

---

## 4. 几何纯函数 `utils/cone.js`（可单测）

```
// 旋转手柄相对球员中心的 canvas 偏移 → 朝向弧度
orientationFromHandle(dx, dy) => Math.atan2(dy, dx)

// 朝向 → 手柄应处的 canvas 偏移（固定半径 R 上）
handleOffset(orientation, radius) => { x: Math.cos(orientation) * radius, y: Math.sin(orientation) * radius }

// 朝向（弧度）→ Konva Wedge 的 rotation（度），使扇形以朝向为中心
coneWedgeRotationDeg(orientation, coneAngleDeg) => orientation * 180 / Math.PI - coneAngleDeg / 2
```

常量（定义在组件或 cone.js）：`CONE_ANGLE_DEG = 90`、`CONE_RADIUS = 64`（px，约 3.5×球员半径）、`CONE_OPACITY = 0.2`、`HANDLE_RADIUS = 7`。

---

## 5. 组件

### ViewCone.jsx
- 渲染一个 Konva `<Wedge>`：`radius=CONE_RADIUS`、`angle=CONE_ANGLE_DEG`、`rotation=coneWedgeRotationDeg(orientation, CONE_ANGLE_DEG)`、`fill=队色`、`opacity=CONE_OPACITY`、`listening={false}`（不拦截事件）。
- Props：`orientation`、`color`。位置由父级 Player 的 Group 决定（Wedge 以 Group 原点为顶点）。

### RotateHandle.jsx
- 一个可拖 Konva `<Circle radius=HANDLE_RADIUS>`，初始位置 = `handleOffset(orientation, CONE_RADIUS)`。
- `onDragMove`/`onDragEnd`：取节点相对球员中心的 `(x, y)`，`orientation = orientationFromHandle(x, y)`，把手柄位置约束回半径 R（`handleOffset(orientation, CONE_RADIUS)`），回调 `onRotate(orientation)`。
- 仅当 `showCone && editable` 时由 Player 渲染。

### Player.jsx（修改）
- 新增 props：`editable`（boolean）、`onRotate`（(orientation)=>void）。
- 渲染顺序（Group 内，从下到上）：`{player.showCone && <ViewCone .../>}` → 现有 `Circle` + `Text` → `{player.showCone && editable && <RotateHandle .../>}`。
- 球员本体拖动（移动位置）逻辑不变；锥 `listening={false}` 不影响拖动；手柄是独立子节点，自己处理拖动。

### PlayerEditPanel.jsx（新增，DOM 非 Konva）
- 绝对定位的小面板。Props：`player`、`screenX`/`screenY`（定位）、`onRename(name)`、`onToggleCone(show)`、`onClose`。
- 内容：名字 `<input>`（默认值 player.name，回车或失焦提交 `onRename`）、「显示视野锥」`<input type=checkbox>`（绑 player.showCone，切换调 `onToggleCone`）、关闭按钮。
- 取代现有双击 `prompt()` 改名。

### BoardCanvas.jsx（修改）
- 新增本地状态 `selectedPlayerId`（哪个球员的面板打开，null 为关闭）。
- 球员 `onDoubleClick(id)` → 设 `selectedPlayerId = id`（打开面板），而非 `prompt`。
- 渲染 `PlayerEditPanel`（当 `selectedPlayerId` 非空）：定位到该球员的屏幕坐标（由其 normalized 位置 × fieldW/H + fieldX/Y 算得），`onRename` → `renamePlayer`、`onToggleCone` → `setPlayerShowCone`、`onClose` → 清空 `selectedPlayerId`。
- 给每个 `<Player>` 传 `editable={editable}`、`onRotate={(orientation) => updateFramePlayerState(editableIndex, id, { ...state, orientation })}`。
- 从 store 解构新增 `setPlayerShowCone`。

---

## 6. 数据流

- **显示**：`view = interpolateAt(...)` → Player 拿到插值 `orientation` → ViewCone 旋转。播放时自动跟转。
- **改朝向**：拖 RotateHandle → `onRotate(orientation)` → `updateFramePlayerState(editableIndex, id, {...state, orientation})` → 记历史 + 1 秒后自动保存。只有停在关键帧（`editable`）时手柄才出现。
- **开关锥 / 改名**：双击 → 面板 → `setPlayerShowCone` / `renamePlayer` → 记历史 + 自动保存。

---

## 7. 测试思路（TDD）

- **`utils/cone.js` 纯函数**：
  - `orientationFromHandle`：右(`dx>0,dy=0`)→0；下→π/2；左→±π；上→−π/2。
  - `handleOffset`：orientation 0 → `{x:R,y:0}`；π/2 → `{x:~0,y:R}`。
  - `coneWedgeRotationDeg`：orientation 0、angle 90 → −45；orientation π → 135。
- **store**：`setPlayerShowCone(id, true)` 置位且记历史；再 `undo()` 还原。
- **`defaultBoardData`**：每个球员含 `showCone: false`。
- **PlayerEditPanel 组件**：渲染名字输入与勾选框；改名提交调 `onRename`；勾选调 `onToggleCone`；关闭调 `onClose`。
- **ViewCone / RotateHandle 的 Konva 渲染**：不写脆弱自动化测试；几何由 cone.js 纯函数覆盖，交互由人工浏览器验证。

---

## 8. 不在本 Sub-block 范围

- 锥角度/半径可调（先固定，按效果再决定是否加）。
- 朝向沿曲线切线自动转向（曲线轨迹功能尚未做；见 [[backlog-future-features]]，做曲线时再确认）。
- 飞盘朝向 / 飞盘锥（不做）。
