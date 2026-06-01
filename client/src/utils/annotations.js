export const MIN_ARROW_PX = 5
export const DEFAULT_ANNO_COLOR = '#ffeb3b'

// 新建箭头标注（带唯一 id）
export function createArrowAnnotation(variant, x1, y1, x2, y2, color) {
  return { id: `anno-${Date.now()}`, type: 'arrow', variant, x1, y1, x2, y2, color }
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
