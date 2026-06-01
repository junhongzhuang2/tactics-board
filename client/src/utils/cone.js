export const CONE_ANGLE_DEG = 90
export const CONE_RADIUS = 64
export const CONE_OPACITY = 0.2
export const HANDLE_RADIUS = 7

// 手柄相对球员中心的 canvas 偏移 → 朝向弧度
export function orientationFromHandle(dx, dy) {
  return Math.atan2(dy, dx)
}

// 朝向 → 手柄应处的 canvas 偏移（固定半径上）
export function handleOffset(orientation, radius) {
  return { x: Math.cos(orientation) * radius, y: Math.sin(orientation) * radius }
}

// 朝向（弧度）→ Konva Wedge 的 rotation（度），使扇形以朝向为中心
export function coneWedgeRotationDeg(orientation, coneAngleDeg) {
  return (orientation * 180) / Math.PI - coneAngleDeg / 2
}

// 面板出界裁切：右/底越界回退一个面板尺寸，再夹到 ≥0
export function clampPanel(x, y, panelW, panelH, viewW, viewH) {
  return {
    x: Math.max(0, x + panelW > viewW ? viewW - panelW : x),
    y: Math.max(0, y + panelH > viewH ? viewH - panelH : y),
  }
}
