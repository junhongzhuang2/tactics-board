# 网页内帮助按钮 + 说明弹窗 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在列表页和战术板顶栏各加一个「? 帮助」按钮，点开一个雾化遮罩 + 缩放淡入的模态弹窗，渲染使用指南 md；弹窗开着时键盘事件不穿透到下层撤销栈。

**Architecture:** 使用指南 md 移进 `client/src/`，用 Vite `?raw` 导入原文，`react-markdown`+`remark-gfm` 渲染。自包含组件 `HelpButton`（按钮 + 模态弹窗，自管开关、×/遮罩/Esc 关闭、捕获阶段键盘隔离）。视觉（雾化、缩放淡入、暗色 Markdown 排版）集中在 `index.css`。两处直接放 `<HelpButton />`。

**Tech Stack:** React 18 + Vite（`?raw`）+ react-markdown + remark-gfm + Vitest。

参考设计：`docs/superpowers/specs/2026-06-10-help-button-design.md`

---

## 背景：实现者必读

- `client/src/index.css` 已有列表页样式（Pitch Glow / 卡片等），**在文件末尾追加**帮助样式即可，勿改已有规则。
- `BoardList.jsx` 根是 `<div className="board-bg">`（`position: relative`），内含居中 hero。`board-bg > *` 已被设为 `position: relative; z-index: 1`。
- `BoardCanvas.jsx` 顶栏是一排 `flex`（约 275-360 行：返回 / 标题 / Undo / +盘 / 保存状态），`gap: 12`。
- 测试运行（PowerShell，用 `;`）：单文件 `cd client; npx vitest run src/components/HelpButton.test.jsx`；全量 `cd client; npx vitest run`。
- Vite 的 `import x from './a.md?raw'` 返回文件原文字符串，Vitest 同样走 Vite 解析，支持 `?raw`。

## 文件结构

- **移动** `docs/使用指南.md` → `client/src/usage-guide.md`（`git mv`，ASCII 名，内容不变，单一来源）
- **新增** `client/src/components/HelpButton.jsx` — 自包含按钮 + 弹窗 + 键盘隔离
- **新增** `client/src/components/HelpButton.test.jsx`
- **修改** `client/src/index.css` — 末尾追加 `.help-overlay/.help-card/@keyframes helpScaleIn/.help-close/.help-md` 样式
- **修改** `client/package.json` — 加 `react-markdown`、`remark-gfm`
- **修改** `client/src/components/BoardList.jsx`、`client/src/components/BoardCanvas.jsx` — 各放一个 `<HelpButton />`

---

## Task 1: 移动指南 + 安装依赖

**Files:**
- Move: `docs/使用指南.md` → `client/src/usage-guide.md`
- Modify: `client/package.json`（npm 自动写入）

- [ ] **Step 1: 移动 md（保留 git 历史）**

```bash
git mv "docs/使用指南.md" "client/src/usage-guide.md"
```

- [ ] **Step 2: 安装依赖**

```bash
cd client; npm install react-markdown remark-gfm
```
Expected: `package.json` 的 dependencies 出现 `react-markdown` 与 `remark-gfm`，`package-lock.json` 更新。

- [ ] **Step 3: 验证 ?raw 导入可用（冒烟）**

运行现有全量测试，确认安装没破坏构建/解析：
```bash
cd client; npx vitest run
```
Expected: 全部 PASS（此时还没用到新依赖，仅确认环境正常）。

- [ ] **Step 4: 提交**

`git mv`（Step 1）已把 md 的「删 docs / 加 client」移动暂存好，这里只需补上新依赖再一起提交：
```bash
git add client/package.json client/package-lock.json
git commit -m "chore: move usage guide into client/src, add react-markdown + remark-gfm"
```

---

## Task 2: HelpButton 组件（TDD，含键盘隔离）

**Files:**
- Create: `client/src/components/HelpButton.jsx`
- Test: `client/src/components/HelpButton.test.jsx`

- [ ] **Step 1: 写失败测试** — 新建 `client/src/components/HelpButton.test.jsx`：

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import HelpButton from './HelpButton'

test('opens the help modal showing the guide', () => {
  render(<HelpButton />)
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('? 帮助'))
  expect(screen.getByText(/使用指南/)).toBeInTheDocument()
})

