# 静态部署 + 本地存储 设计文档

> 把战术板从「全栈(React + Express + PostgreSQL)」改造成「纯前端静态站」:战术板存浏览器 localStorage、托管到 GitHub Pages,别人打开网址即可各自使用,分享靠录屏。**替换原 roadmap 的「D 分享链接」**(实时/后端分享过重,改走静态 + 本地存储)。

## 1. 目标与范围

**做什么:**
- 把 `api/boards.js` 的实现从「`fetch` 后端」换成「浏览器 `localStorage`」(函数签名不变,前端其余零改动)。
- 路由改 `HashRouter`(GitHub Pages 静态托管下刷新子页不 404)。
- Vite `base` 设为子路径 `/tactics-board/`(构建时);新增 GitHub Actions 自动部署到 Pages。

**结果:** 别人打开 `junhongzhuang2.github.io/tactics-board/` → 直接画战术板;数据存各自浏览器本地(独立、不共享);分享某战术靠录屏。

**不做(YAGNI / 已确认取舍):** 跨设备/跨人共享数据、实时协作、分享 token、后端/数据库部署。`server/` 目录**保留不删**(以后想做共享版可复用,部署不带它)。本地存储丢失(清缓存/换设备)可接受。

## 2. 方案

`api/boards.js` 是唯一的「后端边界」——`listBoards`/`getBoard`/`createBoard`/`saveBoard`/`deleteBoard` 五个 async 函数,所有调用方(`App.jsx` 加载、`BoardList.jsx`、`useAutoSave.js`)只经过它。**只替换这一个文件的实现**(fetch → localStorage),保持签名,前端其余不动。加上 HashRouter(静态路由)、Vite base + Actions(部署)。

已排除:IndexedDB(容量大但 API 复杂,对几十个板过度);`BrowserRouter` + 404.html 重定向 hack(不如 HashRouter 可靠);手动 `gh-pages` 部署(不如 Actions 自动)。

## 3. 本地存储实现(`client/src/api/boards.js`)

整文件替换为 localStorage 版,**5 个函数签名不变、仍 async**(调用方零改动)。单 key 存数组;board 形状沿用现有前端用法 `{ id, name, data, created_at, updated_at }`(ISO 字符串;`BoardList` 用 `board.updated_at`/`name`/`id`,`App` 用 `board.data`)。

```
KEY = 'tactics-board:boards'
readAll()      → 解析 localStorage[KEY]，失败/缺失兜底 []
writeAll(arr)  → localStorage[KEY] = JSON.stringify(arr)
newId()        → `board-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
now()          → new Date().toISOString()

listBoards()            → readAll() 按 updated_at 倒序返回（最新在前）
getBoard(id)            → readAll().find(b=>b.id===id) ?? null
createBoard(name, data) → board={id:newId(), name, data, created_at:now(), updated_at:now()}；writeAll([...all, board])；返回 board
saveBoard(id, fields)   → 把匹配项替换为 { ...board, ...fields, updated_at:now() }；writeAll
deleteBoard(id)         → writeAll(all.filter(b=>b.id!==id))
```
仍 `async`(返回 Promise),localStorage 同步操作包在其中。自动保存照常调 `saveBoard`,只是写本地(同步、不会网络失败;`useAutoSave` 的重试/竞态逻辑保留但永远走成功路径,无害,本次不动)。

## 4. 路由(`client/src/main.jsx`)

`BrowserRouter` → `HashRouter`(仅改 import + 标签);App 内 `Routes`/`Route`/`useParams`/`Link` 不动。URL 变 `…/tactics-board/#/` 与 `…/tactics-board/#/board/xxx`。`#` 后路径在前端处理,刷新任意页不 404。

## 5. 部署(Vite base + GitHub Actions)

**`client/vite.config.js`:**
```js
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tactics-board/' : '/',
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], globals: true },
}))
```
(构建用子路径前缀,本地 dev 用根;删掉无用的 `server.proxy`。HashRouter 路径在 `#` 后,不受 base 影响。)

**`.github/workflows/deploy.yml`(新建):** push main → 在 `client/` 里 `npm ci` + `npm run build` → `upload-pages-artifact`(path `client/dist`)→ `deploy-pages`。权限 `pages: write` / `id-token: write`,`environment: github-pages`。

**一次性手动设置:** GitHub 仓库 Settings → Pages → Source 选 **GitHub Actions**。之后每次 push main 自动上线。

## 6. 测试

- **单测(TDD)** `client/src/api/boards.test.js`(jsdom 自带 localStorage,`beforeEach` 清空):create→list 含它;getBoard 命中 / 未命中→null;saveBoard 改 name/data 并更新 updated_at;deleteBoard;listBoards 按 updated_at 倒序;损坏 JSON 兜底 `[]`。
- **现有测试不受影响**:`BoardList.test`(mock `../api/boards`)、`useAutoSave.test`(mock `saveBoard`)仍 mock,继续全绿。
- **无自动化测试**(配置 + 集成,人工冒烟):
  1. 本地 `npm run dev`:新建/画/自动保存、**刷新页面数据还在**(localStorage)、删除、多板列表正常。
  2. `npm run build` 成功;`npm run preview` 在 `/tactics-board/` 子路径下资源正常。
  3. push 后 Actions 绿、访问 `junhongzhuang2.github.io/tactics-board/` 能用、刷新子页不 404。

## 7. 文件清单

- **Modify** `client/src/api/boards.js` — localStorage 实现(5 函数签名不变)。
- **Create** `client/src/api/boards.test.js` — 本地存储单测。
- **Modify** `client/src/main.jsx` — `BrowserRouter` → `HashRouter`。
- **Modify** `client/vite.config.js` — `base`(构建子路径)+ 删 `server.proxy`。
- **Create** `.github/workflows/deploy.yml` — Pages 自动部署。

> `server/` 保留不删(部署不带它)。无 DB 迁移;无数据迁移(本地存储全新,开发用的 Postgres 测试板不带过来,可接受)。

## 8. 单元边界

`api/boards`(本地存储边界,单一职责、jsdom 可测)是唯一实现改动;前端其余(App/BoardList/BoardCanvas/useAutoSave)靠该边界签名不变而**零改动**;`main.jsx`(路由)、`vite.config`(base)、`deploy.yml`(CI)是三处独立配置。每块职责单一、边界清晰。
