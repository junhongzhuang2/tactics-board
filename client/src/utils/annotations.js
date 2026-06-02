export const MIN_ARROW_PX = 5
export const DEFAULT_ANNO_COLOR = '#ffeb3b'

// 新建箭头标注（带唯一 id；随机后缀避免同毫秒撞 id）
export function createArrowAnnotation(variant, x1, y1, x2, y2, color) {
  const id = `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return { id, type: 'arrow', variant, x1, y1, x2, y2, color }
}

// 当前应显示的标注：全局（始终）+ 活动帧的本帧标注，带归属信息（供选中/删除定位）
export function visibleAnnotations(data, activeFrameIndex) {
  const globals = (data.globalAnnotations ?? []).map((a) => ({ annotation: a, scope: 'global', frameIndex: null }))
  const frame = data.frames?.[activeFrameIndex]
  const frameAnnos = (frame?.annotations ?? []).map((a) => ({ annotation: a, scope: 'frame', frameIndex: activeFrameIndex }))
  return [...globals, ...frameAnnos]
}

// 两端物理屏幕像素距离（零长度拦截用）
export function arrowPixelLength(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

export const MIN_SHAPE_PX = 5
export const DEFAULT_FONT_PX = 16
export const ANNO_COLORS = ['#ffeb3b', '#ff5252', '#4a9eff', '#ffffff'] // 黄/红/蓝/白

// 唯一 id（随机后缀避免同毫秒撞 id）
function annoId() {
  return `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// 矩形/椭圆：归一化两角（拖拽起点/终点，可能反向），渲染时算包围盒
export function createRectAnnotation(x1, y1, x2, y2, color) {
  return { id: annoId(), type: 'rect', x1, y1, x2, y2, color }
}

export function createEllipseAnnotation(x1, y1, x2, y2, color) {
  return { id: annoId(), type: 'ellipse', x1, y1, x2, y2, color }
}

// 文字：单点锚（左上）+ 字符串；width 可选（归一化框宽，用于自动折行，缺省则只按 \n 换行）
export function createTextAnnotation(x, y, text, color, width) {
  return { id: annoId(), type: 'text', x, y, text, color, width }
}

// 平移：返回平移后的坐标 patch（dx,dy 归一化）
export function translateAnnotation(annotation, dx, dy) {
  if (annotation.type === 'text') {
    return { x: annotation.x + dx, y: annotation.y + dy }
  }
  const { x1, y1, x2, y2 } = annotation
  return { x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy }
}

// 包围盒顶边中点（浮动工具条定位用），归一化
export function annotationTopAnchor(annotation) {
  if (annotation.type === 'text') {
    return { x: annotation.x, y: annotation.y }
  }
  const { x1, y1, x2, y2 } = annotation
  return { x: (x1 + x2) / 2, y: Math.min(y1, y2) }
}
