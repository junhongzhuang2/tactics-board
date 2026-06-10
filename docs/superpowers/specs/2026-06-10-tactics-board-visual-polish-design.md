# 战术板高级视觉升级 设计

日期：2026-06-10
状态：已确认

## 背景与目标

战术板编辑界面（`BoardCanvas`）目前是纯黑底 + 生硬的深色控件块 + 高饱和原红/原蓝球员。希望升级为一套自洽的「深夜球场推演」视觉语言：外场暗流微光、球场柔影、全站毛玻璃控件、哑光球员色、飞盘悬浮投影、专业剪辑软件式的关键帧时间轴。目标是给教练营造「深夜坐在体育场顶层看台俯瞰聚光灯球场」的沉浸推演感。

纯前端样式/Konva 渲染改动，不引入新依赖、不改数据结构、不改交互逻辑。

## 已确认的设计决策

- 球场柔影加在 **Konva 的球场底层 Rect** 上（不是容器 div），才能呈现「球场浮起」。
- 毛玻璃统一套到 **4 个实际存在的栏**：顶栏、画笔栏（`AnnotationToolbar`）、阵型栏、时间轴。当前代码无右下角圆形 FAB，本次不新增。
- 改过的关键帧标记 = **数字下方一颗飞盘黄 `#ffd23f` 小圆点**；普通帧 = 一颗浅灰半透明小点。
- 球员圆圈内渲染的是中文名（截前 3 字），不是号码，故**不引入英文 web font**（对中文无意义，YAGNI）；仅调字重/字号/内边距。

## ① 外场暗流微光 + 球场柔影

### 外场微光背景

`BoardCanvas.jsx` 画布容器（`containerRef` 那个 div，当前 `background:'#0d0d1a'`，约 373 行）改为径向渐变：

```js
background: 'radial-gradient(ellipse at center, #081e16 0%, #040b08 80%)'
```

墨绿微光垫在球场正后方中心，向四周淡出到近黑。

### 球场柔影

`Field.jsx` 的底层球场矩形 Rect（`FIELD_COLOR` 那个铺满球场区域的 Rect）加 Konva 阴影属性：

```jsx
shadowColor="#000000"
shadowBlur={32}
shadowOffset={{ x: 0, y: 12 }}
shadowOpacity={0.5}
```

球场矩形在暗场容器里向下投出一圈柔影，浮在看台之上。仅加在最外层球场 Rect 上，端区白线/文字等不单独加阴影。

## ② 全站毛玻璃 + 呼吸态按钮

### 毛玻璃栏底（统一令牌）

4 个栏的容器统一改为：

```css
background: rgba(17, 24, 20, 0.55);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
/* 顶栏用 border-bottom，底部各栏用 border-top */
border-color: rgba(255, 255, 255, 0.08);
```

替换现有的 `background:'#111'` + `border:'1px solid #333'`。低饱和度墨绿调半透明，背后内容透出虚化。

- **顶栏**：`BoardCanvas.jsx` 约 277 行的内联 style。
- **画笔栏**：`AnnotationToolbar.jsx` 容器。
- **阵型栏**：`BoardCanvas.jsx` 约 555 行的内联 style。
- **时间轴栏**：`Timeline.jsx` `STYLES.bar`。

### 非激活按钮（隐入毛玻璃）

顶栏/阵型栏/时间轴里的普通按钮（← 返回、+ 盘、⏮⏭▶⏸🔁、＋ 插帧等）：

- 文字/图标色：`rgba(255, 255, 255, 0.6)`
- 去掉 `1px solid #555` 硬边框（改为 `border: none` 或透明边框）
- 底色：透明或极淡（隐入毛玻璃栏底）
- hover 态：文字提亮到 `rgba(255,255,255,0.9)`，底色微亮 `rgba(255,255,255,0.06)`

### 激活态（细腻外发光）

当前用生硬高亮蓝块 `#4a9eff`（Timeline）/ 各处激活态，统一改为荧光蓝呼吸态：

```css
color: #38bdf8;                              /* 或文字/图标变荧光蓝 */
background: rgba(56, 189, 248, 0.15);        /* 淡蓝底 */
box-shadow: 0 0 12px rgba(56, 189, 248, 0.3); /* 外发光 */
```

应用到：循环按钮开启态（`Timeline.STYLES.toggleOn`）、画笔栏的「本帧/全局」「选择」等激活态（`AnnotationToolbar`）。当前帧/活动帧的激活高亮见 ③ 的滑块方案。

## ③ 关键帧具象化 + 丝滑滑块

`Timeline.jsx` 帧轨道（`STYLES.track` + 帧块 map）重做。

### 帧块本体

从「实心彩色块」（`STYLES.frame` 现在 active 时 `#4a9eff` 实心）改为低调毛玻璃块：

- 统一底色：`rgba(255, 255, 255, 0.06)`，无硬边框（或 `1px solid rgba(255,255,255,0.08)`）
- 数字居中，色 `rgba(255,255,255,0.6)`；当前活动帧数字提亮为 `#38bdf8`
- 不再靠帧块自身背景表达「当前帧」——当前帧由滑块高亮层表达（见下）

