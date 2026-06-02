import { Text } from 'react-konva'
import { DEFAULT_FONT_PX } from '../utils/annotations'

// 文字标注。单点锚（左上）+ 固定屏幕字号（不随画布缩放）。文字本身即命中区。
export default function TextAnnotation({ annotation, fieldWidth, fieldHeight, selected, onSelect, onDelete }) {
  const { x, y, text, color } = annotation
  return (
    <Text
      x={x * fieldWidth}
      y={y * fieldHeight}
      text={text}
      fontSize={DEFAULT_FONT_PX}
      fontStyle="bold"
      fill={color}
      shadowColor={selected ? '#ffffff' : undefined}
      shadowBlur={selected ? 8 : 0}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(annotation.id) }}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onDelete?.() }}
    />
  )
}
