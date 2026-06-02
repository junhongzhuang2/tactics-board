import { Text } from 'react-konva'
import { DEFAULT_FONT_PX, translateAnnotation } from '../utils/annotations'

export default function TextAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete, onEdit, listening, draggable, onMoveCommit }) {
  const { x, y, text, color, width } = annotation
  return (
    <Text
      x={x * fieldWidth}
      y={y * fieldHeight}
      text={text}
      fontSize={DEFAULT_FONT_PX}
      fontStyle="bold"
      fill={color}
      width={width != null ? width * fieldWidth : undefined}
      wrap="word"
      listening={listening}
      draggable={draggable}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onDblClick={(e) => { e.cancelBubble = true; onEdit?.() }}
      onDblTap={(e) => { e.cancelBubble = true; onEdit?.() }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
      onDragStart={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onDragEnd={(e) => {
        const dx = e.target.x() / fieldWidth - x
        const dy = e.target.y() / fieldHeight - y
        onMoveCommit?.(translateAnnotation(annotation, dx, dy))
      }}
    />
  )
}
