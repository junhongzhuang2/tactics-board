# 静态部署 + 本地存储 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把战术板改造成纯前端静态站——战术板存浏览器 localStorage、HashRouter 路由、GitHub Actions 自动部署到 GitHub Pages。

**Architecture:** 只替换唯一的「后端边界」`api/boards.js`(fetch → localStorage,5 函数签名不变),前端其余零改动;`main.jsx` 换 HashRouter;`vite.config` 加构建 base;新增 Pages 部署 workflow。`server/` 保留不删、不部署。

**Tech Stack:** React 18, react-router-dom 6 (HashRouter), Vite 5, Vitest, GitHub Actions / Pages。

设计文档：`docs/superpowers/specs/2026-06-09-static-deploy-local-storage-design.md`

---

## File Structure

- **Modify** `client/src/api/boards.js` — localStorage 实现(5 函数签名不变)。
- **Create** `client/src/api/boards.test.js` — 本地存储单测。
- **Modify** `client/src/main.jsx` — `BrowserRouter` → `HashRouter`。
- **Modify** `client/vite.config.js` — 构建 `base` + 删 `server.proxy`。
- **Create** `.github/workflows/deploy.yml` — Pages 自动部署。

> `server/` 不动。无 DB / 数据迁移。

---

## Task 1: `api/boards.js` 改 localStorage（TDD）

**Files:**
- Modify: `client/src/api/boards.js`
- Test: `client/src/api/boards.test.js`

- [ ] **Step 1: 写失败测试** — 新建 `client/src/api/boards.test.js`:

```js
import { listBoards, getBoard, createBoard, saveBoard, deleteBoard } from './boards'

beforeEach(() => { localStorage.clear() })

const tick = () => new Promise((r) => setTimeout(r, 2)) // 让 updated_at 时间戳推进

test('createBoard 后 listBoards 含它、getBoard 命中', async () => {
  const b = await createBoard('板1', { x: 1 })
  expect(b.id).toMatch(/^board-/)
  expect(b.name).toBe('板1')
  expect(b.data).toEqual({ x: 1 })
  expect(b.created_at).toBeTruthy()
  expect(b.updated_at).toBeTruthy()
  expect(await listBoards()).toHaveLength(1)
  expect((await getBoard(b.id)).name).toBe('板1')
})

test('getBoard 未命中返回 null', async () => {
  expect(await getBoard('nope')).toBeNull()
})

test('saveBoard 改 name/data 并更新 updated_at', async () => {
  const b = await createBoard('旧', { v: 1 })
  const before = (await getBoard(b.id)).updated_at
  await tick()
  await saveBoard(b.id, { name: '新', data: { v: 2 } })
  const after = await getBoard(b.id)
  expect(after.name).toBe('新')
  expect(after.data).toEqual({ v: 2 })
  expect(after.updated_at >= before).toBe(true)
})

test('deleteBoard 删除', async () => {
  const b = await createBoard('x', {})
  await deleteBoard(b.id)
  expect(await listBoards()).toHaveLength(0)
})

test('listBoards 按 updated_at 倒序（最新在前）', async () => {
  const a = await createBoard('A', {})
  await tick()
  const b = await createBoard('B', {})
  const list = await listBoards()
  expect(list[0].id).toBe(b.id)
})

test('localStorage 内容损坏时 listBoards 兜底空数组', async () => {
  localStorage.setItem('tactics-board:boards', '{not json')
  expect(await listBoards()).toEqual([])
})
```

- [ ] **Step 2: 运行确认失败** — Run: `cd client; npx vitest run src/api/boards.test.js`
  Expected: FAIL(当前实现是 fetch,jsdom 无后端 → 抛错或测试不符)。

- [ ] **Step 3: 实现** — 整体替换 `client/src/api/boards.js` 为:

```js
const KEY = 'tactics-board:boards'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

function writeAll(boards) {
  localStorage.setItem(KEY, JSON.stringify(boards))
}

function newId() {
  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function now() {
  return new Date().toISOString()
}

export async function listBoards() {
  return readAll().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

export async function getBoard(id) {
  return readAll().find((b) => b.id === id) ?? null
}

export async function createBoard(name, data) {
  const board = { id: newId(), name, data, created_at: now(), updated_at: now() }
  writeAll([...readAll(), board])
  return board
}

export async function saveBoard(id, fields) {
  const boards = readAll().map((b) => (b.id === id ? { ...b, ...fields, updated_at: now() } : b))
  writeAll(boards)
}

export async function deleteBoard(id) {
  writeAll(readAll().filter((b) => b.id !== id))
}
```

- [ ] **Step 4: 运行确认通过** — Run: `cd client; npx vitest run src/api/boards.test.js`
  Expected: PASS(6 个测试)。然后全套 `cd client; npx vitest run` → 全绿(`BoardList.test`/`useAutoSave.test` 仍 mock `api/boards`,不受影响)。