### 改过标记（关键战术发生）

新增纯函数（放 `client/src/utils/` 下，建议 `frameStatus.js`）：

```js
// 一帧是否被教练手动改过：有标注，或任一 player/disc 带贝塞尔曲率 ctrl
export function isFrameModified(frame) {
  if (frame.annotations && frame.annotations.length > 0) return true
  for (const id in frame.playerStates) {
    if (frame.playerStates[id]?.ctrl) return true
  }
  for (const id in (frame.discStates ?? {})) {
    if (frame.discStates[id]?.ctrl) return true
  }
  return false
}
```

每个帧块底部渲染一颗小圆点：

- 改过的帧：`#ffd23f`（飞盘黄）实心小圆点
- 普通帧：`rgba(255, 255, 255, 0.25)` 浅灰半透明小圆点

小圆点绝对定位在帧块底部居中（如 `bottom: 4px`，直径约 5px）。

### 丝滑滑块 playhead（当前帧高亮）

在 track 内新增一个绝对定位的高亮层，表示「当前活动帧」（`activeFrameIndex`），并在切帧时平滑滑动：

- 样式：荧光蓝描边/淡底 + 外发光，`border-radius: 6px`
  ```css
  background: rgba(56, 189, 248, 0.15);
  border: 2px solid #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
  pointer-events: none;
  ```
- 动画：`transition: left .25s cubic-bezier(.16,1,.3,1), width .25s cubic-bezier(.16,1,.3,1)`
- 定位：帧块宽度按时长 flex 不等宽，故高亮层的 `left`/`width` 需用帧块的真实像素位置计算。给每个帧块挂 ref（或一个 refs 数组），用 `getBoundingClientRect()` 相对 track 容器算出活动帧块的 `offsetLeft`/`offsetWidth`，存入 state，渲染到高亮层。在 `activeFrameIndex` 变化、容器 resize、帧增删时重算。
- 红色精确播放头竖线（`STYLES.playhead`，跟 `playheadTime` 走）**保留不变**，与滑块叠加（滑块=当前帧块，竖线=精确时间）。

实现注意：滑块测量用 `useLayoutEffect` + `ResizeObserver`（或监听依赖项变化），避免首帧闪烁。

## ④ 哑光球员色 + 飞盘悬浮投影

### 球员色

`Player.jsx`：

```js
const TEAM_COLORS = { red: '#ef4444', blue: '#3b82f6' }  // 哑光珊瑚红 / 科技海洋蓝
const FONT_SIZE = 11                                       // 13 → 11，更透气
```

名字 Text 的 `fontStyle="bold"` → `fontStyle="500"`。圆半径 `PLAYER_RADIUS` 不变（缩字号即留出内边距）。

### 飞盘悬浮投影

`Disc.jsx` 黄色主圆 Circle 加 Konva 阴影：

```jsx
shadowColor="black"
shadowBlur={8}
shadowOffset={{ x: 2, y: 5 }}
shadowOpacity={0.4}
```

向右下偏移的立体阴影，让飞盘视觉上「飞离草坪、悬浮在球员头顶上空」。内圈装饰圆不单独加阴影。

## 文件清单

- 修改：`client/src/components/BoardCanvas.jsx`（容器背景、顶栏 + 阵型栏毛玻璃）
- 修改：`client/src/components/Field.jsx`（球场 Rect 柔影）
- 修改：`client/src/components/AnnotationToolbar.jsx`（毛玻璃栏底 + 激活态）
- 修改：`client/src/components/Timeline.jsx`（毛玻璃栏 + 按钮呼吸态 + 帧块重做 + 滑块 playhead）
- 修改：`client/src/components/Player.jsx`（哑光色 + 字重/字号）
- 修改：`client/src/components/Disc.jsx`（投影）
- 新建：`client/src/utils/frameStatus.js`（`isFrameModified` 纯函数）
- 新建：`client/src/utils/frameStatus.test.js`（单测）

## 测试

- `isFrameModified` 纯函数单测：空帧 → false；有 annotations → true；player state 带 ctrl → true；disc state 带 ctrl → true；无 ctrl 无标注 → false；缺省 discStates 不报错。
- Timeline 渲染断言：改过的帧渲染飞盘黄点、普通帧渲染浅灰点（按 testid 或样式断言其一）；滑块高亮层存在。
- 现有 179 测试不回归。
- 视觉细节（毛玻璃、微光、柔影、投影、滑块动画）靠浏览器人工验收。

## 非目标（本次不做）

- 不新增右下角 FAB（当前不存在）。
- 不引入英文 web font 或任何新依赖。
- 不改动画/插值/撤销重做等任何交互逻辑与数据结构。
- 不改列表页（`BoardList`）视觉——本次只动战术板编辑界面。
- 不做主题切换/可配置色板。
