import { Circle } from 'react-konva'
import { orientationFromHandle, handleOffset, HANDLE_RADIUS, CONE_RADIUS } from '../utils/cone'

// 可拖小圆点；拖拽中只 onPreview（不写 store），松手 onCommit。
// 每次都把节点约束回固定半径，朝向由相对球员中心的位置算出。
export default function RotateHandle({ orientation, onPreview, onCommit }) {
  const pos = handleOffset(orientation, CONE_RADIUS)

  function compute(e) {
    const node = e.target
    const o = orientationFromHandle(node.x(), node.y())
    const snapped = handleOffset(o, CONE_RADIUS)
    node.position(snapped) // 约束回半径圆
    return o
  }

  return (
    <Circle
      x={pos.x}
      y={pos.y}
      radius={HANDLE_RADIUS}
      fill="#fff"
      stroke="#333"
      strokeWidth={1}
      draggable
      onDragMove={(e) => onPreview(compute(e))}
      onDragEnd={(e) => onCommit(compute(e))}
    />
  )
}
