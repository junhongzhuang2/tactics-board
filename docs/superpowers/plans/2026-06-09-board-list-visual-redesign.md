# 战术板列表页视觉升级 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把战术板列表/创建页（`BoardList`）重做为 A 运动球场风 + Pitch Glow 精致版——居中 hero、虚线新建卡片、毛玻璃卡片、呼吸微光背景、交互式按钮浮现。

**Architecture:** 两步走。Task 1 只改 `BoardList.jsx` 的 DOM 结构与行为（居中 hero、虚线新建卡片、空状态、给卡片挂上 className 钩子），用单元测试锁定行为契约（新建/重命名/删除/空状态）。Task 2 接通视觉层：让 `main.jsx` 引入 `index.css`、在 `index.css` 写全部动画/毛玻璃/hover/glow、把 `index.html` 的 body 底色改深绿渐变。视觉细节靠浏览器人工验收，单元测试只保证不回归。

**Tech Stack:** React 18 + Vite，纯 CSS（`index.css`）+ 内联 STYLES 对象，Vitest + @testing-library/react。

参考设计：`docs/superpowers/specs/2026-06-09-board-list-visual-redesign-design.md`

---

## 背景：当前文件状态（实现者必读）

- `client/src/components/BoardList.jsx`：现为「左标题 + 右上角新建按钮 + 单列卡片」，新建/删除/重命名逻辑在 `handleCreate` / `handleDelete` / `handleRename`，**这三个函数和 `useEffect` 加载逻辑本次完全不改**，只改 `return` 的 JSX 和 `STYLES`。
- `client/src/index.css`：**当前是空文件，且没有被任何地方 import**。Task 2 必须在 `main.jsx` 加 `import './index.css'`，否则样式不生效。
- `client/index.html`：`<head>` 内联 `<style>` 里 `body { background:#1a1a2e; ... }`，Task 2 改这里的 body 底色。
- 测试运行命令（PowerShell，用 `;` 不用 `&&`）：`cd client; npx vitest run src/components/BoardList.test.jsx`
- 全量测试：`cd client; npx vitest run`

---

## Task 1: 重构 BoardList 结构与行为（TDD）

**Files:**
- Modify: `client/src/components/BoardList.jsx`（重写 `STYLES` 与 `return` 的 JSX；三个 handler 与 `useEffect` 不动）
- Test: `client/src/components/BoardList.test.jsx`（新增空状态 + 新建卡片 + className 钩子测试）

- [ ] **Step 1: 写失败测试**

在 `client/src/components/BoardList.test.jsx` 末尾追加三个测试：

```jsx
test('empty state shows the add card and a hint', async () => {
  vi.mocked(api.listBoards).mockResolvedValue([])
  renderList()
  expect(await screen.findByText('＋ 新建战术板')).toBeInTheDocument()
  expect(screen.getByText(/还没有战术板/)).toBeInTheDocument()
})

test('clicking the add-board card runs create flow', async () => {
  vi.mocked(api.listBoards).mockResolvedValue([])
  vi.mocked(api.createBoard).mockResolvedValue({ id: 'new1' })
  vi.spyOn(window, 'prompt').mockReturnValue('My Board')
  renderList()
  fireEvent.click(await screen.findByText('＋ 新建战术板'))
  await waitFor(() => expect(api.createBoard).toHaveBeenCalled())
})

test('cards and add-card expose their CSS hooks', async () => {
  const { container } = renderList()
  await screen.findByText('Old')
  expect(container.querySelector('.add-card')).toBeTruthy()
  expect(container.querySelector('.board-card')).toBeTruthy()
  expect(container.querySelector('.board-bg')).toBeTruthy()
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client; npx vitest run src/components/BoardList.test.jsx`
Expected: 新增 3 个测试 FAIL（找不到「＋ 新建战术板」/找不到 `.board-card` 等）；原有 2 个重命名测试仍 PASS。

- [ ] **Step 3: 重写 BoardList.jsx**

把 `client/src/components/BoardList.jsx` 整体替换为（注意：import、三个 handler、useEffect 与原文件保持一致，只重写 `STYLES` 和 `return`）：

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBoards, createBoard, deleteBoard, saveBoard } from '../api/boards'
import { createDefaultBoardData } from '../utils/defaultBoardData'

