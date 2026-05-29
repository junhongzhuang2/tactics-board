# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可用的单人版战术板——包含场地渲染、球员/飞盘拖拽、多帧管理、后端持久化、战术板列表页。

**Architecture:** 前端 React + Konva.js Canvas 渲染，球员坐标归一化存储（0-1）保证跨设备一致；后端 Express + PostgreSQL，Board 状态整体存入 JSONB 列；前后端通过 REST API 通信。

**Tech Stack:** React 18, Konva 9 + react-konva 18, Zustand 4, Vite 5, Vitest | Node.js, Express 4, pg 8, PostgreSQL 14+, Jest + Supertest

---

## File Structure

```
tactics-board/
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── test-setup.js
│       ├── utils/
│       │   └── coords.js          # 归一化坐标 ↔ 画布像素转换
│       ├── store/
│       │   └── boardStore.js      # Zustand 全局状态
│       ├── api/
│       │   └── boards.js          # fetch() REST 封装
│       └── components/
│           ├── BoardCanvas.jsx    # Konva Stage 容器，响应式尺寸
│           ├── Field.jsx          # 场地线条渲染（Konva Layer）
│           ├── Player.jsx         # 球员圆形元素，可拖拽
│           ├── Disc.jsx           # 飞盘元素，可拖拽
│           ├── FrameBar.jsx       # 底部帧选择器（非动画）
│           └── BoardList.jsx      # 首页：战术板列表
├── server/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js              # HTTP 服务入口
│       ├── app.js                 # Express 配置
│       ├── db/
│       │   ├── pool.js            # pg 连接池
│       │   ├── schema.sql         # 表定义
│       │   └── boards.js          # DB 查询函数
│       └── routes/
│           └── boards.js          # REST 路由处理器
│   └── tests/
│       ├── setup.js               # 测试 DB 初始化
│       ├── boards.db.test.js      # DB 查询单元测试
│       └── boards.api.test.js     # API 集成测试
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## 数据结构（贯穿全计划）

### Board Data（存入 PostgreSQL JSONB）

```js
{
  players: [
    { id: 'r1', team: 'red',  number: 1, name: '1' },
    // r2..r7, b1..b7 同理
  ],
  frames: [
    {
      id: 'frame-0',
      duration: 1000,  // 过渡时长（ms），Phase 2 动画用
      playerStates: {
        r1: { x: 0.15, y: 0.50, orientation: 0 },
        // 所有 14 名球员
      },
      discState: { x: 0.50, y: 0.50 },
      annotations: [],  // Phase 2 填充
    }
  ],
  globalAnnotations: [],  // Phase 2 填充
}
```

所有 `x`, `y` 为归一化坐标（相对场地宽高，范围 0-1）。

### Zustand Store Shape

```js
{
  board: Board | null,          // 当前载入的战术板（含 id, name, data）
  currentFrameIndex: number,    // 当前显示的帧索引
  isDirty: boolean,             // 是否有未保存的改动
}
```

---

## Task 1: 项目结构搭建

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/test-setup.js`
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/src/server.js`
- Create: `server/src/app.js`

- [ ] **Step 1: 创建 client/package.json**

```json
{
  "name": "tactics-board-client",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "konva": "^9.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-konva": "^18.2.10",
    "react-router-dom": "^6.24.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: 创建 client/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 3: 创建 client/index.html**

```html
<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>飞盘战术板</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #1a1a2e; color: #eee; font-family: sans-serif; }
      #root { width: 100vw; height: 100vh; display: flex; flex-direction: column; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 client/src/test-setup.js**

```js
import '@testing-library/jest-dom'

// jsdom 没有 canvas，mock 掉避免 Konva 报错
HTMLCanvasElement.prototype.getContext = () => ({
  fillRect: () => {},
  clearRect: () => {},
  getImageData: () => ({ data: [] }),
  putImageData: () => {},
  createImageData: () => [],
  setTransform: () => {},
  drawImage: () => {},
  save: () => {},
  fillText: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  stroke: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  arc: () => {},
  fill: () => {},
  measureText: () => ({ width: 0 }),
  transform: () => {},
  rect: () => {},
  clip: () => {},
})
```

- [ ] **Step 5: 创建 client/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 6: 创建 client/src/App.jsx（占位，后续替换）**

```jsx
import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div>战术板首页（待实现）</div>} />
      <Route path="/board/:id" element={<div>战术板画布（待实现）</div>} />
    </Routes>
  )
}
```

- [ ] **Step 7: 创建 server/package.json**

```json
{
  "name": "tactics-board-server",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.12.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "globalSetup": "./tests/setup.js"
  }
}
```

- [ ] **Step 8: 创建 server/.env.example**

```
DATABASE_URL=postgres://localhost:5432/tactics_board
TEST_DATABASE_URL=postgres://localhost:5432/tactics_board_test
PORT=3001
```

- [ ] **Step 9: 创建 server/src/app.js**

```js
const express = require('express')
const cors = require('cors')
const boardRoutes = require('./routes/boards')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/boards', boardRoutes)
module.exports = app
```

- [ ] **Step 10: 创建 server/src/server.js**

```js
require('dotenv').config()
const app = require('./app')
const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

