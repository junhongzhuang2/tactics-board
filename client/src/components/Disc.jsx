import { Circle, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'

const DISC_RADIUS = 14

export default function Disc({
  discState,      // { x, y } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,      // (newNormState) => void
  draggable = true,
}) {
  const { x: cx, y: cy } = toCanvas(discState.x, discState.y, fieldWidth, fieldHeight)

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd({ x: clamped.x, y: clamped.y })
  }

  return (
    <Group x={cx} y={cy} draggable={draggable} onDragEnd={handleDragEnd}>
      <Circle radius={DISC_RADIUS} fill="#f5c518" stroke="#c8a000" strokeWidth={2} />
      <Circle radius={DISC_RADIUS * 0.55} fill="transparent" stroke="#c8a000" strokeWidth={1.5} />
    </Group>
  )
}
