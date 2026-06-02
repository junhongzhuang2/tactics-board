import { Rect } from 'react-konva'

// 矩形标注（描边空心）。两角归一化 → 包围盒。透明填充使内部整体可点选，视觉仍空心。
// 选中用 shadowBlur 高亮，必须配 shadowForStrokeEnabled 否则空心边框无阴影。
export default function RectAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x1, y1, x2, y2, color } = annotation
  const left = Math.min(x1, x2) * fieldWidth
  const top = Math.min(y1, y2) * fieldHeight
  const w = Math.abs(x2 - x1) * fieldWidth
  const h = Math.abs(y2 - y1) * fieldHeight
  return (
    <Rect
      x={left}
      y={top}
      width={w}
      height={h}
      stroke={color}
      strokeWidth={selected ? 5 : 3}
      fill="rgba(0,0,0,0.001)"
      hitStrokeWidth={15}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      shadowForStrokeEnabled={true}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