test('closes on the × button', () => {
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.click(screen.getByLabelText('关闭'))
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('closes on overlay click but not on card click', () => {
  const { container } = render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.click(container.querySelector('.help-card')) // 点卡片不关
  expect(screen.getByText(/使用指南/)).toBeInTheDocument()
  fireEvent.click(container.querySelector('.help-overlay')) // 点遮罩关
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('closes on Escape', () => {
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('keyboard events do not leak to lower layers while open', () => {
  const spy = vi.fn()
  window.addEventListener('keydown', spy) // 冒泡阶段，模拟 BoardCanvas 的 window 监听
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
  expect(spy).not.toHaveBeenCalled() // 被捕获阶段拦截器 stopPropagation 拦下
  window.removeEventListener('keydown', spy)
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd client; npx vitest run src/components/HelpButton.test.jsx`
Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现** — 新建 `client/src/components/HelpButton.jsx`：

```jsx
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import guide from '../usage-guide.md?raw'

const BTN = {
  padding: '4px 10px', height: 28, borderRadius: 6,
  background: '#2a2a3e', border: '1px solid #555', color: '#ccc',
  fontSize: 13, cursor: 'pointer',
}

export default function HelpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    // 捕获阶段吞掉所有按键，防止穿透到 BoardCanvas 挂在 window 的撤销/删除监听；仅 Esc 关闭
    function onKey(e) {
      e.stopPropagation()
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey, true) // true = 捕获阶段，先于下层冒泡监听
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <>
      <button style={BTN} aria-label="帮助" title="使用帮助" onClick={() => setOpen(true)}>
        ? 帮助
      </button>
      {open && (
        <div
          className="help-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="使用帮助"
          onClick={() => setOpen(false)}
        >
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <button className="help-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
            <div className="help-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `cd client; npx vitest run src/components/HelpButton.test.jsx`
Expected: PASS（5 个）。

- [ ] **Step 5: 提交**

```bash
git add client/src/components/HelpButton.jsx client/src/components/HelpButton.test.jsx
git commit -m "feat: HelpButton — modal guide viewer with capture-phase keyboard isolation"
```

---

## Task 3: 弹窗视觉样式（index.css）

**Files:**
- Modify: `client/src/index.css`（在文件**末尾追加**）

纯视觉，靠浏览器人工验收；先确认不破坏现有测试。

- [ ] **Step 1: 在 `client/src/index.css` 末尾追加**

```css

/* —— 帮助弹窗 —— */
.help-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.help-card {
  position: relative; width: 100%; max-width: 720px; max-height: 80vh; overflow: auto;
  background: #14161f; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;
  padding: 28px 32px; color: #e6edf3; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: helpScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes helpScaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.help-close {
  position: absolute; top: 12px; right: 14px; width: 30px; height: 30px;
  border-radius: 8px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc; font-size: 18px; line-height: 1; cursor: pointer;
}
.help-close:hover { background: rgba(255, 255, 255, 0.08); }

/* 暗色 Markdown 排版，仅作用于 .help-md 内 */
.help-md { font-size: 14px; line-height: 1.7; color: #cfd6e0; }
.help-md h1 { font-size: 22px; color: #fff; margin: 0 0 12px; }
.help-md h2 {
  font-size: 17px; color: #fff; margin: 22px 0 10px;
  padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.10);
}
.help-md h3 { font-size: 15px; color: #f0f0f0; margin: 16px 0 8px; }
.help-md p { margin: 8px 0; }
.help-md ul, .help-md ol { margin: 8px 0; padding-left: 22px; }
.help-md li { margin: 4px 0; }
.help-md strong { color: #fff; font-weight: 700; }
.help-md a { color: #ffd23f; text-decoration: none; }
.help-md a:hover { text-decoration: underline; }
.help-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  background: rgba(255, 255, 255, 0.08); padding: 1px 6px; border-radius: 4px;
}
.help-md blockquote {
  margin: 10px 0; padding: 4px 14px;
  border-left: 3px solid rgba(255, 210, 63, 0.6); color: #b9c2cf; font-style: italic;
}
.help-md table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
.help-md th, .help-md td {
  border: 1px solid rgba(255, 255, 255, 0.15); padding: 7px 10px; text-align: left;
}
.help-md th { background: rgba(255, 255, 255, 0.06); color: #fff; font-weight: 600; }
```

- [ ] **Step 2: 运行全量测试，确认不回归**

Run: `cd client; npx vitest run`
Expected: 全部 PASS（纯 CSS 追加）。

- [ ] **Step 3: 提交**

```bash
git add client/src/index.css
git commit -m "style: frosted help overlay, scale-up card animation, dark markdown typography"
```

---

## Task 4: 接入两处入口

**Files:**
- Modify: `client/src/components/BoardList.jsx`
- Modify: `client/src/components/BoardCanvas.jsx`

- [ ] **Step 1: 接入 BoardList** — 在 `client/src/components/BoardList.jsx`：

(a) 顶部 import 区加：
```jsx
import HelpButton from './HelpButton'
```
(b) 在 `return (` 的根 `<div className="board-bg">` 之后、`<div style={STYLES.page}>` 之前，插入右上角帮助按钮：
```jsx
      <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 2 }}>
        <HelpButton />
      </div>
```

- [ ] **Step 2: 接入 BoardCanvas** — 在 `client/src/components/BoardCanvas.jsx`：

(a) 顶部 import 区加：
```jsx
import HelpButton from './HelpButton'
```
(b) 在顶栏那排 `flex` 容器内、保存状态指示之后（顶栏 `</div>` 收尾之前），把帮助按钮推到最右：
```jsx
        <div style={{ marginLeft: 'auto' }}>
          <HelpButton />
        </div>
```
用 Read/Grep 定位顶栏：它以 `{/* 顶栏 */}` 注释开头、是第一个 `padding: '8px 16px', background: '#111'` 的 div；把上面这段放在该 div 内部、紧邻其闭合 `</div>` 之前。

- [ ] **Step 3: 运行全量测试，确认不回归**

Run: `cd client; npx vitest run`
Expected: 全部 PASS。

- [ ] **Step 4: 浏览器人工验收** — `cd client; npm run dev`：
  - [ ] 列表页右上角、战术板顶栏右侧都有「? 帮助」
  - [ ] 点开：背后球场/列表被**雾化模糊**，卡片**缩放淡入**出现
  - [ ] 说明排版清晰：标题、**表格（速查表）有边框**、列表、引用、代码块都可读
  - [ ] 卡片内能滚动；点 × / 点遮罩 / 按 Esc 都能关
  - [ ] **在战术板里**打开帮助，按 Ctrl+Z：**不会**触发撤销（键盘被隔离）；关掉帮助后 Ctrl+Z 恢复正常

- [ ] **Step 5: 提交**

```bash
git add client/src/components/BoardList.jsx client/src/components/BoardCanvas.jsx
git commit -m "feat: wire HelpButton into BoardList and BoardCanvas"
```

---

## 完成后

- 整体审查（spec 合规 + 代码质量）→ 用户浏览器最终验收（重点：雾化、缩放动画、表格排版、键盘隔离）→ 合并 main（用户手动 push）。
