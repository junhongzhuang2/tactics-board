import { useState } from 'react'
import { Circle, Shape } from 'react-konva'

const HANDLE_R = 7
const clamp = (v) => Math.min(1, Math.max(0, v))

// 一段轨迹的曲率手柄：贝塞尔虚线预览 + 中点可拖小圆。坐标用归一化，内部转 canvas。
// 拖动中本地预览（不写 store），松手 onCommit；双击 onClear 回直线。事件 cancelBubble 防闪退。
export default function TrajectoryHandle({ p0, p1, ctrl, fieldWidth, fieldHeight, onCommit, onClear }) {
  const initial = ctrl ?? { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const [preview, setPreview] = useState(null) // 拖动预览（归一化）；null 用 initial
  const cur = preview ?? initial
  const cx = (nx) => nx * fieldWidth
  const cy = (ny) => ny * fieldHeight

  return (
    <>
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.moveTo(cx(p0.x), cy(p0.y))
          ctx.quadraticCurveTo(cx(cur.x), cy(cur.y), cx(p1.x), cy(p1.y))
          ctx.strokeShape(shape)
        }}
        stroke="#4a9eff"
        strokeWidth={2}
        dash={[8, 6]}
        listening={false}
      />
      <Circle
        x={cx(cur.x)}
        y={cy(cur.y)}
        radius={HANDLE_R}
        fill="#ffffff"
        stroke="#4a9eff"
        strokeWidth={2}
        draggable
        onDragStart={(e) => { e.cancelBubble = true }}
        onDragMove={(e) => {
          e.cancelBubble = true
          setPreview({ x: e.target.x() / fieldWidth, y: e.target.y() / fieldHeight })
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true
          const c = { x: clamp(e.target.x() / fieldWidth), y: clamp(e.target.y() / fieldHeight) }
          e.target.position({ x: cx(c.x), y: cy(c.y) }) // 复位到 clamp 后位置（提交后由新 props 重新定位，防异步闪回）
          setPreview(null)
          onCommit(c)
        }}
        onClick={(e) => { e.cancelBubble = true }}
        onTap={(e) => { e.cancelBubble = true }}
        onDblClick={(e) => { e.cancelBubble = true; setPreview(null); onClear?.() }}
        onDblTap={(e) => { e.cancelBubble = true; setPreview(null); onClear?.() }}
      />
    </>
  )
}
