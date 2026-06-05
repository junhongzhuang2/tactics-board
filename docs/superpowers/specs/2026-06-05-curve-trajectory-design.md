# 曲线轨迹 设计文档

> 让球员/飞盘在两帧间走弧线而非直线。每段轨迹用二次贝塞尔,起点帧元素加一个可选控制点 `ctrl`;停在关键帧时单击元素显示一个中点手柄,拖动设曲率。无 ctrl 退回直线、完全向后兼容。

## 1. 目标与范围

**做什么:**
- 球员**和**飞盘的每段轨迹(第 i 帧 → 第 i+1 帧)可走二次贝塞尔弧线。
- 停在关键帧时,**单击**某元素 → 显示它这一段的淡色曲线预览 + 一个**中点手柄**;拖手柄设曲率,**双击手柄**清除回直线。
- 播放时该段按曲线插值移动。

**不做(YAGNI / 已确认取舍):**
- **匀速重参数化**:二次贝塞尔按 t 推进时弯处视觉速度略不均,初版不做弧长重参数化(复杂、收益边际);播放节奏沿用现有每帧时长。
- **朝向沿切线**:球员朝向(视野锥)仍按两帧手设值 `lerpAngle` 插值,**独立于曲线**(飞盘运动中朝向≠跑向,保留手动控制)。
- 三次贝塞尔 / 两个手柄;所有元素同时显示手柄;自由手绘路径拟合。

## 2. 方案

控制点挂在**起点帧的元素状态**上(`playerStates[id].ctrl` / `discStates[id].ctrl`),与现有逐帧状态模型贴合;插值在现有 `lerpFrames` 的 x/y 处加一个「有 ctrl 走贝塞尔、否则直线」分支。手柄只对**单击选中**的元素显示单段,画布保持干净。

已排除:(B) 独立「轨迹编辑模式」一次显示所有手柄——与「选中才显示」相悖、更重;(C) 把 ctrl 存成独立段对象/终点帧——不如挂起点帧元素简单(复用逐帧状态 + 插值循环)。

## 3. 数据模型(向后兼容)

第 i 帧元素状态加**可选** `ctrl: {x,y}`(归一化),描述 i→i+1 段的二次贝塞尔控制点:
```
frame.playerStates[id] = { x, y, orientation, ctrl?: {x,y} }
frame.discStates[id]   = { x, y, ctrl?: {x,y} }
```
- 无 `ctrl` → 直线(旧数据天然兼容,无需迁移)。
- 最后一帧元素的 `ctrl` 无意义(无下一段),忽略。

## 4. 插值(`interpolate.js`)

新增纯函数:
```js
function quadraticPoint(p0, c, p1, t) {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * c + t * t * p1
}
```
`lerpFrames` 里球员/盘的 x/y 改为「起点帧该元素有 `ctrl` → 二次贝塞尔,否则 `lerp`」:
```js
const c = s0.ctrl
x: c ? quadraticPoint(s0.x, c.x, s1.x, t) : lerp(s0.x, s1.x, t),
y: c ? quadraticPoint(s0.y, c.y, s1.y, t) : lerp(s0.y, s1.y, t),
```
球员 `orientation: lerpAngle(...)` **不变**;飞盘用 `d0.ctrl` 同理。`snapshot`(单帧静态)只返回 x/y/orientation,**不带 ctrl**——ctrl 是编辑期数据,手柄直接从 `board.data.frames[editableIndex]` 读,不进 `view`。

数学性质(测试点):`ctrl = 两端中点`时二次贝塞尔退化为线性插值,与直线一致。

## 5. 选中机制

- **新增 state**:`BoardCanvas` `const [selectedElement, setSelectedElement] = useState(null)` —— `{ kind:'player'|'disc', id } | null`。
- **单击选中**:`Player`/`Disc` 各加 `onClick`(`e.cancelBubble = true` 后回调 `onSelect(id)`)。Konva 区分拖动与单击(拖完不触发 click),不影响拖动移动;球员双击开面板的行为保留(首击顺带选中,不冲突)。
- **取消选中**:`handleStageClick` 在点空白(`tool==='none'` 点到 Stage)时,与现有清 `selectedAnnoId` 一并清 `selectedElement`。
- **独立性**:`selectedElement`(轨迹)与 `selectedPlayerId`(编辑面板)、`selectedAnnoId`(标注)各管各的。

## 6. 手柄 / 预览 / 清除

**显示门控**:仅当 `!isPlaying` + `tool==='none'` + `editable`(停在关键帧)+ `selectedElement` 存在 + 该帧有下一帧(`editableIndex < frames.length - 1`)+ `selectedPlayerId === null`(改名面板未打开)时显示。最后一条让「单击调轨迹 / 双击改名」互斥,视觉更纯净。