- [ ] **Step 11: 安装依赖**

```bash
cd client && npm install
cd ../server && npm install
```

- [ ] **Step 12: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — client (React+Vite+Konva) and server (Express)"
```

---

## Task 2: 数据库 Schema + 连接池

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/pool.js`
- Create: `server/tests/setup.js`

- [ ] **Step 1: 创建 server/src/db/schema.sql**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT 'Untitled Board',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: 在 PostgreSQL 里手动建库，然后执行 schema**

```bash
psql -c "CREATE DATABASE tactics_board;"
psql -c "CREATE DATABASE tactics_board_test;"
psql -d tactics_board -f server/src/db/schema.sql
psql -d tactics_board_test -f server/src/db/schema.sql
```

- [ ] **Step 3: 创建 server/src/db/pool.js**

```js
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

module.exports = pool
```

- [ ] **Step 4: 创建 server/tests/setup.js（Jest globalSetup）**

```js
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

module.exports = async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
    'postgres://localhost:5432/tactics_board_test'

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = fs.readFileSync(
    path.join(__dirname, '../src/db/schema.sql'), 'utf8'
  )
  await pool.query('DROP TABLE IF EXISTS boards CASCADE')
  await pool.query(schema)
  await pool.end()
}
```

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.sql server/src/db/pool.js server/tests/setup.js
git commit -m "feat: PostgreSQL schema and connection pool"
```

---

## Task 3: Board DB 查询函数

**Files:**
- Create: `server/src/db/boards.js`
- Create: `server/tests/boards.db.test.js`

- [ ] **Step 1: 写失败测试**

新建 `server/tests/boards.db.test.js`：

```js
const pool = require('../src/db/pool')
const db = require('../src/db/boards')

afterAll(() => pool.end())

beforeEach(async () => {
  await pool.query('DELETE FROM boards')
})

const SAMPLE_DATA = {
  players: [{ id: 'r1', team: 'red', number: 1, name: '1' }],
  frames: [{
    id: 'frame-0', duration: 1000,
    playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 } },
    discState: { x: 0.5, y: 0.5 },
    annotations: [],
  }],
  globalAnnotations: [],
}

test('createBoard returns board with id', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  expect(board.id).toBeTruthy()
  expect(board.name).toBe('Test Board')
  expect(board.data).toEqual(SAMPLE_DATA)
})

test('getBoardById returns created board', async () => {
  const created = await db.createBoard('Test Board', SAMPLE_DATA)
  const found = await db.getBoardById(created.id)
  expect(found.id).toBe(created.id)
  expect(found.name).toBe('Test Board')
})

test('getBoardById returns null for unknown id', async () => {
  const found = await db.getBoardById('00000000-0000-0000-0000-000000000000')
  expect(found).toBeNull()
})

test('listBoards returns all boards ordered by updated_at desc', async () => {
  await db.createBoard('Board A', SAMPLE_DATA)
  await db.createBoard('Board B', SAMPLE_DATA)
  const boards = await db.listBoards()
  expect(boards.length).toBe(2)
  expect(boards[0].data).toBeUndefined()  // listBoards 不返回 data
})

test('updateBoard saves new data', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  const newData = { ...SAMPLE_DATA, globalAnnotations: [{ id: 'a1' }] }
  await db.updateBoard(board.id, { data: newData })
  const updated = await db.getBoardById(board.id)
  expect(updated.data.globalAnnotations).toEqual([{ id: 'a1' }])
})

test('updateBoard can rename board', async () => {
  const board = await db.createBoard('Old Name', SAMPLE_DATA)
  await db.updateBoard(board.id, { name: 'New Name' })
  const updated = await db.getBoardById(board.id)
  expect(updated.name).toBe('New Name')
})

test('deleteBoard removes board', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  await db.deleteBoard(board.id)
  const found = await db.getBoardById(board.id)
  expect(found).toBeNull()
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd server && npm test -- tests/boards.db.test.js
```

预期：`Cannot find module '../src/db/boards'`

- [ ] **Step 3: 创建 server/src/db/boards.js**

```js
const pool = require('./pool')

async function createBoard(name, data) {
  const { rows } = await pool.query(
    'INSERT INTO boards (name, data) VALUES ($1, $2) RETURNING *',
    [name, JSON.stringify(data)]
  )
  return rows[0]
}

async function getBoardById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM boards WHERE id = $1',
    [id]
  )
  return rows[0] ?? null
}

async function listBoards() {
  const { rows } = await pool.query(
    'SELECT id, name, created_at, updated_at FROM boards ORDER BY updated_at DESC'
  )
  return rows
}

async function updateBoard(id, fields) {
  const updates = []
  const values = []
  let i = 1

  if (fields.name !== undefined) {
    updates.push(`name = $${i++}`)
    values.push(fields.name)
  }
  if (fields.data !== undefined) {
    updates.push(`data = $${i++}`)
    values.push(JSON.stringify(fields.data))
  }

  if (updates.length === 0) return

  values.push(id)
  await pool.query(
    `UPDATE boards SET ${updates.join(', ')} WHERE id = $${i}`,
    values
  )
}

async function deleteBoard(id) {
  await pool.query('DELETE FROM boards WHERE id = $1', [id])
}

