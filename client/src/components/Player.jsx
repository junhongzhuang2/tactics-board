import { useState } from 'react'
import { Circle, Text, Group } from 'react-konva'
import { toCanvas, toNorm, clampToField } from '../utils/coords'
import ViewCone from './ViewCone'
import RotateHandle from './RotateHandle'

const TEAM_COLORS = { red: '#e53935', blue: '#1e88e5' }
const PLAYER_RADIUS = 18
const FONT_SIZE = 13

export default function Player({
  player,           // { id, team, number, name, showCone }
  playerState,      // { x, y, orientation } — normalized
  fieldWidth,
  fieldHeight,
  onDragEnd,        // (playerId, newNormState) => void
  onDoubleClick,    // (playerId) => void
  onSelect,         // (playerId) => void
  onRotate,         // (orientation) => void  — 仅松手时调用一次
  editable = false,
  draggable = true,
}) {
  const [dragOrientation, setDragOrientation] = useState(null)
  const { x: cx, y: cy } = toCanvas(playerState.x, playerState.y, fieldWidth, fieldHeight)
  const color = TEAM_COLORS[player.team] ?? '#999'
  const label = player.name.length <= 3 ? player.name : player.name.slice(0, 3)
  const coneOrientation = dragOrientation ?? playerState.orientation

  function handleDragEnd(e) {
    const node = e.target
    const norm = toNorm(node.x(), node.y(), fieldWidth, fieldHeight)
    const clamped = clampToField(norm.x, norm.y)
    node.position(toCanvas(clamped.x, clamped.y, fieldWidth, fieldHeight))
    onDragEnd(player.id, { ...playerState, x: clamped.x, y: clamped.y })
  }

  return (
    <Group
      x={cx} y={cy}
      draggable={draggable}
      onDragEnd={handleDragEnd}
      onDblClick={() => onDoubleClick?.(player.id)}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(player.id) }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(player.id) }}
    >
      {player.showCone && <ViewCone orientation={coneOrientation} color={color} />}
      <Circle radius={PLAYER_RADIUS} fill={color} stroke="#fff" strokeWidth={2} />
      <Text
        text={label}
        fontSize={FONT_SIZE}
        fill="#fff"
        fontStyle="bold"
        width={PLAYER_RADIUS * 2}
        height={PLAYER_RADIUS * 2}
        x={-PLAYER_RADIUS}
        y={-PLAYER_RADIUS}
        align="center"
        verticalAlign="middle"
      />
      {player.showCone && editable && (
        <RotateHandle
          orientation={coneOrientation}
          onPreview={(o) => setDragOrientation(o)}
          onCommit={(o) => { setDragOrientation(null); onRotate?.(o) }}
        />
      )}
    </Group>
  )
}
