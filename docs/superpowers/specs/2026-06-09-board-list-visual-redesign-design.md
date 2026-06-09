# 战术板列表页视觉升级 — 设计

日期：2026-06-09
状态：已确认

## 背景与目标

战术板列表 / 创建页（`client/src/components/BoardList.jsx`）目前外观过于朴素：纯深蓝背景（`#1a1a2e`）+ 左标题右按钮 + 简单卡片列表。用户希望提升视觉效果，让着陆页好看、有飞盘运动主题感。

本次只做**视觉与布局升级**，不改动新建/重命名/删除/导航的业务逻辑与数据模型。

## 已确认的设计决策

1. **视觉大方向：A 运动球场风 + Pitch Glow 呼吸微光**
   - 底色：深绿对角渐变 `linear-gradient(160deg, #0d3b2e 0%, #15543f 55%, #1d6b4f 100%)`
   - **Pitch Glow（呼吸微光）**：放弃密集草坪白线，改用两团大面积径向光晕（`radial-gradient`）模拟球场聚光灯——一团飞盘黄暖光（左上）、一团青绿冷光（右下），各自缓慢明灭/缩放（`@keyframes` breathing，约 7s / 9s，错相位），营造动态呼吸感
   - 主强调色：飞盘黄 `#ffd23f`

2. **顶部 Hero（居中）**
   - 🥏 图标 + 标题「飞盘战术板」+ 副标题「讲解战术 · 复盘跑位」
   - 标题居中，**移除右上角的新建按钮**（解决「左标题右按钮」的不对称感）

3. **新建战术板（交互保持不变）**
   - 列表最上方一张飞盘黄虚线卡片「＋ 新建战术板」
   - 点击仍调用现有 `handleCreate()` → `prompt()` 流程，逻辑零改动
   - 该虚线卡片**始终存在**（空状态时也在）

4. **战术板卡片升级（精致版）**
   - **毛玻璃**：半透明白底 `rgba(255,255,255,.06)` + `backdrop-filter: blur(10px)`（含 `-webkit-` 前缀），透出底层 Pitch Glow
   - **隐式边缘高亮**：放弃实心黄竖条，左缘改用内阴影柔光 `box-shadow: inset 6px 0 14px -8px rgba(255,210,63,.9)`，更含蓄
   - **细字重**：日期、副标题用 `font-weight: 300`；名字保持 `font-weight: 500` 保证可读
   - 左侧：名字 + 日期；右侧：重命名 + 删除按钮（幽灵按钮）
   - **交互式浮现**：重命名/删除按钮默认 `opacity: 0.5`，鼠标悬停在卡片上时淡入（`opacity: 1`，`transition`）；悬停按钮本身时变色——重命名→蓝（`#7db4ff` 字 + 蓝底微光）、删除→红（`#ff8a80` 字 + 红底微光）
   - **卡片悬停**：轻微上浮 `translateY(-2px)` + 提亮 + 投影，`transition`
   - **不显示阵型标签**（如「7v7」）——当前数据模型无阵型字段，不引入

5. **空状态**
   - 没有战术板时，虚线新建卡片依然在，其下方显示友好的居中空态：🥏 图标 + 「还没有战术板，点上方新建一个」
   - 替换现有的一行灰字 `还没有战术板，点击右上角新建一个`

## 技术实现

- **`client/src/components/BoardList.jsx`**
  - 重写 `STYLES` 对象：page / hero / logo / title / subtitle / addCard / card / cardName / cardDate / actions / renameBtn / deleteBtn / empty
  - DOM 结构调整：header 改为居中 hero；新增虚线新建卡片作为列表首项；空状态文案更新
  - hover 效果需要 `:hover`，内联 style 无法表达 → 引入 CSS 类（见下）
  - 业务函数 `handleCreate` / `handleDelete` / `handleRename` / `useEffect` 加载逻辑保持不变

- **`client/src/index.css`**（当前为空）
  - 承载所有伪元素 / 动画 / hover / backdrop-filter（内联 style 无法表达）：
    - `@keyframes breatheA` / `breatheB`：Pitch Glow 两团光晕的明灭+缩放
    - Pitch Glow 用 page 容器的 `::before` / `::after` 绝对定位径向光实现
    - `.board-card`：毛玻璃 + 隐式边缘高亮 + hover 上浮/提亮
    - `.board-card .card-actions`：默认 `opacity:.5`，`.board-card:hover .card-actions { opacity:1 }`
    - `.rename-btn:hover`（蓝）、`.delete-btn:hover`（红）
    - `.add-card`：虚线卡片 hover 高亮
  - 静态布局值仍可留在 STYLES 内联对象；动态部分走 class

- **`client/index.html`**
  - body 背景从 `#1a1a2e` 改为深绿对角渐变（纯渐变兜底，避免页面外溢区域露出旧深蓝）
  - Pitch Glow 呼吸光晕在 BoardList 的 page 容器内实现（伪元素 + 动画），**不放 body**，便于动画与组件共存

## 测试影响

- `client/src/components/BoardList.test.jsx`
  - 空状态断言文案变化（「还没有战术板…」措辞调整）需要同步更新
  - 新建入口从右上角 button 改为虚线卡片：若测试用文案 / role 定位「新建」入口，需更新 selector，但文案「新建战术板」保留，点击仍触发 `handleCreate`
  - 重命名 / 删除 / 导航相关测试逻辑不变，仅在 DOM 结构调整后确认 selector 仍有效

## 非目标（本次不做）

- 不改新建交互（保持 `prompt()`）
- 不加阵型字段 / 战术板缩略图预览
- 不动战术板编辑页（`BoardCanvas`）的外观
- 不做网格布局（沿用单列列表）
