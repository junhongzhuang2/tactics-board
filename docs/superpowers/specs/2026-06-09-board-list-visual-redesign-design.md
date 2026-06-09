# 战术板列表页视觉升级 — 设计

日期：2026-06-09
状态：已确认

## 背景与目标

战术板列表 / 创建页（`client/src/components/BoardList.jsx`）目前外观过于朴素：纯深蓝背景（`#1a1a2e`）+ 左标题右按钮 + 简单卡片列表。用户希望提升视觉效果，让着陆页好看、有飞盘运动主题感。

本次只做**视觉与布局升级**，不改动新建/重命名/删除/导航的业务逻辑与数据模型。

## 已确认的设计决策

1. **视觉大方向：A 运动球场风**
   - 背景：深绿对角渐变 `linear-gradient(160deg, #0d3b2e 0%, #15543f 55%, #1d6b4f 100%)`
   - 草坪线暗纹：横向 `repeating-linear-gradient`，每 ~40px 一条 `rgba(255,255,255,.04)` 细线
   - 主强调色：飞盘黄 `#ffd23f`

2. **顶部 Hero（居中）**
   - 🥏 图标 + 标题「飞盘战术板」+ 副标题「讲解战术 · 复盘跑位」
   - 标题居中，**移除右上角的新建按钮**（解决「左标题右按钮」的不对称感）

3. **新建战术板（交互保持不变）**
   - 列表最上方一张飞盘黄虚线卡片「＋ 新建战术板」
   - 点击仍调用现有 `handleCreate()` → `prompt()` 流程，逻辑零改动
   - 该虚线卡片**始终存在**（空状态时也在）

4. **战术板卡片升级**
   - 半透明白底 `rgba(255,255,255,.07)` + 飞盘黄左竖条（`border-left: 4px solid #ffd23f`）+ 圆角
   - 左侧：名字（粗体）+ 日期（淡色）
   - 右侧：重命名 + 删除按钮（幽灵按钮样式）
   - 鼠标悬停：卡片轻微提亮 / 上浮，使用 CSS `transition`
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
  - 新增少量类用于 hover/transition：如 `.board-card`（卡片提亮上浮）、`.add-card`（虚线卡片 hover 高亮）
  - 配色用 CSS 变量或直接写值，保持与 STYLES 一致

- **`client/index.html`**
  - body 背景从 `#1a1a2e` 改为深绿球场渐变 + 草坪线暗纹（让整页背景统一，避免页面外溢区域露出旧色）
  - 注：草坪线暗纹用固定背景，渐变用 `background-attachment: fixed` 或在 page 容器上铺满

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
