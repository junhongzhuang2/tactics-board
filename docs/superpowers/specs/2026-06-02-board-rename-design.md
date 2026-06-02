# 战术板改名 设计文档

**日期：** 2026-06-02
**状态：** 已确认
**范围：** 在战术板页（顶栏）和列表页都能给战术板改名。后端零改动。

---

## 1. 目标 / 现状

战术板创建后无法改名。后端**已支持**：`PUT /api/boards/:id` 接受 `{ name, data }`，`db.updateBoard` 在 `fields.name !== undefined` 时更新 `name` 列。`saveBoard(id, fields)` 已能发任意字段。所以本功能**纯前端**。

---

## 2. 方案

- **Store**：新增 `renameBoard(name)` → 设 `board.name` + `isDirty: true`。**不走 `withHistory`**（`board.name` 不属于 `board.data` 文档，不进撤销栈）。
- **自动保存**：`useAutoSave` 当前保存 `saveBoard(b.id, { data: b.data })`，改为 `saveBoard(b.id, { name: b.name, data: b.data })`，使改名复用既有「防抖 + 退避重试」可靠保存路径。
- **战术板页**：双击顶栏板名 → 内联 `<input>` 编辑 → 提交。
- **列表页**：每卡片加「重命名」按钮 → `prompt` → `saveBoard(id, { name })` → 更新本地列表。

---

## 3. 战术板页（BoardCanvas 顶栏）

- 本地状态 `editingName`（boolean）。
- 默认显示板名 `<span>`；**双击** → `editingName = true`，渲染 `<input>`（`defaultValue = board.name`，`autoFocus`）。
- 提交：回车或失焦 → `const v = e.target.value.trim(); if (v) renameBoard(v)`；然后 `editingName = false`。
- 取消：按 `Esc` → 不提交，`editingName = false`。
- 只有 `board` 存在时可编辑。

`renameBoard` 置 `isDirty` 后，既有自动保存（已带 name）在 1 秒内持久化，顶栏保存状态指示照常工作。

### 焦点隔离守卫（必须成立）
内联编辑用真正的 `<input>` 元素。既有撤销/重做 keydown 处理器开头已有 `if (tag === 'INPUT' || tag === 'TEXTAREA') return`，因此当焦点在顶栏改名框时：
- `Ctrl+Z` / `Cmd+Z` **放行给浏览器原生文本撤销**，绝不触发战术板 undo、绝不污染 `past`/`future`。
- `Delete`/`Backspace` 同样被放行（不会误删选中的标注）。

实现上**只需保证改名控件是标准 `<input>`（不要用 contentEditable）**，无需改动 keydown 处理器。Task 中以人工验证「改名框内 Ctrl+Z 走原生文本撤销、战术板历史不变」收口。

---

## 4. 列表页（BoardList）

- 每张卡片在「删除」旁加一个「重命名」按钮。
- `onClick`：`e.stopPropagation()`（避免触发进入战术板的卡片点击）→ `const v = prompt('新名称', board.name)` → 计算 `const trimmed = v?.trim()`。
- **无改动拦截**：仅当 `trimmed` 非空 **且 `trimmed !== board.name`** 时才 `await saveBoard(board.id, { name: trimmed })` → `setBoards` 局部更新该卡片名。若用户取消（null）、清空、或**未作任何修改直接确定**（`trimmed === board.name`）→ 静默返回，不发起多余的 saveBoard 网络请求。
- 需在 BoardList 引入 `saveBoard`（`../api/boards`）。

---

## 5. 测试思路（TDD）

- **store `renameBoard`**：设 `board.name`、置 `isDirty: true`；**不改 `past`/`future`**（断言 `past.length` 不变）。
- **`useAutoSave`**：保存调用现在带 `name`——在既有 hook 测试里把断言从 `saveBoard('b1', { data: ... })` 调整为包含 `name`（用 `board = { id:'b1', name:'N', data:{...} }`，断言 `saveBoard` 收到 `{ name:'N', data:{...} }`）。
- **BoardList 重命名**（纯 DOM，可测）：mock `api`，点「重命名」、stub `window.prompt`：返回**新名** → 断言 `saveBoard(id, { name })` 被调、卡片名更新；返回 **空/null** → 不调用；返回**与原名相同**（无改动）→ **不调用 saveBoard**（无改动拦截）。
- **战术板页内联编辑**：BoardCanvas 含 Konva，不写脆弱组件测；逻辑（trim/空守卫/Esc）简单，人工浏览器验证 + store 测试覆盖核心。

---

## 6. 不在范围

- 改名进撤销历史（board.name 非文档内容，不纳入）。
- 列表页内联编辑（用 prompt，与该页现有新建/删除风格一致）。
