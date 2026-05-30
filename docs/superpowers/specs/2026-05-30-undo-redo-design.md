# 撤销 / 重做（Undo/Redo）设计文档

**日期：** 2026-05-30
**状态：** 已确认
**范围：** 战术板编辑的撤销/重做机制（独立功能，排在视野锥+朝向之前）

---

## 1. 目标

为战术板编辑提供撤销/重做，让手动复现跑位和制作动画时可以随时反悔。
- 撤销/重做会**跳回那次改动发生的帧与播放头位置**，让被撤销/恢复的内容立即可见。
- 历史**仅当前会话有效**：刷新页面或切换战术板后重置（改动本身仍由既有自动保存持久化，只是“后悔步骤”清零）。

---

## 2. 实现方案

**在 Zustand store 中手写快照历史**（零依赖、完全可控、易测）。每一“步”精确对应一个显式的文档修改动作。

**关键：快照保存对旧 `board.data` 的引用，不做深拷贝。** store 的所有 reducer 都是纯不可变更新（全程 `.map`/对象展开，从不原地修改），因此每次修改后旧的 `board.data` 对象本身就是一份冻结快照。直接保存引用即可：
- commit 是 **O(1)**，消除高频拖拽下的深拷贝掉帧风险——无论将来帧数多少、Phase 2C 标注多复杂；
- 相邻历史条目**结构共享**（只有改动的那一帧是新对象，其余帧共享同一引用），200 条历史内存开销极小。

> 不采用 `zundo` 中间件（多依赖、“一步”的界定不可控）；不采用命令/差量模式（对单人场景过度设计）。将来 E 阶段实时协作若需基于操作的合并，另作设计——单人撤销不与协作耦合。

---

## 3. Store 状态与数据结构

新增状态：
```
past:   HistoryEntry[]   // 撤销栈，末尾是最近一次“改动前”的状态
future: HistoryEntry[]   // 重做栈
```
```
HistoryEntry = {
  data,               // 对改动前 board.data 的引用（不深拷贝；依赖 reducer 不可变）
  currentFrameIndex,  // 改动发生时所在帧
}
```
> 不存 `playheadTime`：撤销/重做恢复时由 `currentFrameIndex` 推导到该帧的关键帧起点（`frameStartTimes[idx]`），保证落点正好在关键帧上、可继续编辑——避免「编辑→拖动播放头到两帧之间→撤销→重做」后落入只读预览。

- 常量 `HISTORY_LIMIT = 200`：`past` 超过时丢弃最旧条目（从头部移除）。
- 派生判断：`canUndo = past.length > 0`、`canRedo = future.length > 0`（组件直接读长度，无需额外字段）。
- `setBoard` 重置 `past: []`、`future: []`。

### 不变量（必须守住）
**任何修改 `board.data` 的 reducer 都不得原地修改，必须返回全新对象（`.map`/展开）。** 历史快照保存的是旧引用，原地修改会污染已入栈的快照。这本是现有 store 的约定；将来 2C 标注工具新增 reducer 时同样适用。第 7 节有专门测试兜底。

---

## 4. 记录机制

内部工具（非公开动作）：
```
const snapshot = (s) => ({
  data: s.board.data,            // 引用，非拷贝（依赖 reducer 不可变更新）
  currentFrameIndex: s.currentFrameIndex,
  // 不存 playheadTime：恢复时由 currentFrameIndex 推导到关键帧起点
})

const withHistory = (s, next) => ({
  ...next,
  past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
  future: [],
})
```
`snapshot(s)` 捕获**改动前**的状态；`withHistory` 在合并本次改动的同时压栈并清空重做栈。

**记录历史的 6 个动作**（均修改 `board.data`），各自把返回值用 `withHistory(s, ...)` 包裹：
`updateFramePlayerState`、`updateFrameDiscState`、`insertFrameAfter`、`removeFrame`、`setFrameDuration`、`renamePlayer`。

**不记录历史的动作**（纯导航/UI 状态）：
`setCurrentFrame`、`setPlayhead`、`play`、`pause`、`toggleLoop`。
→ 翻看帧、拖播放头、播放都不会产生撤销步。

### undo / redo

