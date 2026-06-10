import { Group, Rect, Line, Text } from 'react-konva'

const FIELD_COLOR = '#2d5a27'
const LINE_COLOR = 'rgba(255,255,255,0.45)'
const EZ_TEXT_COLOR = 'rgba(255,255,255,0.25)'
const LINE_WIDTH = 2

const END_ZONE_LEFT = 0.18
const END_ZONE_RIGHT = 0.82
const EZ_FONT = 16

export default function Field({ fieldWidth, fieldHeight }) {
  const w = fieldWidth
  const h = fieldHeight

  return (
    <Group listening={false}>
      {/* 背景（整场同绿，不再有暗色端区块）+ 大而柔的向下投影，使球场浮在中心光池之上
          （在静态 Field 图层，只画一次，不影响播放性能） */}
      <Rect
        x={0} y={0} width={w} height={h} fill={FIELD_COLOR}
        shadowColor="#000000" shadowBlur={44}
        shadowOffset={{ x: 0, y: 20 }} shadowOpacity={0.6}
      />

      {/* 外边框（浅白） */}
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

      {/* 左端区竖排 END ZONE 文字（绕中心旋转 -90，居中于左端区） */}
      <Text
        text="END ZONE"
        fontSize={EZ_FONT} fontStyle="bold" fill={EZ_TEXT_COLOR}
        width={h} height={EZ_FONT} align="center"
        offsetX={h / 2} offsetY={EZ_FONT / 2}
        rotation={-90}
        x={(END_ZONE_LEFT / 2) * w} y={h / 2}
      />

      {/* 右端区竖排 END ZONE 文字 */}
      <Text
        text="END ZONE"
        fontSize={EZ_FONT} fontStyle="bold" fill={EZ_TEXT_COLOR}
        width={h} height={EZ_FONT} align="center"
        offsetX={h / 2} offsetY={EZ_FONT / 2}
        rotation={-90}
        x={((END_ZONE_RIGHT + 1) / 2) * w} y={h / 2}
      />
    </Group>
  )
}
