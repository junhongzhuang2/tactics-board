import { Rect } from 'react-konva'

const SIZE = 10

// 通用可拖句柄（小方块）。x,y 为中心（相对图层的像素）。回调给出新的中心像素。
export default function Handle({ x, y, onDragMove, onDragEnd }) {
  return (
    <Rect
      x={x - SIZE / 2}
      y={y - SIZE / 2}
      width={SIZE}
      height={SIZE}
      fill="#ffffff"
      stroke="#4a9eff"
      strokeWidth={1}
      draggable
      onMouseDown={(e) => { e.cancelBubble = true }}
      onDragStart={(e) => { e.cancelBubble = true }}
      onDragMove={(e) => { e.cancelBubble = true; onDragMove?.(e.target.x() + SIZE / 2, e.target.y() + SIZE / 2) }}
      onDragEnd={(e) => { e.cancelBubble = true; onDragEnd?.(e.target.x() + SIZE / 2, e.target.y() + SIZE / 2) }}
    />
  )
}
