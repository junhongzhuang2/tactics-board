import { Layer } from 'react-konva'
import ArrowAnnotation from './ArrowAnnotation'
import RectAnnotation from './RectAnnotation'
import EllipseAnnotation from './EllipseAnnotation'
import TextAnnotation from './TextAnnotation'

// 单一分发来源：entries 与 draft 预览共用。key 取自 annotation.id（draft 用 '__draft__'）。
function renderAnnotation(annotation, props) {
  switch (annotation.type) {
    case 'rect':
      return <RectAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'ellipse':
      return <EllipseAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'text':
      return <TextAnnotation key={annotation.id} annotation={annotation} {...props} />
    case 'arrow':
    default:
      return <ArrowAnnotation key={annotation.id} annotation={annotation} {...props} />
  }
}

// 渲染「全局 + 活动帧」标注（entries）+ 绘制预览（draft）。
export default function AnnotationLayer({
  x, y, entries, draft, draftType, draftVariant, draftColor, tool,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete, onEdit,
}) {
  const textTool = tool === 'text'
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) =>
        renderAnnotation(annotation, {
          fieldWidth,
          fieldHeight,
          selected: annotation.id === selectedId,
          onSelect,
          onDelete: () => onDelete(scope, frameIndex, annotation.id),
          onEdit: () => onEdit?.(scope, frameIndex, annotation),
          // 文字工具下，形状/箭头不监听点击 → 让点击穿透到 Stage，可在图形内部放置文字；
          // 文字标注始终监听（保留双击编辑）。
          listening: annotation.type === 'text' ? true : !textTool,
        })
      )}
      {draft && draftType !== 'text' &&
        renderAnnotation(
          { id: '__draft__', type: draftType, variant: draftVariant, color: draftColor, ...draft },
          { fieldWidth, fieldHeight, selected: false }
        )}
    </Layer>
  )
}
