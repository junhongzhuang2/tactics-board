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

// 面板出界裁切：右/底越界则回退一个面板尺寸，再夹到 ≥0
clampPanel(x, y, panelW, panelH, viewW, viewH) => {
  x: Math.max(0, x + panelW > viewW ? viewW - panelW : x),
  y: Math.max(0, y + panelH > viewH ? viewH - panelH : y),
}
```
（朝向最短路插值的 `lerpAngle` 放在 `interpolate.js`，见第 6.1 节。）

常量（定义在组件或 cone.js）：`CONE_ANGLE_DEG = 90`、`CONE_RADIUS = 64`（px，约 3.5×球员半径）、`CONE_OPACITY = 0.2`、`HANDLE_RADIUS = 7`。

---

## 5. 组件

### ViewCone.jsx
- 渲染一个 Konva `<Wedge>`：`radius=CONE_RADIUS`、`angle=CONE_ANGLE_DEG`、`rotation=coneWedgeRotationDeg(orientation, CONE_ANGLE_DEG)`、`fill=队色`、`opacity=CONE_OPACITY`、`listening={false}`（不拦截事件）。
- Props：`orientation`、`color`。位置由父级 Player 的 Group 决定（Wedge 以 Group 原点为顶点）。

### RotateHandle.jsx
- 一个可拖 Konva `<Circle radius=HANDLE_RADIUS>`，初始位置 = `handleOffset(orientation, CONE_RADIUS)`。
- 每次取节点相对球员中心的 `(x, y)`，`orientation = orientationFromHandle(x, y)`，并把手柄位置约束回半径 R（`handleOffset(orientation, CONE_RADIUS)`）。
- **`onDragMove`（拖拽中，~60/s）：只回调 `onPreview(orientation)` 做实时视觉预览——绝不写 store、绝不记历史。**
- **`onDragEnd`（松手一次）：回调 `onCommit(orientation)`，由此触发唯一一次 `updateFramePlayerState` → 撤销历史里只占端正一步。**
- 仅当 `showCone && editable` 时由 Player 渲染。

> 关键：旋转拖拽若在 `onDragMove` 里就调记历史的动作，一次转圈会以 60/s 往 `past` 塞上百个微旋转快照，把「移动球员/增删帧」等真实历史挤出 200 上限丢弃。必须 dragMove 仅预览、dragEnd 才提交一步——与现有「球员位置拖动只在 dragEnd 提交」一致。

### Player.jsx（修改）
- 新增 props：`editable`（boolean）、`onRotate`（(orientation)=>void）。
- 新增本地 state `dragOrientation`（默认 null）做拖拽实时预览：RotateHandle 的 `onPreview` → `setDragOrientation(o)`；`onCommit(o)` → `onRotate(o)` 然后 `setDragOrientation(null)`。
- ViewCone 渲染的朝向用 `dragOrientation ?? playerState.orientation`（拖拽中显示本地预览，松手后回到 store 值）。
- 渲染顺序（Group 内，从下到上）：`{player.showCone && <ViewCone orientation={dragOrientation ?? playerState.orientation} .../>}` → 现有 `Circle` + `Text` → `{player.showCone && editable && <RotateHandle .../>}`。
- 球员本体拖动（移动位置）逻辑不变；锥 `listening={false}` 不影响拖动；手柄是独立子节点，自己处理拖动。

### PlayerEditPanel.jsx（新增，DOM 非 Konva）
- 绝对定位的小面板。Props：`player`、`screenX`/`screenY`（定位）、`onRename(name)`、`onToggleCone(show)`、`onClose`。
- 内容：名字 `<input>`（默认值 player.name，回车或失焦提交 `onRename`）、「显示视野锥」`<input type=checkbox>`（绑 player.showCone，切换调 `onToggleCone`）、关闭按钮。
- 取代现有双击 `prompt()` 改名。

### BoardCanvas.jsx（修改）
- 新增本地状态 `selectedPlayerId`（哪个球员的面板打开，null 为关闭）。
- 球员 `onDoubleClick(id)` → 设 `selectedPlayerId = id`（打开面板），而非 `prompt`。
- 渲染 `PlayerEditPanel`（当 `selectedPlayerId` 非空）：定位到该球员的屏幕坐标（由其 normalized 位置 × fieldW/H + fieldX/Y 算得），`onRename` → `renamePlayer`、`onToggleCone` → `setPlayerShowCone`、`onClose` → 清空 `selectedPlayerId`。
- **面板出界裁切**：用一个纯函数 `clampPanel(x, y, panelW, panelH, viewW, viewH)` 算最终位置——`x + panelW > viewW` 则 `x = viewW - panelW`；`y + panelH > viewH` 则 `y = viewH - panelH`；再各夹到 `>= 0`。避免球员在右/底边缘时面板超出视口、点不到关闭/勾选框。`panelW/panelH` 用常量，`viewW/viewH` 取 `window.innerWidth/innerHeight`。该纯函数放 `utils/cone.js`（或新建 `utils/panel.js`）并单测。
- 给每个 `<Player>` 传 `editable={editable}`、`onRotate={(orientation) => updateFramePlayerState(editableIndex, id, { ...state, orientation })}`。
- 从 store 解构新增 `setPlayerShowCone`。

---

## 6. 数据流

- **显示**：`view = interpolateAt(...)` → Player 拿到插值 `orientation` → ViewCone 旋转。播放时自动跟转（朝向插值见第 6.1 节）。
- **改朝向**：拖 RotateHandle 拖拽中只更新本地 `dragOrientation`（预览，不记历史）；松手 `onCommit` → `updateFramePlayerState(editableIndex, id, {...state, orientation})` → 记**一条**历史 + 1 秒后自动保存。只有停在关键帧（`editable`）时手柄才出现。
- **开关锥 / 改名**：双击 → 面板 → `setPlayerShowCone` / `renamePlayer` → 记历史 + 自动保存。

### 6.1 朝向最短路插值（修改 `interpolate.js`）

现有 `interpolateAt` 对 orientation 用普通 `lerp`，当两帧朝向跨过「正左」（如 170° → −170°）会反向绕行约 340°。改为最短角度插值：
```js
// 就近角度插值：把 b−a 归一化到 (−π, π] 再按 t 推进
export function lerpAngle(a, b, t) {
  let d = (b - a) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}
