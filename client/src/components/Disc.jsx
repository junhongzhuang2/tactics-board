import { memo } from 'react'
import { Circle, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'

const DISC_RADIUS = 14

function Disc({
  discId,
  discState,      // { x, y } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,      // (discId, newNormState) => void
  onContextMenu,  // (discId) => void
  onSelect,       // (discId) => void
  draggable = true,
}) {
  const { x: cx, y: cy } = toCanvas(discState.x, discState.y, fieldWidth, fieldHeight)

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd(discId, { x: clamped.x, y: clamped.y })
  }

  return (
    <Group
      x={cx}
      y={cy}
      draggable={draggable}
      onDragEnd={handleDragEnd}
      onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; onContextMenu?.(discId) }}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(discId) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(discId) }}
    >
      <Circle
        radius={DISC_RADIUS} fill="#f5c518" stroke="#c8a000" strokeWidth={2}
        shadowColor="black" shadowBlur={8}
        shadowOffset={{ x: 2, y: 5 }} shadowOpacity={0.4}
      />
      <Circle radius={DISC_RADIUS * 0.55} fill="transparent" stroke="#c8a000" strokeWidth={1.5} />
    </Group>
  )
}

export default memo(Disc)