```
undo: () => set((s) => {
  if (s.past.length === 0) return s
  const prev = s.past[s.past.length - 1]
  const cur = snapshot(s)
  return {
    board: { ...s.board, data: prev.data },
    currentFrameIndex: prev.currentFrameIndex,
    playheadTime: frameStartTimes(prev.data.frames)[prev.currentFrameIndex],
    isPlaying: false,
    isDirty: true,
    past: s.past.slice(0, -1),
    future: [...s.future, cur],
  }
}),

redo: () => set((s) => {
  if (s.future.length === 0) return s
  const entry = s.future[s.future.length - 1]
  const cur = snapshot(s)
  return {
    board: { ...s.board, data: entry.data },
    currentFrameIndex: entry.currentFrameIndex,
    playheadTime: frameStartTimes(entry.data.frames)[entry.currentFrameIndex],
    isPlaying: false,
    isDirty: true,
    past: [...s.past, cur],
    future: s.future.slice(0, -1),
  }
}),
```
- 撤销/重做回滚 `data` + `currentFrameIndex` + `playheadTime`（跳回改动处），暂停播放（`isPlaying:false`），并置 `isDirty:true` 让既有自动保存持久化结果。
- 空栈时为 no-op。
- “撤销后再做新编辑会清空 future”由 `withHistory` 的 `future: []` 自动保证（重做栈失效）。

---

## 5. UI：按钮与快捷键

- 顶栏新增两个按钮 **↶ 撤销** / **↷ 重做**，`aria-label` 为 “撤销”/“重做”；`canUndo`/`canRedo` 为 false 时置灰禁用。
- 快捷键：
  - `Ctrl/Cmd + Z` → 撤销
  - `Ctrl/Cmd + Shift + Z` → 重做
  - `Ctrl + Y` → 重做
- 在 `BoardCanvas` 用 `useEffect` 挂 `window` 的 `keydown` 监听，卸载时移除。
- **焦点在输入框时不拦截**：若 `e.target` 是 `INPUT` / `TEXTAREA`（如时长输入框），放行给浏览器原生文本撤销，避免误撤销战术板。
- 快捷键判定抽成纯函数便于测试：
```
export function isUndoShortcut(e) {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')
}
export function isRedoShortcut(e) {
  return (e.ctrlKey || e.metaKey) && (
    ((e.key === 'z' || e.key === 'Z') && e.shiftKey) ||
    (e.key === 'y' || e.key === 'Y')
  )
}
```

---

## 6. 与现有机制的关系

- **自动保存（关键不变量）**：自动保存链路是 `saveBoard(...)` → `markClean()`，而 `markClean` **只**设 `isDirty:false`，**绝不**调用任何记录历史的动作。
  - 因此撤销 → `isDirty:true` → 1 秒后自动保存 → `markClean()` 这条闭环中，`past`/`future` 完全不被触碰，**Redo 不会失效**。
  - **不变量：只有第 4 节列出的 6 个动作记录历史；`markClean`/`saveBoard` 及任何「保存」相关逻辑永不入栈。** 第 7 节有专门回归测试。
- **播放**：撤销/重做会 `pause()`；播放本身只改 `playheadTime`，不修改 `board.data`，故播放过程不产生历史条目。

---

## 7. 测试思路（TDD）

**Store（boardStore.test.js）：**
- 任一修改动作执行后，`past` 增加一条、`future` 被清空。
- `undo` 恢复上一份 `data` + `currentFrameIndex` + `playheadTime`，并把当前状态移入 `future`。
- `redo` 重新应用，并把状态移回 `past`。
- 撤销后做一次新编辑 → `future` 清空（重做失效）。
- `past` 为空时 `undo` 为 no-op；`future` 为空时 `redo` 为 no-op。
- 连续 201 次编辑后 `past.length === 200`（封顶，丢最旧）。
- `setBoard` 清空 `past`/`future`。
- **自动保存不污染历史（回归测试，复刻陷阱场景）**：编辑 → 撤销 → 调 `markClean()`（模拟自动保存）→ 断言 `future.length` 不变、`canRedo` 仍为 true，再 `redo()` 能正常恢复。
- **快照不被后续编辑污染（兜底不变量）**：编辑 A 记下 `past` 末尾快照的某坐标 → 再做编辑 B → 断言该历史快照里的坐标**未被改动**（验证 reducer 不可变、引用快照安全）。

**快捷键纯函数（interpolate 之外的新工具文件，如 `utils/shortcuts.js`）：**
- `isUndoShortcut` / `isRedoShortcut` 对 Ctrl+Z、Cmd+Z、Ctrl+Shift+Z、Ctrl+Y、无修饰键等组合的判定正确。

**组件层：**
- 撤销/重做按钮在 `canUndo`/`canRedo` 为 false 时 disabled；点击调用对应 store 动作。
- keydown 监听「焦点在 input 时不拦截」由纯函数判定 + 简单集成保证。

---

## 8. 不在本功能范围

- 跨刷新/持久化的历史（仅当前会话）。
- 协作场景下的多人撤销（E 阶段另议）。
- 基于操作/差量的历史（当前用整份快照）。