**新组件 `TrajectoryHandle`**(参考 `RotateHandle` 的 onPreview/onCommit 模式):
- props:`P0`(起点帧元素 canvas 位置)、`P1`(下一帧位置)、当前 `ctrl`(canvas;无则取两端中点)、`onCommit(ctrlNorm)`、`onClear()`。
- 画**二次贝塞尔虚线预览**(淡色):Konva `Shape` `sceneFunc` → `moveTo(P0); quadraticCurveTo(C, P1)`。
- 在 `C` 处放可拖小圆手柄:拖动时组件内部 state 实时更新 `C`、虚线随动(预览,不进 store);**松手 `onCommit`** 提交一步历史;**双击手柄 `onClear`** 删 ctrl 回直线。控制点 clamp 到 `[0,1]`。
- **事件闭环(防闪退)**:手柄圆圈的 `onClick`/`onDblClick`/拖动事件均 `e.cancelBubble = true`,阻止冒泡到 Stage——防双击清除的瞬间误触发「点空白取消选中」而手柄闪退。(与 C3 `Handle`/`SelectionToolbar` 的 stopPropagation 一脉相承。)

**BoardCanvas 接线**:满足门控时,从 `board.data.frames[editableIndex]` 取选中元素位置作 `P0`、`frames[editableIndex+1]` 作 `P1`、元素 `.ctrl` 作当前 ctrl,渲染 `<TrajectoryHandle>`;`onCommit`/`onClear` 调下面的 store action。

## 7. store

新增统一 action(球员/盘共用):
```js
setTrajectoryCtrl(frameIndex, kind /* 'player'|'disc' */, id, ctrl /* {x,y} | null */)
  → key = kind === 'player' ? 'playerStates' : 'discStates'
  → 定位 frames[frameIndex][key][id]；ctrl 非空则 el.ctrl = ctrl，为 null 则 delete el.ctrl
  → withHistory（一步可撤销）+ isDirty
```
不复用 `updateFramePlayerState`/`updateFrameDiscState`(那需带整份 state);专用 action 更聚焦。

## 8. 测试

纯函数 / store TDD,Konva 交互人工。

**单测(TDD):**
- `quadraticPoint`:`t=0→p0`、`t=1→p1`、`ctrl=中点时等价直线`。
- `lerpFrames`:有 ctrl → 中点偏离直线(贝塞尔)、无 ctrl → 等于直线(回归);球员与盘各一。
- store `setTrajectoryCtrl`:球员/盘设 ctrl、传 `null` 删 ctrl(回直线)、withHistory/undo。

**人工冒烟:**
1. 停关键帧单击球员 → 出现「本帧→下一帧」虚线 + 中点手柄;拖手柄曲线弯、松手保存;播放时走弧线。
2. 双击手柄回直线;单击飞盘同样可调。
3. 撤销/重做覆盖设/清 ctrl;点空白取消选中、手柄消失。
4. 非关键帧 / 播放中 / 最后一帧 / 双击球员开着改名面板时 → 不显示手柄;双击手柄清除曲率时手柄不闪退(事件 cancelBubble)。
5. 走弧线时朝向仍按手设值插值(不沿切线)。
6. 旧战术板(无 ctrl)仍直线、正常;操作后约 1 秒「已保存」、刷新后 ctrl 保留。

## 9. 文件清单

- **Modify** `client/src/utils/interpolate.js` + `.test.js` — `quadraticPoint` + lerpFrames 贝塞尔分支。
- **Modify** `client/src/store/boardStore.js` + `.test.js` — `setTrajectoryCtrl`。
- **Create** `client/src/components/TrajectoryHandle.jsx` — 贝塞尔虚线预览 + 可拖手柄。
- **Modify** `client/src/components/Player.jsx` / `Disc.jsx` — 加 `onClick` 选中。
- **Modify** `client/src/components/BoardCanvas.jsx` — `selectedElement` state、单击接线、`TrajectoryHandle` 渲染、`setTrajectoryCtrl` 接线、点空白清选中(人工验证)。

> 无后端改动;无 DB 迁移(`ctrl` 是 data JSON 里的可选字段,旧数据无则走直线)。

## 10. 单元边界

`quadraticPoint`(纯、易测)→ `lerpFrames` 分支 → store `setTrajectoryCtrl`(易测)→ `TrajectoryHandle`(自包含:预览曲线 + 手柄,通过 props/回调通信)→ Player/Disc(各加一个 onClick)→ BoardCanvas(选中 state + 编排)。每块职责单一、边界清晰。
