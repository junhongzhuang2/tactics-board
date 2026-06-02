import { Layer } from 'react-konva'
import ArrowAnnotation from './ArrowAnnotation'

// 渲染「全局 + 活动帧」标注（entries）+ 绘制预览（draft）。
export default function AnnotationLayer({
  x, y, entries, draft, draftVariant, draftColor,
  fieldWidth, fieldHeight, selectedId, onSelect, onDelete,
}) {
  return (
    <Layer x={x} y={y}>
      {entries.map(({ annotation, scope, frameIndex }) => (
        <ArrowAnnotation
          key={annotation.id}
          annotation={annotation}
          fieldWidth={fieldWidth}
          fieldHeight={fieldHeight}
          selected={annotation.id === selectedId}
          onSelect={onSelect}
          onDelete={() => onDelete(scope, frameIndex, annotation.id)}
        />
      ))}
      {draft && (
        <ArrowAnnotation
          annotation={{ id: '__draft__', variant: draftVariant, color: draftColor, ...draft }}
          fieldWidth={fieldWidth}
          fieldHeight={fieldHeight}
          selected={false}
        />
      )}
    </Layer>
  )
}