module.exports = { createBoard, getBoardById, listBoards, updateBoard, deleteBoard }
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd server && npm test -- tests/boards.db.test.js
```

预期：7 tests passed

- [ ] **Step 5: Commit**

```bash
git add server/src/db/boards.js server/tests/boards.db.test.js
git commit -m "feat: board DB queries with full test coverage"
```

---

## Task 4: REST API 路由

**Files:**
- Create: `server/src/routes/boards.js`
- Create: `server/tests/boards.api.test.js`

- [ ] **Step 1: 写失败测试**

新建 `server/tests/boards.api.test.js`：

```js
const request = require('supertest')
const app = require('../src/app')
const pool = require('../src/db/pool')

afterAll(() => pool.end())
beforeEach(async () => pool.query('DELETE FROM boards'))

const SAMPLE_DATA = {
  players: [], frames: [
    { id: 'frame-0', duration: 1000, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] }
  ], globalAnnotations: [],
}

test('POST /api/boards creates a board', async () => {
  const res = await request(app)
    .post('/api/boards')
    .send({ name: 'My Board', data: SAMPLE_DATA })
  expect(res.status).toBe(201)
  expect(res.body.id).toBeTruthy()
  expect(res.body.name).toBe('My Board')
})

test('GET /api/boards lists boards', async () => {
  await request(app).post('/api/boards').send({ name: 'Board A', data: SAMPLE_DATA })
  await request(app).post('/api/boards').send({ name: 'Board B', data: SAMPLE_DATA })
  const res = await request(app).get('/api/boards')
  expect(res.status).toBe(200)
  expect(res.body.length).toBe(2)
})

test('GET /api/boards/:id returns board', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const res = await request(app).get(`/api/boards/${create.body.id}`)
  expect(res.status).toBe(200)
  expect(res.body.name).toBe('My Board')
  expect(res.body.data).toBeDefined()
})

test('GET /api/boards/:id returns 404 for unknown id', async () => {
  const res = await request(app).get('/api/boards/00000000-0000-0000-0000-000000000000')
  expect(res.status).toBe(404)
})

test('PUT /api/boards/:id updates data', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const newData = { ...SAMPLE_DATA, globalAnnotations: [{ id: 'a1' }] }
  const res = await request(app).put(`/api/boards/${create.body.id}`).send({ data: newData })
  expect(res.status).toBe(200)
  const get = await request(app).get(`/api/boards/${create.body.id}`)
  expect(get.body.data.globalAnnotations).toEqual([{ id: 'a1' }])
})

