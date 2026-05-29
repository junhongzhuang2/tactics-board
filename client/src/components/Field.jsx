import { Layer, Rect, Line } from 'react-konva'

const FIELD_COLOR = '#2d5a27'
const END_ZONE_COLOR = '#1e3d1a'
const LINE_COLOR = '#ffffff'
const LINE_WIDTH = 2

const END_ZONE_LEFT = 0.18
const END_ZONE_RIGHT = 0.82

export default function Field({ fieldWidth, fieldHeight }) {
  const w = fieldWidth
  const h = fieldHeight

  return (
    <Layer listening={false}>
      {/* 背景 */}
      <Rect x={0} y={0} width={w} height={h} fill={FIELD_COLOR} />

      {/* 左端区 */}
      <Rect
        x={0} y={0}
        width={END_ZONE_LEFT * w} height={h}
        fill={END_ZONE_COLOR}
      />

      {/* 右端区 */}
      <Rect
        x={END_ZONE_RIGHT * w} y={0}
        width={(1 - END_ZONE_RIGHT) * w} height={h}
        fill={END_ZONE_COLOR}
      />

      {/* 外边框 */}
      <Rect
        x={0} y={0} width={w} height={h}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH} fill="transparent"
      />

      {/* 左端区线 */}
      <Line
        points={[END_ZONE_LEFT * w, 0, END_ZONE_LEFT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 右端区线 */}
      <Line
        points={[END_ZONE_RIGHT * w, 0, END_ZONE_RIGHT * w, h]}
        stroke={LINE_COLOR} strokeWidth={LINE_WIDTH}
      />

      {/* 中线（虚线） */}
      <Line
        points={[0.5 * w, 0, 0.5 * w, h]}
        stroke={LINE_COLOR} strokeWidth={1}
        dash={[8, 8]} opacity={0.4}
      />
    </Layer>
  )
}
