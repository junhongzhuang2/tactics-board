import { Fragment } from 'react'
import { Rect } from 'react-konva'
import Handle from './Handle'
import { translateAnnotation } from '../utils/annotations'

export default function RectAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, listening, draggable, onMoveCommit, onResizePreview, onResizeCommit }) {
  const { x1, y1, x2, y2, color } = annotation
  const left = Math.min(x1, x2) * fieldWidth
  const top = Math.min(y1, y2) * fieldHeight
  const w = Math.abs(x2 - x1) * fieldWidth
  const h = Math.abs(y2 - y1) * fieldHeight
  return (
    <Fragment>
      <Rect
        x={left} y={top} width={w} height={h}
        stroke={color} strokeWidth={selected ? 5 : 3}
        fill="rgba(0,0,0,0.001)" hitStrokeWidth={15}
        listening={listening}
        draggable={draggable}
        shadowColor={selected ? '#ffffff' : undefined}
        shadowBlur={selected ? 8 : 0}
        shadowForStrokeEnabled={true}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
        onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
        onDragEnd={(e) => {
          const dx = e.target.x() / fieldWidth - Math.min(x1, x2)
          const dy = e.target.y() / fieldHeight - Math.min(y1, y2)
          e.target.position({ x: left, y: top }) // 复位；提交后由新 props 重新定位
          onMoveCommit?.(translateAnnotation(annotation, dx, dy))
        }}
      />
      {selected && onResizeCommit && (
        <Fragment>
          <Handle key="tl" x={x1 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="tr" x={x2 * fieldWidth} y={y1 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y1: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y1: py / fieldHeight })} />
          <Handle key="bl" x={x1 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x1: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x1: px / fieldWidth, y2: py / fieldHeight })} />
          <Handle key="br" x={x2 * fieldWidth} y={y2 * fieldHeight}
            onDragMove={(px, py) => onResizePreview?.({ x2: px / fieldWidth, y2: py / fieldHeight })}
            onDragEnd={(px, py) => onResizeCommit?.({ x2: px / fieldWidth, y2: py / fieldHeight })} />
        </Fragment>
      )}
    </Fragment>
  )
}
