# 多飞盘 设计文档

> 把战术板从「每帧单盘」升级为「多盘」。动机:drill 演示里常需多个盘(例如每人一个盘各自传/跑)。盘是独立自由元素(可拖放/传递/落地),与球员同构(每盘一个 id + 每帧位置)。本功能先于「曲线轨迹」做。

## 1. 目标与范围

**做什么:**
- 支持任意数量的飞盘(可加、可删,允许删到 0)。
- 顶栏「+ 盘」按钮新增盘(放场地中心、多个时错开);在盘上**右键删除**。
- 每个盘独立拖放、每帧记各自位置,播放时各自按帧插值移动。
- 旧的单盘战术板加载时平滑迁移为新结构。

**不做(YAGNI):** 盘的颜色/编号区分(所有盘都是同样的黄色飞盘,靠位置区分)、盘绑定球员、盘数量硬上限。

## 2. 方案

采用**「与球员完全对称」**的数据模型:顶层 `board.data.discs`(权威盘列表,只存 id)+ 每帧 `frame.discStates[id]`(各盘当帧位置)。这与现有 `players[]` + `playerStates[id]` 同构,因此插值、快照、渲染、拖拽几乎全是复用,新代码最少。

已排除:(B) 每帧自带数组 `frame.discs=[{id,x,y}]`——插值要在数组里按 id 配对,且与球员模式不一致;(C) 无顶层定义、用每帧 keys 当列表——权威性弱、渲染要先取某帧 keys。

## 3. 数据模型

```
board.data.discs = [{ id }, …]              // 权威「有哪些盘」，只存 id（不区分颜色，留扩展余地）
frame.discStates = { [discId]: { x, y } }    // 每帧各盘归一化位置（0–1）
```
- id：`disc-${Date.now()}-${rand}`(与 annotation/frame id 同风格)。
- `createDefaultBoardData`(新建板):`discs: [{ id: 'disc-1' }]`,每帧 `discStates: { 'disc-1': { x: 0.5, y: 0.5 } }`,移除旧 `discState`。

## 4. 迁移(兼容旧单盘 board)

新增纯函数 `normalizeBoardData(data)`(`client/src/utils/normalizeBoardData.js`):
- 若 `data.discs` 缺失 → 设为 `[{ id: 'disc-1' }]`。
- 每帧:若有旧 `discState` 而无 `discStates` → 设 `discStates = { 'disc-1': frame.discState }`,并去掉旧 `discState`。
- 已是新结构 → 原样返回(**幂等**)。
- 不可变(返回新对象,不改入参)。

接入点:`setBoard(board)` 存入前跑 `normalizeBoardData(board.data)`。旧板一加载即升级,之后自动保存写新结构。无 DB 迁移、无后端改动(`data` 是 JSON 列)。

`insertFrameAfter` 现为对源帧深拷贝(`JSON.parse(JSON.stringify(src))`),`discStates` 自动跟随复制,**无需改动**。

## 5. store 动作

```
updateFrameDiscState(frameIndex, discId, state)   // 改造：加 discId，per-id 更新该帧某盘位置
  → frames[frameIndex].discStates = { ...discStates, [discId]: state }，withHistory

addDisc()                                          // 新增：给所有帧加一个盘
  → id 新生成；pos = 中心错开（0.5 + n*0.04，clamp 到 [0,1]，n=现有盘数）
  → data.discs = [...discs, { id }]
  → 每帧 discStates[id] = pos
  → withHistory

removeDisc(discId)                                 // 新增：从所有帧删一个盘
  → data.discs 过滤掉该 id
  → 每帧 discStates 删该 id 键
  → withHistory
```
- 三者都 `withHistory`(可撤销)+ `isDirty: true`(触发自动保存)。
- **签名变更**:`updateFrameDiscState` 从 `(frameIndex, state)` → `(frameIndex, discId, state)`;调用处(BoardCanvas)与其 store 测试相应更新。
- **门控**:`addDisc`/`removeDisc` 是全帧结构操作,不依赖当前帧 `editable`,但在 `isPlaying` 时禁用(加盘按钮 disabled、右键删忽略)。拖动盘改位置仍沿用单盘的 `editable && !drawing` 条件。

## 6. 插值与渲染

**插值(`interpolate.js`):** 把对单 `discState` 的 lerp 改为对 `discStates` 按 id 遍历(复用 `playerStates` 写法):
```js
const discStates = {}
for (const id of Object.keys(f0.discStates)) {
  discStates[id] = {
    x: lerp(f0.discStates[id].x, f1.discStates[id].x, t),
    y: lerp(f0.discStates[id].y, f1.discStates[id].y, t),
  }
}
return { playerStates, discStates }
```
快照路径(无插值)同样按 id 深拷贝 `discStates`。f0/f1 盘 id 一致(加/删盘同步所有帧 + 迁移保证)。