```
在 `interpolateAt` 的 `lerpFrames` 里，把 `orientation: lerp(s0.orientation, s1.orientation, t)` 改为 `orientation: lerpAngle(s0.orientation, s1.orientation, t)`。x/y/disc 仍用普通 `lerp`。

---

## 7. 测试思路（TDD）

- **`utils/cone.js` 纯函数**：
  - `orientationFromHandle`：右(`dx>0,dy=0`)→0；下(`dy>0`)→π/2；左(`dx<0,dy=0`)→±π；上(`dy<0`)→−π/2。
  - `handleOffset`：orientation 0 → `{x:R,y:0}`；π/2 → `{x:~0,y:R}`；−π/2(上) → `{x:~0,y:−R}`。
  - `coneWedgeRotationDeg`（angle 90）：**边界用例**——0→−45；π(左)→135；−π(左)→−225；−π/2(上)→−135。并断言 `((coneWedgeRotationDeg(π,90)%360)+360)%360 === ((coneWedgeRotationDeg(-π,90)%360)+360)%360`（证明 +π 与 −π 视觉等价、扇形不翻不闪）。
  - `clampPanel`：右越界向左偏、底越界向上偏、各夹到 ≥0；不越界时原样返回。
- **`interpolate.js` `lerpAngle`**：`lerpAngle(0, π/2, 0.5)=π/4`（常规）；`lerpAngle(170°, −170°, 0.5)≈±π`（跨正左走最短 20°，落在正左，而非反向绕 340°）；t=0 返回 a、t=1 返回 b（模 2π 意义下）。
- **`interpolateAt`（朝向最短路）**：两帧朝向 170° / −170°，中点插值结果接近 ±π（最短路），不接近 0。
- **store**：`setPlayerShowCone(id, true)` 置位且记历史；再 `undo()` 还原。
- **`defaultBoardData`**：每个球员含 `showCone: false`。
- **PlayerEditPanel 组件**：渲染名字输入与勾选框；改名提交调 `onRename`；勾选调 `onToggleCone`；关闭调 `onClose`。
- **ViewCone / RotateHandle 的 Konva 渲染**：不写脆弱自动化测试；几何由 cone.js 纯函数覆盖，交互由人工浏览器验证。

---

## 8. 不在本 Sub-block 范围

- 锥角度/半径可调（先固定，按效果再决定是否加）。
- 朝向沿曲线切线自动转向（曲线轨迹功能尚未做；见 [[backlog-future-features]]，做曲线时再确认）。
- 飞盘朝向 / 飞盘锥（不做）。
