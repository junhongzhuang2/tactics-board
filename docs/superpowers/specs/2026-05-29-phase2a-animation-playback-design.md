# Phase 2 Sub-block A — 动画播放设计文档

**日期：** 2026-05-29
**状态：** 已确认
**范围：** 关键帧动画的播放、时间轴、插值渲染（不含视野锥/标注/分享/协作，这些在 B-E）

---

## 1. 目标

把当前「逐帧静态切换」的战术板升级为**可播放的关键帧动画**：
- 点播放后，所有元素（14 名球员 + 飞盘）按各帧 `duration` 同步、连续地插值移动
- 提供可视化时间轴：帧块宽度 ∝ 该帧时长，配可拖动的播放头
- 保留逐帧编辑能力：仅当播放头精确停在某关键帧起点且未播放时可编辑

---

## 2. 交互设计（已逐条确认）

### 2.1 时间轴形态
- **比例时间轴**：每个帧块的宽度正比于它的 `duration`，替换原来的等宽 `FrameBar`
- 时间轴上叠加一个**可拖动的播放头**（竖线 + 抓手）
- 最后一帧的 `duration` 无效（无下一帧可过渡），帧块给一个固定的最小展示宽度

### 2.2 点击与拖动
- **点击帧块** = 跳转到该关键帧起点（进入可编辑状态）
- **拖动播放头** = 连续 scrub 预览（只读，不能编辑）
- **点击播放** = 从当前播放头位置连续播放

### 2.3 步进按钮
- `⏮` `⏭` = 跳到上一个 / 下一个关键帧起点（保留）

### 2.4 编辑判定
- **可编辑**：`playheadTime` 恰好等于某关键帧起点时刻 **且** `isPlaying === false`
  → 拖动球员/飞盘写入该帧的 `playerStates` / `discState`
- **只读预览**：scrub 中、播放中、或停在两帧之间 → 拖拽被禁用

### 2.5 时长编辑（两种方式并存）
- 拖动帧块右边缘改变该帧 `duration`
- 数字输入框精确填写毫秒/秒值

### 2.6 播放结束行为
- 默认：播完停在最后一帧
- 工具栏有一个**循环开关**（默认关），打开后播放头到末尾回绕到 0 继续循环

### 2.7 增删帧
- `[+]` = **在当前选中帧之后插入新帧**（选中最后一帧时即为追加），复制选中帧的状态
- **右键帧块** = 删除该帧（含中间帧；不能删除最后剩余的唯一帧）

---

## 3. 技术设计

### 3.1 派生渲染——纯函数 `interpolateAt(frames, playheadTime)`

```
输入: frames (Frame[]), playheadTime (ms, 整条时间轴上的位置)
处理:
  - 累加各帧 duration，定位 playheadTime 落在第 i 段 [start_i, start_i + duration_i)
  - 段内进度 t = (playheadTime - start_i) / duration_i  ∈ [0, 1]
  - 对每个 player 的 {x, y, orientation} 在 frame[i] 与 frame[i+1] 间线性插值
  - 对 disc 的 {x, y} 同样线性插值
返回: { playerStates: {id→{x,y,orientation}}, discState: {x,y} }
```

- 纯函数，无副作用 → 最易测，TDD 第一块
- 画布渲染 `interpolateAt(...)` 的结果，**不再直接读 `currentFrame`**
- 边界：`playheadTime >= 总时长` 时返回最后一帧的静态状态；只有一帧时直接返回该帧

### 3.2 Store 变更

新增状态：
```
isPlaying:   boolean   // 是否正在播放
playheadTime: number   // 播放头在整条时间轴上的毫秒位置
loop:        boolean   // 循环开关
```

新增 / 修改动作：
```
play()                 // isPlaying = true
pause()                // isPlaying = false
setPlayhead(ms)        // 拖动进度条 / 点击帧块 / rAF 推进时调用
toggleLoop()           // loop = !loop
insertFrameAfter(index)// 取代旧 addFrame；在 index 之后插入选中帧的拷贝
setFrameDuration(index, ms) // 改某帧过渡时长
```

- `currentFrameIndex` 保留：当播放头精确停在某帧起点且未播放时，指向该帧 → 可编辑
- `removeFrame` 保留（已支持中间帧删除、守护最后一帧）

### 3.3 播放引擎——requestAnimationFrame

- 播放时启动 rAF 循环，用真实经过时间（`performance.now()` 差值）累加 `playheadTime`，调 `setPlayhead`
- 到达总时长末尾：
  - `loop === false`：停在最后一帧，`pause()`
  - `loop === true`：`playheadTime` 回绕到 0 继续
- 目标约 60fps；引擎封装为自定义 hook（如 `usePlaybackEngine`），组件卸载时取消 rAF

### 3.4 组件变更
- **删除** `FrameBar.jsx`，新增 `Timeline.jsx`：
  - 比例帧块 + 播放头 + 播放/暂停 + ⏮⏭ + 循环开关 + 时长输入框
- `BoardCanvas.jsx`：渲染数据源从 `currentFrame` 改为 `interpolateAt(frames, playheadTime)`；按编辑判定决定球员/飞盘是否可拖动

---

## 4. 测试思路（TDD）

### 4.1 `interpolateAt`（纯函数，优先）
- 播放头在帧起点 → 返回该帧精确状态
- 段内中点 → 返回两帧中间值
- 段内任意 t → 线性插值正确
- 超过末帧总时长 → 返回最后一帧静态状态
- 仅一帧 → 直接返回该帧

### 4.2 Store 动作
- `insertFrameAfter`：在正确位置插入、复制源帧状态、`currentFrameIndex` 更新
- `play` / `pause` 切换 `isPlaying`
- `toggleLoop` 切换 `loop`
- `setPlayhead` 写入 `playheadTime`
- `setFrameDuration` 修改对应帧时长

### 4.3 Timeline 组件交互
- 点击帧块 → 跳转到该帧起点（playheadTime 设为该帧 start）
- 拖动播放头 → 连续更新 playheadTime（只读）
- 右键帧块 → 删除该帧（最后一帧时禁用）

### 4.4 播放引擎
- 模拟时间推进，`playheadTime` 随 rAF 累加
- 末尾且 `loop=false` → 停止
- 末尾且 `loop=true` → 回绕到 0

---

## 5. 不在本 Sub-block 范围
- 视野锥 / 球员朝向可视化（Sub-block B）
- 标注工具（Sub-block C）
- 分享链接 / token（Sub-block D，需 DB 迁移）
- Socket.io 实时协作（Sub-block E）
