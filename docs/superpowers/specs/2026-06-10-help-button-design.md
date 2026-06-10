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
  - **遮罩**：`position: fixed` 全屏暗色半透明（`rgba(0,0,0,0.6)`），`zIndex` 高于画布；点遮罩关闭。
  - **卡片**：居中、最大宽度约 720px、最大高度约 80vh、`overflow: auto` 可滚动、深色背景浅色字、圆角；卡片内部点击 `stopPropagation`，不触发遮罩关闭。
  - 卡片右上角 **×** 关闭按钮。
  - 卡片内用 `<ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>` 渲染说明。
  - **Esc 关闭**：`open` 时挂 `keydown` 监听，按 Esc 关闭；`useEffect` 清理监听。
- markdown 基本排版样式：标题、表格（边框/内边距）、列表、`blockquote`、`code` 给最小可读样式（局部 CSS 类或内联，避免影响全站）。

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
- 现有测试不受影响（纯新增组件）。
- 视觉（排版、滚动、遮罩）靠浏览器人工验收。

## 非目标（本次不做）

- 不做独立 `/help` 路由页、不做侧边抽屉。
- 不做多语言、不做搜索/目录跳转。
- 不在 md 里引入原始 HTML 或交互元素。
- 不改说明书内容（仅移动文件位置）。
