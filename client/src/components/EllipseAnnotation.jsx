import { Ellipse } from 'react-konva'

// 椭圆标注（描边空心）。两角包围盒内切：center=中点，radiusX/Y=半宽/半高。
export default function EllipseAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x1, y1, x2, y2, color } = annotation
  const cx = ((x1 + x2) / 2) * fieldWidth
  const cy = ((y1 + y2) / 2) * fieldHeight
  const rx = (Math.abs(x2 - x1) / 2) * fieldWidth
  const ry = (Math.abs(y2 - y1) / 2) * fieldHeight
  return (
    <Ellipse
      x={cx}
      y={cy}
      radiusX={rx}
      radiusY={ry}
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