test('DELETE /api/boards/:id removes board', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const res = await request(app).delete(`/api/boards/${create.body.id}`)
  expect(res.status).toBe(204)
  const get = await request(app).get(`/api/boards/${create.body.id}`)
  expect(get.status).toBe(404)
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd server && npm test -- tests/boards.api.test.js
```

预期：`Cannot find module './routes/boards'` 或 404 错误

- [ ] **Step 3: 创建 server/src/routes/boards.js**

```js
const express = require('express')
const router = express.Router()
const db = require('../db/boards')

router.post('/', async (req, res) => {
  try {
    const { name = 'Untitled Board', data } = req.body
    if (!data) return res.status(400).json({ error: 'data is required' })
    const board = await db.createBoard(name, data)
    res.status(201).json(board)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const boards = await db.listBoards()
    res.json(boards)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const board = await db.getBoardById(req.params.id)
    if (!board) return res.status(404).json({ error: 'Board not found' })
    res.json(board)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, data } = req.body
    await db.updateBoard(req.params.id, { name, data })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteBoard(req.params.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd server && npm test
```

预期：所有测试通过

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/boards.js server/tests/boards.api.test.js
git commit -m "feat: REST API for board CRUD"
```

---

## Task 5: coords.js 坐标工具

**Files:**
- Create: `client/src/utils/coords.js`
- Test: `client/src/utils/coords.test.js`

- [ ] **Step 1: 写失败测试**

新建 `client/src/utils/coords.test.js`：

```js
import { toCanvas, toNorm, clampToField } from './coords'

describe('toCanvas', () => {
  test('converts normalized center to canvas center', () => {
    const result = toCanvas(0.5, 0.5, 1000, 400)
    expect(result).toEqual({ x: 500, y: 200 })
  })
  test('converts top-left corner', () => {
    expect(toCanvas(0, 0, 1000, 400)).toEqual({ x: 0, y: 0 })
  })
  test('converts bottom-right corner', () => {
    expect(toCanvas(1, 1, 1000, 400)).toEqual({ x: 1000, y: 400 })
  })
})

describe('toNorm', () => {
  test('converts canvas center to normalized center', () => {
    expect(toNorm(500, 200, 1000, 400)).toEqual({ x: 0.5, y: 0.5 })
  })
  test('converts canvas origin to normalized origin', () => {
    expect(toNorm(0, 0, 1000, 400)).toEqual({ x: 0, y: 0 })
  })
})

describe('clampToField', () => {
  test('passes through values within bounds', () => {
    expect(clampToField(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 })
  })
  test('clamps x below 0', () => {
    expect(clampToField(-0.1, 0.5)).toEqual({ x: 0, y: 0.5 })
  })
  test('clamps x above 1', () => {
    expect(clampToField(1.1, 0.5)).toEqual({ x: 1, y: 0.5 })
  })
  test('clamps y below 0', () => {
    expect(clampToField(0.5, -0.5)).toEqual({ x: 0.5, y: 0 })
  })
  test('clamps y above 1', () => {
    expect(clampToField(0.5, 2)).toEqual({ x: 0.5, y: 1 })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd client && npm test -- coords
```

预期：`Cannot find module './coords'`

- [ ] **Step 3: 创建 client/src/utils/coords.js**

```js
export function toCanvas(normX, normY, fieldWidth, fieldHeight) {
  return { x: normX * fieldWidth, y: normY * fieldHeight }
}

export function toNorm(canvasX, canvasY, fieldWidth, fieldHeight) {
  return { x: canvasX / fieldWidth, y: canvasY / fieldHeight }
}

export function clampToField(x, y) {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  }
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd client && npm test -- coords
```

预期：9 tests passed

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/coords.js client/src/utils/coords.test.js
git commit -m "feat: normalized coordinate utilities with tests"
```

---

## Task 6: Zustand boardStore

**Files:**
- Create: `client/src/store/boardStore.js`
- Test: `client/src/store/boardStore.test.js`

- [ ] **Step 1: 写失败测试**

新建 `client/src/store/boardStore.test.js`：

```js
import { act, renderHook } from '@testing-library/react'
import { useBoardStore } from './boardStore'

// 每个测试前重置 store
beforeEach(() => {
  useBoardStore.setState({
    board: null,
    currentFrameIndex: 0,
    isDirty: false,
  })
})

const makeBoard = () => ({
  id: 'board-1',
  name: 'Test Board',
  data: {
    players: [
      { id: 'r1', team: 'red', number: 1, name: '1' },
      { id: 'b1', team: 'blue', number: 1, name: '1' },
    ],
    frames: [
      {
        id: 'frame-0', duration: 1000,
        playerStates: {
          r1: { x: 0.1, y: 0.5, orientation: 0 },
          b1: { x: 0.9, y: 0.5, orientation: 0 },
        },
        discState: { x: 0.5, y: 0.5 },
        annotations: [],
      },
    ],
    globalAnnotations: [],
  },
})

test('setBoard loads a board', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  act(() => result.current.setBoard(board))
  expect(result.current.board.id).toBe('board-1')
  expect(result.current.currentFrameIndex).toBe(0)
  expect(result.current.isDirty).toBe(false)
})

test('updateFramePlayerState updates position and marks dirty', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.3, y: 0.4, orientation: 0 }))
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.3)
  expect(result.current.isDirty).toBe(true)
})

test('updateFrameDiscState updates disc position', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, { x: 0.7, y: 0.2 }))
  expect(result.current.board.data.frames[0].discState.x).toBe(0.7)
  expect(result.current.isDirty).toBe(true)
})

test('addFrame appends copy of current frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addFrame())
  expect(result.current.board.data.frames.length).toBe(2)
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(0.1)
})

test('removeFrame removes a frame', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 1000, playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 }, b1: { x: 0.5, y: 0.5, orientation: 0 } }, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.removeFrame(1))
  expect(result.current.board.data.frames.length).toBe(1)
})

test('removeFrame does not remove last frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.removeFrame(0))
  expect(result.current.board.data.frames.length).toBe(1)
})

test('setCurrentFrame updates index', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 1000, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.setCurrentFrame(1))
  expect(result.current.currentFrameIndex).toBe(1)
})

test('renamePlayer updates player name', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.renamePlayer('r1', '小王'))
  expect(result.current.board.data.players.find(p => p.id === 'r1').name).toBe('小王')
  expect(result.current.isDirty).toBe(true)
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd client && npm test -- boardStore
```

预期：`Cannot find module './boardStore'`

- [ ] **Step 3: 创建 client/src/store/boardStore.js**

```js
import { create } from 'zustand'
import { nanoid } from 'nanoid'  // 注意：需要安装 nanoid

const useBoardStore = create((set, get) => ({
  board: null,
  currentFrameIndex: 0,
  isDirty: false,

  setBoard: (board) => set({ board, currentFrameIndex: 0, isDirty: false }),

  updateFramePlayerState: (frameIndex, playerId, state) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex
        ? { ...f, playerStates: { ...f.playerStates, [playerId]: state } }
        : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
  }),

  updateFrameDiscState: (frameIndex, discState) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex ? { ...f, discState } : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
  }),

  addFrame: () => set((s) => {
    const frames = s.board.data.frames
    const last = frames[frames.length - 1]
    const newFrame = {
      ...JSON.parse(JSON.stringify(last)),  // deep copy
      id: `frame-${Date.now()}`,
      annotations: [],
    }
    return {
      board: { ...s.board, data: { ...s.board.data, frames: [...frames, newFrame] } },
      currentFrameIndex: frames.length,
      isDirty: true,
    }
  }),

  removeFrame: (frameIndex) => set((s) => {
    if (s.board.data.frames.length <= 1) return s
    const frames = s.board.data.frames.filter((_, i) => i !== frameIndex)
    const currentFrameIndex = Math.min(s.currentFrameIndex, frames.length - 1)
    return {
      board: { ...s.board, data: { ...s.board.data, frames } },
      currentFrameIndex,
      isDirty: true,
    }
  }),

  setCurrentFrame: (frameIndex) => set({ currentFrameIndex: frameIndex }),

  renamePlayer: (playerId, name) => set((s) => {
    const players = s.board.data.players.map((p) =>
      p.id === playerId ? { ...p, name } : p
    )
    return { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true }
  }),

  markClean: () => set({ isDirty: false }),
}))

