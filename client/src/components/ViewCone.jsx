import { Wedge } from 'react-konva'
import { coneWedgeRotationDeg, CONE_ANGLE_DEG, CONE_RADIUS, CONE_OPACITY } from '../utils/cone'

// 半透明扇形，以 orientation 为中心方向；不拦截事件
export default function ViewCone({ orientation, color }) {
  return (
    <Wedge
      radius={CONE_RADIUS}
      angle={CONE_ANGLE_DEG}
      rotation={coneWedgeRotationDeg(orientation, CONE_ANGLE_DEG)}
      fill={color}
      opacity={CONE_OPACITY}
      listening={false}
    />
  )
}
