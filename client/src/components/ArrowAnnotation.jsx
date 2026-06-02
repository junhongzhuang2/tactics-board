import { Fragment } from 'react'
import { Arrow } from 'react-konva'
import Handle from './Handle'
import { translateAnnotation } from '../utils/annotations'

export default function ArrowAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening, draggable, onMoveCommit, onResizePreview, onResizeCommit }) {
  const { x1, y1, x2, y2, variant, color } = annotation
  return (
    <Fragment>
      <Arrow
        points={[x1 * fieldWidth, y1 * fieldHeight, x2 * fieldWidth, y2 * fieldHeight]}
        stroke={color} fill={color}
        strokeWidth={selected ? 5 : 3}
        dash={variant === 'pass' ? [10, 6] : undefined}
        pointerLength={12} pointerWidth={12} hitStrokeWidth={15}
        listening={listening}
        draggable={draggable}
        shadowColor={selected ? '#ffffff' : undefined}
        shadowBlur={selected ? 8 : 0}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
        onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onDragEnd={(e) => {
          const dx = e.target.x() / fieldWidth
          const dy = e.target.y() / fieldHeight
          e.target.position({ x: 0, y: 0 }) // points 是绝对坐标，offset 已并入 patch，必须复位
          onMoveCommit?.(translateAnnotation(annotation, dx, dy))
        }}
      />
      {selected && onResizeCommit && (
        <Fragment>
          <Handle key="p1" x={x1 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="p2" x={x2 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y2: py / fieldHeight })} />
        </Fragment>
      )}
    </Fragment>
  )
}
