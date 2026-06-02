import { Arrow } from 'react-konva'

// 一条箭头。pass=虚线，run=实线。hitStrokeWidth 加宽命中区，细线也好点选/右键。
export default function ArrowAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening }) {
  const { x1, y1, x2, y2, variant, color } = annotation
  return (
    <Arrow
      points={[x1 * fieldWidth, y1 * fieldHeight, x2 * fieldWidth, y2 * fieldHeight]}
      stroke={color}
      fill={color}
      strokeWidth={selected ? 5 : 3}
      dash={variant === 'pass' ? [10, 6] : undefined}
      pointerLength={12}
      pointerWidth={12}
      hitStrokeWidth={15}
      listening={listening}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