export { useBoardStore }
```

- [ ] **Step 4: 安装 nanoid（boardStore 需要但测试中未直接用到，addFrame 用 Date.now() 代替所以不需要）**

实际上 addFrame 使用 `Date.now()` 生成 id，不需要 nanoid。删除 import nanoid 行：

```js
// 删除 boardStore.js 第一行的 nanoid import，已用 Date.now() 替代
```

- [ ] **Step 5: 运行测试，确认全部通过**

```bash
cd client && npm test -- boardStore
```

预期：8 tests passed

- [ ] **Step 6: Commit**

```bash
git add client/src/store/boardStore.js client/src/store/boardStore.test.js
git commit -m "feat: Zustand board store with frame management"
```

---

## Task 7: API 客户端

**Files:**
- Create: `client/src/api/boards.js`

- [ ] **Step 1: 创建 client/src/api/boards.js**

```js
const BASE = '/api/boards'

export async function listBoards() {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to list boards')
  return res.json()
}

export async function createBoard(name, data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  if (!res.ok) throw new Error('Failed to create board')
  return res.json()
}

export async function getBoard(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to get board')
  return res.json()
}

export async function saveBoard(id, fields) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error('Failed to save board')
}

export async function deleteBoard(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete board')
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/boards.js
git commit -m "feat: REST API client"
```

---

## Task 8: 默认战术板数据

**Files:**
- Create: `client/src/utils/defaultBoardData.js`

- [ ] **Step 1: 创建 client/src/utils/defaultBoardData.js**

这个文件定义新建战术板时的初始状态（14名球员分布在场地中央区域）：

```js
const PLAYER_IDS = [
  'r1','r2','r3','r4','r5','r6','r7',
  'b1','b2','b3','b4','b5','b6','b7',
]

const DEFAULT_PLAYER_STATES = {
  r1: { x: 0.20, y: 0.15, orientation: 0 },
  r2: { x: 0.20, y: 0.30, orientation: 0 },
  r3: { x: 0.20, y: 0.50, orientation: 0 },
  r4: { x: 0.20, y: 0.70, orientation: 0 },
  r5: { x: 0.20, y: 0.85, orientation: 0 },
  r6: { x: 0.35, y: 0.35, orientation: 0 },
  r7: { x: 0.35, y: 0.65, orientation: 0 },
  b1: { x: 0.80, y: 0.15, orientation: Math.PI },
  b2: { x: 0.80, y: 0.30, orientation: Math.PI },
  b3: { x: 0.80, y: 0.50, orientation: Math.PI },
  b4: { x: 0.80, y: 0.70, orientation: Math.PI },
  b5: { x: 0.80, y: 0.85, orientation: Math.PI },
  b6: { x: 0.65, y: 0.35, orientation: Math.PI },
  b7: { x: 0.65, y: 0.65, orientation: Math.PI },
}

export function createDefaultBoardData() {
  return {
    players: [
      { id: 'r1', team: 'red',  number: 1, name: '1' },
      { id: 'r2', team: 'red',  number: 2, name: '2' },
      { id: 'r3', team: 'red',  number: 3, name: '3' },
      { id: 'r4', team: 'red',  number: 4, name: '4' },
      { id: 'r5', team: 'red',  number: 5, name: '5' },
      { id: 'r6', team: 'red',  number: 6, name: '6' },
      { id: 'r7', team: 'red',  number: 7, name: '7' },
      { id: 'b1', team: 'blue', number: 1, name: '1' },
      { id: 'b2', team: 'blue', number: 2, name: '2' },
      { id: 'b3', team: 'blue', number: 3, name: '3' },
      { id: 'b4', team: 'blue', number: 4, name: '4' },
      { id: 'b5', team: 'blue', number: 5, name: '5' },
      { id: 'b6', team: 'blue', number: 6, name: '6' },
      { id: 'b7', team: 'blue', number: 7, name: '7' },
    ],
    frames: [{
      id: 'frame-0',
      duration: 1000,
      playerStates: { ...DEFAULT_PLAYER_STATES },
      discState: { x: 0.50, y: 0.50 },
      annotations: [],
    }],
    globalAnnotations: [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/utils/defaultBoardData.js
git commit -m "feat: default board data initializer"
```

---

## Task 9: Field.jsx — 场地渲染

**Files:**
- Create: `client/src/components/Field.jsx`

极限飞盘场地比例：总长100m × 宽37m，两端各18m端区。
归一化：端区线在 x = 18/100 = 0.18 和 x = 82/100 = 0.82。

- [ ] **Step 1: 创建 client/src/components/Field.jsx**

```jsx
import { Layer, Rect, Line, Text } from 'react-konva'

const FIELD_COLOR = '#2d5a27'
const END_ZONE_COLOR = '#1e3d1a'
const LINE_COLOR = '#ffffff'
const LINE_WIDTH = 2

// 端区归一化边界
const END_ZONE_LEFT = 0.18
const END_ZONE_RIGHT = 0.82

export default function Field({ fieldWidth, fieldHeight }) {
  const w = fieldWidth
  const h = fieldHeight

  return (
    <Layer listening={false}>
      {/* 背景 */}
      <Rect x={0} y={0} width={w} height={h} fill={FIELD_COLOR} />

      {/* 左端区 */}
      <Rect
        x={0} y={0}
        width={END_ZONE_LEFT * w} height={h}
        fill={END_ZONE_COLOR}
      />

      {/* 右端区 */}
      <Rect
        x={END_ZONE_RIGHT * w} y={0}
        width={(1 - END_ZONE_RIGHT) * w} height={h}
        fill={END_ZONE_COLOR}
      />

      {/* 外边框 */}
      <Rect
        x={0} y={0} width={w} height={h}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} fill="transparent"
      />

      {/* 左端区线 */}
      <Line
        points={[END_ZONE_LEFT * w, 0, END_ZONE_LEFT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 右端区线 */}
      <Line
        points={[END_ZONE_RIGHT * w, 0, END_ZONE_RIGHT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 中线（虚线） */}
      <Line
        points={[0.5 * w, 0, 0.5 * w, h]}
        stroke={LINE_COLOR} strokeWidth={1}
        dash={[8, 8]} opacity={0.4}
      />
    </Layer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Field.jsx
git commit -m "feat: Field component — Ultimate Frisbee field rendering"
```

---

## Task 10: Player.jsx — 球员元素

**Files:**
- Create: `client/src/components/Player.jsx`

- [ ] **Step 1: 创建 client/src/components/Player.jsx**

```jsx
import { Circle, Text, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'

const TEAM_COLORS = { red: '#e53935', blue: '#1e88e5' }
const PLAYER_RADIUS = 18
const FONT_SIZE = 13

export default function Player({
  player,           // { id, team, number, name }
  playerState,      // { x, y, orientation } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,        // (playerId, newNormState) => void
  onDoubleClick,    // (playerId) => void
}) {
  const { x: cx, y: cy } = toCanvas(playerState.x, playerState.y, fieldWidth, fieldHeight)
  const color = TEAM_COLORS[player.team] ?? '#999'
  const label = player.name.length <= 3 ? player.name : player.name.slice(0, 3)

  function handleDragEnd(e) {
    const node = e.target
    // 转换回归一化坐标并 clamp 到场地内
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    // 将节点位置重置到 clamped 值（避免拖出场外）
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd(player.id, { ...playerState, x: clamped.x, y: clamped.y })
  }

  return (
    <Group
      x={cx} y={cy}
      draggable
      onDragEnd={handleDragEnd}
      onDblClick={() => onDoubleClick?.(player.id)}
    >
      <Circle radius={PLAYER_RADIUS} fill={color} stroke="#fff" strokeWidth={2} />
      <Text
        text={label}
        fontSize={FONT_SIZE}
        fill="#fff"
        fontStyle="bold"
        width={PLAYER_RADIUS * 2}
        height={PLAYER_RADIUS * 2}
        x={-PLAYER_RADIUS}
        y={-PLAYER_RADIUS}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Player.jsx
git commit -m "feat: Player component — draggable with team colors and labels"
```

---

## Task 11: Disc.jsx — 飞盘元素

**Files:**
- Create: `client/src/components/Disc.jsx`

- [ ] **Step 1: 创建 client/src/components/Disc.jsx**

```jsx
import { Circle, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'

const DISC_RADIUS = 14

export default function Disc({
  discState,      // { x, y } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,      // (newNormState) => void
}) {
  const { x: cx, y: cy } = toCanvas(discState.x, discState.y, fieldWidth, fieldHeight)

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd({ x: clamped.x, y: clamped.y })
  }

  return (
    <Group x={cx} y={cy} draggable onDragEnd={handleDragEnd}>
      <Circle radius={DISC_RADIUS} fill="#f5c518" stroke="#c8a000" strokeWidth={2} />
      <Circle radius={DISC_RADIUS * 0.55} fill="transparent" stroke="#c8a000" strokeWidth={1.5} />
    </Group>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Disc.jsx
git commit -m "feat: Disc component — draggable frisbee element"
```

---

## Task 12: FrameBar.jsx — 帧选择器

**Files:**
- Create: `client/src/components/FrameBar.jsx`

- [ ] **Step 1: 创建 client/src/components/FrameBar.jsx**

```jsx
const STYLES = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', background: '#111',
    borderTop: '1px solid #333', overflowX: 'auto',
  },
  frame: (active) => ({
    minWidth: 44, height: 36, borderRadius: 6,
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '2px solid #4a9eff' : '2px solid #444',
    color: '#fff', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
  }),
  btn: {
    padding: '0 14px', height: 36, borderRadius: 6,
    background: '#2a2a3e', border: '1px solid #555',
    color: '#ccc', cursor: 'pointer', fontSize: 20, lineHeight: 1,
  },
}

export default function FrameBar({
  frames,              // Frame[]
  currentFrameIndex,   // number
  onSelectFrame,       // (index) => void
  onAddFrame,          // () => void
  onRemoveFrame,       // (index) => void
}) {
  return (
    <div style={STYLES.bar}>
      {frames.map((frame, i) => (
        <div
          key={frame.id}
          style={STYLES.frame(i === currentFrameIndex)}
          onClick={() => onSelectFrame(i)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (frames.length > 1) onRemoveFrame(i)
          }}
          title={frames.length > 1 ? '右键删除此帧' : ''}
        >
          {i + 1}
        </div>
      ))}
      <button style={STYLES.btn} onClick={onAddFrame} title="添加帧">+</button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/FrameBar.jsx
git commit -m "feat: FrameBar component — frame navigation and management"
```

---

## Task 13: BoardCanvas.jsx — 主画布容器

**Files:**
- Create: `client/src/components/BoardCanvas.jsx`

- [ ] **Step 1: 创建 client/src/components/BoardCanvas.jsx**

```jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer } from 'react-konva'
import Field from './Field'
import Player from './Player'
import Disc from './Disc'
import FrameBar from './FrameBar'
import { useBoardStore } from '../store/boardStore'
import { saveBoard } from '../api/boards'

const FIELD_ASPECT = 100 / 37  // 宽:高
const PADDING = 40

function useFieldSize(containerRef) {
  const [size, setSize] = useState({ stageW: 800, stageH: 400, fieldW: 720, fieldH: 266, fieldX: 40, fieldY: 67 })

  useEffect(() => {
    function compute() {
      if (!containerRef.current) return
      const { clientWidth: cw, clientHeight: ch } = containerRef.current
      const availW = cw - PADDING * 2
      const availH = ch - PADDING * 2
      let fieldW, fieldH
      if (availW / availH > FIELD_ASPECT) {
        fieldH = availH; fieldW = fieldH * FIELD_ASPECT
      } else {
        fieldW = availW; fieldH = fieldW / FIELD_ASPECT
      }
      setSize({
        stageW: cw, stageH: ch,
        fieldW, fieldH,
        fieldX: (cw - fieldW) / 2,
        fieldY: (ch - fieldH) / 2,
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [containerRef])

  return size
}

export default function BoardCanvas() {
  const containerRef = useRef(null)
  const { stageW, stageH, fieldW, fieldH, fieldX, fieldY } = useFieldSize(containerRef)
  const { board, currentFrameIndex, isDirty, updateFramePlayerState, updateFrameDiscState,
          addFrame, removeFrame, setCurrentFrame, markClean } = useBoardStore()

  // 自动保存（isDirty 变为 true 后 1 秒触发）
  useEffect(() => {
    if (!isDirty || !board) return
    const timer = setTimeout(async () => {
      await saveBoard(board.id, { data: board.data })
      markClean()
    }, 1000)
    return () => clearTimeout(timer)
  }, [isDirty, board])

  if (!board) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中…</div>

  const currentFrame = board.data.frames[currentFrameIndex]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <div style={{ padding: '8px 16px', background: '#111', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{board.name}</span>
        {isDirty && <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>}
      </div>

      {/* 画布区域 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Stage width={stageW} height={stageH} style={{ background: '#0d0d1a' }}>
          {/* 场地 */}
          <Layer x={fieldX} y={fieldY}>
            <Field fieldWidth={fieldW} fieldHeight={fieldH} />
          </Layer>

          {/* 球员 + 飞盘 */}
          <Layer x={fieldX} y={fieldY}>
            {board.data.players.map(player => {
              const state = currentFrame.playerStates[player.id]
              if (!state) return null
              return (
                <Player
                  key={player.id}
                  player={player}
                  playerState={state}
                  fieldWidth={fieldW}
                  fieldHeight={fieldH}
                  onDragEnd={(id, newState) => updateFramePlayerState(currentFrameIndex, id, newState)}
                  onDoubleClick={(id) => {
                    const newName = prompt(`重命名球员 ${player.number}（当前: ${player.name}）`, player.name)
                    if (newName !== null && newName.trim()) useBoardStore.getState().renamePlayer(id, newName.trim())
                  }}
                />
              )
            })}
            <Disc
              discState={currentFrame.discState}
              fieldWidth={fieldW}
              fieldHeight={fieldH}
              onDragEnd={(newState) => updateFrameDiscState(currentFrameIndex, newState)}
            />
          </Layer>
        </Stage>
      </div>

      {/* 帧选择器 */}
      <FrameBar
        frames={board.data.frames}
        currentFrameIndex={currentFrameIndex}
        onSelectFrame={setCurrentFrame}
        onAddFrame={addFrame}
        onRemoveFrame={removeFrame}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/BoardCanvas.jsx
git commit -m "feat: BoardCanvas — responsive Konva stage with auto-save"
```

---

## Task 14: BoardList.jsx + App.jsx — 首页与路由

**Files:**
- Create: `client/src/components/BoardList.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: 创建 client/src/components/BoardList.jsx**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBoards, createBoard, deleteBoard } from '../api/boards'
import { createDefaultBoardData } from '../utils/defaultBoardData'

const STYLES = {
  page: { maxWidth: 800, margin: '60px auto', padding: '0 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold' },
  createBtn: {
    padding: '10px 20px', background: '#4a9eff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15,
  },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', background: '#1a1a2e', borderRadius: 10,
    marginBottom: 12, cursor: 'pointer', border: '1px solid #2a2a4e',
  },
  cardName: { fontSize: 17, fontWeight: '500' },
  cardDate: { fontSize: 12, color: '#888', marginTop: 4 },
  deleteBtn: {
    padding: '6px 14px', background: 'transparent', color: '#e57373',
    border: '1px solid #e57373', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
}

export default function BoardList() {
  const [boards, setBoards] = useState([])
  const navigate = useNavigate()

  useEffect(() => { listBoards().then(setBoards) }, [])

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

  return (
    <div style={STYLES.page}>
      <div style={STYLES.header}>
        <h1 style={STYLES.title}>飞盘战术板</h1>
        <button style={STYLES.createBtn} onClick={handleCreate}>+ 新建战术板</button>
      </div>

      {boards.length === 0 && (
        <p style={{ color: '#666', textAlign: 'center', marginTop: 80 }}>
          还没有战术板，点击右上角新建一个
        </p>
      )}

      {boards.map(board => (
        <div key={board.id} style={STYLES.card} onClick={() => navigate(`/board/${board.id}`)}>
          <div>
            <div style={STYLES.cardName}>{board.name}</div>
            <div style={STYLES.cardDate}>
              {new Date(board.updated_at).toLocaleString('zh-CN')}
            </div>
          </div>
          <button style={STYLES.deleteBtn} onClick={(e) => handleDelete(e, board.id)}>删除</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 更新 client/src/App.jsx**

```jsx
import { Routes, Route, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import BoardList from './components/BoardList'
import BoardCanvas from './components/BoardCanvas'
import { getBoard } from './api/boards'
import { useBoardStore } from './store/boardStore'

function BoardPage() {
  const { id } = useParams()
  const setBoard = useBoardStore(s => s.setBoard)

  useEffect(() => {
    getBoard(id).then(board => { if (board) setBoard(board) })
  }, [id])

  return <BoardCanvas />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardList />} />
      <Route path="/board/:id" element={<BoardPage />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/BoardList.jsx client/src/App.jsx
git commit -m "feat: board list home page and routing"
```

---

## Task 15: 端到端验证

- [ ] **Step 1: 创建 server/.env（复制 .env.example 并填写真实 DB URL）**

```bash
cp server/.env.example server/.env
# 编辑 server/.env，填入本机 PostgreSQL 连接串
# 例：DATABASE_URL=postgres://postgres:password@localhost:5432/tactics_board
```

- [ ] **Step 2: 确保 DB Schema 已执行**

```bash
psql $DATABASE_URL -f server/src/db/schema.sql
```

- [ ] **Step 3: 启动后端**

```bash
cd server && npm run dev
# 预期：Server running on port 3001
```

- [ ] **Step 4: 启动前端**

```bash
cd client && npm run dev
# 预期：Local: http://localhost:5173
```

- [ ] **Step 5: 浏览器验证**

打开 `http://localhost:5173`，验证以下功能：
1. 首页显示空列表，有"新建战术板"按钮
2. 点击新建，输入名称，跳转到战术板页面
3. 看到绿色场地，14名球员（红7 + 蓝7）+ 黄色飞盘
4. 拖动任意球员，位置更新，顶部出现"保存中…"提示后消失
5. 点击"+"添加新帧，帧选择器显示两帧
6. 切换帧，球员位置恢复为第1帧的状态（确认帧独立）
7. 返回首页，战术板出现在列表中
8. 刷新页面后打开战术板，球员位置与上次拖动结果一致（确认持久化）
9. 双击球员，输入新名字，圆圈内文字更新

- [ ] **Step 6: 运行所有测试**

```bash
cd server && npm test
cd ../client && npm test
```

预期：所有测试通过

- [ ] **Step 7: 最终 Commit**

```bash
git add .
git commit -m "feat: Phase 1 complete — static tactics board with persistence"
```

---

## 自审检查

**Spec 覆盖：**
- ✅ 网站形式
- ✅ 场地渲染（含端区、中线）
- ✅ 红/蓝队各7人，可自定义名字
- ✅ 飞盘独立元素，可拖拽
- ✅ 归一化坐标，跨设备一致
- ✅ 多帧管理（添加/删除/切换），每帧独立状态
- ✅ 自动保存到 PostgreSQL
- ✅ 战术板列表（创建/打开/删除）
- ⏭ 视野锥 — Phase 2
- ⏭ 标注工具 — Phase 2
- ⏭ 动画播放 — Phase 2
- ⏭ 实时协作 — Phase 2
- ⏭ 分享链接 — Phase 2

**类型一致性：** `playerState` 在 store、Player.jsx、coords.js 中均为 `{ x, y, orientation }`；`discState` 均为 `{ x, y }`；frame 结构贯穿始终。

**无占位符：** 所有 Task 均包含完整代码。