const STYLES = {
  page: { maxWidth: 760, margin: '0 auto', padding: '0 24px 60px' },
  hero: { textAlign: 'center', padding: '48px 16px 24px' },
  logo: { fontSize: 40, lineHeight: 1 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: 1, margin: '8px 0 4px' },
  subtitle: { fontSize: 13, fontWeight: 300, opacity: 0.7 },
  sectionLabel: { textAlign: 'center', fontSize: 11, letterSpacing: 1, opacity: 0.5, margin: '4px 0 16px' },
  cardName: { fontSize: 16, fontWeight: 500 },
  cardDate: { fontSize: 12, fontWeight: 300, opacity: 0.6, marginTop: 4 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.55)', marginTop: 32 },
  emptyIcon: { fontSize: 32, opacity: 0.5 },
}

export default function BoardList() {
  const [boards, setBoards] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    listBoards().then(setBoards)
  }, [])

  async function handleCreate() {
    const name = prompt('战术板名称', 'Untitled Board')
    if (!name) return
    const board = await createBoard(name, createDefaultBoardData())
    navigate(`/board/${board.id}`)
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('确认删除此战术板？')) return
    await deleteBoard(id)
    setBoards(bs => bs.filter(b => b.id !== id))
  }

  async function handleRename(e, board) {
    e.stopPropagation()
    const v = prompt('新名称', board.name)
    const trimmed = v?.trim()
    if (!trimmed || trimmed === board.name) return // 取消/空/未改动 → 不发请求
    await saveBoard(board.id, { name: trimmed })
    setBoards(bs => bs.map(b => (b.id === board.id ? { ...b, name: trimmed } : b)))
  }

  return (
    <div className="board-bg">
      <div style={STYLES.page}>
        <div style={STYLES.hero}>
          <div style={STYLES.logo}>🥏</div>
          <h1 style={STYLES.title}>飞盘战术板</h1>
          <div style={STYLES.subtitle}>讲解战术 · 复盘跑位</div>
        </div>

        <div style={STYLES.sectionLabel}>我的战术板</div>

        <div className="add-card" onClick={handleCreate}>＋ 新建战术板</div>

        {boards.length === 0 && (
          <div style={STYLES.empty}>
            <div style={STYLES.emptyIcon}>🥏</div>
            <p>还没有战术板，点上方新建一个</p>
          </div>
        )}

        {boards.map(board => (
          <div
            key={board.id}
            className="board-card"
            onClick={() => navigate(`/board/${board.id}`)}
          >
            <div>
              <div style={STYLES.cardName}>{board.name}</div>
              <div style={STYLES.cardDate}>
                {new Date(board.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="card-actions">
              <button className="card-btn rename-btn" onClick={(e) => handleRename(e, board)}>
                重命名
              </button>
              <button className="card-btn delete-btn" onClick={(e) => handleDelete(e, board.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd client; npx vitest run src/components/BoardList.test.jsx`
Expected: 全部 5 个测试 PASS（原 2 个重命名 + 新 3 个）。

- [ ] **Step 5: 提交**

```bash
git add client/src/components/BoardList.jsx client/src/components/BoardList.test.jsx
git commit -m "feat: restructure BoardList — centered hero, dashed add-card, empty state"
```

---

## Task 2: 接通视觉层（Pitch Glow + 毛玻璃 + 交互浮现）

**Files:**
- Modify: `client/src/main.jsx`（新增 `import './index.css'`）
- Modify: `client/src/index.css`（写入全部样式）
- Modify: `client/index.html`（body 底色改深绿渐变）

这一步是纯样式接通，靠浏览器人工验收；单元测试只需保证不回归。

- [ ] **Step 1: 在 main.jsx 引入 index.css**

在 `client/src/main.jsx` 顶部 import 区加入一行（放在 `import App` 之后即可）：

```jsx
import './index.css'
```

- [ ] **Step 2: 写入 index.css**

把 `client/src/index.css` 整体替换为：

```css
/* —— Pitch Glow 呼吸微光背景 —— */
.board-bg { position: relative; min-height: 100vh; }
.board-bg::before,
.board-bg::after {
  content: ""; position: fixed; pointer-events: none; z-index: 0; border-radius: 50%;
}
.board-bg::before {
  width: 80vw; height: 60vh; left: -10vw; top: -15vh;
  background: radial-gradient(closest-side, rgba(255, 210, 63, 0.20), transparent 70%);
  animation: breatheA 7s ease-in-out infinite;
}
.board-bg::after {
  width: 70vw; height: 55vh; right: -15vw; bottom: -10vh;
  background: radial-gradient(closest-side, rgba(120, 220, 180, 0.15), transparent 70%);
  animation: breatheB 9s ease-in-out infinite;
}
/* 内容抬到光晕之上 */
.board-bg > * { position: relative; z-index: 1; }

@keyframes breatheA {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50%      { opacity: 0.90; transform: scale(1.08); }
}
@keyframes breatheB {
  0%, 100% { opacity: 0.50; transform: scale(1.05); }
  50%      { opacity: 0.85; transform: scale(1); }
}

/* —— 虚线新建卡片 —— */
.add-card {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 12px; padding: 16px; border-radius: 11px; cursor: pointer;
  border: 2px dashed rgba(255, 210, 63, 0.5); color: #ffd23f;
  font-weight: 600; font-size: 14px;
  transition: background 0.2s, border-color 0.2s;
}
.add-card:hover { background: rgba(255, 210, 63, 0.10); border-color: rgba(255, 210, 63, 0.8); }

/* —— 战术板卡片（毛玻璃 + 隐式边缘高亮 + hover 上浮）—— */
.board-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-radius: 11px; margin-bottom: 12px; cursor: pointer;
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  box-shadow: inset 6px 0 14px -8px rgba(255, 210, 63, 0.9);
  transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
}
.board-card:hover {
  transform: translateY(-2px); background: rgba(255, 255, 255, 0.10);
  box-shadow: inset 6px 0 16px -7px rgba(255, 210, 63, 1), 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* —— 交互式浮现：操作按钮默认半隐，卡片悬停时淡入 —— */
.card-actions { display: flex; gap: 8px; opacity: 0.5; transition: opacity 0.25s; }
.board-card:hover .card-actions { opacity: 1; }

.card-btn {
  font-size: 13px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
  background: transparent; color: #cfe7da; border: 1px solid rgba(255, 255, 255, 0.28);
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.rename-btn:hover { color: #7db4ff; border-color: #7db4ff; background: rgba(30, 136, 229, 0.15); }
.delete-btn:hover { color: #ff8a80; border-color: #ff8a80; background: rgba(229, 57, 53, 0.15); }
```

- [ ] **Step 3: 改 index.html 的 body 底色**

在 `client/index.html` 的 `<head><style>` 中，把
```css
body { background: #1a1a2e; color: #eee; font-family: sans-serif; }
```
改为
```css
body { background: linear-gradient(160deg, #0d3b2e 0%, #15543f 55%, #1d6b4f 100%); color: #eafaf2; font-family: sans-serif; min-height: 100vh; }
```

- [ ] **Step 4: 运行全量测试，确认不回归**

Run: `cd client; npx vitest run`
Expected: 全部测试 PASS（CSS 改动不影响逻辑；BoardList 5 个测试仍过）。

- [ ] **Step 5: 浏览器人工验收清单**

Run: `cd client; npm run dev`，打开列表页，逐项确认：
- [ ] 背景是深绿球场色，有两团光晕在缓慢明灭（呼吸感）
- [ ] 顶部居中：🥏 + 「飞盘战术板」+ 副标题「讲解战术 · 复盘跑位」，右上角没有按钮了
- [ ] 「＋ 新建战术板」是飞盘黄虚线卡片，hover 高亮；点击仍弹出原 prompt 且能建板
- [ ] 卡片是毛玻璃质感，左缘有黄色柔光（非实心竖条）
- [ ] 鼠标移到卡片上：卡片轻微上浮，重命名/删除按钮从半透明淡入
- [ ] 悬停「重命名」变蓝、「删除」变红；功能正常
- [ ] 删到 0 个板时显示空状态（🥏 +「还没有战术板，点上方新建一个」），虚线新建卡片仍在

- [ ] **Step 6: 提交**

```bash
git add client/src/main.jsx client/src/index.css client/index.html
git commit -m "style: Pitch Glow background, glassmorphism cards, interactive button reveal"
```

---

## 完成后

- 全部任务完成后做一次整体审查（spec 合规 + 代码质量），再让用户在浏览器最终验收，然后合并到 main、推送备份。
- 注意：用户在中国，push 可能因网络重置失败，由用户手动 push。
