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
  x, y, entries, draft, draftType, draftVariant, draftColor, tool, dragPreview,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete, onEdit, onMove, onResizePreview, onResizeCommit,
}) {
  const textTool = tool === 'text'
  const isSelectTool = tool === 'none'
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) => {
        // 拖句柄改尺寸时按预览坐标渲染（不入 store/历史）
        const anno = dragPreview?.id === annotation.id ? { ...annotation, ...dragPreview.patch } : annotation
        return renderAnnotation(anno, {
          fieldWidth,
          fieldHeight,
          selected: annotation.id === selectedId,
          // 文字工具下，形状/箭头不监听点击 → 让点击穿透到 Stage 放文字；文字标注始终监听（双击编辑）。
          listening: annotation.type === 'text' ? true : !textTool,
          // 选择工具下才可拖动移动
          draggable: isSelectTool,
          onSelect,
          onDelete: () => onDelete(scope, frameIndex, annotation.id),
          onEdit: () => onEdit?.(scope, frameIndex, annotation),
          onMoveCommit: (patch) => onMove?.(scope, frameIndex, annotation.id, patch),
          onResizePreview: (patch) => onResizePreview?.(annotation.id, patch),
          onResizeCommit: (patch) => onResizeCommit?.(scope, frameIndex, annotation.id, patch),
        })
      })}
      {draft && draftType !== 'text' &&
        renderAnnotation(
          { id: '__draft__', type: draftType, variant: draftVariant, color: draftColor, ...draft },
          { fieldWidth, fieldHeight, selected: false }
        )}
    </Layer>
  )
}