- [ ] **Step 5: 提交**
```bash
git add client/src/api/boards.js client/src/api/boards.test.js
git commit -m "feat: localStorage-backed boards api (drop backend dependency)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: HashRouter + Vite 构建 base

**Files:**
- Modify: `client/src/main.jsx`
- Modify: `client/vite.config.js`

> 无单测(路由/构建配置);构建 + 人工冒烟验证。

- [ ] **Step 1: `main.jsx` 换 HashRouter** — 整体替换 `client/src/main.jsx` 为:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: `vite.config.js` 加构建 base + 删 proxy** — 整体替换 `client/vite.config.js` 为:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 构建发布到 GitHub Pages 子路径 /tactics-board/；本地 dev/test 用根路径
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tactics-board/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
}))
```

- [ ] **Step 3: 全套测试 + 构建 + 预览** —
  Run: `cd client; npx vitest run` → 全绿(无回归)。
  Run: `cd client; npx vite build` → 成功;检查 `dist/index.html` 里资源路径以 `/tactics-board/` 开头。
  Run(可选,本地确认子路径): `cd client; npx vite preview` → 打开它给出的 `http://localhost:4173/tactics-board/`,页面与资源正常。

- [ ] **Step 4: 人工冒烟(本地 dev)** — `cd client; npm run dev`,打开 dev URL(根路径,带 `#`):
  1. 新建战术板 → 进入 `#/board/xxx`、能画;约 1 秒「已保存」。
  2. **刷新页面 → 战术板还在**(localStorage 持久);返回列表能看到它、时间正确。
  3. 删除战术板;新建多个 → 列表按最新在前。
  > 把结果反馈我,尤其「刷新后数据还在」。

- [ ] **Step 5: 提交**
```bash
git add client/src/main.jsx client/vite.config.js
git commit -m "feat: HashRouter + vite build base for GitHub Pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: GitHub Actions 部署 workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

> 无单测(CI 配置);合并到 main、push 后由 Actions 验证。

- [ ] **Step 1: 创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: client/package-lock.json
      - name: Install deps
        run: npm ci
        working-directory: client
      - name: Build
        run: npm run build
        working-directory: client
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: client/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 语法自检** — 确认 YAML 缩进正确;`working-directory: client` 在两个 run 步骤上;`cache-dependency-path: client/package-lock.json` 存在;artifact path 为 `client/dist`。(无本地命令可跑;靠合并后 Actions 运行验证。)

- [ ] **Step 3: 提交**
```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages deploy workflow (build client, publish dist)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: 一次性手动设置 + 合并后验证(人工)** —
  1. 合并本分支到 `main` 并 push(由 finishing 流程完成)。
  2. **GitHub 仓库 → Settings → Pages → Build and deployment → Source 选「GitHub Actions」**(只需一次)。
  3. 打开仓库 Actions 标签,看 `Deploy to GitHub Pages` 这次运行变绿。
  4. 访问 `https://frisbee-tactics-board.github.io/tactics-board/` → 能新建/画/保存;**刷新 `#/board/xxx` 子页不 404**。
  > 第 2 步必须你在网页上点一次(我无法代操作);其余 push 后自动。

---

## Self-Review（已执行）

**1. Spec coverage（对照设计文档）：**
- §3 localStorage 实现(5 函数签名不变 + board 形状 + 兜底)→ Task 1 ✅
- §4 HashRouter → Task 2 Step 1 ✅
- §5 Vite base(构建子路径)+ 删 proxy + Actions workflow(node20/cache/working-directory/artifact)+ 一次性 Pages 设置 → Task 2 Step 2 + Task 3 ✅
- §6 测试:api/boards 单测(create/get/save/delete/排序/兜底);现有测试仍 mock 不受影响;人工冒烟(dev 刷新持久 / preview 子路径 / 部署后访问)→ Task 1 + Task 2 Step 3/4 + Task 3 Step 4 ✅
- §7 文件清单全覆盖;`server/` 不动 ✅

**2. Placeholder scan：** 无 TODO/TBD;每个代码/配置步骤含完整内容。

**3. Type consistency：**
- `api/boards.js` 五函数名(`listBoards`/`getBoard`/`createBoard`/`saveBoard`/`deleteBoard`)与现有调用方(`App.jsx`/`BoardList.jsx`/`useAutoSave.js`)一致、签名不变。
- board 形状 `{id,name,data,created_at,updated_at}` 与 `BoardList`(`board.updated_at`/`name`/`id`)、`App`(`board.data`)、测试断言一致。
- localStorage key `'tactics-board:boards'` 在实现与「损坏兜底」测试中一致。
- workflow:`working-directory: client`、`cache-dependency-path: client/package-lock.json`、artifact `client/dist`、`base: '/tactics-board/'` 与 repo 名一致。

**已知取舍：** 路由/Vite/workflow 无自动化测试(配置类),靠构建 + 人工冒烟 + 部署后验证。`useAutoSave` 的重试/竞态逻辑保留但本地存储永远成功,无害,本次不动(YAGNI)。一次性「Pages Source = GitHub Actions」需用户手动点一次。