**渲染(`BoardCanvas`):** 单个 `<Disc>` 改为遍历;回调用 `useCallback` 稳定(配合 `Disc` 的 `React.memo`,见下):
```jsx
const handleDiscDragEnd = useCallback(
  (discId, state) => updateFrameDiscState(editableIndex, discId, state),
  [updateFrameDiscState, editableIndex]
)
const handleDiscRemove = useCallback((discId) => removeDisc(discId), [removeDisc])
...
{board.data.discs.map((d) => {
  const ds = view.discStates[d.id]
  if (!ds) return null
  return (
    <Disc key={d.id} discId={d.id} discState={ds} fieldWidth={fieldW} fieldHeight={fieldH}
      onDragEnd={handleDiscDragEnd} onContextMenu={handleDiscRemove} />
  )
})}
```
**空盘安全:** `discs` 为 `[]` 时 `map` 返回空、不碰 `view.discStates`;`interpolate` 对空 `discStates` 返回 `{}`——遍历渲染干净返回空,无 undefined/解构报错。其余传参/draggable 门控按现有单盘 Disc 的实际写法对齐(计划阶段读准)。

**`Disc` 组件:** 改为接收 `discId`;`onDragEnd(discId, newState)`、`onContextMenu(discId)`(最外层 `Group` 上 `onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu?.(discId) }}`,右键删盘,与标注右键删同手势)。**用 `React.memo` 包裹导出**——配合上面稳定的回调,拖动某个盘提交(`dragEnd` 单次 setState)时,未拖动的盘按 props 不变跳过重绘。注意:播放中每个盘 `discState` 每帧都变,`memo` 本就不跳过(符合预期);此优化主要作用于非播放的拖动/编辑场景,在 ≤14 个轻量盘规模下收益有限但无害,符合纯展示组件惯例。

## 7. 加盘按钮

顶栏(撤销/保存状态那一排)加「+ 盘」按钮 → `addDisc()`;`disabled={isPlaying}`。

## 8. 测试

延续 C 系列:纯函数/store/插值 TDD,Konva 交互人工。

**单测(TDD):**
- `normalizeBoardData`:旧 `discState` → `discStates['disc-1']` + 补 `discs`;多帧都迁移;已是新结构幂等;不可变。
- store:`addDisc`(discs+1、每帧 discStates 加该 id、记历史)、`removeDisc`(discs/每帧同步删)、`updateFrameDiscState(frameIndex, discId, state)`(per-id)。
- **下限安全**:连续 `removeDisc` 直至清空 → 断言 `board.data.discs` 为 `[]`、每帧 `discStates` 为 `{}`,且过程不抛错(空盘不崩)。
- **破坏性变更对齐**:`updateFrameDiscState` 签名从 `(frameIndex, state)` → `(frameIndex, discId, state)`,**先**把现有 Phase1 单测调用补上 `'disc-1'` 参数(红→绿对齐),**再**改实现,确保测试底座始终全绿。
- `interpolate`:两帧多个 discStates 按 id 各自 lerp;空 `discStates` 返回 `{}` 不崩。

**人工冒烟:**
1. 点「+盘」新增盘(中心错开),拖多个盘各自移动。
2. 右键某盘删除;删到 0 个也正常。
3. 播放时多盘各自按帧插值移动;加盘按钮在播放中禁用。
4. 撤销/重做覆盖加盘/删盘/移动;操作后约 1 秒「已保存」、刷新保留。
5. **打开一个旧的单盘战术板** → 正常迁移显示、可继续编辑、保存为新结构。

## 9. 文件清单

- **Modify** `client/src/utils/defaultBoardData.js` — 新结构 discs+discStates。
- **Create** `client/src/utils/normalizeBoardData.js` + `client/src/utils/normalizeBoardData.test.js` — 迁移纯函数。
- **Modify** `client/src/store/boardStore.js` + `client/src/store/boardStore.test.js` — setBoard 接迁移、`updateFrameDiscState` per-id、`addDisc`、`removeDisc`。
- **Modify** `client/src/utils/interpolate.js` + `client/src/utils/interpolate.test.js` — discStates per-id。
- **Modify** `client/src/components/Disc.jsx` — `onContextMenu`。
- **Modify** `client/src/components/BoardCanvas.jsx` — 遍历渲染、加盘按钮、右键删接线(人工验证)。

> 无后端改动;无 DB 迁移(旧数据由 `normalizeBoardData` 在 `setBoard` 时升级)。

## 10. 单元边界

迁移纯函数(隔离风险、易测)→ store(per-id 动作 + 加/删盘,套球员模式)→ interpolate(per-id,套球员模式)→ Disc(加一个右键回调)→ BoardCanvas(遍历渲染 + 加盘按钮编排)。每块职责单一、边界清晰。
