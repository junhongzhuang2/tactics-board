# 网页内帮助按钮 + 说明弹窗 设计

日期：2026-06-10
状态：已确认

## 背景与目标

已有一份用户使用指南（含隐藏操作速查表），但放在仓库里，队友打开网站看不到。需要在网页内加一个「? 帮助」按钮，点开就能看说明，降低新用户上手门槛（尤其右键/双击/拖拽这类隐藏操作）。

## 已确认的设计决策

1. **呈现方式**：页内**模态弹窗**（暗色半透明遮罩 + 居中可滚动卡片），不离开当前页。
2. **入口位置**：列表页（`BoardList`）和战术板顶栏（`BoardCanvas`）**各放一个**「? 帮助」按钮。
3. **内容来源（单一）**：复用使用指南 md，弹窗直接渲染它；以后改说明只改这一处。

## 内容来源

- 把 `docs/使用指南.md` **移动**到 `client/src/usage-guide.md`（ASCII 文件名，便于稳定 import；内容不变）。用 `git mv` 保留历史。
- 在组件中 `import guide from './usage-guide.md?raw'` 拿到 markdown 原文字符串（Vite 的 `?raw` 后缀，打包进 bundle，无运行时网络请求）。
- 用 `react-markdown` + `remark-gfm`（GFM 表格支持，速查表是表格）渲染。`react-markdown` 默认不渲染原始 HTML，md 内也无原始 HTML，安全。

## 组件设计

### `client/src/components/HelpButton.jsx`（新建，自包含）

- 渲染一个「? 帮助」按钮（样式贴合现有顶栏按钮：深色底、浅灰字、圆角）。
- 内部用 `useState` 管理 `open`。
- `open` 时渲染模态弹窗：
  - **遮罩（雾化）**：`position: fixed` 全屏，`background: rgba(0,0,0,0.45)` + `backdrop-filter: blur(8px)`（含 `-webkit-backdrop-filter`），让背后的球场/列表像被霜雾覆盖退到视觉后方，注意力聚焦说明书；`zIndex` 高于画布；点遮罩关闭。
  - **卡片**：居中、最大宽度约 720px、最大高度约 80vh、`overflow: auto` 可滚动、深色背景浅色字、圆角；卡片内部点击 `stopPropagation`，不触发遮罩关闭。
  - **卡片入场动画（Scale Up & Fade In）**：打开时 `transform: scale(0.96)→scale(1)` + `opacity: 0→1` 的缩放淡入，`@keyframes`，时长约 200ms，缓动曲线统一用项目运动节奏 **`cubic-bezier(0.16, 1, 0.3, 1)`**。
  - 卡片右上角 **×** 关闭按钮。
  - 卡片内用 `<ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>` 渲染说明，容器加 `.help-md` 类承接排版样式（见下）。

### 键盘事件隔离（关键）

`BoardCanvas` 把撤销/重做/删除等快捷键监听挂在 **`window`** 上（`keydown`），仅对 `INPUT`/`TEXTAREA` 焦点早返回。帮助弹窗内没有输入框，若不拦截，弹窗开着时按 **Ctrl+Z / Delete** 等会**穿透**触发下层 Zustand 撤销栈 / 画布操作。

- 弹窗 `open` 时，在 `window` 上以**捕获阶段**（`addEventListener('keydown', handler, true)`）挂一个拦截器：对所有按键 `e.stopPropagation()`（必要时 `stopImmediatePropagation()`），使事件**到不了** `BoardCanvas` 的冒泡监听；仅在此拦截器内识别 **Esc → 关闭弹窗**。
- 捕获阶段先于冒泡阶段执行，且无论焦点在何处都能拦住，比在卡片节点上 `stopPropagation` 更可靠（焦点在 `body` 时事件不经过卡片 DOM）。
- 因弹窗内无输入框，吞掉全部键盘是安全的。`useEffect` 在关闭/卸载时移除监听。

### 暗色 Markdown 排版（Dark Markdown Typography）

在 `client/src/index.css` 定义一个 `.help-md` 作用域类（套在 react-markdown 渲染容器上），为其下**原生标签**定义一套极简暗色排版，仅作用于 `.help-md` 内、不影响全站：

- `h1/h2/h3`：字号梯度 + 上下间距 + 顶部细分隔线（h2）。
- `p / ul / ol / li`：行高 ~1.7、浅色字（`#cfd6e0` 级）、列表缩进。
- `table / th / td`：`border-collapse`、单元格 `1px solid rgba(255,255,255,.15)` 边框 + 内边距、`th` 略深底色加粗（速查表是表格，必须可读）。
- `blockquote`：左侧 3px 柔色竖条 + 淡色斜体（小贴士用）。
- `code`：等宽字体 + 微底色 + 圆角内边距。
- `a`：飞盘黄/蓝点缀色，hover 下划线。
- `strong`：加重但不刺眼。

### 接入

- `BoardList`：在右上/顶部操作区放一个 `<HelpButton />`。
- `BoardCanvas`：顶栏（「← 返回」「+ 盘」等所在那一排）放一个 `<HelpButton />`。
- 两处互不影响，各自独立（HelpButton 自管状态）。

## 依赖

- 新增 `react-markdown`、`remark-gfm` 到 `client/package.json`（`npm install`）。两者成熟、体积可接受，适合纯前端静态站。

## 测试

- 新增 `client/src/components/HelpButton.test.jsx`：
  - 初始不显示弹窗内容；点「帮助」按钮后弹窗出现，含说明里的关键字（如「速查表」或「双击」）。
  - 点 × 关闭后内容消失。
  - 按 Esc 关闭。
  - **键盘隔离**：弹窗打开时，给 `window` 额外挂一个冒泡阶段 `keydown` spy，派发一个 `Ctrl+Z` keydown，断言该 spy **未被调用**（被捕获阶段拦截器 `stopPropagation` 拦下）；关闭弹窗后再派发，spy 恢复被调用。
- 现有测试不受影响（纯新增组件）。
- 视觉（排版、滚动、遮罩）靠浏览器人工验收。

## 非目标（本次不做）

- 不做独立 `/help` 路由页、不做侧边抽屉。
- 不做多语言、不做搜索/目录跳转。
- 不在 md 里引入原始 HTML 或交互元素。
- 不改说明书内容（仅移动文件位置）。
